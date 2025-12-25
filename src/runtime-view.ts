import type { SafeInstanceType } from "./config"
import { Disposable } from "./disposable"
import { type RangeIterator, toIterator, type BidirectionalPointer } from "./iterator"
import { DeletionPolicy, SparseSet, SparseSetPointer, type BaseSparseSet, type SparseSetConstructor } from "./sparse-set"
import { defineTemplate } from "./template"
import { assert as ENTT_ASSERT } from "./util"

export class RuntimeViewIterator<E> implements BidirectionalPointer<E, RuntimeViewIterator<E>> {
  private pools: Array<BaseSparseSet<E, any>>
  private filter: Array<BaseSparseSet<E, any>>
  private it: SparseSetPointer<E>
  private tombstoneCheck: boolean

  private valid(): boolean {
    const entt = this.it.deref()
    return (!this.tombstoneCheck || !this.pools[0].isTombstone(entt))
      && this.pools.every((curr) => curr.contains(entt))
      && !this.filter.some((curr) => curr?.contains(entt))
  }

  constructor ()
  constructor (cpools: Array<BaseSparseSet<E, any>>, curr: SparseSetPointer<E>, ignore: Array<BaseSparseSet<E, any>>)
  constructor (cpools?: Array<BaseSparseSet<E, any>>, curr?: SparseSetPointer<E>, ignore?: Array<BaseSparseSet<E, any>>) {
    if (cpools != null && curr != null && ignore != null) {
      this.pools = cpools
      this.it = curr.clone()
      this.filter = ignore
      this.tombstoneCheck = cpools.length === 1 && cpools[0].policy() === DeletionPolicy.InPlace

      if (!this.it.equals(SparseSet.prototype.end.call(cpools[0])) && !this.valid()) {
        this.selfPlus()
      }
    } else {
      this.pools = []
      this.it = new SparseSetPointer()
      this.filter = []
      this.tombstoneCheck = false
    }
  }

  clone (target?: RuntimeViewIterator<E>): RuntimeViewIterator<E> {
    if (target) {
      if (target === this) return this
      target.pools = this.pools.slice()
      target.it = this.it.clone()
      target.filter = this.filter.slice()
      target.tombstoneCheck = this.tombstoneCheck
      return target
    }
    const copied = new RuntimeViewIterator<E>()
    copied.pools = this.pools.slice()
    copied.it = this.it.clone()
    copied.filter = this.filter.slice()
    copied.tombstoneCheck = this.tombstoneCheck
    return copied
  }

  swap (other: RuntimeViewIterator<E>): void {
    if (this === other) return
    this.it.swap(other.it)

    const tmpPools = this.pools
    const tmpFilter = this.filter
    const tmpTombstoneCheck = this.tombstoneCheck

    this.pools = other.pools
    this.filter = other.filter
    this.tombstoneCheck = other.tombstoneCheck

    other.pools = tmpPools
    other.filter = tmpFilter
    other.tombstoneCheck = tmpTombstoneCheck
  }

  write (value: E): E {
    return this.it.write(value)
  }

  deref () {
    return this.it.deref()
  }

  selfPlus(): this {
    this.it.selfPlus()
    for (const last = SparseSet.prototype.end.call(this.pools[0]); !this.it.equals(last) && !this.valid(); this.it.selfPlus()) { /* empty */ }
    return this
  }

  selfMinus(): this {
    this.it.selfMinus()
    for (const first = SparseSet.prototype.begin.call(this.pools[0]); !this.it.equals(first) && !this.valid(); this.it.selfMinus()) { /* empty */ }
    return this
  }

  equals (other: RuntimeViewIterator<E>): boolean {
    return this.it.equals(other.it)
  }
}

export interface BasicRuntimeView<E> {
  clear (): void
  dispose (): void
  iterate (base: BaseSparseSet<E, any>): this
  exclude (base: BaseSparseSet<E, any>): this
  sizeHint (): number
  begin (): RuntimeViewIterator<E>
  end (): RuntimeViewIterator<E>
  ok (): boolean
  contains (entt: E): boolean
  each (func: (entity: E) => void): void
  [Symbol.iterator](): RangeIterator<RuntimeViewIterator<E>>
}

export interface BasicRuntimeViewConstructor<T extends SparseSetConstructor<any>> {
  EntityType: T['EntityType']
  CommonType: T
  Iterator: typeof RuntimeViewIterator<SafeInstanceType<T['EntityType']>>
  new (): BasicRuntimeView<SafeInstanceType<T['EntityType']>>
  prototype: BasicRuntimeView<SafeInstanceType<T['EntityType']>>
}

export interface BasicRuntimeViewTemplate {
  <T extends SparseSetConstructor<any>>(Type: T): BasicRuntimeViewConstructor<T>
}

export const basicRuntimeViewTemplate = defineTemplate<BasicRuntimeViewTemplate>(function <T extends SparseSetConstructor<any>> (Type: T): BasicRuntimeViewConstructor<T> {
  class BasicRuntimeView extends Disposable {
    private readonly pools: Array<SafeInstanceType<T>>

    private readonly filter: Array<SafeInstanceType<T>>

    private offset (): number {
      __DEV__ && ENTT_ASSERT(this.pools.length !== 0, 'Invalid view')
      const leading = this.pools[0]
      return (leading.policy() === DeletionPolicy.SwapOnly) ? Number(leading.freeList()) : leading.size
    }

    static EntityType = Type.EntityType
    static CommonType = Type
    static Iterator = RuntimeViewIterator<SafeInstanceType<T>>

    constructor () {
      super()
      this.pools = []
      this.filter = []
    }

    dispose (): void {
      this.pools.length = 0
      this.filter.length = 0
    }

    clear (): void {
      this.pools.length = 0
      this.filter.length = 0
    }

    iterate (base: SafeInstanceType<T>): this {
      if (this.pools.length === 0 || !(base.size < this.pools[0].size)) {
        this.pools.push(base as SafeInstanceType<T>)
      } else {
        const front = this.pools[0]
        this.pools[0] = base
        this.pools.push(front)
      }
      return this
    }

    exclude (base: SafeInstanceType<T>): this {
      this.filter.push(base)
      return this
    }

    sizeHint (): number {
      return this.pools.length === 0 ? 0 : this.offset()
    }

    begin (): RuntimeViewIterator<SafeInstanceType<T>> {
      return this.pools.length === 0
        ? new RuntimeViewIterator<SafeInstanceType<T>>() 
        : new RuntimeViewIterator<SafeInstanceType<T>>(this.pools, Type.prototype.end.call(this.pools[0]).minus(this.offset()), this.filter)
    }

    end (): RuntimeViewIterator<SafeInstanceType<T>> {
      return this.pools.length === 0
        ? new RuntimeViewIterator<SafeInstanceType<T>>() 
        : new RuntimeViewIterator<SafeInstanceType<T>>(this.pools, Type.prototype.end.call(this.pools[0]), this.filter)
    }

    ok (): boolean {
      return !(this.pools.length === 0 && this.filter.length === 0)
    }

    contains (entt: SafeInstanceType<T['EntityType']>): boolean {
      return this.pools.length !== 0
        && this.pools.every((curr) => curr.contains(entt))
        && !this.filter.some((curr) => curr?.contains(entt))
        && this.pools[0].index(entt) < this.offset()
    }

    each (func: (entity: SafeInstanceType<T['EntityType']>) => void): void {
      for (const entity of this) {
        func(entity as SafeInstanceType<T['EntityType']>)
      }
    }

    [Symbol.iterator](): RangeIterator<RuntimeViewIterator<SafeInstanceType<T>>> {
      return toIterator(this.begin(), this.end())
    }
  }

  return BasicRuntimeView as any
})

export const RuntimeView = /*#__PURE__*/ (() => basicRuntimeViewTemplate.instantiate(SparseSet))()
export type RuntimeView = InstanceType<typeof RuntimeView>
