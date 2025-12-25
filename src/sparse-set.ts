import { Disposable } from "./disposable"
import { enttTraitsTemplate, type CustomEntityConstructor, type EntityConstructor, type EnttTraits } from "./entity"
import { type ForwardPointer, type IterableHelpers, toIterator, makeReversePointer, type RandomAccessPointer, type Range, type ReversableRange, ReversePointer, AggregatePointer } from "./iterator"
import { defineTemplate } from "./template"
import { Entity, Uint64 } from "./type"
import { defaultSort, assert as ENTT_ASSERT, fastMod, isExtendsFrom, type IRef } from "./util"
import type { SafeInstanceType } from "./config"

export const DeletionPolicy = {
  SwapAndPop: 0,
  InPlace: 1,
  SwapOnly: 2,
  Unspecified: 0,
  0: 'SwapAndPop',
  1: 'InPlace',
  2: 'SwapOnly'
} as const
export type DeletionPolicy = Extract<typeof DeletionPolicy[keyof typeof DeletionPolicy], number>

export interface BaseSparseSet<T, VersionType> extends Disposable {
  mode: DeletionPolicy
  reserve (cap: number): void
  data (): T[]
  policy (): DeletionPolicy
  type (): Function | undefined
  empty (): boolean
  isNull (entity: T): boolean
  isTombstone (entity: T): boolean
  inPlacePop (entity: T): void
  swapAndPop (entity: T): void
  swapOrMove (_lhs: number, _rhs: number): void
  tryEmplace(value: T, forcePush?: boolean, elem?: any): SparseSetPointer<T>
  pop (first: SparseSetPointer<T>, last: SparseSetPointer<T>): void
  popAll (): void
  freeList (value?: number | bigint): bigint
  contiguous (): boolean
  push(entity: T, elem?: any): SparseSetPointer<T>
  pushRange (iterable: Range<ForwardPointer<T, any>>): SparseSetPointer<T>
  pushRange (first: ForwardPointer<T, any>, last: ForwardPointer<T, any>): SparseSetPointer<T>
  add(value: T): this
  clear(): void
  erase (value: T): void
  erase (first: ForwardPointer<T, any>, last: ForwardPointer<T, any>): void
  delete(value: T): boolean
  remove(value: T): boolean
  remove(first: ForwardPointer<T, any>, last: ForwardPointer<T, any>): number
  contains(value: T): boolean
  has(value: T): boolean
  at (index: number): T
  access (pos: number): T | undefined
  current (value: T): VersionType
  bump (value: T): VersionType
  index (value: T): number
  find (value: T): SparseSetPointer<T>
  toIterator (entt: T): SparseSetPointer<T>
  bind (value: any): void
  compact (): void
  swapElements (lhs: T, rhs: T): void
  sortN (length: number, compareFn?: (a: T, b: T) => number, algo?: (arr: T[], compare?: (a: T, b: T) => number) => T[]): void
  sort (compareFn?: (a: T, b: T) => number, algo?: (arr: T[], compare?: (a: T, b: T) => number) => T[]): void
  sortAs (range: Range<ForwardPointer<T, any>>): SparseSetPointer<T>
  sortAs (first: ForwardPointer<T, any>, last: ForwardPointer<T, any>): SparseSetPointer<T>
  readonly size: number
}

export interface BasicSparseSet<T, VersionType> extends BaseSparseSet<T, VersionType>, ReversableRange<SparseSetPointer<T>>, IterableHelpers<T, T, BasicSparseSet<T, VersionType>> {
}

export interface SparseSetConstructor<T extends EntityConstructor> {
  BasicIterator: typeof SparseSetPointer<SafeInstanceType<T>>
  Iterator: typeof SparseSetPointer<SafeInstanceType<T>>
  ReverseIterator: typeof ReversePointer<SparseSetPointer<SafeInstanceType<T>>>
  TraitsType: EnttTraits<T>
  EntityType: EnttTraits<T>['ValueType']
  new (mode?: DeletionPolicy): BasicSparseSet<SafeInstanceType<T>, SafeInstanceType<EnttTraits<T>['VersionType']>>
  new (Type: Function, mode?: DeletionPolicy): BasicSparseSet<SafeInstanceType<T>, SafeInstanceType<EnttTraits<T>['VersionType']>>
  isTombstone (entity: SafeInstanceType<T>): boolean
  isNull (entity: SafeInstanceType<T>): boolean
  prototype: BasicSparseSet<SafeInstanceType<T>, SafeInstanceType<EnttTraits<T>['VersionType']>>
}

export class SparseSetPointer<T> implements RandomAccessPointer<T, SparseSetPointer<T>> {
  private packed: T[]

  private offset: number

  constructor ()
  constructor (packed: T[], offset: number)
  constructor (packed: T[] | null = null, offset = 0) {
    this.packed = packed!
    this.offset = offset
  }

  clone (target?: SparseSetPointer<T>): SparseSetPointer<T> {
    if (target) {
      if (this === target) return target
      target.packed = this.packed
      target.offset = this.offset
      return target
    }
    return new SparseSetPointer(this.packed, this.offset)
  }

  swap (other: SparseSetPointer<T>): void {
    if (this === other) return
    const t = this.packed
    this.packed = other.packed
    other.packed = t
    const o = this.offset
    this.offset = other.offset
    other.offset = o
  }

  data () {
    return this.packed
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
    return new SparseSetPointer(this.packed, this.offset - n)
  }

  minus (n: number) {
    return new SparseSetPointer(this.packed, this.offset + n)
  }

  diff (other: SparseSetPointer<any>): number {
    return other.index() - this.index()
  }

  equals (other: SparseSetPointer<any>): boolean {
    return this.index() === other.index()
  }

  lt (other: SparseSetPointer<any>): boolean {
    return this.index() > other.index()
  }

  gt (other: SparseSetPointer<any>): boolean {
    return this.index() < other.index()
  }

  le (other: SparseSetPointer<any>): boolean {
    return !this.gt(other)
  }

  ge (other: SparseSetPointer<any>): boolean {
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
    if (__DEV__) {
      if (idx < 0 || idx >= this.packed.length) {
        throw new RangeError(`Iterator access out of range: ${idx}, [0, ${this.packed.length})`)
      }
    }
    return this.packed[idx]
  }

  set (off: number, value: T): void {
    const idx = this.index() - off
    if (__DEV__) {
      if (idx < 0 || idx >= this.packed.length) {
        throw new RangeError(`Iterator access out of range: ${idx}, [0, ${this.packed.length})`)
      }
    }
    this.packed[idx] = value
  }

  index (): number {
    return this.offset - 1
  }

  [Symbol.toPrimitive](hint: string): string | number {
    const pos = this.packed.length - 1 - this.index()
    if (hint === 'string') {
      return pos.toString()
    }
    return pos
  }
}

/* Object.defineProperty(SparseSetPointer.prototype, Symbol.toStringTag, {
  value: `SparseSet Iterator`,
  writable: false,
  enumerable: false,
  configurable: true
}) */

export interface BasicSparseSetTemplate {
  <EC extends EntityConstructor>(EntityType: EC): SparseSetConstructor<EC>
}

export const basicSparseSetTemplate = defineTemplate<BasicSparseSetTemplate>(function <EC extends EntityConstructor> (EntityType: EC) {
  const traits = enttTraitsTemplate.instantiate(EntityType)
  const typeName = (traits.ValueType as CustomEntityConstructor<any, any>).name
  const maxSize = Uint64(traits.toEntity(traits.null))
  const pageSize = Uint64(traits.pageSize)

  const policyToHead = (mode: DeletionPolicy): bigint => (
    mode === DeletionPolicy.SwapOnly
      ? Uint64(0)
      : maxSize
  )

  const entityToPos = (entity: SafeInstanceType<EC>): bigint => Uint64(traits.toEntity(entity))

  const posToPage = (pos: bigint): bigint => (pos / pageSize)

  const _contains = (() => {
    const cap = traits.entityMask
    const mask = traits.toIntegral(traits.null) & ~cap
    return isExtendsFrom(traits.EntityType, [Number])
      ? (self: any, entity: VT): boolean => {
          const elem = self.sparsePtr(entity)
          if (elem == null) return false
          const check = ((mask & traits.toIntegral(entity)) ^ traits.toIntegral(elem)) >>> 0
          return check < traits.entityMask
        }
      : (self: any, entity: VT): boolean => {
          const elem = self.sparsePtr(entity)
          if (elem == null) return false
          const check = traits.EntityType((mask & traits.toIntegral(entity)) ^ traits.toIntegral(elem))
          return check < traits.entityMask
      }
  })()

  type VT = SafeInstanceType<EnttTraits<EC>['ValueType']>
  type ET = SafeInstanceType<EnttTraits<EC>['EntityType']>

  type BigIntIndex = any

  return class BasicSparseSet extends Disposable {
    static BasicIterator = SparseSetPointer
    static Iterator = BasicSparseSet.BasicIterator
    static ReverseIterator = ReversePointer
    static TraitsType = traits
    static EntityType = traits.ValueType

    private readonly sparse: VT[] // (entity & idx_mask) -> combine(index(packed), entity)
    private readonly packed: VT[]
    protected readonly mode: DeletionPolicy
    private head: bigint
    private readonly Type: Function | undefined

    private sparsePtr (entity: SafeInstanceType<EC>): VT | null {
      const pos = entityToPos(entity)
      const page = posToPage(pos) as BigIntIndex
      return (page < this.sparse.length && this.sparse[page]) ? this.sparse[page][fastMod(pos, pageSize)] : null
    }

    private sparseRef (entity: SafeInstanceType<EC>): IRef<VT> {
      const pos = entityToPos(entity)
      const page = posToPage(pos) as BigIntIndex
      __DEV__ && ENTT_ASSERT((page < this.sparse.length && this.sparse[page]), 'Invalid element')
      const pageIndex = fastMod(pos, pageSize)
      return {
        get: () => this.sparse[page][pageIndex],
        set: (value: VT) => {
          this.sparse[page][pageIndex] = value
        }
      }
    }

    private assureAtLeast (entity: SafeInstanceType<EC>): IRef<VT> {
      const pos = entityToPos(entity)
      const page = posToPage(pos) as BigIntIndex

      while (this.sparse.length <= page) {
        this.sparse.push(Array(traits.pageSize).fill(traits.null) as any)
      }

      const pageIndex = fastMod(pos, pageSize)
      return {
        get: () => this.sparse[page][pageIndex],
        set: (value: VT) => {
          this.sparse[page][pageIndex] = value
        }
      }
    }

    public static isNull (entity: VT): boolean {
      return traits.isNull(entity)
    }

    public static isTombstone (entity: VT): boolean {
      return traits.isTombstone(entity)
    }

    public constructor (mode?: DeletionPolicy)
    public constructor (Type: new (...args: any[]) => any, mode?: DeletionPolicy)
    public constructor (TypeOrMode?: DeletionPolicy | Function, modeOrUndefined?: DeletionPolicy) {
      super()
      this.sparse = []
      this.packed = []
      const mode = typeof TypeOrMode === 'number' ? TypeOrMode as DeletionPolicy : (modeOrUndefined ?? DeletionPolicy.SwapAndPop)
      this.mode = mode
      this.head = policyToHead(mode)
      this.Type = typeof TypeOrMode === 'function' ? TypeOrMode : undefined
      __DEV__ && ENTT_ASSERT(traits.versionMask || mode !== DeletionPolicy.InPlace, 'Policy does not support zero-sized versions')
    }

    public dispose () {
      this.clear()
    }

    public reserve (cap: number): void {
      if (cap > this.packed.length) {
        this.packed.length = cap
      }
    }

    public data () {
      return this.packed
    }

    public policy () {
      return this.mode
    }

    public isNull (entity: VT): boolean {
      return traits.isNull(entity)
    }

    public isTombstone (entity: VT): boolean {
      return traits.isTombstone(entity)
    }

    public type () {
      return this.Type
    }

    public empty (): boolean {
      return this.packed.length === 0
    }

    public get size (): number {
      return this.packed.length
    }

    public freeList (value?: number | bigint): bigint {
      if (value != null) {
        __DEV__ && ENTT_ASSERT(this.mode === DeletionPolicy.SwapOnly && !(value > this.packed.length), 'Invalid value')
        this.head = Uint64(value)
      }
      return this.head
    }

    public contiguous (): boolean {
      return this.mode !== DeletionPolicy.InPlace || this.head === maxSize
    }

    public access (pos: number): VT | undefined {
      __DEV__ && ENTT_ASSERT(pos < this.packed.length, "Index out of bounds")
      return this.packed[pos]
    }

    private swapAt (lhs: number | bigint, rhs: number | bigint): void {
      const from = this.packed[lhs as number]
      const to = this.packed[rhs as number]

      this.sparseRef(from).set(traits.combine(traits.EntityType(rhs), traits.toIntegral(from)))
      this.sparseRef(to).set(traits.combine(traits.EntityType(lhs), traits.toIntegral(to)))

      this.packed[lhs as number] = to
      this.packed[rhs as number] = from
    }

    /** @virtual */
    protected tryEmplace (entity: VT, forceBack = false, _value?: any) {
      __DEV__ && ENTT_ASSERT(!traits.isNull(entity) && !traits.isTombstone(entity), 'Invalid element')

      const elem = BasicSparseSet.prototype.assureAtLeast.call(this, entity)
      let pos = this.size

      switch (this.mode) {
        case DeletionPolicy.InPlace:
          if (this.head !== maxSize && !forceBack) {
            pos = Number(this.head)
            __DEV__ && ENTT_ASSERT(elem.get() == null || traits.isNull(elem.get()), 'Slot not available')
            elem.set(traits.combine(traits.EntityType(this.head) as ET, traits.toIntegral(entity)))
            this.head = Uint64(traits.toEntity(this.packed[pos]))
            this.packed[pos] = entity
            break
          }
        // eslint-disable-next-line no-fallthrough -- expected fallthrough
        case DeletionPolicy.SwapAndPop:
          __DEV__ && ENTT_ASSERT(elem.get() == null || traits.isNull(elem.get()), 'Slot not available')
          this.packed.push(entity)
          elem.set(traits.combine(traits.EntityType(this.packed.length - 1), traits.toIntegral(entity)))
          break
        
        case DeletionPolicy.SwapOnly:
          if (elem.get() == null || traits.isNull(elem.get())) {
            this.packed.push(entity)
            elem.set(traits.combine(traits.EntityType(this.packed.length - 1), traits.toIntegral(entity)))
          } else {
            __DEV__ && ENTT_ASSERT(!(entityToPos(elem.get()) < this.head), 'Slot not available')
            this.bump(entity)
          }
          pos = Number(this.head)
          this.head++
          BasicSparseSet.prototype.swapAt.call(this, entityToPos(elem.get()), pos)
          break
        default: throw new Error('Unsupported operation')
      }

      return new BasicSparseSet.BasicIterator(this.packed, pos + 1)
    }

    public push (entity: VT, elem?: any): SparseSetPointer<SafeInstanceType<EC>> {
      return this.tryEmplace(entity, false, elem)
    }

    public pushRange (iterable: Range<ForwardPointer<VT, any>> | ForwardPointer<VT, any>, last?: ForwardPointer<VT, any>): SparseSetPointer<SafeInstanceType<EC>> {
      let first: ForwardPointer<VT, any> = undefined!
      if (last != null) {
        first = (iterable as ForwardPointer<VT, any>).clone()
        last = last.clone()
      } else {
        first = (iterable as Range<ForwardPointer<VT, any>>).begin()
        last = (iterable as Range<ForwardPointer<VT, any>>).end()
      }
      let curr = BasicSparseSet.prototype.end.call(this)
      for (; !first.equals(last); first.selfPlus()) {
        curr = this.tryEmplace(first.deref(), true)
      }
      return curr
    }

    public add (entity: VT): this {
      this.push(entity)
      return this
    }

    public contains (entity: VT): boolean {
      return _contains(this, entity)
    }

    public has (entity: VT): boolean {
      return this.contains(entity)
    }

    private swapAndPop (entity: VT): void {
      __DEV__ && ENTT_ASSERT(this.mode === DeletionPolicy.SwapAndPop, 'Deletion policy mismatch')
      const self = this.sparseRef(entity)
      const entt = traits.toEntity(self.get())
      this.sparseRef(this.packed[this.packed.length - 1]).set(traits.combine(entt, traits.toIntegral(this.packed[this.packed.length - 1])))
      this.packed[entt] = this.packed[this.packed.length - 1]
      __DEV__ && ENTT_ASSERT((this.packed[this.packed.length - 1] = traits.null, true), '')
      self.set(traits.null)
      this.packed.pop()
    }

    private inPlacePop (entity: VT): void {
      __DEV__ && ENTT_ASSERT(this.mode === DeletionPolicy.InPlace, 'Deletion policy mismatch')
      const ref = this.sparseRef(entity)
      const tmp = ref.get()
      ref.set(traits.null)
      const pos = entityToPos(tmp) as BigIntIndex
      const head = this.head
      this.head = Uint64(traits.EntityType(pos))
      this.packed[pos] = traits.combine(traits.EntityType(head), traits.EntityType(traits.tombstone))
    }

    private swapOnly (entity: VT): void {
      __DEV__ && ENTT_ASSERT(this.mode === DeletionPolicy.SwapOnly, 'Deletion policy mismatch')
      const pos = this.index(entity)
      this.bump(traits.next(entity))
      if (pos < this.head) {
        this.head--
      }
      BasicSparseSet.prototype.swapAt.call(this, pos, this.head)
    }

    /** @virtual */
    protected pop (first: SparseSetPointer<VT>, last: SparseSetPointer<VT>): void {
      first = first.clone()
      last = last.clone()
      if (this.mode === DeletionPolicy.SwapAndPop) {
        for (; !first.equals(last); first.selfPlus()) {
          this.swapAndPop(first.deref())
        }
      } else if (this.mode === DeletionPolicy.InPlace) {
        for (; !first.equals(last); first.selfPlus()) {
          this.inPlacePop(first.deref())
        }
      } else if (this.mode === DeletionPolicy.SwapOnly) {
        for (; !first.equals(last); first.selfPlus()) {
          this.swapOnly(first.deref())
        }
      } else {
        throw new Error('Unsupported operation')
      }
    }

    /** @virtual */
    protected popAll (): void {
      switch (this.mode) {
        case DeletionPolicy.InPlace:
          if (this.head !== maxSize) {
            for (const elem of this.packed) {
              if (!traits.isTombstone(elem)) {
                this.sparseRef(elem).set(traits.null)
              }
            }
            break
          }
        // eslint-disable-next-line no-fallthrough -- expected fallthrough
        case DeletionPolicy.SwapOnly:
        case DeletionPolicy.SwapAndPop:
          for (const elem of this.packed) {
            this.sparseRef(elem).set(traits.null)
          }
          break
      }
      this.head = policyToHead(this.mode)
      this.packed.length = 0
    }

    public erase (entity: VT): void
    public erase (first: ForwardPointer<VT, any>, last: ForwardPointer<VT, any>): void
    public erase (first: VT | ForwardPointer<VT, any>, last?: ForwardPointer<VT, any>): void {
      if (last != null) {
        if (first instanceof SparseSetPointer && last instanceof SparseSetPointer) {
          this.pop(first, last)
        } else {
          const f = (first as ForwardPointer<VT, any>).clone()
          last = last.clone()
          for(; !f.equals(last); f.selfPlus()) {
            this.erase(f.deref())
          }
        }
      } else {
        const it = this.toIterator(first as VT)
        this.pop(it, it.plus(1))
      }
    }

    public remove (entity: VT): boolean
    public remove (first: ForwardPointer<VT, any>, last: ForwardPointer<VT, any>): number
    public remove (entity: VT | ForwardPointer<VT, any>, last?: ForwardPointer<VT, any>): number | boolean {
      if (last != null) {
        let count = 0
        const first = (entity as ForwardPointer<VT, any>).clone()
        const l = last.clone()
        if (entity instanceof SparseSetPointer && last instanceof SparseSetPointer) {
          while (!first.equals(l)) {
            while (!first.equals(l) && !this.contains(first.deref())) {
              first.selfPlus()
            }
            const it = first.clone()

            while (!first.equals(l) && this.contains(first.deref())) {
              first.selfPlus()
            }

            count += first.diff(it)
            this.erase(it, first)
          }
        } else {
          for (; !first.equals(l); first.selfPlus()) {
            count += Number(this.remove(first.deref()))
          }
        }
        return count
      } else {
        if (!this.has(entity as VT)) return false
  
        this.erase(entity as VT)
        return true
      }
    }

    public delete (entity: VT): boolean {
      return this.remove(entity)
    }

    public clear (): void {
      this.popAll()
      __DEV__ && ENTT_ASSERT((this.compact(), this.size) === 0, 'Non-empty set')
      this.head = policyToHead(this.mode)
      this.packed.length = 0
    }

    public forEach (callbackfn: (value: any, value2: any, set: BasicSparseSet) => void, thisArg?: any): void {
      for (let i = this.packed.length - 1; i >= 0; --i) {
        const item = this.packed[i]
        callbackfn.call(thisArg, item, item, this)
      }
    }

    public at (index: number): VT {
      return this.packed[(this.packed.length - 1 - index) % this.packed.length]
    }

    public keys () {
      return this[Symbol.iterator]()
    }

    public values () {
      return this[Symbol.iterator]()
    }

    public entries () {
      const begin = BasicSparseSet.prototype.begin.call(this) as SparseSetPointer<SafeInstanceType<EC>>
      const end = BasicSparseSet.prototype.end.call(this) as SparseSetPointer<SafeInstanceType<EC>>
      const f = new AggregatePointer([begin, begin.clone()])
      const l = new AggregatePointer([end, end.clone()])
      return toIterator(f, l)
    }

    public current (entt: VT) {
      const elem = this.sparsePtr(entt)
      return elem != null ? traits.toVersion(elem) : traits.toVersion(traits.tombstone)
    }

    public bump (entt: VT) {
      const elem = this.sparseRef(entt)
      __DEV__ && ENTT_ASSERT(!traits.isNull(entt) && (elem.get() == null || !traits.isTombstone(elem.get())), 'Cannot set the required version')
      elem.set(traits.combine(traits.toIntegral(elem.get()), traits.toIntegral(entt)))
      this.packed[entityToPos(elem.get()) as BigIntIndex] = entt
      return traits.toVersion(entt)
    }

    public index (value: VT): number {
      __DEV__ && ENTT_ASSERT(this.contains(value), "Set does not contain entity")
      return Number(entityToPos(this.sparsePtr(value)!))
    }

    public find (value: VT): SparseSetPointer<VT> {
      return this.has(value) ? this.toIterator(value) : BasicSparseSet.prototype.end.call(this)
    }

    public begin () {
      return new BasicSparseSet.BasicIterator(this.packed, this.packed.length)
    }

    public end () {
      return new BasicSparseSet.BasicIterator(this.packed, 0)
    }

    public rbegin () {
      return makeReversePointer(BasicSparseSet.prototype.end.call(this))
    }

    public rend () {
      return makeReversePointer(BasicSparseSet.prototype.begin.call(this))
    }

    public toIterator (entt: VT) {
      return BasicSparseSet.prototype.end.call(this).minus(this.index(entt)).selfMinus()
    }

    /** @virtual */
    protected bindAny (_value: any) {
      // do nothing
    }

    public bind (value: any) {
      this.bindAny(value)
    }

    /** @virtual */
    private swapOrMove (_lhs: number, _rhs: number) {
      __DEV__ && ENTT_ASSERT((this.mode !== DeletionPolicy.SwapOnly) || ((_lhs < this.head) === (_rhs < this.head)), 'Cross swapping is not supported')
    }

    public compact (): void {
      if (this.mode === DeletionPolicy.InPlace) {
        let from = this.packed.length
        let pos = this.head as BigIntIndex
        this.head = maxSize

        for (; from && traits.isTombstone(this.packed[from - 1]); --from) { /* empty */ }

        while (pos !== maxSize) {
          const to = pos
          pos = Uint64(entityToPos(this.packed[pos]))
          if (to < from) {
            --from
            this.swapOrMove(from, Number(to))

            this.packed[to] = this.packed[from]
            const elem = traits.EntityType(to)
            this.sparseRef(this.packed[to]).set(traits.combine(elem, traits.toIntegral(this.packed[to])))

            for (; from && traits.isTombstone(this.packed[from - 1]); --from) { /* empty */ }
          }
        }

        this.packed.length = from
      }
    }

    public sort (compareFn?: (a: VT, b: VT) => number, algo: (arr: VT[], compare?: (a: VT, b: VT) => number) => VT[] = defaultSort<VT>): void {
      const len = this.mode === DeletionPolicy.SwapOnly ? Number(this.head) : this.packed.length
      this.sortN(len, compareFn, algo)
    }

    public sortN (length: number, compareFn?: (a: VT, b: VT) => number, algo: (arr: VT[], compare?: (a: VT, b: VT) => number) => VT[] = defaultSort<VT>): void {
      __DEV__ && ENTT_ASSERT(this.mode !== DeletionPolicy.InPlace || this.head === maxSize, 'Sorting with tombstones is not allowed')
      __DEV__ && ENTT_ASSERT(!(length > this.packed.length), 'Length exceeds the number of elements')

      const reversedSlice = this.packed.slice(0, length).reverse()
      algo(reversedSlice, compareFn)

      for (let i = 0; i < length; ++i) {
        this.packed[length - 1 - i] = reversedSlice[i]
      }

      for (let pos = 0; pos < length; ++pos) {
        let curr = pos
        let next = this.index(this.packed[curr])

        while (curr !== next) {
          const idx = this.index(this.packed[next])
          const entt = this.packed[curr]

          this.swapOrMove(next, idx)
          const elem = traits.EntityType(curr)
          this.sparseRef(entt).set(traits.combine(elem, traits.toIntegral(this.packed[curr])))
          const old = next
          next = idx
          curr = old
        }
      }
    }

    private swapElements (lhs: VT, rhs: VT): void {
      const from = this.index(lhs)
      const to = this.index(rhs)
      this.swapOrMove(from, to)
      BasicSparseSet.prototype.swapAt.call(this, from, to)
    }

    public sortAs (range: Range<ForwardPointer<VT, any>>): SparseSetPointer<VT>
    public sortAs (first: ForwardPointer<VT, any>, last: ForwardPointer<VT, any>): SparseSetPointer<VT>
    public sortAs (rangeOrFirst: Range<ForwardPointer<VT, any>> | ForwardPointer<VT, any>, lastOrNull?: ForwardPointer<VT, any>): SparseSetPointer<VT> {
      __DEV__ && ENTT_ASSERT(this.mode !== DeletionPolicy.InPlace || this.head === maxSize, 'Sorting with tombstones is not allowed')
      const first = lastOrNull != null ? (rangeOrFirst as ForwardPointer<VT, any>).clone() : (rangeOrFirst as Range<ForwardPointer<VT, any>>).begin()
      const last = lastOrNull != null ? lastOrNull.clone() : (rangeOrFirst as Range<ForwardPointer<VT, any>>).end()

      const len = this.mode === DeletionPolicy.SwapOnly ? Number(this.head) : this.packed.length
      const it = BasicSparseSet.prototype.end.call(this).minus(len)
      const other = BasicSparseSet.prototype.end.call(this)

      for (; !it.equals(other) && !first.equals(last); first.selfPlus()) {
        const curr = first.deref()
        if (this.contains(curr)) {
          const entt = it.deref()
          if (traits.toIntegral(entt) !== traits.toIntegral(curr)) {
            this.swapElements(entt, curr!)
          }
          it.selfPlus()
        }
      }
      return it
    }

    public get [Symbol.toStringTag](): string {
      return `BasicSparseSet<${typeName}>`
    }

    public [Symbol.iterator]() {
      const begin = BasicSparseSet.prototype.begin.call(this)
      const end = BasicSparseSet.prototype.end.call(this)
      return toIterator(begin, end)
    }
  } as unknown as SparseSetConstructor<EC>
})

export const SparseSet = /*#__PURE__*/ (() => basicSparseSetTemplate.instantiate(Entity))()
export type SparseSet = InstanceType<typeof SparseSet>
