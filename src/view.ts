import type { EntityConstructor, EnttTraits } from "./entity"
import { AggregatePointer, type ForwardPointer, toIterator, toRange, type RangeIterator, type ReversePointer, type BidirectionalPointer } from "./iterator"
import { DeletionPolicy, SparseSetPointer, type SparseSetConstructor } from "./sparse-set"
import type { BasicStorageConstructor, EntityStorage, EntityStorageConstructor, Storage } from "./storage"
import { defineTemplate } from "./template"
import type { SafeInstanceType } from "./config"
import { AssertionError, assert as ENTT_ASSERT } from "./util"

export type BasicView<Entity, Items extends any[]> = Items extends [infer U]
  ? BasicViewExtendsBasicStorageView<U, Entity, number | bigint, ForwardPointer<Entity, any>, ReversePointer<BidirectionalPointer<Entity, any>>>
  : BasicViewExtendsBasicCommonView<Items, Entity, number | bigint>

const tombstoneCheck = (...args: any[]) => args.length === 1 && args[0].storagePolicy === DeletionPolicy.InPlace

const placeholderMap = new Map<Function, any>()
const viewPlaceholder = (Type: new () => any) => {
  if (!placeholderMap.has(Type)) {
    const instance = new Type()
    placeholderMap.set(Type, instance)
    return instance
  }
  return placeholderMap.get(Type)
}

function allOf<T>(first: ForwardPointer<T, any>, last: ForwardPointer<T, any>, entt: T): boolean {
  first = first.clone()
  last = last.clone()
  for (; !first.equals(last) && (first.deref() as any).contains(entt); first.selfPlus()) { /** empty */ }
  return first.equals(last)
}

function noneOf<T>(first: ForwardPointer<T, any>, last: ForwardPointer<T, any>, entt: T): boolean {
  first = first.clone()
  last = last.clone()
  for (; !first.equals(last) && !(first.deref() as any).contains(entt); first.selfPlus()) { /** empty */ }
  return first.equals(last)
}

function fullyInitialized<T>(first: ForwardPointer<T, any>, last: ForwardPointer<T, any>, placeholder: unknown): boolean {
  first = first.clone()
  last = last.clone()
  for (; !first.equals(last) && first.deref() !== placeholder; first.selfPlus()) { /** empty */ }
  return first.equals(last)
}

/* function isBaseOf (Base: any, Derived: any): boolean {
  if (Base === Derived) {
    return true
  }
  let Current = Derived
  while (Current != null) {
    if (Object.getPrototypeOf(Current) === Base) {
      return true
    }
    Current = Object.getPrototypeOf(Current)
  }
  return false
} */

function findSameBase (A: any, B: any): any {
  if (A === B) {
    return A
  }
  let CurrentA = A
  while (CurrentA != null) {
    let CurrentB = B
    while (CurrentB != null) {
      if (CurrentA === CurrentB) {
        return CurrentA
      }
      CurrentB = Object.getPrototypeOf(CurrentB)
    }
    CurrentA = Object.getPrototypeOf(CurrentA)
  }
  return null
}

export function commonType (...instances: any[]): any {
  if (instances.length === 0) {
    throw new Error('No storage type provided')
  }
  let Target = instances[0]
  for (let pos = 1; pos < instances.length; ++pos) {
    const Current = instances[pos]
    Target = findSameBase(Target, Current)
    if (Target == null) {
      throw new Error('No common storage type found')
    }
  }
  return Target
}

interface ViewPointer<E, V> extends ForwardPointer<E, ViewPointer<E, V>> {
  pools: Array<Storage<any, E, V>>
  valid(entt: E): boolean
  seekNext(): void
}

interface ViewPointerConstructor<E extends EntityConstructor> {
  new (): ViewPointer<SafeInstanceType<E>, SafeInstanceType<EnttTraits<E>['VersionType']>>
  new (
    first: SafeInstanceType<SparseSetConstructor<SafeInstanceType<E>>['Iterator']>,
    values: Array<Storage<any, any, any>>,
    excl: Array<Storage<any, any, any>>,
    idx: number
  ): ViewPointer<SafeInstanceType<E>, SafeInstanceType<EnttTraits<E>['VersionType']>>
  prototype: ViewPointer<SafeInstanceType<E>, SafeInstanceType<EnttTraits<E>['VersionType']>>
}

interface ViewPointerTemplate {
  <E extends EntityConstructor> (
    Type: SparseSetConstructor<SafeInstanceType<E>>,
    checked: boolean,
    get: number,
    exclude: number
  ): ViewPointerConstructor<E>
}

const viewPointerTemplate = defineTemplate<ViewPointerTemplate>(function<E extends EntityConstructor> (
  Type: SparseSetConstructor<SafeInstanceType<E>>,
  checked: boolean,
  get: number,
  exclude: number
) {
  const PointerType = Type.Iterator

  class ViewPointer {
    private it: SparseSetPointer<SafeInstanceType<E>>
    pools: Array<Storage<any, SafeInstanceType<E>, SafeInstanceType<EnttTraits<E>['VersionType']>>>
    private filter: Array<Storage<any, SafeInstanceType<E>, SafeInstanceType<EnttTraits<E>['VersionType']>>>
    private index: number

    valid (entt: SafeInstanceType<E>) {
      const pools = toRange(this.pools)
      const filter = toRange(this.filter)
      return (!checked || !Type.isTombstone(entt))
        && (get === 1 || allOf(pools.begin(), pools.begin().plus(this.index), entt) && allOf(pools.begin().plus(this.index + 1), pools.end(), entt))
        && (exclude === 0 || noneOf(filter.begin(), filter.end(), entt))
    }

    seekNext (): void {
      for (const sentinel = new PointerType(); !this.it.equals(sentinel as any) && !this.valid(this.it.deref()); this.it.selfPlus()) {/** empty */}
    }

    constructor ()
    constructor (
      first: SafeInstanceType<typeof PointerType>,
      values: Array<Storage<any, any, any>>,
      excl: Array<Storage<any, any, any>>,
      idx: number
    )
    constructor (
      first?: SafeInstanceType<typeof PointerType>,
      values?: Array<Storage<any, any, any>>,
      excl?: Array<Storage<any, any, any>>,
      idx?: number
    ) {
      if (first != null && values != null && excl != null && idx != null) {
        this.it = first.clone()
        this.pools = values
        this.filter = excl
        this.index = idx

        if (__DEV__) {
          if (values.length !== get) throw new AssertionError('View iterator get count mismatch')
          if (excl.length !== exclude) throw new AssertionError('View iterator exclude count mismatch')
          ENTT_ASSERT(get !== 1 || exclude !== 0 || this.pools[0].policy() === DeletionPolicy.InPlace, 'Non in-place storage view iterator')
        }

        this.seekNext()
      } else {
        this.it = new PointerType()
        this.pools = Array(get)
        this.filter = Array(exclude)
        this.index = 0
      }
    }

    selfPlus (): this {
      this.it.selfPlus()
      this.seekNext()
      return this
    }

    write (_value: SafeInstanceType<E>): SafeInstanceType<E> {
      throw new Error('Unsupported operation')
    }

    deref () {
      return this.it.deref()
    }

    equals (other: ViewPointer): boolean {
      return this.it.equals(other.it)
    }

    clone (target?: ViewPointer): ViewPointer {
      if (target) {
        if (this === target) return target
        this.it.clone(target.it)
        target.pools = this.pools
        target.filter = this.filter
        target.index = this.index
        return target
      }
      return new ViewPointer(this.it, this.pools, this.filter, this.index)
    }

    swap (other: ViewPointer): void {
      if (this === other) return
      const it = this.it
      this.it = other.it
      other.it = it
      const pools = this.pools
      this.pools = other.pools
      other.pools = pools
      const filter = this.filter
      this.filter = other.filter
      other.filter = filter
      const index = this.index
      this.index = other.index
      other.index = index
    }
  }

  return ViewPointer
})

class ExtendedViewPointer<It extends ForwardPointer<any, any>> {
  private readonly it: It & { pools: Array<Storage<any, any, any>> }

  constructor (it: It) {
    this.it = it.clone() as It & { pools: Array<Storage<any, any, any>> }
  }

  selfPlus (): this {
    this.it.selfPlus()
    return this
  }

  write (_value: unknown): unknown {
    throw new Error('Unsupported operation')
  }

  deref () {
    return [this.it.deref(), ...this.it.pools.flatMap((pool: Storage<any, any, any>) => pool.getAsTuple(this.it.deref()))]
  }

  equals (other: ExtendedViewPointer<It>): boolean {
    return this.it.equals(other.it)
  }

  clone (target?: ExtendedViewPointer<It>): ExtendedViewPointer<It> {
    if (target) {
      if (this === target) return target
      this.it.clone(target.it)
      return target
    }
    return new ExtendedViewPointer(this.it)
  }

  swap (other: ExtendedViewPointer<It>): void {
    if (this === other) return
    this.it.swap(other.it)
  }

  base () {
    return this.it.clone()
  }
}

interface BasicCommonView<T, E, V> extends Iterable<E> {
  pools: Array<Storage<T, E, V>>
  filter: Array<Storage<T, E, V>>
  refresh (): void
  handle (): Storage<any, E, V> | null
  sizeHint (): number
  begin (): ViewPointer<E, V>
  end (): ViewPointer<E, V>
  front (): E
  back (): E
  find (entt: E): ViewPointer<E, V>
  ok (): boolean
  [Symbol.toPrimitive] (): boolean
  contains (entt: E): boolean
  poolAt (index: number): Storage<T, E, V>
  poolAt (index: number, elem: Storage<T, E, V> | null): void
  filterAt (index: number): Storage<T, E, V> | null
  filterAt (index: number, elem: Storage<T, E, V> | null): void
  noneOf (entt: E): boolean
}

interface BasicCommonViewConstructor<T extends SparseSetConstructor<any>> {
  Iterator: ViewPointerConstructor<T['EntityType']>
  CommonType: T
  EntityType: T['EntityType']
  new (): BasicCommonView<any, T['EntityType'], SafeInstanceType<EnttTraits<T['EntityType']>['VersionType']>>
  new (
    value: Array<Storage<any, any, any>>,
    excl: Array<Storage<any, any, any>>
  ): BasicCommonView<any, T['EntityType'], SafeInstanceType<EnttTraits<T['EntityType']>['VersionType']>>
  prototype: BasicCommonView<any, T['EntityType'], SafeInstanceType<EnttTraits<T['EntityType']>['VersionType']>>
}

interface BasicCommonViewTemplate {
  <T extends SparseSetConstructor<any>> (
    Type: T,
    checked: boolean,
    get: number,
    exclude: number
  ): BasicCommonViewConstructor<T>
}

const basicCommonViewTemplate = defineTemplate<BasicCommonViewTemplate>(function<T extends SparseSetConstructor<any>> (
  Type: T,
  checked: boolean,
  get: number,
  exclude: number
) {
  const BasicCommonView = class {
    protected pools: Array<Storage<any, any, any>>
    protected filter: Array<Storage<any, any, any>>
    private index: number
    private readonly placeholder: any

    static Iterator = viewPointerTemplate.instantiate(Type, checked, get, exclude)
    static CommonType = Type
    static EntityType = Type.EntityType

    private offset () {
      __DEV__ && ENTT_ASSERT(this.index !== get, 'Invalid view')
      return (this.pools[this.index].policy() === DeletionPolicy.SwapOnly ? Number(this.pools[this.index].freeList()) : this.pools[this.index].size)
    }

    private uncheckedRefresh (): void {
      this.index = 0
      if (get > 1) {
        for (let pos = 1; pos < get; ++pos) {
          if (this.pools[pos].size < this.pools[this.index].size) {
            this.index = pos
          }
        }
      }
    }

    protected constructor ()
    protected constructor (value: Array<Storage<any, any, any>>, excl: Array<Storage<any, any, any>>)
    protected constructor (value?: Array<Storage<any, any, any>>, excl?: Array<Storage<any, any, any>>) {
      this.placeholder = viewPlaceholder(Type)
      if (Array.isArray(value) && Array.isArray(excl)) {
        if (__DEV__) {
          if (value.length !== get) {
            throw new Error('View pool count mismatch')
          }
          if (excl.length !== exclude) {
            throw new Error('View exclude count mismatch')
          }
        }
        this.pools = value
        this.filter = excl
        this.index = get
        this.uncheckedRefresh()
      } else {
        this.pools = Array(get)
        this.filter = Array(exclude)
        this.index = get
        for (let pos = 0, last = this.filter.length; pos < last; ++pos) {
          this.filter[pos] = this.placeholder
        }
      }
    }

    protected poolAt (index: number): Storage<any, any, any>
    protected poolAt (index: number, elem: any): void
    protected poolAt (index: number, elem?: any): Storage<any, any, any> | void {
      if (index < 0 || index >= get) {
        throw new Error('View pool index out of range')
      }
      if (elem !== undefined) {
        __DEV__ && ENTT_ASSERT(elem !== null, 'Unexpected element')
        this.pools[index] = elem
        this.refresh()
      } else {
        return this.pools[index]
      }
    }

    protected filterAt (index: number): Storage<any, any, any> | null
    protected filterAt (index: number, elem: any): void
    protected filterAt (index: number, elem?: any): Storage<any, any, any> | null | void {
      if (index < 0 || index >= exclude) {
        throw new Error('View filter index out of range')
      }
      if (elem !== undefined) {
        __DEV__ && ENTT_ASSERT(elem !== null, 'Unexpected element')
        this.filter[index] = elem
      } else {
        return this.filter[index] === this.placeholder ? null : this.filter[index]
      }
    }

    protected noneOf (entt: any): boolean {
      const range = toRange(this.filter)
      return noneOf(range.begin(), range.end(), entt)
    }

    protected use (pos: number): void {
      this.index = this.index !== get ? pos : get
    }

    refresh (): void {
      let pos = Number(this.index !== get) * get
      for (; pos < get && this.pools[pos] != null; ++pos) { /** empty */}
      if (pos === get) {
        this.uncheckedRefresh()
      }
    }

    handle (): Storage<any, any, any> | null {
      return this.index !== get ? this.pools[this.index] : null
    }

    sizeHint (): number {
      return this.index !== get ? this.offset() : 0
    }

    begin (): InstanceType<typeof BasicCommonView.Iterator> {
      return this.index !== get
        ? new BasicCommonView.Iterator(
            Type.prototype.end.call(this.pools[this.index]).minus(this.offset()),
            this.pools,
            this.filter,
            this.index
          )
        : new BasicCommonView.Iterator()
    }

    end (): InstanceType<typeof BasicCommonView.Iterator> {
      return this.index !== get
        ? new BasicCommonView.Iterator(
            Type.prototype.end.call(this.pools[this.index]),
            this.pools,
            this.filter,
            this.index
          )
        : new BasicCommonView.Iterator()
    }

    front (): any {
      const it = this.begin()
      return it.equals(this.end()) ? Type.TraitsType.null : it.deref()
    }

    back (): any {
      if (this.index !== get) {
        const it = this.pools[this.index].rbegin()
        const last = it.plus(this.offset())
        for (const idx = this.index; !it.equals(last) && !(allOf(toRange(this.pools).begin(), toRange(this.pools).begin().plus(idx), it.deref()) && allOf(toRange(this.pools).begin().plus(idx).plus(1), toRange(this.pools).end(), it.deref()) && noneOf(toRange(this.filter).begin(), toRange(this.filter).end(), it.deref())); it.selfPlus()) {/** empty */}
        return it.equals(last) ? Type.TraitsType.null : it.deref()
      }
      return Type.TraitsType.null
    }

    find (entt: any): InstanceType<typeof BasicCommonView.Iterator> {
      return this.contains(entt) ? new BasicCommonView.Iterator(this.pools[this.index].find(entt), this.pools, this.filter, this.index) : this.end()
    }

    ok (): boolean {
      return this.index !== get && fullyInitialized(toRange(this.filter).begin(), toRange(this.filter).end(), this.placeholder)
    }

    [Symbol.toPrimitive] (): boolean {
      return this.ok()
    }

    contains (entt: any): boolean {
      return this.index !== get
        && (checked ? !Type.isTombstone(entt) : true)
        && allOf(toRange(this.pools).begin(), toRange(this.pools).begin().plus(this.index), entt)
        && allOf(toRange(this.pools).begin().plus(this.index + 1), toRange(this.pools).end(), entt)
        && this.noneOf(entt)
    }

    [Symbol.iterator] (): RangeIterator<InstanceType<typeof BasicCommonView.Iterator>> {
      return toIterator(this)
    }
  }

  return BasicCommonView
})

export type ExtractStorageConstructor<T> = T extends Storage<any, any, any>
  ? BasicStorageConstructor<any, any>
  : T extends EntityStorage<any, any>
    ? EntityStorageConstructor<any>
    : never

export type ExtractStorageElement<T> = T extends Storage<infer Elem, any, any>
  ? Elem
  : unknown

export type ExtractStorageEntity<T> = T extends Storage<any, infer E, any>
  ? E
  : T extends EntityStorage<infer E, any>
    ? E
    : unknown

export type ExtractStorageVersion<T> = T extends Storage<any, any, infer V>
  ? V
  : T extends EntityStorage<any, infer V>
    ? V
    : unknown

export interface BasicViewExtendsBasicStorageView<T, E, V, It, Rit> extends BasicStorageView<T, E, V, It, Rit> {
  getStorageByElementType (_ElementType: any): Storage<T, E, V> | null
  getStorageByIndex (index?: number): Storage<T, E, V> | null
  setStorageByType (elem: Storage<T, E, V>): void
  setStorage (index: number, elem: Storage<T, E, V> | null): void
  access (entt: E): T | undefined
  getByElementType (entt: E, ElementType: any): T
  get (entt: E): [T]
  get (entt: E, index: number): T
  each<ComponentsOnly extends boolean = false>(func: ComponentsOnly extends true ? ((component: T) => void) : ((entity: E, component: T) => void), componentsOnly?: ComponentsOnly): void
  each(): RangeIterator<ForwardPointer<[E, ...[T]], any>>
  bitOr (other: E): any
}

export interface BasicViewExtendsBasicStorageViewConstructor<S extends Storage<any, any, any> | EntityStorage<any, any>> extends Omit<BasicStorageViewConstructor<ExtractStorageConstructor<S>['BaseType'], ExtractStorageConstructor<S>['storagePolicy']>, 'new' | 'prototype'> {
  CommonType: BasicStorageViewConstructor<ExtractStorageConstructor<S>['BaseType'], ExtractStorageConstructor<S>['storagePolicy']>['CommonType']
  EntityType: BasicStorageViewConstructor<ExtractStorageConstructor<S>['BaseType'], ExtractStorageConstructor<S>['storagePolicy']>['EntityType']
  Iterator: BasicStorageViewConstructor<ExtractStorageConstructor<S>['BaseType'], ExtractStorageConstructor<S>['storagePolicy']>['Iterator']
  ReverseIterator: BasicStorageViewConstructor<ExtractStorageConstructor<S>['BaseType'], ExtractStorageConstructor<S>['storagePolicy']>['ReverseIterator']
  new (
    value?: S | [S],
    _?: any
  ): BasicViewExtendsBasicStorageView<
    ExtractStorageElement<S>,
    ExtractStorageEntity<S>,
    ExtractStorageVersion<S>,
    SafeInstanceType<BasicStorageViewConstructor<ExtractStorageConstructor<S>['BaseType'], ExtractStorageConstructor<S>['storagePolicy']>['Iterator']>,
    SafeInstanceType<BasicStorageViewConstructor<ExtractStorageConstructor<S>['BaseType'], ExtractStorageConstructor<S>['storagePolicy']>['ReverseIterator']>
  >
  prototype: BasicViewExtendsBasicStorageView<
    ExtractStorageElement<S>,
    ExtractStorageEntity<S>,
    ExtractStorageVersion<S>,
    SafeInstanceType<BasicStorageViewConstructor<ExtractStorageConstructor<S>['BaseType'], ExtractStorageConstructor<S>['storagePolicy']>['Iterator']>,
    SafeInstanceType<BasicStorageViewConstructor<ExtractStorageConstructor<S>['BaseType'], ExtractStorageConstructor<S>['storagePolicy']>['ReverseIterator'], never>
  >
}

export interface BasicViewExtendsBasicCommonView<Items extends any[], E, V> extends BasicCommonView<any, E, V> {
  useByType (ElementType: any): void
  use (index: number): void
  getStorageByElementType (ElementType: any): Storage<any, E, V> | null
  getStorageByIndex (index: number): Storage<any, E, V> | null
  setStorageByType (elem: Storage<any, E, V>): void
  setStorage (index: number, elem: Storage<any, E, V> | null): void
  access (entt: E): Items
  getByElementType<Types extends Function[]> (entt: E, ...ElementTypes: Types): Types['length'] extends 1 ? SafeInstanceType<Types[0]> : { [K in keyof Types]: SafeInstanceType<Types[K]> }
  getByIndexes (entt: E, ...indexes: number[]): any[]
  each<ComponentsOnly extends boolean = false>(func: ComponentsOnly extends true ? ((...args: Items) => void) : ((...args: [E, ...Items]) => void), componentsOnly?: ComponentsOnly): void
  each(): RangeIterator<ForwardPointer<[E, ...Items], any>>
  bitOr (other: any): any
}

export interface BasicViewExtendsBasicCommonViewConstructor<Gets extends Array<Storage<any, any, any>>, Excludes extends Array<Storage<any, any, any>>> extends Omit<BasicCommonViewConstructor<SparseSetConstructor<any>>, 'new' | 'prototype'> {
  CommonType: SparseSetConstructor<any>
  EntityType: SparseSetConstructor<any>['EntityType']
  Iterator: ViewPointerConstructor<SparseSetConstructor<any>['EntityType']>
  new (
    value?: Gets,
    excl?: Excludes
  ): BasicViewExtendsBasicCommonView<
    { [K in keyof Gets]: ExtractStorageElement<Gets[K]> },
    ExtractStorageEntity<Gets[number]>,
    ExtractStorageVersion<Gets[number]>
  >
  prototype: BasicViewExtendsBasicCommonView<
    { [K in keyof Gets]: ExtractStorageElement<Gets[K]> },
    ExtractStorageEntity<Gets[number]>,
    ExtractStorageVersion<Gets[number]>
  >
}

export interface BasicViewTemplate {
  <const Gets extends Array<Storage<any, any, any>>, const Excludes extends Array<Storage<any, any, any>>>(
    Gets: Gets,
    Excludes?: Excludes
  ): [Gets, Excludes] extends [[Storage<any, any, any> | EntityStorage<any, any>], [] | undefined | null]
    ? BasicViewExtendsBasicStorageViewConstructor<Gets[0]>
    : BasicViewExtendsBasicCommonViewConstructor<Gets, Excludes>
}

export const basicViewTemplate = defineTemplate<BasicViewTemplate>(function (_Gets: any[], _Excludes: any[]): any {
  throw new Error('Invalid BasicView instantiation')
}, [
  {
    predicate: (Gets: any[], Excludes: any[]) => (Gets.length === 1 && (Excludes == null || Excludes.length === 0)),
    render (Gets: any[], _Excludes: any[]) {
      const Get = (Gets[0].constructor as EntityStorageConstructor<any> | BasicStorageConstructor<any, any>)
      const BasicStorageView = basicStorageViewTemplate.instantiate(Get.BaseType, Get.storagePolicy)
      const BaseType = BasicStorageView
      class BasicView extends BasicStorageView {
        static CommonType = BaseType.CommonType
        static EntityType = BaseType.EntityType
        static Iterator = BaseType.Iterator
        static ReverseIterator = BaseType.ReverseIterator

        constructor (value?: Storage<any, any, any> | [Storage<any, any, any>], _?: any) {
          super(Array.isArray(value) ? value[0] : value)
        }

        getStorageByElementType (_ElementType: any): Storage<any, any, any> | null {
          return this.getStorageByIndex(0)
        }

        getStorageByIndex (index = 0): Storage<any, any, any> | null {
          if (__DEV__) {
            if (index !== 0) {
              throw new Error('Index out of bounds')
            }
          }
          return super.handle()
        }

        setStorageByType (elem: Storage<any, any, any>): void {
          this.setStorage(0, elem)
        }

        setStorage (index: number, elem: Storage<any, any, any> | null): void {
          if (__DEV__) {
            if (index !== 0) {
              throw new Error('Index out of bounds')
            }
          }
          this.leading = elem
        }

        access (entt: any) {
          return this.getStorageByIndex()?.get(entt)
        }

        getByElementType (entt: any, ElementType: any): any {
          if (ElementType !== Get.ElementType) {
            throw new Error('Invalid element type')
          }
          return this.get(entt, 0)
        }

        get (entt: any, index?: number): any {
          if (index == null) {
            return this.getStorageByIndex()?.getAsTuple(entt) ?? [undefined]
          }
          return this.getStorageByIndex(index)?.get(entt)
        }

        each (func?: (...arg: any[]) => void, componentsOnly?: boolean): any {
          if (func != null && typeof func === 'function') {
            if (!componentsOnly) {
              for (const pack of this.each()) {
                func.apply(this, pack)
              }
            } else if (Get.storagePolicy === DeletionPolicy.SwapAndPop || Get.storagePolicy === DeletionPolicy.SwapOnly) {
              if (Get.ValueType === undefined) {
                for (let pos = super.size; pos; --pos) {
                  func.call(this)
                }
              } else {
                const len = super.size
                if (len !== 0) {
                  for (let last = this.getStorageByIndex()!.end(), first = last.minus(len); !first.equals(last); first.selfPlus()) {
                    func.call(this, first.deref())
                  }
                }
              }
            } else {
              if (__DEV__) {
                if (Get.storagePolicy !== DeletionPolicy.InPlace) {
                  throw new AssertionError('Unexpected storage policy')
                }
              }
              for (const pack of this.each()) {
                func.call(this, ...pack.slice(1))
              }
            }
            return
          }
          if (Get.storagePolicy === DeletionPolicy.SwapAndPop || Get.storagePolicy === DeletionPolicy.SwapOnly) {
            return super.handle() ? this.getStorageByIndex()!.each() : toIterator(new AggregatePointer([new SparseSetPointer()]), new AggregatePointer([new SparseSetPointer()]))
          } else {
            if (__DEV__) {
              if (Get.storagePolicy !== DeletionPolicy.InPlace) {
                throw new AssertionError('Unexpected storage policy')
              }
            }
            return toIterator(new ExtendedViewPointer(super.begin() as unknown as InstanceType<typeof BasicStorageView.Iterator>), new ExtendedViewPointer(super.end() as unknown as InstanceType<typeof BasicStorageView.Iterator>))
          }
        }

        bitOr (other: any) {
          const pools = [this.leading, ...(other.pools ?? [other.leading])]
          const placeholder = viewPlaceholder(commonType(...pools.map(storage => (storage.constructor as any).BaseType)))
          const filterOrPlaceholder = (value: any) => (value ?? placeholder)
          const filter = other.filter ? [
            ...other.filter.map((_: any, i: number) => filterOrPlaceholder(other.getStorageByIndex(other.pools.length + i)))
          ] : []
          const BV = basicViewTemplate.instantiate(pools, filter)
          const elem = new BV()
          elem.pools = pools
          elem.filter = filter
          elem.refresh()
          return elem
        }
      }
      return BasicView
    }
  },
  {
    predicate: (Gets: any[], _Excludes: any[]) => Gets.length !== 0,
    render (Gets: any[], Excludes: any[]) {
      const BasicCommonView = basicCommonViewTemplate.instantiate(
        commonType(...Gets.map(storage => storage.constructor.BaseType)),
        tombstoneCheck(...Gets),
        Gets.length,
        Excludes.length
      )
      const BaseType = BasicCommonView

      class BasicView extends BasicCommonView {
        static BaseType = BaseType
        // private static elementAt = (index: number) => [...Gets, ...Excludes][index]
        private static readonly indexOf = (Type: any) => {
          const elements = [...Gets.map(t => t.constructor.ElementType), ...Excludes.map(t => t.constructor.ElementType)]
          return elements.indexOf(Type)
        }

        private get (entt: any, ...indexes: number[]): any[] {
          return indexes.map((index) => (this.getStorageByIndex(index)?.getAsTuple(entt) ?? [])).flat()
        }

        private dispatchGet (Curr: number, Other: number, curr: any[]) {
          if (Curr === Other) {
            return [curr[Curr + 1]]
          } else {
            const storage = this.getStorageByIndex(Other)
            const result = storage?.getAsTuple(curr[0])
            return result ?? []
          }
        }

        private _each (Curr: number, func: (...arg: any[]) => void, componentsOnly: boolean | undefined, ...indexes: number[]): void {
          const storage = this.getStorageByIndex(Curr)!
          for (const curr of storage.each()) {
            const entt = curr[0]
            if ((!tombstoneCheck(...Gets) || !storage.isTombstone(entt)) && indexes.every((index) => (Curr === index || super.poolAt(index).contains(entt))) && super.noneOf(entt)) {
              const comps = indexes.flatMap(index => this.dispatchGet(Curr, index, curr))
              if (componentsOnly) {
                func.apply(this, comps)
              } else {
                func.call(this, entt, ...comps)
              }
            }
          }
        }

        private pickAndEach (func: (...arg: any[]) => void, componentsOnly: boolean | undefined, ...indexes: number[]): void {
          const view = super.handle()
          if (view != null) {
            indexes.forEach(index => {
              if (view === super.poolAt(index)) {
                this._each(index, func, componentsOnly, ...indexes)
              }
            })
          }
        }

        static CommonType = BaseType.CommonType
        static EntityType = BaseType.EntityType
        static Iterator = BaseType.Iterator

        constructor (value?: Array<Storage<any, any, any>>, excl: Array<Storage<any, any, any>> = [] as any) {
          if (Array.isArray(value) && Array.isArray(excl)) {
            super([...value], [...excl])
          } else {
            super()
          }
        }

        useByType (ElementType: any): void {
          this.use(BasicView.indexOf(ElementType))
        }

        use (index: number): void {
          this.use(index)
        }

        getStorageByElementType (ElementType: any): Storage<any, any, any> | null {
          return this.getStorageByIndex(BasicView.indexOf(ElementType))
        }

        getStorageByIndex (index: number): Storage<any, any, any> | null {
          if (index < Gets.length) {
            return super.poolAt(index)
          } else {
            return super.filterAt(index - Gets.length)
          }
        }

        setStorageByType (elem: Storage<any, any, any>): void {
          const index = BasicView.indexOf((elem.constructor as any).ElementType)
          this.setStorage(index, elem)
        }

        setStorage (index: number, elem: Storage<any, any, any> | null): void {
          if (index < 0 || index >= Gets.length + Excludes.length) {
            throw new Error('View storage index out of range')
          }
          if (index < Gets.length) {
            super.poolAt(index, elem)
          } else {
            super.filterAt(index - Gets.length, elem)
          }
        }

        access (entt: any) {
          return this.get(entt)
        }

        getByElementType (entt: any, ...ElementTypes: any[]): any[] {
          const ret = this.get(entt, ...ElementTypes.map(t => BasicView.indexOf(t)))
          return ret.length === 1 ? ret[0] : ret
        }

        getByIndexes (entt: any, ...indexes: number[]): any[] {
          if (indexes.length === 0) {
            return this.get(entt)
          } else if (indexes.length === 1) {
            return this.getStorageByIndex(indexes[0])?.get(entt)
          } else {
            return indexes.map(index => this.getStorageByIndex(index)?.getAsTuple(entt)).flat()
          }
        }

        each (func: (...arg: any[]) => void, componentsOnly?: boolean): any {
          if (func != null && typeof func === 'function') {
            this.pickAndEach(func, componentsOnly, ...Array.from({ length: Gets.length }, (_, i) => i))
          } else {
            return toIterator(new ExtendedViewPointer(super.begin() as unknown as InstanceType<typeof BasicCommonView.Iterator>), new ExtendedViewPointer(super.end() as unknown as InstanceType<typeof BasicCommonView.Iterator>))
          }
        }

        bitOr (other: any) {
          const pools = [...this.pools, ...(other.pools ?? [other.leading])]
          const placeholder = viewPlaceholder(commonType(...pools.map(storage => (storage.constructor as any).BaseType)))
          const filterOrPlaceholder = (value: any) => (value ?? placeholder)
          const filter = [
            ...this.filter.map((_: any, i: number) => filterOrPlaceholder(this.getStorageByIndex(this.pools.length + i))),
            ...(other.filter ? other.filter.map((_: any, i: number) => filterOrPlaceholder(other.getStorageByIndex(other.pools.length + i))) : [])
          ]
          const BV = basicViewTemplate.instantiate(pools, filter)
          const elem = new BV()
          elem.pools = pools
          elem.filter = filter
          elem.refresh()
          return elem
        }
      }
      return BasicView
    }
  }
])

export function makeView (gets: any, excl: any = []) {
  const BV = basicViewTemplate.instantiate(gets, excl)
  return new BV(gets, excl)
}

interface BasicStorageView<T, E, V, It, Rit> extends Iterable<E> {
  leading: Storage<T, E, V> | null
  handle (): Storage<T, E, V> | null
  size: number
  sizeHint (): number
  empty (): boolean
  begin (): It
  end (): It
  rbegin (): Rit
  rend (): Rit
  front (): E
  back (): E
  ok (): boolean
}

interface BasicStorageViewConstructor<T extends SparseSetConstructor<any>, P extends DeletionPolicy> {
  Iterator: P extends 1 ? ViewPointerConstructor<T['EntityType']> : T['Iterator']
  ReverseIterator: P extends 1 ? undefined : T['ReverseIterator']
  CommonType: T
  EntityType: T['EntityType']
  new (
    value?: Storage<any, any, any> | null
  ): BasicStorageView<any, T['EntityType'], SafeInstanceType<EnttTraits<T['EntityType']>['VersionType']>, InstanceType<BasicStorageViewConstructor<T, P>['Iterator']>, SafeInstanceType<BasicStorageViewConstructor<T, P>['ReverseIterator'], never>>
  prototype: BasicStorageView<any, T['EntityType'], SafeInstanceType<EnttTraits<T['EntityType']>['VersionType']>, InstanceType<BasicStorageViewConstructor<T, P>['Iterator']>, SafeInstanceType<BasicStorageViewConstructor<T, P>['ReverseIterator'], never>>
}

interface BasicStorageViewTemplate {
  <T extends SparseSetConstructor<any>, P extends DeletionPolicy> (
    Type: T,
    policy: P
  ): BasicStorageViewConstructor<T, P>
}

const basicStorageViewTemplate = defineTemplate<BasicStorageViewTemplate>(function (
  Type: SparseSetConstructor<any>,
  policy: DeletionPolicy
) {
  class BasicStorageView {
    protected leading: Storage<any, any, any> | null

    static CommonType = Type
    static EntityType = Type.EntityType
    static Iterator = policy === DeletionPolicy.InPlace ? viewPointerTemplate.instantiate(Type, true, 1, 0) : Type.Iterator
    static ReverseIterator = policy === DeletionPolicy.InPlace ? undefined : Type.ReverseIterator

    constructor (value?: Storage<any, any, any>) {
      this.leading = value ?? null
      __DEV__ && ENTT_ASSERT(this.leading?.policy() === policy, 'Unexpected storage policy')
    }

    handle () {
      return this.leading
    }

    get size () {
      if (policy === DeletionPolicy.InPlace) {
        throw new Error('Size not available for in-place storage views')
      }

      if (policy === DeletionPolicy.SwapAndPop) {
        return this.leading != null ? Number(this.leading.size) : 0
      }

      if (__DEV__) {
        if (policy !== DeletionPolicy.SwapOnly) {
          throw new AssertionError('Unexpected storage policy')
        }
      }

      return this.leading != null ? Number(this.leading.freeList()) : 0
    }

    sizeHint () {
      if (policy !== DeletionPolicy.InPlace) {
        throw new Error('Size hint not available for non in-place storage views')
      }
      return this.leading != null ? Number(this.leading.size) : 0
    }

    empty () {
      if (policy === DeletionPolicy.InPlace) {
        throw new Error('Empty not available for in-place storage views')
      }

      if (policy === DeletionPolicy.SwapAndPop) {
        return !this.leading || this.leading.empty()
      }

      if (__DEV__) {
        if (policy !== DeletionPolicy.SwapOnly) {
          throw new AssertionError('Unexpected storage policy')
        }
      }

      return !this.leading || (Number(this.leading.freeList()) === 0)
    }

    begin () {
      if (policy === DeletionPolicy.SwapAndPop) {
        return this.leading ? Type.prototype.begin.call(this.leading) : new BasicStorageView.Iterator()
      } else if (policy === DeletionPolicy.SwapOnly) {
        return this.leading ? Type.prototype.end.call(this.leading).minus(Number(this.leading.freeList())) : new BasicStorageView.Iterator()
      } else {
        if (__DEV__) {
          if (policy !== DeletionPolicy.InPlace) {
            throw new AssertionError('Unexpected storage policy')
          }
        }
        return this.leading
          ? new BasicStorageView.Iterator(
              Type.prototype.begin.call(this.leading),
              [this.leading as any],
              [],
              0
            )
          : new BasicStorageView.Iterator()
      }
    }

    end () {
      if (policy === DeletionPolicy.SwapAndPop || policy === DeletionPolicy.SwapOnly) {
        return this.leading ? Type.prototype.end.call(this.leading) : new BasicStorageView.Iterator()
      } else {
        if (__DEV__) {
          if (policy !== DeletionPolicy.InPlace) {
            throw new AssertionError('Unexpected storage policy')
          }
        }
        return this.leading
          ? new BasicStorageView.Iterator(
              Type.prototype.end.call(this.leading),
              [this.leading as any],
              [],
              0
            )
          : new BasicStorageView.Iterator()
      }
    }

    rbegin () {
      if (policy === DeletionPolicy.InPlace) {
        throw new Error('Reverse begin not available for in-place storage views')
      }
      return this.leading ? Type.prototype.rbegin.call(this.leading) : new BasicStorageView.ReverseIterator!(new Type.BasicIterator())
    }

    rend () {
      if (policy === DeletionPolicy.InPlace) {
        throw new Error('Reverse end not available for in-place storage views')
      }
      if (policy === DeletionPolicy.SwapAndPop) {
        return this.leading ? Type.prototype.rend.call(this.leading) : new BasicStorageView.ReverseIterator!(new Type.BasicIterator())
      } else {
        if (__DEV__) {
          if (policy !== DeletionPolicy.SwapOnly) {
            throw new AssertionError('Unexpected storage policy')
          }
        }
        return this.leading ? Type.prototype.rend.call(this.leading).plus(Number(this.leading.freeList())) : new BasicStorageView.ReverseIterator!(new Type.BasicIterator())
      }
    }

    front () {
      if (policy === DeletionPolicy.SwapAndPop) {
        return this.empty() ? Type.TraitsType.null : Type.prototype.begin.call(this.leading).deref()
      } else if (policy === DeletionPolicy.SwapOnly) {
        return this.empty() ? Type.TraitsType.null : Type.prototype.end.call(this.leading).minus(Number(this.leading!.freeList())).deref()
      } else {
        if (__DEV__) {
          if (policy !== DeletionPolicy.InPlace) {
            throw new AssertionError('Unexpected storage policy')
          }
        }
        const it = this.begin()
        return it.equals(this.end() as any) ? Type.TraitsType.null : it.deref()
      }
    }

    back () {
      if (policy === DeletionPolicy.SwapAndPop || policy === DeletionPolicy.SwapOnly) {
        return this.empty() ? Type.TraitsType.null : Type.prototype.rbegin.call(this.leading).deref()
      } else {
        if (__DEV__) {
          if (policy !== DeletionPolicy.InPlace) {
            throw new AssertionError('Unexpected storage policy')
          }
        }
        if (this.leading != null) {
          const it = Type.prototype.rbegin.call(this.leading)
          const last = Type.prototype.rend.call(this.leading)
          for (; !it.equals(last) && Type.isTombstone(it.deref()); it.selfPlus()) {/** empty */}
          return it.equals(last) ? Type.TraitsType.null : it.deref()
        }
        return Type.TraitsType.null
      }
    }

    find (entt: any) {
      if (policy === DeletionPolicy.SwapAndPop) {
        return this.leading != null ? this.leading.find(entt) : new BasicStorageView.Iterator()
      } else if (policy === DeletionPolicy.SwapOnly) {
        const it = this.leading != null ? this.leading.find(entt) : new BasicStorageView.Iterator()
        return this.leading != null && ((it as SparseSetPointer<any>).index() < Number(this.leading.freeList())) ? it : new BasicStorageView.Iterator()
      } else {
        return this.leading != null
          ? new BasicStorageView.Iterator(
              this.leading.find(entt),
              [this.leading as any],
              [],
              0
            )
          : new BasicStorageView.Iterator()
      }
    }

    ok () {
      return this.leading != null
    }

    contains (entt: any) {
      if (policy === DeletionPolicy.SwapAndPop || policy === DeletionPolicy.InPlace) {
        return this.leading?.contains(entt)
      } else {
        if (__DEV__) {
          if (policy !== DeletionPolicy.SwapOnly) {
            throw new AssertionError('Unexpected storage policy')
          }
        }
        return this.leading != null && this.leading.contains(entt) && (this.leading.index(entt) < Number(this.leading.freeList()))
      }
    }

    [Symbol.iterator] (): RangeIterator<InstanceType<typeof BasicStorageView.Iterator>> {
      return toIterator(this)
    }
  }
  return BasicStorageView
})
