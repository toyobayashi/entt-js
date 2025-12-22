import { expect, test, describe, beforeAll, afterAll } from 'vitest'
import { type SafeInstanceType, componentTraitsTemplate, storageTemplate, type Storage, StoragePointer, type ComponentTraits, ReversePointer, createSafeNew } from '../src'
import { Int, PointerStable } from './custom-types'

type ET<Ctor> = Ctor extends 'int' ? number : SafeInstanceType<Ctor>

describe('Storage', () => {
  const valueTypeList = [Int, PointerStable] as any

  beforeAll(() => {
    componentTraitsTemplate.addSpecialization({
      predicate: (Type) => (Type === Int),
      render: (Type, Entity) => ({
        ElementType: Int,
        EntityType: Entity,
        pageSize: 128,
        inPlaceDelete: false
      })
    })
  })

  afterAll(() => {
    componentTraitsTemplate.removeAllUserlandSpecializations()
  })

  test('Iterator', function () {
    for (const ValueType of valueTypeList) {
      const Storage = storageTemplate.instantiate(ValueType)
      const TraitsType = Storage.TraitsType as ComponentTraits<any, NumberConstructor>
      const VT = TraitsType.ElementType
      const v = createSafeNew(VT)
      const Iterator = Storage.Iterator as typeof StoragePointer<ET<typeof ValueType>>
      const pool = new Storage() as Storage<ET<typeof ValueType>, number, number>
      pool.emplace(1, 2)

      const end = pool.begin()
      const begin = new Iterator()
      pool.end().clone(begin)
      begin.swap(end)

      expect(begin.equals(pool.begin())).toBe(true)
      expect(end.equals(pool.end())).toBe(true)
      expect(begin.equals(end)).toBe(false)

      expect(begin.index()).toBe(0)
      expect(end.index()).toBe(-1)

      expect(begin.equals(pool.begin())).toBe(true)
      begin.selfPlus()
      expect(begin.equals(pool.end())).toBe(true)
      begin.selfMinus()

      expect(begin.plus(1).equals(pool.end())).toBe(true)
      expect(end.minus(1).equals(pool.begin())).toBe(true)

      expect(begin.plus(end.diff(begin)).equals(pool.end())).toBe(true)
      expect(begin.minus(begin.diff(end)).equals(pool.end())).toBe(true)

      expect(end.minus(end.diff(begin)).equals(pool.begin())).toBe(true)
      expect(end.plus(begin.diff(end)).equals(pool.begin())).toBe(true)

      expect(begin.access(0)).toBe(pool.begin().deref())
      expect(begin.lt(end)).toBe(true)
      expect(begin.le(pool.begin())).toBe(true)
      expect(end.gt(begin)).toBe(true)
      expect(end.ge(pool.end())).toBe(true)
      expect(begin.index()).toBe(0)
      expect(end.index()).toBe(-1)

      pool.emplace(3, 4)
      pool.begin().clone(begin)

      expect(begin.index()).toBe(1)
      expect(end.index()).toBe(-1)

      expect(begin.access(0)).toStrictEqual(v(4))
      expect(begin.access(1)).toStrictEqual(v(2))

      expect([...pool]).toEqual([v(4), v(2)])
    }
  })

  test('Reverse Iterator', function () {
    for (const ValueType of valueTypeList) {
      const Storage = storageTemplate.instantiate(ValueType)
      const TraitsType = Storage.TraitsType as ComponentTraits<any, NumberConstructor>
      const VT = TraitsType.ElementType
      const v = createSafeNew(VT)
      const Iterator = Storage.Iterator as typeof StoragePointer<ET<typeof ValueType>>
      const R = Storage.ReverseIterator as typeof ReversePointer<StoragePointer<ET<typeof ValueType>>>
      const pool = new Storage() as Storage<ET<typeof ValueType>, number, number>
      pool.emplace(1, 2)

      const end = pool.rbegin()
      const begin = new R(new Iterator())
      pool.rend().clone(begin)
      begin.swap(end)

      expect(begin.equals(pool.rbegin())).toBe(true)
      expect(end.equals(pool.rend())).toBe(true)
      expect(begin.equals(end)).toBe(false)

      expect(begin.base().index()).toBe(-1)
      expect(end.base().index()).toBe(0)

      expect(begin.equals(pool.rbegin())).toBe(true)
      begin.selfPlus()
      expect(begin.equals(pool.rend())).toBe(true)
      begin.selfMinus()

      expect(begin.plus(1).equals(pool.rend())).toBe(true)
      expect(end.minus(1).equals(pool.rbegin())).toBe(true)

      expect(begin.plus(end.diff(begin)).equals(pool.rend())).toBe(true)
      expect(begin.minus(begin.diff(end)).equals(pool.rend())).toBe(true)

      expect(end.minus(end.diff(begin)).equals(pool.rbegin())).toBe(true)
      expect(end.plus(begin.diff(end)).equals(pool.rbegin())).toBe(true)

      expect(begin.access(0)).toBe(pool.rbegin().deref())
      expect(begin.lt(end)).toBe(true)
      expect(begin.le(pool.rbegin())).toBe(true)
      expect(end.gt(begin)).toBe(true)
      expect(end.ge(pool.rend())).toBe(true)
      expect(begin.base().index()).toBe(-1)
      expect(end.base().index()).toBe(0)

      pool.emplace(3, 4)
      pool.rbegin().clone(begin)
      pool.rend().clone(end)

      expect(begin.base().index()).toBe(-1)
      expect(end.base().index()).toBe(1)

      expect(begin.access(0)).toStrictEqual(v(2))
      expect(begin.access(1)).toStrictEqual(v(4))

      expect([...pool].toReversed()).toEqual([v(2), v(4)])
    }
  })

  test('Patch', function () {
    for (const ValueType of valueTypeList) {
      const Storage = storageTemplate.instantiate(ValueType)
      const TraitsType = Storage.TraitsType as ComponentTraits<any, NumberConstructor>
      const VT = TraitsType.ElementType
      const v = createSafeNew(VT)
      const pool = new Storage() as Storage<ET<typeof ValueType>, number, number>

      const entity = 2
      const callback = (elem: any) => {
        if (typeof elem === 'number') {
          return elem + 1
        }
        elem.value += 1
      }

      pool.emplace(entity, 0)

      expect(pool.get(entity)).toStrictEqual(v(0))
      pool.patch(entity)
      pool.patch(entity, callback)
      pool.patch(entity, callback, callback)
      expect(pool.get(entity)).toStrictEqual(v(3))
    }
  })
})
