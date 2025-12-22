import { createSafeNew, type SafeInstanceType, type SafeParameters } from "./config"
import { Disposable } from "./disposable"
import type { EntityConstructor, EnttTraits } from "./entity"
import { basicGroupTemplate, type GroupDescriptor, type NonOwningGroup, type OwningGroup } from "./group"
import { type ForwardPointer, type Range, toRange } from "./iterator"
import type { BasicSighMixin } from "./mixin"
import type { Sink } from "./signal"
import { basicSparseSetTemplate, SparseSetPointer, type SparseSetConstructor } from "./sparse-set"
import { storageTypeTTemplate, type EmptyStorage, type EntityStorage, type Storage } from "./storage"
import { defineTemplate } from "./template"
import { Entity } from "./type"
import { basicViewTemplate, type BasicView } from "./view"
import { defaultSort, assert as ENTT_ASSERT, type StorageKey, destructKey } from "./util"

export interface BasicRegistryConstructor<T extends EntityConstructor> {
  new (): BasicRegistry<SafeInstanceType<T>, SafeInstanceType<EnttTraits<T>['VersionType']>>
  prototype: BasicRegistry<SafeInstanceType<T>, SafeInstanceType<EnttTraits<T>['VersionType']>>
  EntityType: T
  TraitsType: EnttTraits<T>
  CommonType: SparseSetConstructor<T>
}

export type StorageType<T> = T extends [infer U, any] ? U : T extends Function ? T : T extends undefined ? undefined : never
export type MapStorageKeyToStorage<E, Arr> = { [K in keyof Arr]: SafeInstanceType<StorageType<Arr[K]>> extends E ? EntityStorage<SafeInstanceType<StorageType<Arr[K]>>, any> : Storage<SafeInstanceType<StorageType<Arr[K]>>, E, any> }

export interface BasicRegistry<T, V> extends Disposable {
  create (hint?: T): T
  createRange (range: Range<ForwardPointer<T, any>>): void
  createRange (first: ForwardPointer<T, any>, last: ForwardPointer<T, any>): void
  dispose(): void
  ctx (): Record<string, any>
  storage (): IteratorObject<[PropertyKey | Function, Storage<any, T, V>]>
  getStorage<K extends StorageKey<Function | undefined> | PropertyKey> (k: K, forceConst?: boolean): K extends StorageKey<infer U> ? BasicSighMixin<U extends undefined ? EmptyStorage<T, V> : Storage<SafeInstanceType<U>, T, V>, BasicRegistry<T, V>, T> : (BasicSighMixin<Storage<SafeInstanceType<unknown>, T, V>, BasicRegistry<T, V>, T> | undefined)
  reset (id: any): boolean
  valid (entt: T): boolean
  current (entt: T): V
  destroy (entt: T, version?: V): V
  destroyRange (iterable: Range<ForwardPointer<T, any>>): void
  destroyRange (iterable: ForwardPointer<T, any>, last: ForwardPointer<T, any>): void
  insert<U extends Function> (ComponentType: StorageKey<U>, first: ForwardPointer<T, any>, last: ForwardPointer<T, any>, value?: SafeInstanceType<U>): void
  insertRange<U extends Function> (ComponentType: StorageKey<U>, first: ForwardPointer<T, any>, last: ForwardPointer<T, any>, from: ForwardPointer<SafeInstanceType<U>, any>): void
  emplace<U extends Function> (entt: T, ComponentType: StorageKey<U>, ...args: SafeParameters<U>): SafeInstanceType<U>
  emplaceOrReplace<U extends Function> (entt: T, ComponentType: StorageKey<U>, ...args: SafeParameters<U>): SafeInstanceType<U>
  patch<U extends Function, F extends (component: SafeInstanceType<U>) => SafeInstanceType<U> | undefined> (entt: T, ComponentType: StorageKey<U>, ...func: F[]): SafeInstanceType<U>
  replace<U extends Function> (entt: T, ComponentType: StorageKey<U>, ...args: SafeParameters<U>): SafeInstanceType<U>
  remove (entt: T, ...ComponentTypes: Array<StorageKey<Function>>): number
  removeRange (first: ForwardPointer<T, any>, last: ForwardPointer<T, any>, ...ComponentTypes: Array<StorageKey<Function>>): number
  eraseIf (entt: T, func: (id: Function | PropertyKey, storage: Storage<any, T, V>) => boolean): void
  erase (entt: T, ...ComponentTypes: Array<StorageKey<Function>>): void
  eraseRange (first: ForwardPointer<T, any>, last: ForwardPointer<T, any>, ...ComponentTypes: Array<StorageKey<Function>>): void
  compact (...ComponentTypes: Array<StorageKey<Function>>): void
  allOf (entt: T, ...ComponentTypes: Array<StorageKey<Function>>): boolean
  anyOf (entt: T, ...ComponentTypes: Array<StorageKey<Function>>): boolean
  tryGet<U extends Array<StorageKey<Function>>> (entt: T, ...ComponentType: U): [U['length']] extends [1] ? (SafeInstanceType<StorageType<U[0]>> | undefined) : { [K in keyof U]: SafeInstanceType<StorageType<U[K]>> | undefined }
  get<U extends Array<StorageKey<Function>>> (entt: T, ...ComponentType: U): [U['length']] extends [1] ? (SafeInstanceType<StorageType<U[0]>>) : { [K in keyof U]: SafeInstanceType<StorageType<U[K]>> }
  getOrEmplace<U extends Function> (entt: T, ComponentType: StorageKey<U>, ...args: SafeParameters<U>): SafeInstanceType<U>
  clear (...ComponentTypes: Array<StorageKey<Function>>): void
  orphan (entt: T): boolean
  onConstruct <U extends Function> (ComponentType: StorageKey<U>): Sink<void, [BasicRegistry<T, V>, T]>
  onUpdate <U extends Function> (ComponentType: StorageKey<U>): Sink<void, [BasicRegistry<T, V>, T]>
  onDestroy <U extends Function> (ComponentType: StorageKey<U>): Sink<void, [BasicRegistry<T, V>, T]>
  sort<U extends Function> (ComponentType: StorageKey<U>, compare: (lhs: SafeInstanceType<U>, rhs: SafeInstanceType<U>) => number, algo?: (arr: T[], compare?: (a: T, b: T) => number) => T[]): void
  sortByEntity (ComponentType: StorageKey<Function>, compare: (lhs: T, rhs: T) => number, algo?: (arr: T[], compare?: (a: T, b: T) => number) => T[]): void
  sortAs (To: StorageKey<Function>, From: StorageKey<Function>): void
  view<const Contains extends Array<StorageKey<Function>>> (
    types: Contains,
    excludes?: Array<StorageKey<Function>>
  ): BasicView<T, { [K in keyof Contains]: SafeInstanceType<StorageType<Contains[K]>> }>

  group<
    const Owned extends Array<StorageKey<Function>>,
    const Get extends Array<StorageKey<Function>> = [],
    const Exclude extends Array<StorageKey<Function>> = []
  > (
    owned: Owned,
    get?: Get,
    exclude?: Exclude
  ): Owned['length'] extends 0 
    ? NonOwningGroup<MapStorageKeyToStorage<T, Get>, MapStorageKeyToStorage<T, Exclude>>
    : OwningGroup<MapStorageKeyToStorage<T, Owned>, MapStorageKeyToStorage<T, Get>, MapStorageKeyToStorage<T, Exclude>>
  groupIfExists<
    const Owned extends Array<StorageKey<Function>>,
    const Get extends Array<StorageKey<Function>> = [],
    const Exclude extends Array<StorageKey<Function>> = []
  > (
    owned: Owned,
    get?: Get,
    exclude?: Exclude
  ): Owned['length'] extends 0 
    ? NonOwningGroup<MapStorageKeyToStorage<T, Get>, MapStorageKeyToStorage<T, Exclude>>
    : OwningGroup<MapStorageKeyToStorage<T, Owned>, MapStorageKeyToStorage<T, Get>, MapStorageKeyToStorage<T, Exclude>>

  owned (...Types: Function[]): boolean
}

export interface BasicRegistryTemplate {
  <T extends EntityConstructor>(ValueType: T): BasicRegistryConstructor<T>
}

export const basicRegistryTemplate = defineTemplate<BasicRegistryTemplate>(function templateBasicRegistry<
  T extends EntityConstructor
> (ValueType: T): BasicRegistryConstructor<T> {
  type VersionType = SafeInstanceType<EnttTraits<T>['VersionType']>
  const EntityStorageClass = storageTypeTTemplate.instantiate(ValueType, ValueType)
  const TraitsType = EntityStorageClass.TraitsType
  const EntityType = TraitsType.ValueType
  const BaseType = basicSparseSetTemplate.instantiate(ValueType)

  return class extends Disposable {
    static readonly TraitsType = TraitsType
    static readonly EntityType = EntityType
    static readonly CommonType = BaseType

    private readonly entities: BasicSighMixin<EntityStorage<SafeInstanceType<T>, VersionType>, BasicRegistry<SafeInstanceType<T>, VersionType>, SafeInstanceType<T>>
    private readonly vars: Record<string, any>
    private readonly groups: Map<string, GroupDescriptor>
    private readonly pools: Map<PropertyKey | Function, BasicSighMixin<Storage<any, SafeInstanceType<T>, VersionType>, BasicRegistry<SafeInstanceType<T>, VersionType>, SafeInstanceType<T>>>

    constructor () {
      super()
      this.entities = new EntityStorageClass() as BasicSighMixin<EntityStorage<SafeInstanceType<T>, VersionType>, BasicRegistry<SafeInstanceType<T>, VersionType>, SafeInstanceType<T>>
      this.entities.bind(this)
      this.vars = Object.create(null)
      this.groups = new Map()
      this.pools = new Map()
    }

    dispose(): void {
      for (const group of this.groups.values()) {
        group.dispose()
      }
      this.groups.clear()
      for (const pool of this.pools.values()) {
        pool.dispose()
      }
      this.pools.clear()
      this.entities.dispose()
      Object.keys(this.vars).forEach((_, key) => {
        delete this.vars[key]
      })
    }

    assure<U extends Function> (k: StorageKey<U>): BasicSighMixin<Storage<SafeInstanceType<U>, SafeInstanceType<T>, VersionType>, BasicRegistry<SafeInstanceType<T>, VersionType>, SafeInstanceType<T>> {
      const [ComponentType, id] = destructKey(k)
      if (typeof ComponentType !== 'function' && ComponentType !== undefined) {
        throw new Error('Invalid component type')
      }
      if (Object.is(ComponentType, EntityType)) {
        __DEV__ && ENTT_ASSERT(id === EntityType, "User entity storage not allowed")
        return this.entities as any
      }
      if (this.pools.has(id)) {
        const cpool = this.pools.get(id)!
        __DEV__ && ENTT_ASSERT(cpool.type() === ComponentType, "Unexpected type")
        return this.pools.get(id)!
      }
      const StorageClass = storageTypeTTemplate.instantiate(ComponentType, EntityType)
      const cpool = new StorageClass() as BasicSighMixin<Storage<SafeInstanceType<U>, SafeInstanceType<T>, VersionType>, BasicRegistry<SafeInstanceType<T>, VersionType>, SafeInstanceType<T>>
      this.pools.set(id, cpool)
      cpool.bind(this)
      return cpool
    }

    constAssure<U extends Function> (k: StorageKey<U> | PropertyKey): BasicSighMixin<Storage<SafeInstanceType<U>, SafeInstanceType<T>, VersionType>, BasicRegistry<SafeInstanceType<T>, VersionType>, SafeInstanceType<T>> | undefined {
      const [ComponentType, id] = destructKey(k)
      const hasType = typeof ComponentType === 'function' || ComponentType === undefined
      if (hasType) {
        if (Object.is(ComponentType, EntityType)) {
          __DEV__ && ENTT_ASSERT(id === EntityType, "User entity storage not allowed")
          return this.entities as any
        }
      }

      const cpool = this.pools.get(id)
      if (!cpool) return undefined
      __DEV__ && ENTT_ASSERT(!hasType || cpool.type() === ComponentType, "Unexpected type")
      return cpool
    }

    ctx (): Record<string, any> {
      return this.vars
    }

    create (hint?: SafeInstanceType<T>): SafeInstanceType<T> {
      return this.entities.generate(hint)
    }

    createRange (first: any, last?: any): void {
      this.entities.generateRange(first, last)
    }

    insert<U extends Function> (ComponentType: StorageKey<U>, first: ForwardPointer<SafeInstanceType<T>, any>, last: ForwardPointer<SafeInstanceType<T>, any>, value?: SafeInstanceType<U>): void {
      last = last.clone()
      if (__DEV__) {
        for (let it = first.clone(); !it.equals(last); it.selfPlus()) {
          ENTT_ASSERT(this.valid(it.deref()), 'Invalid entity')
        }
      }
      const cpool = this.assure(ComponentType) as Storage<SafeInstanceType<U>, SafeInstanceType<T>, VersionType>
      cpool.insert(first, last, value)
    }

    insertRange<U extends Function> (ComponentType: StorageKey<U>, first: ForwardPointer<SafeInstanceType<T>, any>, last: ForwardPointer<SafeInstanceType<T>, any>, from: ForwardPointer<SafeInstanceType<U>, any>): void {
      last = last.clone()
      if (__DEV__) {
        for (let it = first.clone(); !it.equals(last); it.selfPlus()) {
          ENTT_ASSERT(this.valid(it.deref()), 'Invalid entity')
        }
      }
      const cpool = this.assure(ComponentType) as Storage<SafeInstanceType<U>, SafeInstanceType<T>, VersionType>
      cpool.insertRange(first, last, from)
    }

    storage (): IteratorObject<[PropertyKey | Function, Storage<any, SafeInstanceType<T>, VersionType>]> {
      return this.pools.entries()
    }

    getStorage<K extends StorageKey<Function> | PropertyKey> (k: K, forceConst = false): K extends StorageKey<infer U> ? BasicSighMixin<Storage<SafeInstanceType<U>, SafeInstanceType<T>, VersionType>, BasicRegistry<SafeInstanceType<T>, VersionType>, SafeInstanceType<T>> : (BasicSighMixin<Storage<SafeInstanceType<unknown>, SafeInstanceType<T>, VersionType>, BasicRegistry<SafeInstanceType<T>, VersionType>, SafeInstanceType<T>> | undefined) {
      if (!forceConst && (typeof k === 'function' || Array.isArray(k) || k === undefined)) {
        return this.assure(k) as any
      }
      return this.constAssure(k) as any
    }

    reset (id: any): boolean {
      __DEV__ && ENTT_ASSERT(id !== EntityType, "Cannot reset entity storage")
      return this.pools.delete(id)
    }

    valid (entt: SafeInstanceType<T>): boolean {
      const idx = this.entities.find(entt).index()
      return idx >= 0 && idx < this.entities.freeList()
    }

    current (entt: SafeInstanceType<T>): SafeInstanceType<EnttTraits<T>['VersionType']> {
      return this.entities.current(entt)
    }

    destroy (entt: SafeInstanceType<T>, version?: VersionType): VersionType {
      const pools = [...this.pools.values()]
      for (let pos = pools.length - 1; pos >= 0; --pos) {
        pools[pos].remove(entt)
      }
      this.entities.erase(entt)
      const ret = this.entities.current(entt)
      if (version !== undefined) {
        const elem = TraitsType.construct(TraitsType.toEntity(entt), version)
        return this.entities.bump(TraitsType.isTombstone(elem) ? TraitsType.next(elem) : elem)
      }
      return ret
    }

    destroyRange (iterable: Range<ForwardPointer<SafeInstanceType<T>, any>> | ForwardPointer<SafeInstanceType<T>, any>, last?: ForwardPointer<SafeInstanceType<T>, any>): void {
      const to = last == null ? this.entities.sortAs(iterable as Range<ForwardPointer<SafeInstanceType<T>, any>>) : this.entities.sortAs(iterable as ForwardPointer<SafeInstanceType<T>, any>, last)
      const from = this.entities.end().minus(Number(this.entities.freeList()))
      for (const pool of this.pools.values()) {
        pool.remove(from, to)
      }
      this.entities.erase(from, to)
    }

    emplace<U extends Function> (entt: SafeInstanceType<T>, ComponentType: StorageKey<U>, ...args: SafeParameters<U>): SafeInstanceType<U> {
      __DEV__ && ENTT_ASSERT(this.valid(entt), "Invalid entity")
      const cpool = this.assure(ComponentType) as Storage<SafeInstanceType<U>, SafeInstanceType<T>, VersionType>
      return cpool.emplace(entt, ...args)
    }

    emplaceOrReplace<U extends Function> (entt: SafeInstanceType<T>, ComponentType: StorageKey<U>, ...args: SafeParameters<U>): SafeInstanceType<U> {
      const cpool = this.assure(ComponentType) as Storage<SafeInstanceType<U>, SafeInstanceType<T>, VersionType>
      __DEV__ && ENTT_ASSERT(this.valid(entt), "Invalid entity")
      return cpool.has(entt) ? cpool.patch(entt, () => createSafeNew(cpool.type()!)(...args)) : cpool.emplace(entt, ...args)
    }

    patch<U extends Function, F extends (component: SafeInstanceType<U>) => SafeInstanceType<U> | undefined> (entt: SafeInstanceType<T>, ComponentType: StorageKey<U>, ...func: F[]): SafeInstanceType<U> {
      const cpool = this.assure(ComponentType)
      return cpool.patch(entt, ...func)
    }

    replace<U extends Function> (entt: SafeInstanceType<T>, ComponentType: StorageKey<U>, ...args: SafeParameters<U>): SafeInstanceType<U> {
      const cpool = this.assure(ComponentType)
      return cpool.patch(entt, () => createSafeNew(cpool.type()!)(...args))
    }

    remove (entt: SafeInstanceType<T>, ...ComponentTypes: Array<StorageKey<Function>>): number {
      let removed = 0
      for (const ComponentType of ComponentTypes) {
        const cpool = this.assure(ComponentType)
        if (cpool.delete(entt)) {
          ++removed
        }
      }
      return removed
    }

    removeRange (first: ForwardPointer<SafeInstanceType<T>, any>, last: ForwardPointer<SafeInstanceType<T>, any>, ...ComponentTypes: Array<StorageKey<Function>>): number {
      let count = 0
      first = first.clone()
      last = last.clone()
      if (first instanceof SparseSetPointer && last instanceof SparseSetPointer) {
        const array = ComponentTypes.map((ComponentType) => this.assure(ComponentType))
        const cpools = toRange(array)
        const from = cpools.begin()
        const to = cpools.end()
        for (; !from.equals(to); from.selfPlus()) {
          if (ComponentTypes.length > 1) {
            if (from.deref().data() === first.data()) {
              const tmp = from.deref()
              from.write(array[array.length - 1])
              array[array.length - 1] = tmp
            }
          }
          count += from.deref().remove(first, last)
        }
      } else {
        for (const cpools = ComponentTypes.map((ComponentType) => this.assure(ComponentType)); !first.equals(last); first.selfPlus()) {
          const entt = first.deref()
          for (const cpool of cpools) {
            count += cpool.remove(entt) ? 1 : 0
          }
        }
      }
      return count
    }

    eraseIf (entt: SafeInstanceType<T>, func: (id: Function | PropertyKey, storage: Storage<any, SafeInstanceType<T>, VersionType>) => boolean): void {
      for (const [id, cpool] of this.storage()) {
        if (cpool.contains(entt) && func(id, cpool)) {
          cpool.erase(entt)
        }
      }
    }

    erase (entt: SafeInstanceType<T>, ...ComponentTypes: Array<StorageKey<Function>>): void {
      for (const ComponentType of ComponentTypes) {
        const cpool = this.assure(ComponentType)
        cpool.erase(entt)
      }
    }

    eraseRange (first: ForwardPointer<SafeInstanceType<T>, any>, last: ForwardPointer<SafeInstanceType<T>, any>, ...ComponentTypes: Array<StorageKey<Function>>): void {
      first = first.clone()
      last = last.clone()
      if (first instanceof SparseSetPointer && last instanceof SparseSetPointer) {
        const array = ComponentTypes.map((ComponentType) => this.assure(ComponentType))
        const cpools = toRange(array)
        const from = cpools.begin()
        const to = cpools.end()
        for (; !from.equals(to); from.selfPlus()) {
          if (ComponentTypes.length > 1) {
            if (from.deref().data() === first.data()) {
              const tmp = from.deref()
              from.write(array[array.length - 1])
              array[array.length - 1] = tmp
            }
          }
          from.deref().erase(first, last)
        }
      } else {
        for (const cpools = ComponentTypes.map((ComponentType) => this.assure(ComponentType)); !first.equals(last); first.selfPlus()) {
          const entt = first.deref()
          for (const cpool of cpools) {
            cpool.erase(entt)
          }
        }
      }
    }

    compact (...ComponentTypes: Array<StorageKey<Function>>): void {
      if (ComponentTypes.length === 0) {
        for (const pool of this.pools.values()) {
          pool.compact()
        }
      } else {
        for (const ComponentType of ComponentTypes) {
          const cpool = this.assure(ComponentType)
          cpool.compact()
        }
      }
    }

    allOf (entt: SafeInstanceType<T>, ...ComponentTypes: Array<StorageKey<Function>>): boolean {
      if (ComponentTypes.length === 1) {
        const cpool = this.constAssure(ComponentTypes[0])
        // eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- ignore
        return cpool != null && cpool?.has(entt)
      }
      return ComponentTypes.every((ComponentType) => this.allOf(entt, ComponentType))
    }

    anyOf (entt: SafeInstanceType<T>, ...ComponentTypes: Array<StorageKey<Function>>): boolean {
      return ComponentTypes.some((ComponentType) => this.allOf(entt, ComponentType))
    }

    tryGet<U extends Array<StorageKey<Function>>> (entt: SafeInstanceType<T>, ...ComponentType: U): [U['length']] extends [1] ? (SafeInstanceType<StorageType<U[0]>> | undefined) : { [K in keyof U]: SafeInstanceType<StorageType<U[K]>> | undefined } {
      if (ComponentType.length === 1) {
        const cpool = this.constAssure(ComponentType[0])
        return cpool ? cpool.has(entt) ? cpool.get(entt) : undefined as any : undefined as any
      }
      return ComponentType.map((Type) => this.tryGet(entt, Type)) as any
    }

    get<U extends Array<StorageKey<Function>>> (entt: SafeInstanceType<T>, ...ComponentType: U): [U['length']] extends [1] ? (SafeInstanceType<StorageType<U[0]>> | undefined) : { [K in keyof U]: SafeInstanceType<StorageType<U[K]>> | undefined } {
      if (ComponentType.length === 1) {
        const cpool = this.assure(ComponentType[0])
        return cpool.get(entt)
      }
      return ComponentType.map((Type) => this.get(entt, Type)) as any
    }

    getOrEmplace<U extends Function> (entt: SafeInstanceType<T>, ComponentType: StorageKey<U>, ...args: SafeParameters<U>): SafeInstanceType<U> {
      const cpool = this.assure(ComponentType) as Storage<SafeInstanceType<U>, SafeInstanceType<T>, VersionType>
      __DEV__ && ENTT_ASSERT(this.valid(entt), "Invalid entity")
      return cpool.has(entt) ? cpool.get(entt)! : cpool.emplace(entt, ...args)
    }

    clear (...ComponentTypes: Array<StorageKey<Function>>): void {
      if (ComponentTypes.length === 0) {
        const pools = [...this.pools.values()]
        for (let pos = pools.length - 1; pos >= 0; --pos) {
          pools[pos].clear()
        }
        const elem = this.entities.each()
        this.entities.erase(elem.begin().base(), elem.end().base())
        // for (const entt of this.entities) {
        //   this.entities.delete(entt)
        // }
      } else {
        ComponentTypes.forEach((ComponentType) => {
          this.assure(ComponentType).clear()
        })
      }
    }

    orphan (entt: SafeInstanceType<T>): boolean {
      const pools = [...this.pools.values()]
      return !pools.some((pool) => pool.has(entt))
    }

    onConstruct <U extends Function> (ComponentType: StorageKey<U>): Sink<void, [BasicRegistry<SafeInstanceType<T>, VersionType>, SafeInstanceType<T>]> {
      return this.assure(ComponentType).onConstruct()
    }

    onUpdate <U extends Function> (ComponentType: StorageKey<U>): Sink<void, [BasicRegistry<SafeInstanceType<T>, VersionType>, SafeInstanceType<T>]> {
      return this.assure(ComponentType).onUpdate()
    }

    onDestroy <U extends Function> (ComponentType: StorageKey<U>): Sink<void, [BasicRegistry<SafeInstanceType<T>, VersionType>, SafeInstanceType<T>]> {
      return this.assure(ComponentType).onDestroy()
    }

    sort<U extends Function> (ComponentType: StorageKey<U>, compare: (lhs: SafeInstanceType<U>, rhs: SafeInstanceType<U>) => number, algo = defaultSort): void {
      if (__DEV__) {
        const [C] = destructKey(ComponentType)
        if (typeof C !== 'function' && C !== undefined) {
          throw new Error('Invalid component type')
        }
        ENTT_ASSERT(!this.owned(C!), 'Cannot sort owned storage')
      }
      const cpool = this.assure(ComponentType)
      cpool.sort(
        (a, b) => compare(cpool.get(a)!, cpool.get(b)!),
        algo
      )
    }

    sortByEntity (ComponentType: StorageKey<Function>, compare: (lhs: SafeInstanceType<T>, rhs: SafeInstanceType<T>) => number, algo = defaultSort): void {
      if (__DEV__) {
        const [C] = destructKey(ComponentType)
        if (typeof C !== 'function' && C !== undefined) {
          throw new Error('Invalid component type')
        }
        ENTT_ASSERT(!this.owned(C!), 'Cannot sort owned storage')
      }
      const cpool = this.assure(ComponentType)
      cpool.sort(compare, algo)
    }

    sortAs (To: StorageKey<Function>, From: StorageKey<Function>): void {
      if (__DEV__) {
        const [ComponentType] = destructKey(To)
        if (typeof ComponentType !== 'function' && ComponentType !== undefined) {
          throw new Error('Invalid component type')
        }
        ENTT_ASSERT(!this.owned(ComponentType!), 'Cannot sort owned storage')
      }
      const cpool = this.assure(From)
      this.assure(To).sortAs(cpool.begin(), cpool.end())
    }

    view<const Contains extends Array<StorageKey<Function>>> (
      types: Contains,
      excludes: Array<StorageKey<Function>> = []
    ): BasicView<SafeInstanceType<T>, { [K in keyof Contains]: SafeInstanceType<StorageType<Contains[K]>> }> {
      const gets = types.map((Type) => this.assure(Type))
      const excl = excludes.map((Type) => this.assure(Type))
      const View = basicViewTemplate.instantiate(gets, excl)
      return new View(gets, excl) as any
    }

    group<
      const Owned extends Array<StorageKey<Function>>,
      const Get extends Array<StorageKey<Function>>,
      const Exclude extends Array<StorageKey<Function>>
    > (
      owned: Owned,
      get: Get = [] as unknown as Get,
      exclude: Exclude = [] as unknown as Exclude
    ): Owned['length'] extends 0 
      ? NonOwningGroup<MapStorageKeyToStorage<SafeInstanceType<T>, Get>, MapStorageKeyToStorage<SafeInstanceType<T>, Exclude>>
      : OwningGroup<MapStorageKeyToStorage<SafeInstanceType<T>, Owned>, MapStorageKeyToStorage<SafeInstanceType<T>, Get>, MapStorageKeyToStorage<SafeInstanceType<T>, Exclude>> {
      const o = owned.map((Type) => this.assure(Type))
      const g = get.map((Type) => this.assure(Type))
      const e = exclude.map((Type) => this.assure(Type))
      const GroupType = basicGroupTemplate.instantiate(o, g, e)
      const HandlerType = GroupType.Handler

      if (this.groups.has(GroupType.groupId())) {
        return new GroupType(this.groups.get(GroupType.groupId())! as any) as any
      }

      let handler: InstanceType<typeof HandlerType> = undefined!

      if (o.length === 0) {
        handler = new HandlerType(g, e)
      } else {
        handler = new HandlerType([...o, ...g], e)
        if (__DEV__) {
          this.groups.forEach(group => {
            ENTT_ASSERT(!o.every(p => !group.owned(p)), 'Conflicting groups')
          })
        }
      }

      this.groups.set(GroupType.groupId(), handler)
      return new GroupType(handler) as any
    }

    groupIfExists<
      const Owned extends Array<StorageKey<Function>>,
      const Get extends Array<StorageKey<Function>>,
      const Exclude extends Array<StorageKey<Function>>
    > (
      owned: Owned,
      get: Get = [] as unknown as Get,
      exclude: Exclude = [] as unknown as Exclude
    ): Owned['length'] extends 0 
      ? NonOwningGroup<MapStorageKeyToStorage<SafeInstanceType<T>, Get>, MapStorageKeyToStorage<SafeInstanceType<T>, Exclude>>
      : OwningGroup<MapStorageKeyToStorage<SafeInstanceType<T>, Owned>, MapStorageKeyToStorage<SafeInstanceType<T>, Get>, MapStorageKeyToStorage<SafeInstanceType<T>, Exclude>> {
      const o = owned.map((Type) => this.assure(Type))
      const g = get.map((Type) => this.assure(Type))
      const e = exclude.map((Type) => this.assure(Type))
      const GroupType = basicGroupTemplate.instantiate(o, g, e)

      if (this.groups.has(GroupType.groupId())) {
        return new GroupType(this.groups.get(GroupType.groupId())! as any) as any
      }

      return new GroupType() as any
    }

    owned (...Types: Function[]): boolean {
      for (const group of this.groups.values()) {
        if (Types.some((Type) => group.owned(Type))) {
          return true
        }
      }
      return false
    }
  } as unknown as BasicRegistryConstructor<T>
})

export const Registry = /*#__PURE__*/ (() => basicRegistryTemplate.instantiate(Entity))()
