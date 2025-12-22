import { makeRangePointer, type ForwardPointer, type Range } from "./iterator"
import { Sigh, Sink } from "./signal"
import { DeletionPolicy, type SparseSetPointer } from "./sparse-set"
import { defineTemplate } from "./template"
import { assert as ENTT_ASSERT } from "./util"

export type BasicSighMixin<S, R, E> = S & {
  onConstruct(): Sink<void, [R, E]>
  onUpdate(): Sink<void, [R, E]>
  onDestroy(): Sink<void, [R, E]>
  registry(): R
}

export type BasicSighMixinConstructor<T extends new (...args: any[]) => any, R, E> = Exclude<T, 'new' | 'prototype'> & {
  UnderlyingType: T
  new (...args: ConstructorParameters<T>): BasicSighMixin<InstanceType<T>, R, E>
  prototype: BasicSighMixin<InstanceType<T>, R, E>
}

export const basicSighMixinTemplate = defineTemplate(function<T extends new (...args: any[]) => any, R, E> (Type: T): BasicSighMixinConstructor<T, R, E> {
  const UnderlyingType = Type
  // const EntityType = UnderlyingType.EntityType as Function

  type SighType = Sigh<(owner: R, entity: E) => void>

  return class BasicSighMixin extends Type {
    static UnderlyingType = UnderlyingType

    private owner: R | null
    private readonly construction: SighType
    private readonly destruction: SighType
    private readonly update: SighType

    constructor (...args: any[]) {
      super(...args)
      this.owner = null
      this.construction = new Sigh()
      this.destruction = new Sigh()
      this.update = new Sigh()
    }

    dispose (): void {
      this.construction.dispose()
      this.destruction.dispose()
      this.update.dispose()
      super.dispose()
      this.owner = null
    }

    private ownerOrAssert (): R {
      __DEV__ && ENTT_ASSERT(this.owner != null, 'Invalid reference to registry')
      return this.owner!
    }

    pop (first: SparseSetPointer<E>, last: SparseSetPointer<E>): void {
      const reg = this.ownerOrAssert()
      if (this.destruction.empty()) {
        super.pop(first, last)
      } else {
        first = first.clone()
        last = last.clone()
        for (; !first.equals(last); first.selfPlus()) {
          const entt = first.deref()
          this.destruction.publish(reg, entt)
          const it = super.find(entt)
          super.pop(it, it.plus(1))
        }
      }
    }

    popAll (): void {
      const reg = this.ownerOrAssert()
      if (!this.destruction.empty()) {
        if ('ElementType' in UnderlyingType && 'EntityType' in UnderlyingType && UnderlyingType.ElementType === UnderlyingType.EntityType) {
          for (let pos = 0, last = super.freeList(); pos < last; ++pos) {
            this.destruction.publish(reg, super.access(pos))
          }
        } else {
          for (const entt of (UnderlyingType as any).BaseType.prototype[Symbol.iterator].call(this)) {
            if ((UnderlyingType as any).storagePolicy === DeletionPolicy.InPlace) {
              if (!this.isTombstone(entt)) {
                this.destruction.publish(reg, entt)
              }
            } else {
              this.destruction.publish(reg, entt)
            }
          }
        }
      }

      super.popAll()
    }

    tryEmplace (entt: E, forceback: boolean, value: any): void {
      const reg = this.ownerOrAssert()
      const it = super.tryEmplace(entt, forceback, value)
      if (!this.construction.empty()) {
        this.construction.publish(reg, it.deref())
      }
    }

    insert (first: ForwardPointer<E, any>, last: ForwardPointer<E, any>, ...args: any[]): void {
      let from = super.size
      super.insert(first, last, ...args)
      const reg = this.ownerOrAssert()
      if (!this.construction.empty()) {
        const to = super.size
        for (; from !== to; ++from) {
          this.construction.publish(reg, super.access(from))
        }
      }
    }

    bindAny (value: any) {
      this.owner = value as R
      super.bindAny(value)
    }

    onConstruct() {
      return new Sink(this.construction)
    }

    onUpdate() {
      return new Sink(this.update)
    }

    onDestroy() {
      return new Sink(this.destruction)
    }

    registry () {
      return this.ownerOrAssert()
    }

    generate (hint?: E): E {
      const e = super.generate(hint)
      if (!this.construction.empty()) {
        this.construction.publish(this.ownerOrAssert(), e)
      }
      return e
    }

    generateRange (first: Range<ForwardPointer<E, any>> | ForwardPointer<E, any>, last?: ForwardPointer<E, any>): void {
      super.generateRange(first, last)
      const reg = this.ownerOrAssert()
      if (!this.construction.empty()) {
        const [f, l] = makeRangePointer(first, last)
        for (; !f.equals(l); f.selfPlus()) {
          this.construction.publish(reg, f.deref())
        }
      }
    }

    emplace (entt: E, ...args: any[]) {
      super.emplace(entt, ...args)
      if (!this.construction.empty()) {
        this.construction.publish(this.ownerOrAssert(), entt)
      }
      return this.get(entt)
    }

    patch (entt: E, ...args: any[]) {
      super.patch(entt, ...args)
      if (!this.update.empty()) {
        this.update.publish(this.ownerOrAssert(), entt)
      }
      return this.get(entt)
    }
  } as any
})
