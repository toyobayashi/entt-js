import { basicStorageTemplate, directCall, config as enttConfig, type SafeInstanceType, Int32, internalEnttTraits, NotConstructorError, storageTypeTemplate, Template, Uint32, type Int32Constructor, type Uint32Constructor, Float64 } from '../src'
import { popcount } from '../src/util'


function inherits<C extends Function> (Derived: C, Base: Function) {
  Object.setPrototypeOf(Derived, Base)
  Object.setPrototypeOf(Derived.prototype, Base.prototype)
}

const config = internalEnttTraits.instantiate(Number)
const defaultEntityLength = popcount(config.entityMask)

class EntityObject {
  static EntityType = Number
  version: number
  value: number

  constructor (value: number) {
    this.version = ((value >>> defaultEntityLength) & config.versionMask) >>> 0
    this.value = (value & config.entityMask) >>> 0
  }

  [Symbol.toPrimitive] (): any {
    return ((this.value & config.entityMask)
      | ((this.version & config.versionMask) << defaultEntityLength)) >>> 0
  }
}

interface TestEntityConstructor extends Uint32Constructor {
  (value?: number): number
}
export const Entity = function Entity (this: any, value?: number) {
  return Uint32(value)
} as unknown as TestEntityConstructor
inherits(Entity, Uint32)
enttConfig.customCalls.set(Entity, directCall)

interface TestOtherEntityConstructor extends Uint32Constructor {
  (value?: number): number
}
export const OtherEntity = function OtherEntity (this: any, value?: number) {
  return Uint32(value)
} as unknown as TestOtherEntityConstructor
inherits(OtherEntity, Uint32)
enttConfig.customCalls.set(OtherEntity, directCall)

const Int = Int32
const Uint = Uint32
const Double = Float64

export class AssureLoop {}
const assureLoopMixinTemplate = new Template(function (Type: any) {
  return class AssureLoopMixin extends Type {
    static UnderlyingType = Type
    static EntityType = Type.EntityType
    static Type = Type.Type

    bindAny (value: any): void {
      const owner = value
      if (owner) {
        owner.getStorage(Int)
      }
    }
  }
})
storageTypeTemplate.addSpecialization({
  predicate: (Type, EntityType) => Type === AssureLoop,
  render: (Type, EntityType) => {
    return class {
      static Type = assureLoopMixinTemplate.instantiate(basicStorageTemplate.instantiate(AssureLoop, EntityType))
    }
  }
})

class PointerStable {
  static inPlaceDelete = true as const
  value: number
  constructor (value: number = 0) {
    this.value = value
  }
  [Symbol.toPrimitive] (hint: string) {
    return this.value
  }
}

export {
  EntityObject,
  PointerStable,
  Int, Uint, Double
}
