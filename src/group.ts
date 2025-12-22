import { defineTemplate } from './template'
import { DeletionPolicy, type BasicSparseSet, type SparseSetConstructor, type SparseSetPointer } from './sparse-set'
import type { BasicStorageConstructor, EntityStorage, EntityStorageConstructor, Storage } from './storage'
import { Disposable } from './disposable'
import { commonType, type ExtractStorageElement, type ExtractStorageEntity, type ExtractStorageVersion } from './view'
import { RangeIterator, type ReversePointer, toIterator, type ForwardPointer } from './iterator'
import stableHash from 'stable-hash'
import type { BasicSighMixin } from './mixin'
import { createSafeNew, type SafeInstanceType } from './config'
import { AssertionError, defaultSort } from './util'

class ExtendedGroupPointer<It extends SparseSetPointer<any>, const Owned extends Array<Storage<any, any, any> | EntityStorage<any, any>>, const Get extends Array<Storage<any, any, any> | EntityStorage<any, any>>> implements ForwardPointer<any, ExtendedGroupPointer<It, Owned, Get>> {
  private readonly it: It
  private owned: Owned
  private get: Get

  get pools(): [...Owned, ...Get] {
    return [...this.owned, ...this.get]
  }

  private indexToElement<T> (cpool: Storage<any, any, any> | EntityStorage<any, any>): T[] {
    const ValueType = (cpool.constructor as BasicStorageConstructor<any, any> | EntityStorageConstructor<any>).ValueType
    if (ValueType == null) {
      return []
    }
    return [cpool.rbegin().access(this.it.index())]
  }

  constructor(It: typeof SparseSetPointer)
  constructor(from: It, owned: Owned, get: Get)
  constructor(it: It | typeof SparseSetPointer, owned?: Owned, get?: Get) {
    if (it && owned && get) {
      this.it = (it as It).clone() as It
      this.owned = owned
      this.get = get
    } else {
      this.it = new (it as typeof SparseSetPointer) as It
      this.owned = [] as unknown as Owned
      this.get = [] as unknown as Get
    }
  }

  selfPlus(): this {
    this.it.selfPlus()
    return this
  }

  write(value: unknown): unknown {
    this.it.write(value)
    return value
  }

  deref() {
    const entity = this.it.deref()
    
    return [entity, ...this.owned.flatMap(o => this.indexToElement(o)), ...this.get.flatMap(g => g.getAsTuple(this.it.deref()))]
  }

  equals(other: ExtendedGroupPointer<It, Owned, Get>): boolean {
    return this.it.equals(other.it)
  }

  clone(target?: ExtendedGroupPointer<It, Owned, Get>): ExtendedGroupPointer<It, Owned, Get> {
    if (target) {
      if (this === target) return target
      this.it.clone(target.it)
      this.owned = target.owned.slice() as Owned
      this.get = target.get.slice() as Get
      return target
    }
    return new ExtendedGroupPointer(this.it, this.owned, this.get)
  }

  swap(other: ExtendedGroupPointer<It, Owned, Get>): void {
    if (this === other) return
    this.it.swap(other.it)
    const tmpOwned = this.owned
    this.owned = other.owned
    other.owned = tmpOwned
    const tmpGet = this.get
    this.get = other.get
    other.get = tmpGet
  }

  base() {
    return this.it.clone()
  }
}

export class GroupDescriptor extends Disposable {
  /** @virtual */
  owned (_id: any): boolean {
    return false
  }
}

export interface GroupHandlerTemplate {
  <T extends SparseSetConstructor<any>> (
    Type: T,
    Get: number,
    Exclude: number
  ): GroupHandlerConstructor<T>
  <T extends SparseSetConstructor<any>> (
    Type: T,
    Owned: 0,
    Get: number,
    Exclude: number
  ): GroupHandlerConstructor<T>
  <T extends SparseSetConstructor<any>> (
    Type: T,
    Owned: number,
    Get: number,
    Exclude: number
  ): OwningGroupHandlerConstructor<T>
}

export interface OwningGroupHandlerConstructor<T extends SparseSetConstructor<any>> {
  EntityType: T['EntityType']
  CommonType: T
  new (
    ogpool: Array<BasicSighMixin<Storage<any, SafeInstanceType<T['EntityType']>, SafeInstanceType<T['TraitsType']['VersionType']>>, any, SafeInstanceType<T['EntityType']>>>,
    epool: Array<BasicSighMixin<Storage<any, SafeInstanceType<T['EntityType']>, SafeInstanceType<T['TraitsType']['VersionType']>>, any, SafeInstanceType<T['EntityType']>>>
  ): OwningGroupHandler<T['EntityType'], SafeInstanceType<T['TraitsType']['VersionType']>>
}

export interface GroupHandlerConstructor<T extends SparseSetConstructor<any>> {
  EntityType: T['EntityType']
  CommonType: T
  new (
    gpool: Array<BasicSighMixin<Storage<any, SafeInstanceType<T['EntityType']>, SafeInstanceType<T['TraitsType']['VersionType']>>, any, SafeInstanceType<T['EntityType']>>>,
    epool: Array<BasicSighMixin<Storage<any, SafeInstanceType<T['EntityType']>, SafeInstanceType<T['TraitsType']['VersionType']>>, any, SafeInstanceType<T['EntityType']>>>
  ): GroupHandler<T['EntityType'], SafeInstanceType<T['TraitsType']['VersionType']>>
}

export interface GroupHandler<E, V> extends GroupDescriptor {
  handle(): BasicSparseSet<E, V>
  storage (index: number): BasicSparseSet<E, V>
}

export interface OwningGroupHandler<E, V> extends GroupDescriptor {
  length (): number
  storage (index: number): BasicSparseSet<E, V>
}

const groupHandlerTemplate = defineTemplate<GroupHandlerTemplate>(function<T extends SparseSetConstructor<any>> (
  Type: T,
  Owned: number,
  Get: number,
  Exclude: number
) {
  type E = SafeInstanceType<T['EntityType']>
  class GroupHandler extends GroupDescriptor {
    static EntityType = Type.EntityType

    private readonly pools: Array<Storage<any, any, any>>
    private readonly filter: Array<Storage<any, any, any>>
    private len: number

    private swapElements (pos: number, entt: E): void {
      for (let next = 0; next < Owned; ++next) {
        this.pools[next].swapElements(this.pools[next].access(pos), entt)
      }
    }

    private pushOnConstruct (entt: E): void {
      const pos = this.len
      if (((...args: Array<Storage<any, any, any>>) => {
        const [cpool, ...other] = args
        return cpool.contains(entt) && !(cpool.index(entt) < pos) && other.every(o => o.contains(entt))
      })(...this.pools) &&
          ((...cpool: any[]) => cpool.every(c => !c.contains(entt)))(...this.filter)) {
        this.swapElements(this.len++, entt)
      }
    }

    private pushOnDestroy (entt: E): void {
      const pos = this.len
      if (((...args: Array<Storage<any, any, any>>) => {
        const [cpool, ...other] = args
        return cpool.contains(entt) && !(cpool.index(entt) < pos) && other.every(o => o.contains(entt))
      })(...this.pools) &&
          ((...cpool: any[]) => (cpool.reduce((p, c) => p + Number(c.contains(entt)), 0) === 1))(...this.filter)) {
        this.swapElements(this.len++, entt)
      }
    }

    private removeIf (entt: E): void {
      const pools = this.pools
      if (pools[0].contains(entt) && (pools[0].index(entt) < this.len)) {
        this.swapElements(--this.len, entt)
      }
    }

    private commonSetup (): void {
      const pools = this.pools
      for (const first = Type.prototype.rbegin.call(pools[0]), last = first.plus(pools[0].size); !first.equals(last); first.selfPlus()) {
        this.pushOnConstruct(first.deref())
      }
    }

    CommonType = Type
    
    constructor (ogpool: Array<BasicSighMixin<Storage<any, E, any>, any, E>>, epool: Array<BasicSighMixin<Storage<any, E, any>, any, E>>) {
      super()
      this.pools = Array(Owned + Get)
      this.filter = Array(Exclude)
      for (let i = 0; i < Owned + Get; ++i) {
        this.pools[i] = ogpool[i]
      }
      for (let i = 0; i < Exclude; ++i) {
        this.filter[i] = epool[i]
      }
      this.len = 0

      ogpool.forEach(cpool => {
        cpool.onConstruct().connect(function (this: GroupHandler, _, entt) { GroupHandler.prototype.pushOnConstruct.call(this, entt) }, this)
        cpool.onDestroy().connect(function (this: GroupHandler, _, entt) { GroupHandler.prototype.removeIf.call(this, entt) }, this)
      })

      epool.forEach(cpool => {
        cpool.onConstruct().connect(function (this: GroupHandler, _, entt) { GroupHandler.prototype.removeIf.call(this, entt) }, this)
        cpool.onDestroy().connect(function (this: GroupHandler, _, entt) { GroupHandler.prototype.pushOnDestroy.call(this, entt) }, this)
      })

      this.commonSetup()
    }

    owned (t: any): boolean {
      for (let pos = 0; pos < Owned; ++pos) {
        if (Object.is(this.pools[pos].type(), t) || stableHash(this.pools[pos].type()) === t) {
          return true
        }
      }
      return false
    }

    length () {
      return this.len
    }

    storage (index: number) {
      if (index < (Owned + Get)) {
        return this.pools[index]
      } else {
        return this.filter[index - (Owned + Get)]
      }
    }
  }
  return GroupHandler
}, [
  {
    predicate: (_0, Owned: number, _2, Exclude) => (Owned === 0 || Exclude === undefined),
    render: <T extends SparseSetConstructor<any>>(Type: T, Owned: number, Get: number, Exclude: number) => {
      type E = SafeInstanceType<T['EntityType']>
      if (Exclude === undefined) {
        Exclude = Get
        Get = Owned
        Owned = 0
      }
      const newType = createSafeNew(Type)

      class GroupHandler extends GroupDescriptor {
        static EntityType = Type.EntityType

        private readonly pools: Array<Storage<any, E, any>>
        private readonly filter: Array<Storage<any, E, any>>
        private readonly elem: BasicSparseSet<E, any>

        private pushOnConstruct (entt: E): void {
          if (!this.elem.contains(entt)
              && this.pools.every(c => c.contains(entt))
              && this.filter.every(f => !f.contains(entt))) {
            this.elem.push(entt)
          }
        }

        private pushOnDestroy (entt: E): void {
          if (this.elem.contains(entt)
              && this.pools.every(c => c.contains(entt))
              && (this.filter.reduce((c, f) => (c + Number(f.contains(entt))), 0) === 1)) {
            this.elem.remove(entt)
          }
        }

        private removeIf (entt: E): void {
          this.elem.remove(entt)
        }

        private commonSetup (): void {
          const begin = Type.prototype.begin.call(this.pools[0])
          const end = Type.prototype.end.call(this.pools[0])
          const jsIt = toIterator(begin, end)
          for (const entity of jsIt) {
            this.pushOnConstruct(entity)
          }
        }

        static CommonType = Type

        constructor (gpool: Array<BasicSighMixin<Storage<any, E, any>, any, E>>, epool: Array<BasicSighMixin<Storage<any, E, any>, any, E>>) {
          super()

          this.pools = Array(Get)
          this.filter = Array(Exclude)
          for (let i = 0; i < Get; ++i) {
            this.pools[i] = gpool[i]
          }
          for (let i = 0; i < Exclude; ++i) {
            this.filter[i] = epool[i]
          }
          this.elem = newType() as BasicSparseSet<E, any>
          gpool.forEach(cpool => {
            cpool.onConstruct().connect(function (this: GroupHandler, _, entt) { GroupHandler.prototype.pushOnConstruct.call(this, entt) }, this)
            cpool.onDestroy().connect(function (this: GroupHandler, _, entt) { GroupHandler.prototype.removeIf.call(this, entt) }, this)
          })

          epool.forEach(cpool => {
            cpool.onConstruct().connect(function (this: GroupHandler, _, entt) { GroupHandler.prototype.removeIf.call(this, entt) }, this)
            cpool.onDestroy().connect(function (this: GroupHandler, _, entt) { GroupHandler.prototype.pushOnDestroy.call(this, entt) }, this)
          })

          this.commonSetup()
        }

        handle () {
          return this.elem
        }

        storage (index: number) {
          if (index < Get) {
            return this.pools[index]
          } else {
            return this.filter[index - Get]
          }
        }
      }

      return GroupHandler
    }
  }
])

// Non-owning group interface
export interface NonOwningGroup<
  Get extends Array<Storage<any, any, any> | EntityStorage<any, any>>,
  Exclude extends Array<Storage<any, any, any> | EntityStorage<any, any>>,
  E = ExtractStorageEntity<Get[number]>,
  V = ExtractStorageVersion<Get[number]>
> extends Iterable<E> {
  handle(): BasicSparseSet<E, V> | null
  storage<Index extends number> (index: Index): [...Get, ...Exclude][Index] | null
  storage<T extends Function> (ElementType: T): ([SafeInstanceType<T>] extends [E] ? EntityStorage<SafeInstanceType<T>, V> : Storage<SafeInstanceType<T>, E, V>) | null
  size(): number
  capacity(): number
  empty(): boolean
  begin(): SparseSetPointer<E>
  end(): SparseSetPointer<E>
  rbegin(): ReversePointer<SparseSetPointer<E>>
  rend(): ReversePointer<SparseSetPointer<E>>
  front(): E
  back(): E
  access (pos: number): E
  ok(): boolean
  find(entt: E): SparseSetPointer<E>
  contains(entt: E): boolean
  get<const Types extends Function[]>(entt: E, ...types: Types): Types['length'] extends 0 ? { [K in keyof Get]: ExtractStorageElement<Get[K]> } : Types['length'] extends 1 ? SafeInstanceType<Types[0]> : { [K in keyof Types]: SafeInstanceType<Types[K]> }
  getByIndexes<const Indexes extends number[]>(entt: E, ...indexes: Indexes): Indexes['length'] extends 0 ? { [K in keyof Get]: ExtractStorageElement<Get[K]> } : Indexes['length'] extends 1 ? ExtractStorageElement<Get[Indexes[0]]> : { [K in keyof Indexes]: ExtractStorageElement<Get[Indexes[K]]> }
  each<ComponentsOnly extends boolean = false>(
    func: ComponentsOnly extends true
      ? (...components: { [K in keyof Get]: ExtractStorageElement<Get[K]> }) => void
      : (...components: [E, ...{ [K in keyof Get]: ExtractStorageElement<Get[K]> }]) => void,
    componentsOnly?: ComponentsOnly
  ): void
  each(): IterableIterator<[E, ...{ [K in keyof Get]: ExtractStorageElement<Get[K]> }]>
  sort<const Types extends Function[], X = Types['length'] extends 0 ? E : { [K in keyof Types]: SafeInstanceType<Types[K]> }> (compareFn: (lhs: X, rhs: X) => number, types: Types, algo?: (arr: E[], compare?: (a: E, b: E) => number) => E[]): void
  sortByIndexes<const Indexes extends number[], X = Indexes['length'] extends 0 ? E : { [K in keyof Indexes]: ExtractStorageElement<Get[Indexes[K]]> }> (compareFn: (lhs: X, rhs: X) => number, indexes: Indexes, algo?: (arr: E[], compare?: (a: E, b: E) => number) => E[]): void
  sortAs (first: ForwardPointer<any, any>, last: ForwardPointer<any, any>): void
}

// Owning group interface
export interface OwningGroup<
  Owned extends Array<Storage<any, any, any> | EntityStorage<any, any>>,
  Get extends Array<Storage<any, any, any> | EntityStorage<any, any>>,
  Exclude extends Array<Storage<any, any, any> | EntityStorage<any, any>>,
  E = ExtractStorageEntity<[...Owned, ...Get][number]>,
  V = ExtractStorageVersion<[...Owned, ...Get][number]>
> extends Iterable<ExtractStorageEntity<Owned[number]>> {
  handle(): BasicSparseSet<E, V> | null
  storage<Index extends number> (index: Index): [...Owned, ...Get, ...Exclude][Index] | null
  storage<T extends Function> (ElementType: T): ([SafeInstanceType<T>] extends [E] ? EntityStorage<SafeInstanceType<T>, V> : Storage<SafeInstanceType<T>, E, V>) | null
  size(): number
  empty(): boolean
  begin(): SparseSetPointer<E>
  end(): SparseSetPointer<E>
  rbegin(): ReversePointer<SparseSetPointer<E>>
  rend(): ReversePointer<SparseSetPointer<E>>
  front(): E
  back(): E
  access (pos: number): E
  ok(): boolean
  find(entt: E): SparseSetPointer<E>
  contains(entt: E): boolean
  get<const Types extends Function[]>(entt: E, ...types: Types): Types['length'] extends 0 ? { [K in keyof [...Owned, ...Get]]: ExtractStorageElement<[...Owned, ...Get][K]> } : Types['length'] extends 1 ? SafeInstanceType<Types[0]> : { [K in keyof Types]: SafeInstanceType<Types[K]> }
  getByIndexes<const Indexes extends number[]>(entt: E, ...indexes: Indexes): Indexes['length'] extends 0 ? { [K in keyof [...Owned, ...Get]]: ExtractStorageElement<[...Owned, ...Get][K]> } : Indexes['length'] extends 1 ? ExtractStorageElement<[...Owned, ...Get][Indexes[0]]> : { [K in keyof Indexes]: ExtractStorageElement<[...Owned, ...Get][Indexes[K]]> }
  each<ComponentsOnly extends boolean = false>(
    func: ComponentsOnly extends true
      ? (...args: [...{ [K in keyof Owned]: ExtractStorageElement<Owned[K]> }, ...{ [K in keyof Get]: ExtractStorageElement<Get[K]> }]) => void
      : (...args: [E, ...{ [K in keyof Owned]: ExtractStorageElement<Owned[K]> }, ...{ [K in keyof Get]: ExtractStorageElement<Get[K]> }]) => void,
    componentsOnly?: ComponentsOnly
  ): void
  each(): IterableIterator<[E, ...{ [K in keyof Owned]: ExtractStorageElement<Owned[K]> }, ...{ [K in keyof Get]: ExtractStorageElement<Get[K]> }]>
  sort<const Types extends Function[], X = Types['length'] extends 0 ? E : { [K in keyof Types]: SafeInstanceType<Types[K]> }> (compareFn: (lhs: X, rhs: X) => number, types: Types, algo?: (arr: E[], compare?: (a: E, b: E) => number) => E[]): void
  sortByIndexes<const Indexes extends number[], X = Indexes['length'] extends 0 ? E : { [K in keyof Indexes]: ExtractStorageElement<[...Owned, ...Get][Indexes[K]]> }> (compareFn: (lhs: X, rhs: X) => number, indexes: Indexes, algo?: (arr: E[], compare?: (a: E, b: E) => number) => E[]): void
}

export interface NonOwningGroupConstructor<Get extends Array<Storage<any, any, any>>, Exclude extends Array<Storage<any, any, any>>> {
  Handler: GroupHandlerConstructor<SparseSetConstructor<ExtractStorageEntity<Get[number]>>>
  groupId(): string
  new (handler?: GroupHandler<ExtractStorageEntity<Get[number]>, ExtractStorageVersion<Get[number]>>): NonOwningGroup<Get, Exclude>
  prototype: NonOwningGroup<Get, Exclude>
}

export interface OwningGroupConstructor<Owned extends Array<Storage<any, any, any>>, Get extends Array<Storage<any, any, any>>, Exclude extends Array<Storage<any, any, any>>> {
  Handler: OwningGroupHandlerConstructor<SparseSetConstructor<ExtractStorageEntity<[...Owned, ...Get][number]>>>
  groupId(): string
  new (handler?: OwningGroupHandler<ExtractStorageEntity<[...Owned, ...Get][number]>, ExtractStorageVersion<[...Owned, ...Get][number]>>): OwningGroup<Owned, Get, Exclude>
  prototype: OwningGroup<Owned, Get, Exclude>
}

export interface GroupTemplate {
  <
    const Owned extends Array<Storage<any, any, any>>,
    const Get extends Array<Storage<any, any, any>>,
    const Exclude extends Array<Storage<any, any, any>>
  >(
    owned: Owned,
    get: Get,
    exclude: Exclude
  ): Owned['length'] extends 0 
    ? NonOwningGroupConstructor<Get, Exclude>
    : OwningGroupConstructor<Owned, Get, Exclude>
}

export const basicGroupTemplate = defineTemplate<GroupTemplate>(function (
  _owned: Array<Storage<any, any, any>>,
  _get: Array<Storage<any, any, any>>,
  _exclude: Array<Storage<any, any, any>>
): any {
  throw new Error('Invalid BasicGroup instantiation')
}, [
  // Non-owning group specialization (no owned types)
  {
    predicate: (owned: Array<Storage<any, any, any>>, get: Array<Storage<any, any, any>>, exclude: Array<Storage<any, any, any>>) => (owned.length === 0 || owned == null || (Array.isArray(owned) && Array.isArray(get) && exclude === undefined)),
    render(owned: Array<Storage<any, any, any>>, get: Array<Storage<any, any, any>>, exclude: Array<Storage<any, any, any>>) {
      if (Array.isArray(owned) && Array.isArray(get) && exclude === undefined) {
        exclude = get
        get = owned
      }
      const BaseType = commonType(...get.map(g => (g.constructor as any).BaseType), ...exclude.map(e => (e.constructor as any).BaseType))
      const UnderlyingType = BaseType.EntityType
      const Handler = groupHandlerTemplate.instantiate(BaseType, 0, get.length, exclude.length)

      if (get.length === 0) {
        throw new Error('Non-owning group must have at least one get type')
      }

      class BasicGroup {
        static BaseType = BaseType
        static UnderlyingType = UnderlyingType

        private static indexOf (T: any): number {
          return [...get.map(g => (g.constructor as any).ElementType), ...exclude.map(e => (e.constructor as any).ElementType)].indexOf(T)
        }

        private poolsFor (...indexes: number[]): Array<BasicSparseSet<any, any>> {
          return this.descriptor ? indexes.map(i => this.descriptor!.storage(i)!) : []
        }

        static EntityType = UnderlyingType
        static CommonType = BaseType
        static Iterator = BaseType.Iterator
        static ReverseIterator = BaseType.ReverseIterator
        static Handler = Handler

        descriptor: InstanceType<typeof Handler> | null

        static groupId(): string {
          return stableHash(['non-owning', ...get, ...exclude])
        }

        constructor(handler?: InstanceType<typeof Handler>) {
          this.descriptor = handler ?? null
        }

        handle (): BasicSparseSet<any, any> {
          return this.descriptor!.handle()
        }

        storage (index: number): Storage<any, any, any> | EntityStorage<any, any> | null
        storage<T extends Function> (ElementType: T): Storage<SafeInstanceType<T>, any, any> | EntityStorage<SafeInstanceType<T>, any> | null
        storage (ElementType: number | Function): Storage<any, any, any> | EntityStorage<any, any> | null {
          if (typeof ElementType === 'number') {
            return this.ok() ? this.descriptor!.storage(ElementType) as any : null
          }
          return this.storage(BasicGroup.indexOf(ElementType)) as any
        }

        ok () {
          return this.descriptor != null
        }

        get size (): number {
          return this.ok() ? this.handle().size : 0
        }

        capacity (): number {
          return this.ok() ? (this.handle() as unknown as Storage<any, any, any>).capacity() : 0
        }

        empty (): boolean {
          return !this.ok() || this.handle().empty()
        }

        begin () {
          return this.ok() ? this.handle().begin() : new BaseType.Iterator()
        }

        end () {
          return this.ok() ? this.handle().end() : new BaseType.Iterator()
        }

        rbegin () {
          return this.ok() ? this.handle().rbegin() : new BaseType.ReverseIterator(new BaseType.Iterator())
        }

        rend () {
          return this.ok() ? this.handle().rend() : new BaseType.ReverseIterator(new BaseType.Iterator())
        }

        front (): any {
          const it = this.begin()
          return !it.equals(this.end()) ? it.deref() : BaseType.TraitsType.null
        }

        back (): any {
          const rit = this.rbegin()
          return !rit.equals(this.rend()) ? rit.deref() : BaseType.TraitsType.null
        }

        find (entt: any) {
          return this.ok() ? this.handle().find(entt) : new BaseType.Iterator()
        }

        access (pos: number): any {
          return this.begin().access(pos)
        }

        contains(entt: any): boolean {
          return this.ok() && this.handle().contains(entt)
        }

        get(entt: any, ...types: any[]): any {
          return this.getByIndexes(entt, ...types.map(t => BasicGroup.indexOf(t)))
        }

        getByIndexes(entt: any, ...indexes: number[]): any {
          const cpools = this.poolsFor(...Array.from({ length: get.length }, (_, i) => i)) as Array<Storage<any, any, any> | EntityStorage<any, any>>

          if (indexes.length === 0) {
            return cpools.flatMap(c => c.getAsTuple(entt))
          } else if (indexes.length === 1) {
            return cpools[indexes[0]].get(entt)
          } else {
            return indexes.flatMap(i => cpools[i].getAsTuple(entt))
          }
        }

        each(func?: (entt: any, ...components: any[]) => void, componentsOnly?: boolean): any {
          if (typeof func === 'function') {
            for (const entt of this) {
              const components = this.get(entt)
              if (componentsOnly) {
                func.apply(this, components)
              } else {
                func.call(this, entt, ...components)
              }
            }
          } else {
            const cpools = this.poolsFor(...Array.from({ length: get.length }, (_, i) => i)) as Array<Storage<any, any, any> | EntityStorage<any, any>>
            return new RangeIterator(new ExtendedGroupPointer(this.begin(), [], cpools), new ExtendedGroupPointer(this.end(), [], cpools))
          }
        }

        [Symbol.iterator](): RangeIterator<any, any> {
          return toIterator(this)
        }

        sort (compareFn: (lhs: any, rhs: any) => number, types: any[], algo = defaultSort): void {
          this.sortByIndexes(compareFn, types.map(t => BasicGroup.indexOf(t)), algo)
        }

        sortByIndexes (compareFn: (lhs: any, rhs: any) => number, indexes: number[], algo = defaultSort): void {
          if (!this.ok()) return

          if (indexes.length === 0) {
            this.descriptor!.handle().sort(compareFn, algo)
          } else {
            const cpools = this.poolsFor(...indexes) as Array<Storage<any, any, any> | EntityStorage<any, any>>
            const comp = (lhs: any, rhs: any) => {
              if (indexes.length === 1) {
                return compareFn(cpools[indexes[0]].get(lhs), cpools[indexes[0]].get(rhs))
              } else {
                return compareFn(
                  indexes.map(i => cpools[i].get(lhs)),
                  indexes.map(i => cpools[i].get(rhs))
                )
              }
            }
            this.descriptor!.handle().sort(comp, algo)
          }
        }

        sortAs (first: ForwardPointer<any, any>, last: ForwardPointer<any, any>): void {
          if (this.ok()) {
            this.descriptor!.handle().sortAs(first, last)
          }
        }
      }

      return BasicGroup
    }
  },
  // Owning group specialization (has owned types)  
  {
    predicate: (owned: Array<Storage<any, any, any>>, _get: Array<Storage<any, any, any>>, _exclude: Array<Storage<any, any, any>>) => owned.length > 0,
    render(owned: Array<Storage<any, any, any>>, get: Array<Storage<any, any, any>>, exclude: Array<Storage<any, any, any>>) {
      // Validate that owned storages don't support in-place deletion
      if (__DEV__) {
        if (owned.some(o => ((o.constructor as BasicStorageConstructor<any, any> | EntityStorageConstructor<any>).storagePolicy === DeletionPolicy.InPlace))) {
          throw new AssertionError('Groups do not support in-place delete')
        }
      }

      const BaseType = commonType(...owned.map(o => (o.constructor as any).BaseType), ...get.map(g => (g.constructor as any).BaseType), ...exclude.map(e => (e.constructor as any).BaseType))
      const UnderlyingType = BaseType.EntityType
      const Handler = groupHandlerTemplate.instantiate(BaseType, owned.length, get.length, exclude.length)

      class BasicGroup {
        static BaseType = BaseType
        static UnderlyingType = UnderlyingType

        private static indexOf (T: any): number {
          return [...owned.map(o => (o.constructor as any).ElementType), ...get.map(g => (g.constructor as any).ElementType), ...exclude.map(e => (e.constructor as any).ElementType)].indexOf(T)
        }

        private poolsFor (indexes: number[], other: number[]): Array<BasicSparseSet<any, any>> {
          return this.descriptor ? [
            ...indexes.map(i => this.descriptor!.storage(i)!),
            ...other.map(i => this.descriptor!.storage(i + owned.length)!)
          ] : []
        }

        static EntityType = UnderlyingType
        static CommonType = BaseType
        static Iterator = BaseType.Iterator
        static ReverseIterator = BaseType.ReverseIterator
        static Handler = Handler
  
        private readonly descriptor: InstanceType<typeof Handler> | null

        static groupId (): string {
          return stableHash([owned, get, exclude])
        }

        constructor(handler?: InstanceType<typeof Handler>) {
          this.descriptor = handler ?? null
        }

        handle(): Storage<any, any, any> | EntityStorage<any, any> | null {
          return this.storage(0)
        }

        ok (): boolean {
          return this.descriptor != null
        }

        storage (index: number): Storage<any, any, any> | EntityStorage<any, any> | null
        storage<T extends Function> (ElementType: T): Storage<SafeInstanceType<T>, any, any> | EntityStorage<SafeInstanceType<T>, any> | null
        storage (ElementType: number | Function): Storage<any, any, any> | EntityStorage<any, any> | null {
          if (typeof ElementType === 'number') {
            return this.ok() ? this.descriptor!.storage(ElementType) as any : null
          }
          return this.storage(BasicGroup.indexOf(ElementType)) as any
        }

        get size(): number {
          return this.ok() ? this.descriptor!.length() : 0
        }

        empty (): boolean {
          return !this.ok() || !this.descriptor!.length()
        }

        begin() {
          return this.ok() ? BaseType.prototype.end.call(this.handle()!).minus(this.descriptor!.length()) : new BaseType.Iterator()
        }

        end() {
          return this.ok() ? BaseType.prototype.end.call(this.handle()!) : new BaseType.Iterator()
        }

        rbegin() {
          return this.ok() ? BaseType.prototype.rbegin.call(this.handle()!) : new BaseType.ReverseIterator(new BaseType.Iterator())
        }

        rend() {
          return this.ok() ? BaseType.prototype.rbegin.call(this.handle()!).plus(this.descriptor!.length()) : new BaseType.ReverseIterator(new BaseType.Iterator())
        }

        front(): any {
          const it = this.begin()
          return !it.equals(this.end()) ? it.deref() : BaseType.TraitsType.null
        }

        back(): any {
          const rit = this.rbegin()
          return !rit.equals(this.rend()) ? rit.deref() : BaseType.TraitsType.null
        }

        find(entt: any) {
          const it = this.ok() ? this.handle()!.find(entt) : new BaseType.Iterator()
          return it.gte(this.begin()) ? it : new BaseType.Iterator()
        }

        access (pos: number): any {
          return this.begin().access(pos)
        }

        contains(entt: any): boolean {
          return this.ok() && this.handle()!.contains(entt) && this.handle()!.index(entt) < this.descriptor!.length()
        }

        get(entt: any, ...types: any[]): any {
          return this.getByIndexes(entt, ...types.map(t => BasicGroup.indexOf(t)))
        }

        getByIndexes(entt: any, ...indexes: number[]): any {
          const cpools = this.poolsFor(
            Array.from({ length: owned.length }, (_, i) => i),
            Array.from({ length: get.length }, (_, i) => i)
          ) as Array<Storage<any, any, any> | EntityStorage<any, any>>

          if (indexes.length === 0) {
            return cpools.flatMap(c => c.getAsTuple(entt))
          } else if (indexes.length === 1) {
            return cpools[indexes[0]].get(entt)
          } else {
            return indexes.flatMap(i => cpools[i].getAsTuple(entt))
          }
        }

        each(func?: (entt: any, ...components: any[]) => void, componentsOnly?: boolean): any {
          if (typeof func === 'function') {
            for (const args of this.each()) {
              if (componentsOnly) {
                func.apply(this, args.slice(1))
              } else {
                func.apply(this, args)
              }
          }
          } else {
            const cpools = this.poolsFor(
              Array.from({ length: owned.length }, (_, i) => i),
              Array.from({ length: get.length }, (_, i) => i)
            ) as Array<Storage<any, any, any> | EntityStorage<any, any>>
            const begin = this.begin()
            const end = this.end()
            return new RangeIterator(
              new ExtendedGroupPointer(begin, cpools.slice(0, owned.length), cpools.slice(owned.length)),
              new ExtendedGroupPointer(end, cpools.slice(0, owned.length), cpools.slice(owned.length))
            )
          }
        }

        [Symbol.iterator](): RangeIterator<any, any> {
          return toIterator(this)
        }

        sort (compareFn: (lhs: any, rhs: any) => number, types: any[], algo = defaultSort): void {
          this.sortByIndexes(compareFn, types.map(t => BasicGroup.indexOf(t)), algo)
        }

        sortByIndexes (compareFn: (lhs: any, rhs: any) => number, indexes: number[], algo = defaultSort): void {
          const cpools = this.poolsFor(
            Array.from({ length: owned.length }, (_, i) => i),
            Array.from({ length: get.length }, (_, i) => i)
          ) as Array<Storage<any, any, any> | EntityStorage<any, any>>

          if (indexes.length === 0) {
            this.storage(0)!.sortN(this.descriptor!.length(), compareFn, algo)
          } else {
            const comp = (lhs: any, rhs: any) => {
              if (indexes.length === 1) {
                return compareFn(cpools[indexes[0]].get(lhs), cpools[indexes[0]].get(rhs))
              } else {
                return compareFn(
                  indexes.map(i => cpools[i].get(lhs)),
                  indexes.map(i => cpools[i].get(rhs))
                )
              }
            }
            this.storage(0)!.sortN(this.descriptor!.length(), comp, algo)
          }

          const cb = (...args: Array<Storage<any, any, any> | EntityStorage<any, any>>) => {
            const [head, ...other] = args
            for (let next = this.descriptor!.length(); next; --next) {
              const pos = next - 1
              const entt = head.data()[pos]
              other.forEach(o => {
                o.swapElements(o.data()[pos], entt)
              })
            }
          }

          cb.apply(this, cpools)
        }
      }

      return BasicGroup
    }
  }
])

export function makeGroup<
  const Owned extends Array<Storage<any, any, any>>,
  const Get extends Array<Storage<any, any, any>>, 
  const Exclude extends Array<Storage<any, any, any>> = []
>(
  owned: Owned,
  get: Get,
  exclude: Exclude = [] as unknown as Exclude
): Owned['length'] extends 0 
  ? NonOwningGroup<Get, Exclude>
  : OwningGroup<Owned, Get, Exclude> {
  const GroupConstructor = basicGroupTemplate.instantiate(owned, get, exclude)
  return new GroupConstructor() as any
}
