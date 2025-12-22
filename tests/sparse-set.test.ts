import { expect, test, describe, beforeAll, afterAll } from 'vitest'
import { basicEnttTraitsTemplate,  type SafeInstanceType, basicSparseSetTemplate, enttTraitsTemplate, type EnttTraits, SparseSetPointer, DeletionPolicy, makeReversePointer, createSafeNew, Uint16, Uint32 } from '../src'
import { Entity, EntityObject } from './custom-types'

describe('SparseSet', () => {
  const valueTypeList = [
    Number,
    BigInt,
    Entity,
    EntityObject
  ] as const
  let traitsList: readonly EnttTraits<NumberConstructor | BigIntConstructor>[]

  const spec = {
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
  }

  beforeAll(() => {
    enttTraitsTemplate.addSpecialization(spec)
    traitsList = valueTypeList.map((v) => enttTraitsTemplate.instantiate(v as any))
  })

  afterAll(() => {
    enttTraitsTemplate.removeSpecialization(spec)
  })

  const deletionPolicies = [
    DeletionPolicy.SwapAndPop,
    DeletionPolicy.InPlace,
    DeletionPolicy.SwapOnly
  ] as DeletionPolicy[]

  function testData () {
    for (let i = 0; i < traitsList.length; ++i) {
      const traits = traitsList[i] as unknown as EnttTraits<NumberConstructor | BigIntConstructor>
      const ValueType = createSafeNew(traits.ValueType)
      const SparseSet = basicSparseSetTemplate.instantiate(valueTypeList[i] as NumberConstructor | BigIntConstructor)
      for (const policy of deletionPolicies) {
        const set = new SparseSet(policy)
        const entity = ValueType(1)
        const other = ValueType(2)
  
        set.add(entity)
        set.add(other)
        set.delete(entity)
  
        expect(set.has(entity)).toBe(false)
  
        switch (policy) {
          case DeletionPolicy.SwapAndPop:
            expect(set.has(traits.next(entity))).toBe(false)
            expect(set.size).toBe(1)
            expect(set.index(other)).toBe(0)
            expect(set.access(0)).toBe(other)
            break
          case DeletionPolicy.InPlace:
            expect(set.has(traits.next(entity))).toBe(false)
            expect(set.size).toBe(2)
            expect(set.index(other)).toBe(1)
            expect(traits.isTombstone(set.access(0)!)).toBe(true)
            expect(set.access(1)).toBe(other)
            break
          case DeletionPolicy.SwapOnly:
            expect(set.has(traits.next(entity))).toBe(true)
            expect(set.size).toBe(2)
            expect(set.index(other)).toBe(0)
            expect(set.index(traits.next(entity))).toBe(1)
            expect(set.access(0)).toBe(other)
            expect(set.access(1)).toStrictEqual(traits.next(entity))
          default:
            break
        }
      }
    }
  }

  function testIterator () {
    type VT = SafeInstanceType<BigIntConstructor | NumberConstructor>
    for (let i = 0; i < traitsList.length; ++i) {
      const traits = traitsList[i] as unknown as EnttTraits<BigIntConstructor | NumberConstructor>
      const ValueType = createSafeNew(traits.ValueType)
      const SparseSet = basicSparseSetTemplate.instantiate(valueTypeList[i] as BigIntConstructor | NumberConstructor)
      for (const policy of deletionPolicies) {
        const set = new SparseSet(policy)

        set.add(ValueType(3) as VT)
        const end = set.begin().clone()
        const begin = new SparseSetPointer<VT>()
        expect(end.data()).toBe(set.data())
        expect(begin.data()).toBe(null)

        set.end().clone(begin)
        begin.swap(end)
        expect(end.data()).toBe(set.data())
        expect(begin.data()).toBe(set.data())

        expect(begin.equals(set.begin())).toBe(true)
        expect(end.equals(set.end())).toBe(true)
        expect(begin.equals(end)).toBe(false)

        expect(begin.index()).toBe(0)
        expect(end.index()).toBe(-1)

        begin.selfPlus()
        expect(begin.equals(set.end())).toBe(true)
        begin.selfMinus()

        expect(begin.plus(1).equals(set.end())).toBe(true)
        expect(end.minus(1).equals(set.begin())).toBe(true)

        begin.selfPlus()
        expect(begin.equals(set.end())).toBe(true)
        begin.selfMinus()
        expect(begin.equals(set.begin())).toBe(true)

        expect(begin.plus(end.diff(begin)).equals(set.end())).toBe(true)
        expect(begin.minus(begin.diff(end)).equals(set.end())).toBe(true)
        expect(end.minus(end.diff(begin)).equals(set.begin())).toBe(true)
        expect(end.plus(begin.diff(end)).equals(set.begin())).toBe(true)

        expect(begin.access(0)).toBe(set.data()[0])

        expect(begin.lt(end)).toBe(true)
        expect(begin.le(set.begin())).toBe(true)
        expect(end.gt(begin)).toBe(true)
        expect(end.ge(set.end())).toBe(true)

        expect(begin.deref()).toStrictEqual(ValueType(3))
        expect(begin.index()).toBe(0)
        expect(end.index()).toBe(-1)

        set.add(ValueType(1) as VT)
        set.begin().clone(begin)
        expect(begin.index()).toBe(1)
        expect(end.index()).toBe(-1)

        expect(begin.access(0)).toStrictEqual(ValueType(1))
        expect(begin.access(1)).toStrictEqual(ValueType(3))

        const arr = [...set] as VT[]
        expect(arr).toStrictEqual([ValueType(1), ValueType(3)])
        set.forEach(v => {
          expect(v).toBe(arr.shift())
          arr.push(v)
        })
        for (const v of set) {
          expect(v).toBe(arr.shift())
        }
      }
    }
  }

  function testReverseIterator () {
    type VT = SafeInstanceType<BigIntConstructor | NumberConstructor>
    for (let i = 0; i < traitsList.length; ++i) {
      const traits = traitsList[i] as unknown as EnttTraits<BigIntConstructor | NumberConstructor>
      const ValueType = createSafeNew(traits.ValueType)
      const SparseSet = basicSparseSetTemplate.instantiate(valueTypeList[i] as BigIntConstructor | NumberConstructor)
      for (const policy of deletionPolicies) {
        const set = new SparseSet(policy)

        set.add(ValueType(3) as VT)
        const end = set.rbegin().clone()
        const begin = makeReversePointer(new SparseSetPointer<VT>())

        set.rend().clone(begin)
        begin.swap(end)
        expect(begin.equals(end)).toBe(false)
        expect(begin.base().index()).toBe(-1)
        expect(end.base().index()).toBe(0)

        expect(begin.equals(set.rbegin())).toBe(true)
        begin.selfPlus()
        expect(begin.equals(set.rend())).toBe(true)
        begin.selfMinus()

        expect(begin.plus(1).equals(set.rend())).toBe(true)
        expect(end.minus(1).equals(set.rbegin())).toBe(true)

        begin.selfPlus()
        expect(begin.equals(set.rend())).toBe(true)
        begin.selfMinus()
        expect(begin.equals(set.rbegin())).toBe(true)

        expect(begin.plus(end.diff(begin)).equals(set.rend())).toBe(true)
        expect(begin.minus(begin.diff(end)).equals(set.rend())).toBe(true)
        expect(end.minus(end.diff(begin)).equals(set.rbegin())).toBe(true)
        expect(end.plus(begin.diff(end)).equals(set.rbegin())).toBe(true)

        expect(begin.access(0)).toBe(set.rbegin().deref())

        expect(begin.lt(end)).toBe(true)
        expect(begin.le(set.rbegin())).toBe(true)
        expect(end.gt(begin)).toBe(true)
        expect(end.ge(set.rend())).toBe(true)

        expect(begin.deref()).toStrictEqual(ValueType(3))
        expect(begin.base().index()).toBe(-1)
        expect(end.base().index()).toBe(0)

        set.add(ValueType(1) as VT)
        set.rend().clone(end)
        expect(begin.base().index()).toBe(-1)
        expect(end.base().index()).toBe(1)

        expect(begin.access(0)).toStrictEqual(ValueType(3))
        expect(begin.access(1)).toStrictEqual(ValueType(1))

        const arr = [...set].toReversed() as VT[]
        expect(arr).toStrictEqual([ValueType(3), ValueType(1)])
        set.forEach(v => {
          expect(v).toBe(arr.pop())
          arr.unshift(v)
        })
        for (const v of set) {
          expect(v).toBe(arr.pop())
        }
      }
    }
  }

  function testHas () {
    type VT = SafeInstanceType<NumberConstructor | BigIntConstructor>
    type EV = SafeInstanceType<EnttTraits<NumberConstructor | BigIntConstructor>['EntityType']>
    for (let i = 0; i < traitsList.length; ++i) {
      const traits = traitsList[i] as unknown as EnttTraits<NumberConstructor | BigIntConstructor>
      const ValueType = createSafeNew(traits.ValueType)
      const SparseSet = basicSparseSetTemplate.instantiate(valueTypeList[i] as NumberConstructor | BigIntConstructor)
      for (const policy of deletionPolicies) {
        const set = new SparseSet(policy)

        const entity = ValueType(3) as VT
        const other = traits.construct(traits.EntityType(4) as EV, traits.VersionType(1) as any)

        set.add(entity)
        set.add(other)
        
        expect(set.has(traits.null)).toBe(false)
        expect(set.has(traits.tombstone)).toBe(false)
        expect(set.has(entity)).toBe(true)
        expect(set.has(other)).toBe(true)
        expect(set.has(ValueType(1) as VT)).toBe(false)
        expect(set.has(traits.construct(traits.EntityType(3) as EV, traits.VersionType(1) as any))).toBe(false)
        expect(set.has(traits.construct(traits.EntityType(4) as EV, traits.toVersion(traits.tombstone)))).toBe(false)

        set.delete(entity)
        expect(set.has(entity)).toBe(false)
        set.delete(other)
        expect(set.has(other)).toBe(false)
      }
    }
  }

  function testCurrent () {
    type EV = SafeInstanceType<EnttTraits<BigIntConstructor | NumberConstructor>['EntityType']>
    for (let i = 0; i < traitsList.length; ++i) {
      const traits = traitsList[i] as unknown as EnttTraits<BigIntConstructor | NumberConstructor>
      const SparseSet = basicSparseSetTemplate.instantiate(valueTypeList[i] as BigIntConstructor | NumberConstructor)
      for (const policy of deletionPolicies) {
        const set = new SparseSet(policy)

        expect(set.current(traits.tombstone)).toBe(traits.toVersion(traits.tombstone))
        expect(set.current(traits.null)).toBe(traits.toVersion(traits.tombstone))

        const entity = traits.construct(traits.EntityType(0), traits.VersionType(0))
        const other = traits.construct(traits.EntityType(3), traits.VersionType(3))

        expect(set.current(entity)).toBe(traits.toVersion(traits.tombstone))
        expect(set.current(other)).toBe(traits.toVersion(traits.tombstone))

        set.add(entity)
        set.add(other)
        expect(set.current(entity)).not.toBe(traits.toVersion(traits.tombstone))
        expect(set.current(other)).not.toBe(traits.toVersion(traits.tombstone))
        expect(set.current(traits.next(entity))).toBe(traits.toVersion(entity))
        expect(set.current(traits.next(other))).toBe(traits.toVersion(other))
      }
    }
  }

  function testBump () {
    type VT = SafeInstanceType<NumberConstructor | BigIntConstructor>
    type EV = SafeInstanceType<EnttTraits<NumberConstructor | BigIntConstructor>['EntityType']>
    for (let i = 0; i < traitsList.length; ++i) {
      const traits = traitsList[i] as unknown as EnttTraits<NumberConstructor | BigIntConstructor>
      const ValueType = createSafeNew(traits.ValueType)
      const SparseSet = basicSparseSetTemplate.instantiate(valueTypeList[i] as NumberConstructor | BigIntConstructor)
      for (const policy of deletionPolicies) {
        const set = new SparseSet(policy)

        const entity: VT[] = [
          ValueType(1) as VT,
          ValueType(3) as VT,
          traits.construct(traits.EntityType(2) as EV, 4 as any),
        ]
        for (const e of entity) {
          set.add(e)
        }

        expect(set.current(entity[0])).toBe(0)
        expect(set.current(entity[1])).toBe(0)
        expect(set.current(entity[2])).toBe(4)
        expect(set.bump(entity[0])).toBe(0)
        expect(set.bump(traits.construct(traits.toEntity(entity[1]), 1 as any))).toBe(1)
        expect(set.bump(traits.construct(traits.toEntity(entity[2]), 0 as any))).toBe(0)

        expect(set.current(entity[0])).toBe(0)
        expect(set.current(entity[1])).toBe(1)
        expect(set.current(entity[2])).toBe(0)
      }
    }
  }

  function testPush () {
    type VT = SafeInstanceType<NumberConstructor | BigIntConstructor>
    for (let i = 0; i < traitsList.length; ++i) {
      const traits = traitsList[i] as unknown as EnttTraits<NumberConstructor | BigIntConstructor>
      const ValueType = createSafeNew(traits.ValueType)
      const SparseSet = basicSparseSetTemplate.instantiate(valueTypeList[i] as NumberConstructor | BigIntConstructor)
      for (const policy of deletionPolicies) {
        const set = new SparseSet(policy)

        const entity: VT[] = [
          ValueType(1) as VT,
          ValueType(3) as VT,
        ]

        switch (policy) {
          case DeletionPolicy.SwapAndPop: {
            expect(set.size).toBe(0)
            set.add(entity[0])
            set.add(entity[1])
            expect(set.size).toBe(2)

            expect(set.index(entity[0])).toBe(0)
            expect(set.index(entity[1])).toBe(1)

            // remove all
            set.delete(entity[0])
            set.delete(entity[1])
            expect(set.size).toBe(0)

            // re-add and check indices are stable
            set.add(entity[0])
            set.add(entity[1])
            expect(set.index(entity[0])).toBe(0)
            expect(set.index(entity[1])).toBe(1)

            // deleting range (simulate) then pushing again should work
            set.delete(entity[0])
            set.delete(entity[1])
            expect(set.size).toBe(0)

            break
          }
          case DeletionPolicy.InPlace: {
            expect(set.size).toBe(0)
            set.add(entity[0])
            set.add(entity[1])
            expect(set.size).toBe(2)

            expect(set.index(entity[0])).toBe(0)
            expect(set.index(entity[1])).toBe(1)

            // erase both (leave tombstones)
            set.delete(entity[0])
            set.delete(entity[1])

            // in-place keeps slots; size reflects allocated slots
            expect(set.size).toBe(2)

            // re-add: indexes may be reused in-place (order can change)
            set.add(entity[0])
            set.add(entity[1])
            expect(set.size).toBe(2)
            expect(set.index(entity[0])).toBe(1)
            expect(set.index(entity[1])).toBe(0)

            // after re-adding in-place the indices are implementation defined,
            // but historically the first re-added goes at a later slot: check they exist
            expect(set.has(entity[0])).toBe(true)
            expect(set.has(entity[1])).toBe(true)

            break
          }
          default:
            break
        }
      }
    }
  }

  function testPushOutOfBounds () {
    type VT = SafeInstanceType<NumberConstructor | BigIntConstructor>
    for (let i = 0; i < traitsList.length; ++i) {
      const traits = traitsList[i] as unknown as EnttTraits<NumberConstructor | BigIntConstructor>
      const ValueType = createSafeNew(traits.ValueType)
      const SparseSet = basicSparseSetTemplate.instantiate(valueTypeList[i] as NumberConstructor | BigIntConstructor)
      for (const policy of deletionPolicies) {
        const set = new SparseSet(policy)

        const entity: VT[] = [
          ValueType(0) as VT,
          ValueType(traits.pageSize) as VT,
        ]

        set.add(entity[0])
        expect(set.index(entity[0])).toBe(0)

        set.delete(entity[0])

        set.add(entity[1])

        expect(set.has(entity[1])).toBe(true)
        expect(set.index(entity[1])).toBe(0)
      }
    }
  }

  function testClear () {
    type VT = SafeInstanceType<NumberConstructor | BigIntConstructor>
    for (let i = 0; i < traitsList.length; ++i) {
      const traits = traitsList[i] as unknown as EnttTraits<BigIntConstructor | NumberConstructor>
      const ValueType = createSafeNew(traits.ValueType)
      const SparseSet = basicSparseSetTemplate.instantiate(valueTypeList[i] as BigIntConstructor | NumberConstructor)
      for (const policy of deletionPolicies) {
        const set = new SparseSet(policy)

        const entity: VT[] = [
          ValueType(1) as VT,
          ValueType(3) as VT,
          ValueType(2) as VT,
        ]
        for (const e of entity) {
          set.add(e)
        }
        set.delete(entity[1])
        set.clear()

        expect(set.size).toBe(0)
        expect(set.has(entity[0])).toBe(false)
        expect(set.has(entity[1])).toBe(false)
        expect(set.has(entity[2])).toBe(false)
      }
    }
  }

  function testSortOrdered () {
    type VT = SafeInstanceType<NumberConstructor | BigIntConstructor>
    for (let i = 0; i < traitsList.length; ++i) {
      const traits = traitsList[i] as unknown as EnttTraits<BigIntConstructor | NumberConstructor>
      const ValueType = createSafeNew(traits.ValueType)
      const SparseSet = basicSparseSetTemplate.instantiate(valueTypeList[i] as BigIntConstructor | NumberConstructor)
      for (const policy of deletionPolicies) {
        const set = new SparseSet(policy)

        const entity: VT[] = [
          ValueType(16) as VT,
          ValueType(8) as VT,
          ValueType(4) as VT,
          ValueType(2) as VT,
          ValueType(1) as VT,
        ]
        for (const e of entity) {
          set.add(e)
        }
        set.sort((a, b) => {
          return a < b ? -1 : a > b ? 1 : 0
        })

        expect([...set]).toStrictEqual(entity.toReversed())
      }
    }
  }

  function testSortReverse () {
    type VT = SafeInstanceType<NumberConstructor | BigIntConstructor>
    for (let i = 0; i < traitsList.length; ++i) {
      const traits = traitsList[i] as unknown as EnttTraits<BigIntConstructor | NumberConstructor>
      const ValueType = createSafeNew(traits.ValueType)
      const SparseSet = basicSparseSetTemplate.instantiate(valueTypeList[i] as BigIntConstructor | NumberConstructor)
      for (const policy of deletionPolicies) {
        const set = new SparseSet(policy)

        const entity: VT[] = [
          ValueType(1) as VT,
          ValueType(2) as VT,
          ValueType(4) as VT,
          ValueType(8) as VT,
          ValueType(16) as VT,
        ]
        for (const e of entity) {
          set.add(e)
        }
        set.sort((a, b) => {
          return a < b ? -1 : a > b ? 1 : 0
        })

        expect([...set]).toStrictEqual(entity)
      }
    }
  }

  function testSortUnordered () {
    type VT = SafeInstanceType<NumberConstructor | BigIntConstructor>
    for (let i = 0; i < traitsList.length; ++i) {
      const traits = traitsList[i] as unknown as EnttTraits<BigIntConstructor | NumberConstructor>
      const ValueType = createSafeNew(traits.ValueType)
      const SparseSet = basicSparseSetTemplate.instantiate(valueTypeList[i] as BigIntConstructor | NumberConstructor)
      for (const policy of deletionPolicies) {
        using set = new SparseSet(policy)

        const entity: VT[] = [
          ValueType(4) as VT,
          ValueType(2) as VT,
          ValueType(1) as VT,
          ValueType(8) as VT,
          ValueType(16) as VT,
        ]
        for (const e of entity) {
          set.add(e)
        }
        set.sort((a, b) => {
          return a < b ? -1 : a > b ? 1 : 0
        })

        const begin = set.begin()
        const end = set.end()

        expect(begin.deref()).toStrictEqual(entity[2])
        begin.selfPlus()
        expect(begin.deref()).toStrictEqual(entity[1])
        begin.selfPlus()
        expect(begin.deref()).toStrictEqual(entity[0])
        begin.selfPlus()
        expect(begin.deref()).toStrictEqual(entity[3])
        begin.selfPlus()
        expect(begin.deref()).toStrictEqual(entity[4])
        begin.selfPlus()
        expect(begin.equals(end)).toBe(true)
      }
    }
  }

  function testCompact () {
    type VT = SafeInstanceType<BigIntConstructor | NumberConstructor>
    for (let i = 0; i < traitsList.length; ++i) {
      const traits = traitsList[i] as unknown as EnttTraits<BigIntConstructor | NumberConstructor>
      const ValueType = createSafeNew(traits.ValueType)
      const SparseSet = basicSparseSetTemplate.instantiate(valueTypeList[i] as BigIntConstructor | NumberConstructor)
      for (const policy of deletionPolicies) {
        const set = new SparseSet(policy)

        const entity = ValueType(1)
        const other = ValueType(2)

        set.add(entity)
        set.add(other)

        switch (policy) {
          case DeletionPolicy.SwapAndPop: {
            expect(set.size).toBe(2)
            expect(set.index(entity)).toBe(0)
            expect(set.index(other)).toBe(1)

            set.compact();

            expect(set.size).toBe(2)
            expect(set.index(entity)).toBe(0)
            expect(set.index(other)).toBe(1)

            set.delete(entity);

            expect(set.size).toBe(1)
            expect(set.index(other)).toBe(0)
            set.compact();

            expect(set.size).toBe(1)
            expect(set.index(other)).toBe(0)
            break
          }
          case DeletionPolicy.InPlace: {
            expect(set.size).toBe(2);
            expect(set.index(entity)).toBe(0);
            expect(set.index(other)).toBe(1);

            set.compact();

            expect(set.size).toBe(2);
            expect(set.index(entity)).toBe(0);
            expect(set.index(other)).toBe(1);

            set.delete(other);

            expect(set.size).toBe(2);
            expect(set.index(entity)).toBe(0);

            set.compact();

            expect(set.size).toBe(1);
            expect(set.index(entity)).toBe(0);

            set.add(other);
            set.delete(entity);

            expect(set.size).toBe(2);
            expect(set.index(other)).toBe(1);

            set.compact();

            expect(set.size).toBe(1);
            expect(set.index(other)).toBe(0);

            set.compact();

            expect(set.size).toBe(1);
            expect(set.index(other)).toBe(0);
            break
          }
          case DeletionPolicy.SwapOnly: {
            expect(set.size).toBe(2)
            expect(set.index(entity)).toBe(0)
            expect(set.index(other)).toBe(1)
            set.compact();

            expect(set.size).toBe(2)
            expect(set.index(entity)).toBe(0)
            expect(set.index(other)).toBe(1)
            set.delete(entity);
            expect(set.size).toBe(2)
            expect(set.index(other)).toBe(0)
            expect(set.index(traits.next(entity))).toBe(1)
            set.compact();

            expect(set.size).toBe(2)
            expect(set.index(other)).toBe(0)
            expect(set.index(traits.next(entity))).toBe(1)
            break
          }
          default:
            break
        }
      }
    }
  }

  function testContiguous () {
    for (let i = 0; i < traitsList.length; ++i) {
      const traits = traitsList[i] as unknown as EnttTraits<BigIntConstructor | NumberConstructor>
      const ValueType = createSafeNew(traits.ValueType)
      const SparseSet = basicSparseSetTemplate.instantiate(valueTypeList[i] as BigIntConstructor | NumberConstructor)
      for (const policy of deletionPolicies) {
        const set = new SparseSet(policy)

        const entity = ValueType(1)
        const other = ValueType(2)

        expect(set.contiguous()).toBe(true)

        set.add(entity)
        set.add(other)

        expect(set.contiguous()).toBe(true)

        set.delete(entity)

        switch (policy) {
          case DeletionPolicy.SwapOnly:
          case DeletionPolicy.SwapAndPop:
            expect(set.contiguous()).toBe(true)
            set.clear();
            expect(set.contiguous()).toBe(true)
            break
          case DeletionPolicy.InPlace: {
            expect(set.contiguous()).toBe(false)
            set.compact()
            expect(set.contiguous()).toBe(true)
            set.add(entity)
            set.delete(entity)
            expect(set.contiguous()).toBe(false)
            set.clear()
            expect(set.contiguous()).toBe(true)
            break
          }
          default:
            break
        }
      }
    }
  }

  test('Data', testData)
  test('Iterator', testIterator)
  test('Reverse Iterator', testReverseIterator)
  test('Has', testHas)
  test('Current', testCurrent)
  test('Bump', testBump)
  test('Clear', testClear)
  test('SortOrdered', testSortOrdered)
  test('SortReverse', testSortReverse)
  test('SortUnordered', testSortUnordered)

  test('Push', testPush)
  test('PushOutOfBounds', testPushOutOfBounds)
  test('Compact', testCompact)
  test('Contiguous', testContiguous)
})
