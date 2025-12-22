import { componentTraitsTemplate, type ComponentTraits } from "./component"
import { config, createSafeNew, type SafeInstanceType, type SafeParameters } from "./config"
import { enttTraitsTemplate, type EntityConstructor, type EnttTraits } from "./entity"
import { makeReversePointer, ReversePointer, type IterableHelpers, type ReversableRange, type RandomAccessPointer, toIterator, type Range, type ForwardPointer, makeRangePointer, AggregatePointer, type RangeIterator } from "./iterator"
import { basicSighMixinTemplate } from "./mixin"
import { basicSparseSetTemplate, DeletionPolicy, SparseSetPointer, type BaseSparseSet, type BasicSparseSet, type SparseSetConstructor } from "./sparse-set"
import { defineTemplate } from "./template"
import { type DefaultEntityConstructor, Entity, Uint64 } from "./type"
import { assert as ENTT_ASSERT, clone, type IRef } from "./util"

export interface Storage<T, E, V> extends BaseSparseSet<E, V>, ReversableRange<StoragePointer<T>>, IterableHelpers<E, T, Storage<T, E, V>> {
  capacity (): number
  reserve (cap: number): void
  get (entt: E): T | undefined
  getAsRef (entt: E): IRef<T | undefined>
  getAsTuple (entt: E): [T]
  emplace (entt: E, ...args: ConstructorParameters<new (...args: any[]) => T>): T
  insert (first: ForwardPointer<E, any>, last: ForwardPointer<E, any>, value?: T): StoragePointer<T>
  insertRange (first: ForwardPointer<E, any>, last: ForwardPointer<E, any>, from: ForwardPointer<T, any>): StoragePointer<T>
  patch<F extends (instance: T) => T | undefined> (entt: E, ...func: F[]): T
  each (): RangeIterator<AggregatePointer<[SparseSetPointer<E>, StoragePointer<T>]>>
  reach (): RangeIterator<AggregatePointer<[ReversePointer<SparseSetPointer<E>>, ReversePointer<StoragePointer<T>>]>>
}

export interface EmptyStorage<E, V> extends BasicSparseSet<E, V> {
  get (entt: E): undefined
  getAsRef (entt: E): IRef<undefined>
  getAsTuple (entt: E): []
  emplace (entt: E): void
  insert (first: ForwardPointer<E, any>, last: ForwardPointer<E, any>): void
  patch<F extends () => void> (entt: E, ...func: F[]): void
  each (): RangeIterator<AggregatePointer<[SparseSetPointer<E>]>>
  reach (): RangeIterator<AggregatePointer<[ReversePointer<SparseSetPointer<E>>]>>
}

export interface EntityStorage<T, V> extends BasicSparseSet<T, V> {
  startFrom (hint: T): void
  get (entt: T): void
  getAsRef (entt: T): IRef<void>
  getAsTuple (entt: T): []
  patch<F extends () => void> (entt: T, ...func: F[]): void
  generate (hint?: T): T
  generateRange (range: Range<ForwardPointer<T, any>>): void
  generateRange (first: ForwardPointer<T, any>, last: ForwardPointer<T, any>): void
  insert (first: ForwardPointer<T, any>, last: ForwardPointer<T, any>): void

  each (): RangeIterator<AggregatePointer<[SparseSetPointer<T>]>>
  reach (): RangeIterator<AggregatePointer<[ReversePointer<SparseSetPointer<T>>]>>
}

export interface EntityStorageConstructor<T extends EntityConstructor> extends SparseSetConstructor<T> {
  storagePolicy: DeletionPolicy
  TraitsType: EnttTraits<T>
  ElementType: T
  EntityType: T
  ValueType: undefined
  BaseType: SparseSetConstructor<T>
  Iterator: typeof SparseSetPointer<SafeInstanceType<T>>
  ReverseIterator: typeof ReversePointer<SparseSetPointer<SafeInstanceType<T>>>
  new (): EntityStorage<SafeInstanceType<T>, SafeInstanceType<EnttTraits<T>['VersionType']>>
  prototype: EntityStorage<SafeInstanceType<T>, SafeInstanceType<EnttTraits<T>['VersionType']>>
}

export interface EmptyStorageConstructor<T, E extends EntityConstructor> extends Omit<SparseSetConstructor<E>, 'Iterator' | 'ReverseIterator' | 'TraitsType' | 'prototype'> {
  storagePolicy: DeletionPolicy
  TraitsType: ComponentTraits<T, E>
  ElementType: T
  EntityType: E
  ValueType: undefined
  BaseType: SparseSetConstructor<E>
  new (): EmptyStorage<SafeInstanceType<E>, SafeInstanceType<EnttTraits<E>['VersionType']>>
  prototype: EmptyStorage<SafeInstanceType<E>, SafeInstanceType<EnttTraits<E>['VersionType']>>
}

export interface BasicStorageConstructor<T, E extends EntityConstructor> extends Omit<SparseSetConstructor<E>, 'Iterator' | 'ReverseIterator' | 'TraitsType' | 'prototype'> {
  storagePolicy: DeletionPolicy
  TraitsType: ComponentTraits<T, E>
  ElementType: T
  EntityType: E
  ValueType: T
  BaseType: SparseSetConstructor<E>
  Iterator: typeof StoragePointer<SafeInstanceType<T>>
  ReverseIterator: typeof ReversePointer<StoragePointer<SafeInstanceType<T>>>
  new (): Storage<SafeInstanceType<T>, SafeInstanceType<E>, SafeInstanceType<EnttTraits<E>['VersionType']>>
  prototype: Storage<SafeInstanceType<T>, SafeInstanceType<E>, SafeInstanceType<EnttTraits<E>['VersionType']>>
}

// export type StorageConstructor<
//   T extends Function,
//   E extends EntityConstructor
// > = [T] extends [E]
//   ? EntityStorageConstructor<T>
//   : BasicStorageConstructor<T, E>

export class StoragePointer<T> implements RandomAccessPointer<T, StoragePointer<T>> {
  private payload: T[][]
  private offset: number
  private pageSize: number
  constructor ()
  constructor (pageSize: number, payload: T[][], offset: number)
  constructor (pageSize?: number, payload?: T[][] | null, offset?: number) {
    this.pageSize = pageSize ?? 0
    this.payload = payload ?? null!
    this.offset = offset ?? 0
  }
  dispose () {
    this.payload = null!
    this.offset = 0
    this.pageSize = 0
  }
  
  clone (target?: StoragePointer<T>): StoragePointer<T> {
    if (target) {
      if (target === this) return target
      target.payload = this.payload
      target.offset = this.offset
      target.pageSize = this.pageSize
      return target
    }
    return new StoragePointer(this.pageSize, this.payload, this.offset)
  }

  swap (other: StoragePointer<T>): void {
    if (this === other) return
    const t = this.payload
    this.payload = other.payload
    other.payload = t
    const o = this.offset
    this.offset = other.offset
    other.offset = o
    const p = this.pageSize
    this.pageSize = other.pageSize
    other.pageSize = p
  }

  data () {
    return this.payload
  }

  selfPlus (n = 1): this {
    this.offset -= n
    return this
  }

  selfMinus (n = 1): this {
    this.offset += n
    return this
  }

  plus (n: number) {
    return new StoragePointer(this.pageSize, this.payload, this.offset - n)
  }

  minus (n: number) {
    return new StoragePointer(this.pageSize, this.payload, this.offset + n)
  }

  diff (other: StoragePointer<T>): number {
    return other.index() - this.index()
  }

  equals (other: StoragePointer<T>): boolean {
    return this.index() === other.index()
  }

  lt (other: StoragePointer<T>): boolean {
    return this.index() > other.index()
  }

  gt (other: StoragePointer<T>): boolean {
    return this.index() < other.index()
  }

  le (other: StoragePointer<T>): boolean {
    return !this.gt(other)
  }

  ge (other: StoragePointer<T>): boolean {
    return !this.lt(other)
  }

  deref (): T {
    return this.access(0)
  }

  write (value: T): T {
    this.set(0, value)
    return value
  }

  access (value: number): T {
    const idx = this.index() - value
    if (this.pageSize === 0) {
      return this.payload[0][idx] as T
    }
    return this.payload[(idx / this.pageSize) >>> 0][(idx & (this.pageSize - 1)) >>> 0]
  }

  set (off: number, value: T): void {
    const idx = this.index() - off
    if (this.pageSize === 0) {
      this.payload[0][idx] = value
    } else {
      this.payload[(idx / this.pageSize) >>> 0][(idx & (this.pageSize - 1)) >>> 0] = value
    }
  }

  index (): number {
    return this.offset - 1
  }
}

export type IsEmptyClass<T extends Function> = SafeInstanceType<T> extends object
  ? [keyof SafeInstanceType<T>] extends [never]
    ? true
    : false
  : false

export interface BasicStorageTemplate {
  <E extends EntityConstructor>(Type: E, Entity?: E): EntityStorageConstructor<E>
  <T extends Function, E extends EntityConstructor>(Type: T, Entity: E): IsEmptyClass<T> extends true ? EmptyStorageConstructor<T, E> : BasicStorageConstructor<T, E>
}

export const basicStorageTemplate = defineTemplate<BasicStorageTemplate>(function <
  T extends Function,
  E extends EntityConstructor
> (Type: T, Entity: E): any {
  const UnderlyingType = basicSparseSetTemplate.instantiate<E>(Entity)
  const BaseType = UnderlyingType
  // const UnderlyingIterator = UnderlyingType.BasicIterator
  const TraitsType = componentTraitsTemplate.instantiate(Type, Entity)
  const _new = createSafeNew(TraitsType.ElementType)
  const storagePolicy = TraitsType.inPlaceDelete ? DeletionPolicy.InPlace : DeletionPolicy.SwapAndPop
  if (TraitsType.pageSize === 0) {
    // @ts-expect-error -- ignore
    return class BasicStorage extends BaseType {
      static TraitsType = TraitsType

      static storagePolicy = storagePolicy
      static EntityType = Entity
      static ElementType = Type
      static BaseType = BaseType
      static ValueType = undefined

      constructor () {
        super(TraitsType.ElementType, storagePolicy)
      }

      get (entt: SafeInstanceType<E>): undefined {
        __DEV__ && ENTT_ASSERT(super.contains(entt), "Invalid entity")
      }

      getAsRef (entt: SafeInstanceType<E>): IRef<undefined> {
        __DEV__ && ENTT_ASSERT(super.contains(entt), "Invalid entity")
        return {
          get: () => {},
          set: () => {}
        }
      }

      getAsTuple (entt: SafeInstanceType<E>): [] {
        __DEV__ && ENTT_ASSERT(super.contains(entt), "Invalid entity")
        return []
      }

      emplace (entt: SafeInstanceType<E>, ..._args: SafeParameters<T>): void {
        super.tryEmplace(entt, false)
      }

      insert (first: ForwardPointer<SafeInstanceType<E>, any>, last: ForwardPointer<SafeInstanceType<E>, any>, _?: undefined): void {
        first = first.clone()
        last = last.clone()
        for (; !first.equals(last); first.selfPlus()) {
          const entt = first.deref()
          super.tryEmplace(entt, true)
        }
      }

      patch<F extends () => void> (entt: SafeInstanceType<E>, ...func: F[]): void {
          __DEV__ && ENTT_ASSERT(super.contains(entt), "Invalid entity")
        for (const f of func) {
          f()
        }
      }
      
      // @ts-expect-error -- ignore
      [Symbol.iterator]() {
        return toIterator(this)
      }

      each (): IteratorObject<[SafeInstanceType<E>]> {
        const kBegin = super.begin()
        const kEnd = super.end()
        const f = new AggregatePointer([kBegin])
        const l = new AggregatePointer([kEnd])
        return toIterator(f, l)
      }

      reach (): IteratorObject<[SafeInstanceType<E>]> {
        const kBegin = super.rbegin()
        const kEnd = super.rend()
        const f = new AggregatePointer([kBegin])
        const l = new AggregatePointer([kEnd])
        return toIterator(f, l)
      }
    }
  }

  const BasicStorage = class extends BaseType {
    private readonly payload: Array<Array<SafeInstanceType<T>>>
    static TraitsType = TraitsType

    static Iterator = StoragePointer
    static ReverseIterator = ReversePointer
    static storagePolicy = storagePolicy
    static EntityType = Entity
    static ElementType = Type
    static BaseType = BaseType
    static ValueType = Type

    private elementAt (pos: number) {
      return this.payload[(pos / TraitsType.pageSize) >>> 0]?.[(pos & (TraitsType.pageSize - 1)) >>> 0]
    }

    private elementSet (pos: number, value: SafeInstanceType<T>) {
      const page = this.assureAtLeast(pos)
      this.payload[page][(pos & (TraitsType.pageSize - 1)) >>> 0] = value
    }

    private assureAtLeast (pos: number) {
      const page = (pos / TraitsType.pageSize) >>> 0
      while (this.payload.length <= page) {
        if (this.payload.length === page) {
          this.payload.push(Array(((pos & (TraitsType.pageSize - 1)) >>> 0) + 1))
        } else {
          this.payload.push(Array(TraitsType.pageSize).fill(undefined))
        }
      }
      return page
    }

    constructor () {
      super(TraitsType.ElementType, storagePolicy)
      this.payload = []
    }

    dispose () {
      this.payload.length = 0
      super.dispose()
    }

    override reserve (cap: number): void {
      if (cap !== 0) {
        super.reserve(cap)
        this.assureAtLeast(cap - 1)
      }
    }

    get (entt: SafeInstanceType<E>): SafeInstanceType<T> | undefined {
      return this.elementAt(super.index(entt))
    }

    getAsRef (entt: SafeInstanceType<E>): IRef<SafeInstanceType<T> | undefined> {
      return {
        get: () => this.elementAt(super.index(entt)),
        set: (value: SafeInstanceType<T> | undefined) => {
          this.elementSet(super.index(entt), value!)
        }
      }
    }

    getAsTuple (entt: SafeInstanceType<E>): [SafeInstanceType<T> | undefined] {
      return [this.get(entt)]
    }

    private emplaceElement (entt: SafeInstanceType<E>, forceBack: boolean | undefined, ...args: SafeParameters<T> | [SafeInstanceType<T>]): SparseSetPointer<SafeInstanceType<E>> {
      const it = super.tryEmplace(entt, forceBack)
      let elem: SafeInstanceType<T> = undefined!
      try {
        if (args.length === 1 && args[0] instanceof TraitsType.ElementType) {
          elem = clone(args[0] as SafeInstanceType<T>)
        } else {
          elem = _new(...args as SafeParameters<T>)
        }
        this.elementSet(it.index(), elem)
      } catch (e) {
        super.pop(it, it.plus(1))
        throw e
      }
      return it
    }

    override tryEmplace (entt: SafeInstanceType<E>, forceBack: boolean | undefined, value?: any) {
      if (value != null) {
        return this.emplaceElement(entt, forceBack, value)
      }
      // @ts-expect-error -- ignore
      return this.emplaceElement(entt, forceBack)
    }

    emplace (entt: SafeInstanceType<E>, ...args: SafeParameters<T>): SafeInstanceType<T> {
      const it = this.emplaceElement(entt, false, ...args)
      return this.elementAt(it.index())!
    }

    insert (first: ForwardPointer<SafeInstanceType<E>, any>, last: ForwardPointer<SafeInstanceType<E>, any>, value: SafeInstanceType<T> = _new()): StoragePointer<SafeInstanceType<T>> {
      first = first.clone()
      last = last.clone()
      for (; !first.equals(last); first.selfPlus()) {
        const entt = first.deref()
        this.emplaceElement(entt, true, value!)
      }
      return this.begin()
    }

    insertRange (first: ForwardPointer<SafeInstanceType<E>, any>, last: ForwardPointer<SafeInstanceType<E>, any>, from: ForwardPointer<SafeInstanceType<T>, any>): StoragePointer<SafeInstanceType<T>> {
      first = first.clone()
      last = last.clone()
      from = from.clone()
      for (; !first.equals(last); first.selfPlus(), from.selfPlus()) {
        const entt = first.deref()
        this.emplaceElement(entt, true, from.deref())
      }
      return this.begin()
    }

    patch<F extends (instance: SafeInstanceType<T>) => SafeInstanceType<T> | undefined> (entt: SafeInstanceType<E>, ...func: F[]): SafeInstanceType<T> {
      const idx = super.index(entt) // assert existence
      let elem: SafeInstanceType<T> = undefined!
      for (const f of func) {
        elem = this.elementAt(idx)!
        const update = f(elem)
        if (update != null) {
          this.elementSet(idx, update)
          elem = update
        }
      }
      return elem
    }

    override pop (first: SparseSetPointer<SafeInstanceType<E>>, last: SparseSetPointer<SafeInstanceType<E>>): void {
      first = first.clone()
      last = last.clone()
      for (; !first.equals(last); first.selfPlus()) {
        if (TraitsType.inPlaceDelete) {
          const entt = first.deref()
          const idx = super.index(entt)
          super.inPlacePop(entt)
          this.elementSet(idx, undefined!)
        } else {
          const lastIndex = super.size - 1
          const entt = first.deref()
          const idx = super.index(entt)

          if (idx !== lastIndex) {
            const tmp = this.elementAt(lastIndex)!
            this.elementSet(idx, tmp)
            this.elementSet(lastIndex, undefined!)
          } else {
            this.elementSet(lastIndex, undefined!)
          }
          super.swapAndPop(entt)
        }
      }
    }

    override popAll (): void {
      for (const first = super.begin(); !(first.index() < 0); first.selfPlus()) {
        if (TraitsType.inPlaceDelete) {
          if (!this.isTombstone(first.deref())) {
            super.inPlacePop(first.deref())
            this.elementSet(first.index(), undefined!)
          }
        } else {
          super.swapAndPop(first.deref())
          this.elementSet(first.index(), undefined!)
        }
      }
    }

    private swapAt (from: number, to: number) {
      const tmp = this.elementAt(from)!
      this.elementSet(from, this.elementAt(to)!)
      this.elementSet(to, tmp)
    }

    private moveTo (from: number, to: number) {
      const tmp = this.elementAt(from)!
      this.elementSet(from, undefined!)
      this.elementSet(to, tmp)
    }

    override swapOrMove (from: number, to: number) {
      if (this.mode === DeletionPolicy.InPlace) {
        const entity = super.access(to)
        if (entity != null && BaseType.TraitsType.isTombstone(entity)) {
          this.moveTo(from, to)
        } else {
          BasicStorage.prototype.swapAt.call(this, from, to)
        }
      } else {
        BasicStorage.prototype.swapAt.call(this, from, to)
      }
    }
    
    // @ts-expect-error -- ignore
    [Symbol.iterator]() {
      return toIterator(this)
    }

    // @ts-expect-error -- ignore
    entries (): IteratorObject<[SafeInstanceType<E>, SafeInstanceType<T>]> {
      const kBegin = super.begin()
      const vBegin = this.begin()
      const kEnd = super.end()
      const vEnd = this.end()
      const f = new AggregatePointer([kBegin, vBegin])
      const l = new AggregatePointer([kEnd, vEnd])
      return toIterator(f, l)
    }

    capacity (): number {
      return this.payload.length * TraitsType.pageSize
    }

    // @ts-expect-error -- ignore
    begin () {
      return new StoragePointer(TraitsType.pageSize, this.payload, this.size)
    }

    // @ts-expect-error -- ignore
    end () {
      return new StoragePointer(TraitsType.pageSize, this.payload, 0)
    }

    // @ts-expect-error -- ignore
    rbegin () {
      return makeReversePointer<StoragePointer<SafeInstanceType<T>>>(this.end())
    }

    // @ts-expect-error -- ignore
    rend () {
      return makeReversePointer<StoragePointer<SafeInstanceType<T>>>(this.begin())
    }

    each (): IteratorObject<[SafeInstanceType<E>, SafeInstanceType<T>]> {
      return this.entries()
    }

    reach (): IteratorObject<[SafeInstanceType<E>, SafeInstanceType<T>]> {
      const kBegin = super.rbegin()
      const vBegin = this.rbegin()
      const kEnd = super.rend()
      const vEnd = this.rend()
      const f = new AggregatePointer([kBegin, vBegin])
      const l = new AggregatePointer([kEnd, vEnd])
      return toIterator(f, l)
    }

    // @ts-expect-error -- ignore
    forEach (callbackfn: (value: SafeInstanceType<T>, value2: SafeInstanceType<E>, obj: Storage<SafeInstanceType<T>, SafeInstanceType<E>>) => void, thisArg?: any): void {
      const begin = this.begin()
      const end = this.end()
      for (; !begin.equals(end); begin.selfPlus()) {
        const value = begin.deref()
        const key = this.data()[begin.index()]
        callbackfn.call(thisArg, value, key, this as any)
      }
    }
  }
  return BasicStorage
}, [
  {
    predicate: (Type: Function, Entity: Function) => (Entity === undefined || Object.is(Entity, Type)),
    render: ((Entity: EntityConstructor) => {
      type C = EntityConstructor

      const UnderlyingType = basicSparseSetTemplate.instantiate(Entity)
      const BaseType = UnderlyingType
      const TraitsType = enttTraitsTemplate.instantiate(Entity)
      const storagePolicy = DeletionPolicy.SwapOnly

      return class BasicStorage extends BaseType {
        private placeholder: bigint
        static TraitsType = TraitsType
        static storagePolicy = storagePolicy
        static EntityType = Entity
        static ElementType = Entity
        static BaseType = BaseType
        static ValueType = undefined

        static Iterator = SparseSetPointer
        static ReverseIterator = ReversePointer

        constructor () {
          super(TraitsType.ValueType, storagePolicy)
          this.placeholder = 0n
        }

        dispose () {
          this.placeholder = 0n
          super.dispose()
        }

        private fromPlaceholder (): SafeInstanceType<C> {
          const entt = TraitsType.combine(TraitsType.EntityType(this.placeholder) as any, TraitsType.EntityType(0) as any)
          const isNullEntity = TraitsType.isNull(entt)
          __DEV__ && ENTT_ASSERT(!isNullEntity, "No more entities available")
          this.placeholder += !isNullEntity ? 1n : 0n
          return entt
        }

        private next (): SafeInstanceType<C> {
          let entt = this.fromPlaceholder()
          while (super.current(entt) !== TraitsType.toVersion(TraitsType.tombstone) && !TraitsType.isNull(entt)) {
            entt = this.fromPlaceholder()
          }
          return entt
        }

        override popAll (): void {
          super.popAll()
          this.placeholder = 0n
        }

        override tryEmplace (hint?: SafeInstanceType<C>) {
          return super.find(this.generate(hint))
        }

        get (entt: SafeInstanceType<C>): void {
          __DEV__ && ENTT_ASSERT(super.index(entt) < super.freeList(), 'The requested entity is not a live one')
        }

        getAsRef (entt: SafeInstanceType<C>): IRef<void> {
          __DEV__ && ENTT_ASSERT(super.index(entt) < super.freeList(), 'The requested entity is not a live one')
          return {
            get: () => {},
            set: () => {}
          }
        }

        getAsTuple (entt: SafeInstanceType<C>): [] {
          __DEV__ && ENTT_ASSERT(super.index(entt) < super.freeList(), 'The requested entity is not a live one')
          return []
        }

        startFrom (hint: SafeInstanceType<C>): void {
          this.placeholder = BigInt(TraitsType.toEntity(hint))
        }

        generate (hint?: SafeInstanceType<C>): SafeInstanceType<C> {
          if (hint != null && !TraitsType.isNull(hint) && !TraitsType.isTombstone(hint)) {
            const curr = TraitsType.construct(TraitsType.toEntity(hint), super.current(hint))
            if (TraitsType.isTombstone(curr) || super.index(curr) >= super.freeList()) {
              return super.tryEmplace(hint, true).deref()
            }
          }
          const len = super.freeList() as any
          const entt = len === Uint64(super.size) ? this.next() : super.data()[len]
          return super.tryEmplace(entt, true).deref()
        }

        generateRange (first: Range<ForwardPointer<SafeInstanceType<C>, any>> | ForwardPointer<SafeInstanceType<C>, any>, last: ForwardPointer<SafeInstanceType<C>, any>): void {
          const [f, l] = makeRangePointer(first, last)
          const sz = Uint64(super.size)
          for (; !f.equals(l) && super.freeList() !== sz; f.selfPlus()) {
            f.write(super.tryEmplace(super.data()[super.freeList() as any], true).deref())
          }
          for (; !f.equals(l); f.selfPlus()) {
            f.write(super.tryEmplace(this.next(), true).deref())
          }
        }

        insert (first: ForwardPointer<SafeInstanceType<C>, any>, last: ForwardPointer<SafeInstanceType<C>, any>): void {
          first = first.clone()
          last = last.clone()
          for (; !first.equals(last); first.selfPlus()) {
            const entt = first.deref()
            super.tryEmplace(entt, true)
          }
        }

        patch<F extends () => any> (entt: SafeInstanceType<C>, ...func: F[]): void {
          __DEV__ && ENTT_ASSERT(super.index(entt) < super.freeList(), 'The requested entity is not a live one')
          for (const f of func) {
            f()
          }
        }

        each () {
          const it = super.end()
          const offset = super.freeList()
          const start = it.minus(Number(offset))
          return toIterator(new AggregatePointer([start]), new AggregatePointer([it]))
        }

        reach () {
          const it = super.rbegin()
          const offset = super.freeList()
          return toIterator(
            new AggregatePointer([new ReversePointer(it)]),
            new AggregatePointer([new ReversePointer(it.plus(Number(offset)))])
          )
        }
      } as any
    }) as any
  }
])

export interface StorageTemplate {
  (Type: DefaultEntityConstructor): EntityStorageConstructor<DefaultEntityConstructor>
  <T extends Function>(Type: T): BasicStorageConstructor<T, DefaultEntityConstructor>
}

export const storageTemplate = defineTemplate<{
  (Type: DefaultEntityConstructor): EntityStorageConstructor<DefaultEntityConstructor>
  <T extends Function>(Type: T): BasicStorageConstructor<T, DefaultEntityConstructor>
}>(function (Type: Function): any {
  return basicStorageTemplate.instantiate(Type, Entity)
})

export const storageTypeTemplate = defineTemplate<{
  <T extends Function, E extends EntityConstructor>(Type: T, EntityType: E): any
}>(function (Type: Function, EntityType: EntityConstructor): any {
  return class StorageType {
    static Type = config.mixin ? basicSighMixinTemplate.instantiate(basicStorageTemplate.instantiate(Type, EntityType)) : basicStorageTemplate.instantiate(Type, EntityType)
  }
})

export const storageTypeTTemplate = defineTemplate<{
  (...args: any[]): any
}>(function (...args: any[]): any {
  return (storageTypeTemplate as any).instantiate(...args).Type
})
