import { config, createSafeNew, type SafeInstanceType } from "./config"
import { defineTemplate } from "./template"
import { Uint32, Uint64, Uint16 } from "./type"
import { assert, isExtendsFrom, popcount } from "./util"

export type EntityConstructor = NumberConstructor
  | BigIntConstructor
  | CustomEntityConstructor<any, any>

export interface CustomEntityConstructor<EC extends NumberConstructor | BigIntConstructor, R extends { [Symbol.toPrimitive](): SafeInstanceType<EC> }> {
  EntityType: EC
  new (entt?: SafeInstanceType<EC>, ...args: any[]): R
  prototype: R
}

export interface InternalEnttTraits<VT extends EntityConstructor, EC extends NumberConstructor | BigIntConstructor, VC extends NumberConstructor | BigIntConstructor> {
  ValueType: VT
  EntityType: EC
  VersionType: VC
  entityMask: SafeInstanceType<EC>
  versionMask: SafeInstanceType<EC>
}

export type InternalEnttTraitsReturn<VT> = VT extends NumberConstructor
  ? InternalEnttTraits<NumberConstructor, NumberConstructor, NumberConstructor>
  : VT extends BigIntConstructor
    ? InternalEnttTraits<BigIntConstructor, BigIntConstructor, NumberConstructor>
    : VT extends CustomEntityConstructor<any, any>
      ? InternalEnttTraits<VT, VT['EntityType'], NumberConstructor>
      : never

export interface BasicEnttTraits<Traits extends InternalEnttTraits<any, any, any>> {
  ValueType: Traits['ValueType']
  EntityType: Traits['EntityType'] & ((value: Traits['ValueType']) => SafeInstanceType<Traits['EntityType']>)
  VersionType: Traits['VersionType'] & ((value: Traits['ValueType']) => SafeInstanceType<Traits['VersionType']>)
  entityMask: Traits['entityMask']
  versionMask: Traits['versionMask']
  length: number
  null: SafeInstanceType<Traits['ValueType']>
  tombstone: SafeInstanceType<Traits['ValueType']>

  toIntegral: (value: SafeInstanceType<Traits['ValueType']>) => SafeInstanceType<Traits['EntityType']>
  toEntity: (value: SafeInstanceType<Traits['ValueType']>) => SafeInstanceType<Traits['EntityType']>
  toVersion: (value: SafeInstanceType<Traits['ValueType']>) => SafeInstanceType<Traits['VersionType']>
  next: (value: SafeInstanceType<Traits['ValueType']>) => SafeInstanceType<Traits['ValueType']>
  construct: (entity: SafeInstanceType<Traits['EntityType']>, version: SafeInstanceType<Traits['VersionType']>) => SafeInstanceType<Traits['ValueType']>
  combine: (lhs: SafeInstanceType<Traits['EntityType']>, rhs: SafeInstanceType<Traits['EntityType']>) => SafeInstanceType<Traits['ValueType']>
  isNull: (value: SafeInstanceType<Traits['ValueType']>) => boolean
  isTombstone: (value: SafeInstanceType<Traits['ValueType']>) => boolean
}

export interface EnttTraits<Type> extends BasicEnttTraits<InternalEnttTraitsReturn<Type>> {
  BaseType?: BasicEnttTraits<InternalEnttTraitsReturn<Type>>
  pageSize: number
}

export interface InternalEnttTraitsTemplate {
  <VT extends EntityConstructor>(ValueType: VT): InternalEnttTraitsReturn<VT>
}

export const internalEnttTraits = defineTemplate<InternalEnttTraitsTemplate>(function (ValueType: EntityConstructor) {
  if (typeof ValueType === 'function' && ValueType.prototype != null) {
    // class
    const BaseEntityType = isExtendsFrom(ValueType, [Number, BigInt, Uint32, Uint64])
    if (BaseEntityType) {
      const r = this.selectSpecialization(BaseEntityType)
      const traits = r!.call(this, BaseEntityType)
      traits.ValueType = ValueType
      return traits
    }
    const EntityType = (ValueType as CustomEntityConstructor<any, any>).EntityType
    if (!EntityType) {
      throw new TypeError('Invalid EntityType')
    }
    const traits = internalEnttTraits.instantiate(EntityType)
    traits.ValueType = ValueType
    return traits
  }

  throw new TypeError('Invalid ValueType')
}, [
  {
    predicate: (ValueType) => ValueType === Number,
    render: function () {
      return {
        ValueType: Number,
        EntityType: Number,
        VersionType: Number,
        entityMask: 0xFFFFF,
        versionMask: 0xFFF
      }
    }
  },
  {
    predicate: (ValueType) => ValueType === BigInt,
    render: function () {
      return {
        ValueType: BigInt,
        EntityType: BigInt,
        VersionType: Number,
        entityMask: BigInt(0xFFFFFFFF),
        versionMask: BigInt(0xFFFFFFFF)
      }
    }
  },
  {
    predicate: (ValueType) => ValueType === Uint32,
    render: function () {
      return {
        ValueType: Uint32,
        EntityType: Uint32,
        VersionType: Uint16,
        entityMask: Uint32(0xFFFFF),
        versionMask: Uint32(0xFFF)
      }
    }
  },
  {
    predicate: (ValueType) => ValueType === Uint64,
    render: function () {
      return {
        ValueType: Uint64,
        EntityType: Uint64,
        VersionType: Uint32,
        entityMask: Uint64(0xFFFFFFFF),
        versionMask: Uint64(0xFFFFFFFF)
      }
    }
  }
])

export interface BasicEnttTraitsTemplate {
  <Traits extends InternalEnttTraits<any, any, any>>(traits: Traits): BasicEnttTraits<Traits>
}

export const basicEnttTraitsTemplate = defineTemplate<BasicEnttTraitsTemplate>(function (traits) {
  const {
    ValueType,
    EntityType,
    VersionType,
    entityMask,
    versionMask,
  } = traits

  const length = popcount(entityMask)

  __DEV__ && assert(entityMask && ((entityMask & (entityMask + EntityType(1))) === EntityType(0)), "Invalid entity mask")

  __DEV__ && assert((versionMask & (versionMask + EntityType(1))) === EntityType(0), "Invalid version mask")

  const newValueType = createSafeNew(ValueType)

  const toIntegral: BasicEnttTraits<typeof traits>['toIntegral'] = EntityType === Number
    ? (value) => (EntityType(value) >>> 0)
    : (value) => EntityType(value)
  const toEntity = ((value) => (toIntegral(value) & entityMask)) as BasicEnttTraits<typeof traits>['toEntity']

  const toVersion: BasicEnttTraits<typeof traits>['toVersion'] = VersionType === Number
    ? (value) => (VersionType(!versionMask ? 0 : ((toIntegral(value) >> EntityType(length)) & versionMask)) >>> 0)
    : (value) => VersionType(!versionMask ? 0 : ((toIntegral(value) >> EntityType(length)) & versionMask))
  
  const c = isExtendsFrom(ValueType, [Number, BigInt])
    ? (v: number | bigint) => ValueType(v)
    : (v: number | bigint) => newValueType(v)
  const _construct: BasicEnttTraits<typeof traits>['construct'] = (entity, version) => {
    let v = (EntityType(entity) & entityMask)
    if (versionMask) {
      v = v | ((EntityType(version) & versionMask) << EntityType(length))
    }
    return v
  }

  const construct: BasicEnttTraits<typeof traits>['construct'] = EntityType === Number
    ? (entity, version) => c(_construct(entity, version) >>> 0)
    : (entity, version) => c(EntityType(_construct(entity, version)))

  const next = ((value) => {
    const vers: any = toVersion(value) + VersionType(1)
    return construct(toIntegral(value), (vers + (vers === versionMask ? VersionType(1) : VersionType(0))))
  }) as BasicEnttTraits<typeof traits>['next']
  const _combine: BasicEnttTraits<typeof traits>['combine'] = (lhs, rhs) => {
    let v = (EntityType(lhs) & entityMask)
    if (versionMask) {
      v = v | (EntityType(rhs) & (versionMask << EntityType(length)))
    }
    return v
  }
  const combine: BasicEnttTraits<typeof traits>['combine'] = EntityType === Number
    ? (lhs, rhs) => c(_combine(lhs, rhs) >>> 0)
    : (lhs, rhs) => c(EntityType(_combine(lhs, rhs)))

  const nul = construct(entityMask, versionMask)
  const tombstone = construct(entityMask, versionMask)

  const isNull: BasicEnttTraits<typeof traits>['isNull'] = (value) => toEntity(value) === toEntity(nul)
  const isTombstone: BasicEnttTraits<typeof traits>['isTombstone'] = !versionMask
    ? (value) => toIntegral(value) === toIntegral(tombstone)
    : (value) => toVersion(value) === toVersion(tombstone)

  return {
    ValueType,
    EntityType,
    VersionType,
    entityMask,
    versionMask,
    length,
    null: nul,
    tombstone,

    toIntegral,
    toEntity,
    toVersion,
    next,
    construct,
    combine,
    isNull,
    isTombstone,
  }
})

export interface EnttTraitsTemplate {
  <Type extends EntityConstructor>(ValueType: Type): EnttTraits<Type>
}

export const enttTraitsTemplate = defineTemplate<EnttTraitsTemplate>(function (ValueType) {
  const traits = internalEnttTraits.instantiate(ValueType)
  const BaseType = basicEnttTraitsTemplate.instantiate(traits)

  return {
    ...BaseType,
    BaseType,
    pageSize: config.sparsePage,
  }
})
