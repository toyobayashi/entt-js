import { expect, test, describe, beforeAll, afterAll } from 'vitest'
import { type SafeInstanceType, basicEnttTraitsTemplate, enttTraitsTemplate, type EntityConstructor, type EnttTraits, createSafeNew, Uint16, Uint32 } from '../src'
import { Entity, EntityObject, OtherEntity } from './custom-types'

describe('Entity', () => {
  const valueTypeList = [
    Number,
    BigInt,
    Entity,
    OtherEntity,
    EntityObject
  ] as const
  let traitsList: readonly EnttTraits<NumberConstructor | BigIntConstructor>[]

  beforeAll(() => {
    enttTraitsTemplate.addSpecialization({
      predicate: (ValueType: any) => ValueType === Entity,
      render: function () {
        const BaseType = basicEnttTraitsTemplate.instantiate({
          ValueType: Entity,
          EntityType: Uint32,
          VersionType: Uint16,
          entityMask: 0x3FFFF,
          versionMask: 0x0FFF
        })
  
        return {
          ...BaseType,
          pageSize: 4096,
        }
      }
    })
  
    enttTraitsTemplate.addSpecialization({
      predicate: (ValueType: any) => ValueType === OtherEntity,
      render: function () {
        const BaseType = basicEnttTraitsTemplate.instantiate({
          ValueType: OtherEntity,
          EntityType: Uint32,
          VersionType: Uint16,
          entityMask: 0xFFFFFFFF,
          versionMask: 0
        })
  
        return {
          ...BaseType,
          pageSize: 4096,
        }
      }
    })

    traitsList = valueTypeList.map((v) => enttTraitsTemplate.instantiate(v as any))
  })

  afterAll(() => {
    enttTraitsTemplate.removeAllUserlandSpecializations()
  })

  function testTraits<T extends EntityConstructor> () {
    for (let i = 0; i < traitsList.length; ++i) {
      const traits = traitsList[i] as unknown as EnttTraits<T>
      const entity = traits.construct(traits.EntityType(4) as SafeInstanceType<EnttTraits<T>['EntityType']>, traits.VersionType(1) as any)
      const other = traits.construct(traits.EntityType(3) as SafeInstanceType<EnttTraits<T>['EntityType']>, traits.VersionType(0) as any)
      expect(traits.toIntegral(entity)).toBe(traits.toIntegral(entity))
      expect(traits.toIntegral(entity)).not.toBe(traits.toIntegral(traits.null))
      expect(traits.toIntegral(entity)).not.toBe(traits.EntityType(0))
    
      expect(traits.toEntity(entity)).toBe(traits.EntityType(4))
      expect(traits.toVersion(entity)).toBe(traits.VersionType(!!traits.versionMask))
      expect(traits.toEntity(other)).toBe(traits.EntityType(3))
      expect(traits.toVersion(other)).toBe(traits.VersionType(0))
      expect(traits.construct(traits.toEntity(entity), traits.toVersion(entity))).toStrictEqual(entity)
      expect(traits.construct(traits.toEntity(other), traits.toVersion(other))).toStrictEqual(other)
      if (!traits.versionMask) {
        expect(traits.construct(traits.toEntity(entity), traits.toVersion(other))).toStrictEqual(entity)
      } else {
        expect(traits.construct(traits.toEntity(entity), traits.toVersion(other))).not.toStrictEqual(entity)
      }
      expect(traits.construct(traits.toEntity(other), traits.toVersion(entity))).toStrictEqual(traits.combine(traits.toIntegral(other), traits.toIntegral(entity)))
      expect(traits.combine(traits.EntityType(traits.null as any) as any, traits.EntityType(traits.tombstone as any) as any)).toStrictEqual(traits.null)
      expect(traits.combine(traits.EntityType(traits.tombstone as any) as any, traits.EntityType(traits.null as any) as any)).toStrictEqual(traits.tombstone)
    
      expect(traits.next(entity)).toStrictEqual(traits.construct(traits.toIntegral(entity), traits.toVersion(entity) + traits.VersionType(1) as any));
      expect(traits.next(other)).toStrictEqual(traits.construct(traits.toIntegral(other), traits.toVersion(other) + traits.VersionType(1) as any));
    
      expect(traits.next(traits.tombstone)).toStrictEqual(traits.construct(traits.null as any, traits.VersionType(0) as any));
      expect(traits.next(traits.null)).toStrictEqual(traits.construct(traits.null as any, traits.VersionType(0) as any));
    }
  }

  function testNull () {
    for (let i = 0; i < traitsList.length; ++i) {
      const traits = traitsList[i] as unknown as EnttTraits<NumberConstructor | BigIntConstructor>
      const ValueType = createSafeNew(traits.ValueType)
      expect(traits.isNull(traits.null)).toBe(true)
      expect(traits.isNull(ValueType(0))).toBe(false)

      const entity = ValueType(4)

      expect(traits.combine(traits.EntityType(traits.null as any) as any, traits.toIntegral(entity))).toStrictEqual(traits.construct(traits.toEntity(traits.null), traits.toVersion(entity)));
      expect(traits.combine(traits.EntityType(traits.null as any) as any, traits.toIntegral(traits.null))).toStrictEqual(traits.null);
      expect(traits.combine(traits.EntityType(traits.null as any) as any, traits.EntityType(traits.tombstone as any) as any)).toStrictEqual(traits.null);
      expect(traits.isNull(entity)).toBe(false)
    }
  }

  function testTombstone () {
    for (let i = 0; i < traitsList.length; ++i) {
      const traits = traitsList[i] as unknown as EnttTraits<NumberConstructor | BigIntConstructor>
      const ValueType = createSafeNew(traits.ValueType)
      expect(traits.isTombstone(traits.tombstone)).toBe(true)
      expect(traits.isTombstone(ValueType(0))).toBe(false)

      const entity = ValueType(4)

      expect(traits.combine(traits.toIntegral(entity), traits.EntityType(traits.tombstone as any) as any)).toStrictEqual(traits.construct(traits.toEntity(entity), traits.toVersion(traits.tombstone)));
      expect(traits.combine(traits.EntityType(traits.tombstone as any) as any, traits.toIntegral(traits.tombstone))).toStrictEqual(traits.tombstone);
      expect(traits.combine(traits.EntityType(traits.tombstone as any) as any, traits.EntityType(traits.null as any) as any)).toStrictEqual(traits.tombstone);
      expect(traits.isTombstone(entity)).toBe(false)
    }
  }

  test('Traits', testTraits)
  test('Null', testNull)
  test('Tombstone', testTombstone)
})
