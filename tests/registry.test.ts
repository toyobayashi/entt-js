import { expect, test, describe, beforeAll, afterAll } from 'vitest'
import { type SafeInstanceType, basicEnttTraitsTemplate, enttTraitsTemplate, makeView, type EnttTraits, Registry, type BasicRegistry, ArrayPointer, SparseSet, toRange, distance, Entity, Uint16, Uint32, Int64 } from '../src'
import { Int, Double, Uint, Entity as TestEntity, AssureLoop, PointerStable } from './custom-types'

type ValueType<T> = SafeInstanceType<T>

describe('Registry', () => {

  class Aggregate {
    value: number
    constructor (value: number) {
      this.value = value
    }
    [Symbol.toPrimitive] () {
      return this.value
    }
  }

  class Empty {}

  test('Int', () => {
    expect((3.14 as any) instanceof Int).toBe(false)
    const a = Int(3.14)
    expect(a).toStrictEqual(3)
    expect(typeof a === 'number').toBe(true)
    expect(Int.is(a)).toBe(true)
    expect(Int.is(NaN)).toBe(false)
    expect(`${a}.14`).toBe('3.14')
    // expect(() => new (Int as any)(3.14)).throws(TypeError)
    expect(Int(-3.14)).toStrictEqual(-3)
    expect(Int(0x80000000)).toStrictEqual(-2147483648)
    expect(Int(0xffffffff + 1)).toStrictEqual(0)
    expect(Int(0xffffffff)).toStrictEqual(-1)
    expect(Uint32(-1)).toStrictEqual(0xFFFFFFFF)
    expect(Int(Uint32(-1))).toStrictEqual(-1)
    expect(Int64(Int64.MAX_VALUE + 1n)).toStrictEqual(Int64.MIN_VALUE)
    expect(Int64(Int64.MIN_VALUE - 1n)).toStrictEqual(Int64.MAX_VALUE)
  })

  class Listener {
    last: ValueType<EnttTraits<NumberConstructor>['ValueType']>
    counter: number

    constructor () {
      this.last = enttTraitsTemplate.instantiate(Entity).null
      this.counter = 0
    }

    static sort (Type: Function, registry: BasicRegistry<number, number>) {
      registry.sort(Type, (lhs, rhs) => lhs > rhs ? 1 : (lhs < rhs) ? -1 : 0)
    }

    incr (_: BasicRegistry<number, number>, entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>) {
      this.last = entity
      ++this.counter
    }

    decr (_: BasicRegistry<number, number>, entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>) {
      this.last = entity
      --this.counter
    }
  }


  beforeAll(() => {
    enttTraitsTemplate.addSpecialization({
      predicate: (ValueType: any) => ValueType === TestEntity,
      render: function () {
        const BaseType = basicEnttTraitsTemplate.instantiate({
          ValueType: TestEntity,
          EntityType: Uint32,
          VersionType: Uint16,
          entityMask: 0xFF,
          versionMask: 0
        })
  
        return {
          ...BaseType,
          pageSize: 4096,
        }
      }
    })
  })

  afterAll(() => {
    enttTraitsTemplate.removeAllUserlandSpecializations()
  })

  test('Functionalities', function() {
    const TraitsType = enttTraitsTemplate.instantiate(Entity)

    const registry = new Registry()
    expect(registry.getStorage(Entity).size).toBe(0)
    expect(registry.getStorage(Entity).freeList()).toBe(0n)
    expect(registry.getStorage(Entity).empty()).toBe(true)

    expect(registry.getStorage(BigInt).size).toBe(0)
    expect(registry.getStorage(String).size).toBe(0)
    expect(registry.getStorage(BigInt).empty()).toBe(true)
    expect(registry.getStorage(String).empty()).toBe(true)
    
    const e0 = registry.create()
    const e1 = registry.create()
    registry.emplace(e1, BigInt, 0)
    registry.emplace(e1, String)
    expect(registry.allOf(e0)).toBe(true)
    expect(registry.anyOf(e1)).toBe(false)

    expect(registry.getStorage(BigInt).size).toBe(1)
    expect(registry.getStorage(String).size).toBe(1)
    expect(registry.getStorage(BigInt).empty()).toBe(false)
    expect(registry.getStorage(String).empty()).toBe(false)

    expect(registry.tryGet(e0, BigInt)).toBeUndefined()
    expect(registry.tryGet(e1, BigInt)).not.toBeUndefined()
    expect(registry.tryGet(e0, String)).toBeUndefined()
    expect(registry.tryGet(e1, String)).not.toBeUndefined()
    expect(registry.tryGet(e0, Symbol)).toBeUndefined()
    expect(registry.tryGet(e1, Symbol)).toBeUndefined()

    expect(registry.emplace(e0, BigInt, 4)).toStrictEqual(4n)
    expect(registry.emplace(e0, String, 'c')).toStrictEqual('c')
    expect(() => registry.erase(e1, BigInt)).not.toThrow()
    expect(() => registry.erase(e1, String)).not.toThrow()
    expect(registry.allOf(e0, BigInt, String)).toBe(true)
    expect(registry.allOf(e1, BigInt, String)).toBe(false)
    expect(registry.anyOf(e0, BigInt, Symbol)).toBe(true)
    expect(registry.anyOf(e1, BigInt, Symbol)).toBe(false)

    const e2 = registry.create()
    registry.emplaceOrReplace(e2, BigInt, registry.get(e0, BigInt)!)
    registry.emplaceOrReplace(e2, String, registry.get(e0, String)!)
    expect(registry.allOf(e2, BigInt, String)).toBe(true)
    expect(registry.get(e0, BigInt)).toStrictEqual(4n)
    expect(registry.get(e0, String)).toStrictEqual('c')
    expect(registry.tryGet(e0, BigInt)).not.toBeUndefined()
    expect(registry.tryGet(e0, String)).not.toBeUndefined()
    expect(registry.tryGet(e0, Symbol)).toBeUndefined()
    expect(registry.tryGet(e0, BigInt)).toStrictEqual(4n)
    expect(registry.tryGet(e0, String)).toStrictEqual('c')

    expect(registry.get(e0, BigInt, String)[0]).toStrictEqual(4n)
    expect(registry.tryGet(e0, BigInt, String, Symbol)[0]).toStrictEqual(4n)
    expect(registry.get(e0, BigInt, String)[1]).toStrictEqual('c')
    expect(registry.tryGet(e0, BigInt, String, Symbol)[1]).toStrictEqual('c')

    expect(registry.get(e0, BigInt)).toStrictEqual(registry.get(e2, BigInt))
    expect(registry.get(e0, String)).toStrictEqual(registry.get(e2, String))

    expect(registry.patch(e0, BigInt, (v) => 2n)).toStrictEqual(2n)
    expect(registry.replace(e0, BigInt, 3n)).toStrictEqual(3n)

    expect(() => registry.emplaceOrReplace(e0, BigInt, 1)).not.toThrow()
    expect(() => registry.emplaceOrReplace(e1, BigInt, 1)).not.toThrow()

    expect(registry.get(e0, BigInt)).toStrictEqual(1n)
    expect(registry.get(e1, BigInt)).toStrictEqual(1n)

    expect(registry.getStorage(Entity).size).toBe(3)
    expect(registry.getStorage(Entity).freeList()).toBe(3n)
    expect(TraitsType.toVersion(e2)).toBe(0)
    expect(registry.current(e2)).toBe(0)
    expect(() => registry.destroy(e2)).not.toThrow()
    expect(TraitsType.toVersion(e2)).toBe(0)
    expect(registry.current(e2)).toBe(1)

    expect(registry.valid(e0)).toBe(true)
    expect(registry.valid(e1)).toBe(true)
    expect(registry.valid(e2)).toBe(false)
    expect(registry.getStorage(Entity).size).toBe(3)
    expect(registry.getStorage(Entity).freeList()).toBe(2n)
    expect(() => registry.clear()).not.toThrow()
    expect(registry.getStorage(Entity).size).toBe(3)
    expect(registry.getStorage(Entity).freeList()).toBe(0n)
    expect(registry.getStorage(Entity).empty()).toBe(false)

    const e3 = registry.create()
    expect(registry.emplace(e3, BigInt, 3)).toStrictEqual(3n)
    expect(registry.emplace(e3, String, 'c')).toStrictEqual('c')
    expect(registry.getStorage(BigInt).size).toBe(1)
    expect(registry.getStorage(String).size).toBe(1)
    expect(registry.getStorage(BigInt).empty()).toBe(false)
    expect(registry.getStorage(String).empty()).toBe(false)
    expect(registry.allOf(e3, BigInt, String)).toBe(true)
    expect(registry.get(e3, BigInt)).toStrictEqual(3n)
    expect(registry.get(e3, String)).toStrictEqual('c')
    expect(() => registry.clear()).not.toThrow()
    expect(registry.getStorage(BigInt).size).toBe(0)
    expect(registry.getStorage(String).size).toBe(0)
    expect(registry.getStorage(BigInt).empty()).toBe(true)
    expect(registry.getStorage(String).empty()).toBe(true)

    const e4 = registry.create()
    const e5 = registry.create()
    registry.emplace(e4, BigInt, 0)
    expect(registry.remove(e4, BigInt)).toBe(1)
    expect(registry.remove(e5, BigInt)).toBe(0)
    expect(registry.getStorage(BigInt).size).toBe(0)
    expect(registry.getStorage(String).size).toBe(0)
    expect(registry.getStorage(BigInt).empty()).toBe(true)
  })

  test('Storage Iterator', function () {
    const registry = new Registry()
    const entity = registry.create()
    const storage = registry.getStorage([BigInt, 'other'])
    storage.emplace(entity, 0)
    for (const [id, pool] of registry.storage()) {
      expect(pool.has(entity)).toBe(true)
      expect(storage).toBe(pool)
      expect(id).toBe('other')
    }
  })

  test('Storage', function () {
    const registry = new Registry()
    class Empty {}
    const storage = registry.getStorage([Empty, 'other'])
    const entity = registry.create()
    
    expect(registry.getStorage([Empty, 'other'])).toBe(storage)
    expect(registry.getStorage(Empty)).not.toBe(storage)
    expect(registry.getStorage('other')).not.toBeUndefined()
    expect(registry.getStorage('rehto')).toBeUndefined()
    expect(registry.anyOf(entity, Empty)).toBe(false)
    expect(storage.has(entity)).toBe(false)
    
    registry.emplace(entity, Empty)
    expect(storage.has(entity)).toBe(false)
    expect(registry.anyOf(entity, Empty)).toBe(true)
    expect(makeView([registry.getStorage(Empty), storage]).sizeHint()).toBe(0)

    storage.emplace(entity)
    expect(storage.has(entity)).toBe(true)
    expect(registry.anyOf(entity, Empty)).toBe(true)
    expect(makeView([registry.getStorage(Empty), storage]).sizeHint()).toBe(1)

    registry.destroy(entity)
    expect(registry.create(entity)).toBe(entity)
    expect(storage.has(entity)).toBe(false)
    expect(registry.anyOf(entity, Empty)).toBe(false)
  })

  test('Storage Death', function () {
    const registry = new Registry()
    class Empty {}
    registry.getStorage([Empty, 'other'])
    expect(() => { registry.getStorage([BigInt, 'other']) }).toThrow()
    expect(() => { registry.getStorage([Entity, 'other']) }).toThrow()
  })

  test('Storage Reset', function () {
    const registry = new Registry()
    registry.getStorage(BigInt)
    registry.getStorage([BigInt, 'other'])
    
    expect(registry.getStorage(BigInt)).not.toBeUndefined()
    expect(registry.getStorage('other')).not.toBeUndefined()
    expect(registry.reset('other')).toBe(true)
    expect(registry.getStorage(BigInt)).not.toBeUndefined()
    expect(registry.getStorage('other')).toBeUndefined()

    expect(registry.reset('other')).toBe(false)
    expect(registry.reset(BigInt)).toBe(true)
    expect(registry.reset(BigInt)).toBe(false)

    expect(registry.getStorage(BigInt, true)).toBeUndefined()
    expect(registry.getStorage('other')).toBeUndefined()

    const entity = registry.create()
    expect(registry.valid(entity)).toBe(true)
    expect(() => registry.reset(Entity)).toThrow()
    expect(registry.valid(entity)).toBe(true)
  })

  test('Identifiers', function () {
    const TraitsType = enttTraitsTemplate.instantiate(Entity)
    const registry = new Registry()
    const pre = registry.create()

    expect(TraitsType.toIntegral(pre)).toBe(TraitsType.toEntity(pre))
    registry.destroy(pre)
    const post = registry.create()
    expect(pre).not.toBe(post)
    expect(TraitsType.toEntity(pre)).toStrictEqual(TraitsType.toEntity(post))
    expect(TraitsType.toVersion(pre)).not.toBe(TraitsType.toVersion(post))
    expect(TraitsType.toVersion(pre)).not.toBe(registry.current(pre))
    expect(TraitsType.toVersion(post)).toBe(registry.current(post))
    const invalid = TraitsType.combine(TraitsType.toEntity(post) + 1, TraitsType.EntityType(0))
    expect(TraitsType.toVersion(invalid)).toBe(0)
    expect(registry.current(invalid)).toBe(TraitsType.toVersion(TraitsType.tombstone))
  })

  test('More on Identifiers', function () {
    const TraitsType = enttTraitsTemplate.instantiate(Entity)
    const registry = new Registry()
    const entity = [registry.create(), registry.create()]
    registry.destroy(entity[0])
    expect(registry.valid(entity[0])).toBe(false)
    expect(registry.valid(entity[1])).toBe(true)
    expect(registry.current(TraitsType.null)).toBe(TraitsType.toVersion(TraitsType.tombstone))
    expect(registry.current(entity[0])).toBe(TraitsType.toVersion(entity[0]) + 1)
    expect(registry.current(entity[1])).toBe(TraitsType.toVersion(entity[1]))
    registry.destroy(entity[1])
    expect(registry.valid(entity[1])).toBe(false)
    expect(registry.current(entity[1])).toBe(TraitsType.toVersion(entity[1]) + 1)
  })

  test('Version Overflow', function () {
    const TraitsType = enttTraitsTemplate.instantiate(Entity)
    const registry = new Registry()
    const entity = registry.create()
    registry.destroy(entity)
    expect(registry.current(entity)).not.toBe(TraitsType.toVersion(entity))
    expect(registry.current(entity)).not.toBe(TraitsType.VersionType(0))
    registry.destroy(registry.create(), TraitsType.toVersion(TraitsType.tombstone) - TraitsType.VersionType(1))
    registry.destroy(registry.create())
    expect(registry.current(entity)).toBe(TraitsType.toVersion(entity))
    expect(registry.current(entity)).toBe(TraitsType.VersionType(0))
  })

  test('Null Entity', function () {
    const registry = new Registry()
    const TraitsType = enttTraitsTemplate.instantiate(Entity)
    const entity = TraitsType.null
    expect(registry.valid(entity)).toBe(false)
    expect(registry.create(entity)).not.toBe(entity)
  })

  test('Tombstone Version', function () {
    const registry = new Registry()
    const TraitsType = enttTraitsTemplate.instantiate(Entity)
    const entity = TraitsType.tombstone
    expect(registry.valid(entity)).toBe(false)
    const other = registry.create()
    const vers = TraitsType.toVersion(entity)
    const required = TraitsType.construct(TraitsType.toEntity(other), vers)
    expect(registry.destroy(other, vers)).not.toBe(vers)
    expect(registry.create(required)).not.toStrictEqual(required)
  })

  test('Create Many Entities At Once', function() {
    const TraitsType = enttTraitsTemplate.instantiate(Entity)
    const registry = new Registry()
    const entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>[] = Array(3).fill(0)
    const entt = registry.create()
    registry.destroy(registry.create())
    registry.destroy(entt)
    registry.destroy(registry.create())
    registry.createRange(toRange(entity))
    expect(registry.valid(entity[0])).toBe(true)
    expect(registry.valid(entity[1])).toBe(true)
    expect(registry.valid(entity[2])).toBe(true)
    expect(TraitsType.toEntity(entity[0])).toBe(0)
    expect(TraitsType.toVersion(entity[0])).toBe(2)
    expect(TraitsType.toEntity(entity[1])).toBe(1)
    expect(TraitsType.toVersion(entity[1])).toBe(1)
    expect(TraitsType.toEntity(entity[2])).toBe(2)
    expect(TraitsType.toVersion(entity[2])).toBe(0)
  })

  test('Create Many Entities At Once With Listener', function() {
    class Empty {}
    const TraitsType = enttTraitsTemplate.instantiate(Entity)
    const registry = new Registry()
    const listener = new Listener()
    const entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>[] = Array(3).fill(0)

    registry.onConstruct(BigInt).connect(listener.incr, listener)
    const entityRange = toRange(entity)
    registry.createRange(entityRange)
    registry.insert(BigInt, entityRange.begin(), entityRange.end(), 1n)
    registry.insert(String, entityRange.begin(), entityRange.end(), 'c')
    expect(registry.get(entity[0], BigInt)).toBe(1n)
    expect(registry.get(entity[1], String)).toBe('c')
    expect(listener.counter).toBe(3)

    registry.onConstruct(BigInt).disconnect(listener.incr, listener)
    registry.onConstruct(Empty).connect(listener.incr, listener)
    registry.createRange(toRange(entity))
    registry.insert(String, entityRange.begin(), entityRange.end(), 'a')
    registry.insert(Empty, entityRange.begin(), entityRange.end())
    // for (const e of entity) {
    //   registry.emplace(e, String, 'a')
    //   registry.emplace(e, Empty)
    // }
    expect(registry.allOf(entity[0], Empty)).toBe(true)
    expect(registry.get(entity[2], String)).toBe('a')
    expect(listener.counter).toBe(6)
  })

  test('Create With Hint', function() {
    const TraitsType = enttTraitsTemplate.instantiate(Entity)
    const registry = new Registry()
    const e3 = registry.create(TraitsType.construct(3, 0))
    const e2 = registry.create(TraitsType.construct(3, 0))
    expect(e2).toBe(TraitsType.construct(0, 0))
    expect(registry.valid(TraitsType.construct(1, 0))).toBe(false)
    expect(registry.valid(TraitsType.construct(2, 0))).toBe(false)
    expect(e3).toBe(TraitsType.construct(3, 0))
    registry.destroy(e2)
    expect(TraitsType.toVersion(e2)).toBe(0)
    expect(registry.current(e2)).toBe(1)
    const ne2 = registry.create()
    const e1 = registry.create(TraitsType.construct(2, 0))
    expect(TraitsType.toEntity(ne2)).toBe(0)
    expect(TraitsType.toVersion(ne2)).toBe(1)
    expect(TraitsType.toEntity(e1)).toBe(2)
    expect(TraitsType.toVersion(e1)).toBe(0)
    registry.destroy(e1)
    registry.destroy(ne2)
    const e0 = registry.create(TraitsType.construct(0, 0))
    expect(e0).toBe(TraitsType.construct(0, 0))
    expect(TraitsType.toVersion(e0)).toBe(0)
  })

  test('Create Clear Cycle', function() {
    const TraitsType = enttTraitsTemplate.instantiate(Entity)
    const registry = new Registry()
    let pre: ValueType<EnttTraits<NumberConstructor>['ValueType']> = TraitsType.null
    let post: ValueType<EnttTraits<NumberConstructor>['ValueType']> = TraitsType.null

    const first_iteration = 10
    const second_iteration = 7
    const third_iteration = 5
    for (let i = 0; i < first_iteration; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Double, 0)
    }

    registry.clear()

    for (let i = 0; i < second_iteration; ++i) {
      const entity = registry.create()
      registry.emplace(entity, BigInt, 0)

      if (i === 3) {
        pre = entity
      }
    }

    registry.clear()

    for (let i = 0; i < third_iteration; ++i) {
      const entity = registry.create()

      if (i === 3) {
        post = entity
      }
    }

    expect(registry.valid(pre)).toBe(false)
    expect(registry.valid(post)).toBe(true)
    expect(TraitsType.toVersion(pre) + 1).toBe(TraitsType.toVersion(post))
    expect(registry.current(pre)).toBe(registry.current(post))
  })

  test('Create Destroy Release Corner Case', function() {
    const registry = new Registry()
    const e0 = registry.create()
    const e1 = registry.create()

    registry.destroy(e0)
    registry.getStorage(Entity).delete(e1)

    expect(registry.getStorage(Entity).freeList()).toBe(0n)

    expect(registry.current(e0)).toBe(1)
    expect(registry.current(e1)).toBe(1)
  })

  test.skip('Create Too Many Entities Death Test', function() {
    const registry = new Registry()
    const TraitsType = enttTraitsTemplate.instantiate(Entity)
    const entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>[] = Array(TraitsType.toEntity(TraitsType.null)).fill(0)
    registry.createRange(toRange(entity))
    expect(() => registry.create()).toThrow()
  })

  test('Destroy With Version', function() {
    const registry = new Registry()
    const e0 = registry.create()
    const e1 = registry.create()

    expect(registry.current(e0)).toBe(0)
    expect(registry.current(e1)).toBe(0)

    registry.destroy(e0)
    registry.destroy(e1, 3)

    expect(registry.current(e0)).toBe(1)
    expect(registry.current(e1)).toBe(3)

    const registry2 = new Registry()
    const entity = registry2.create()
    registry2.destroy(entity)
    expect(() => registry2.destroy(entity)).toThrow()
    expect(() => registry2.destroy(entity, 3)).toThrow()
  })

  test('Destroy Range', function() {
    const registry = new Registry()
    const iview = registry.view([BigInt])
    const icview = registry.view([BigInt, String])
    const entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>[] = Array(3).fill(0)
    registry.createRange(toRange(entity))

    registry.emplace(entity[0], BigInt, 0)
    registry.emplace(entity[0], String, 'c')
    registry.emplace(entity[0], Double, 0.0)

    registry.emplace(entity[1], BigInt, 0)
    registry.emplace(entity[1], String, 'c')

    registry.emplace(entity[2], BigInt, 0)

    expect(registry.valid(entity[0])).toBe(true)
    expect(registry.valid(entity[1])).toBe(true)
    expect(registry.valid(entity[2])).toBe(true)

    registry.destroyRange(icview)

    expect(registry.valid(entity[0])).toBe(false)
    expect(registry.valid(entity[1])).toBe(false)
    expect(registry.valid(entity[2])).toBe(true)

    expect(registry.getStorage(BigInt).size).toBe(1)
    expect(registry.getStorage(String).size).toBe(0)
    expect(registry.getStorage(Double).size).toBe(0)

    registry.destroyRange(iview)

    expect(registry.valid(entity[2])).toBe(false)
    expect(() => registry.destroyRange(iview.rbegin(), iview.rend())).not.toThrow()
    expect(iview.size).toBe(0)
    expect(icview.sizeHint()).toBe(0)

    expect(registry.getStorage(BigInt).size).toBe(0)
    expect(registry.getStorage(String).size).toBe(0)
    expect(registry.getStorage(Double).size).toBe(0)

    registry.createRange(toRange(entity))
    registry.insert(BigInt, new ArrayPointer(entity, 0), new ArrayPointer(entity, entity.length), 0n)
    
    expect(registry.valid(entity[0])).toBe(true)
    expect(registry.valid(entity[1])).toBe(true)
    expect(registry.valid(entity[2])).toBe(true)
    expect(registry.getStorage(BigInt).size).toBe(3)
    
    registry.destroyRange(toRange(entity))
    expect(registry.valid(entity[0])).toBe(false)
    expect(registry.valid(entity[1])).toBe(false)
    expect(registry.valid(entity[2])).toBe(false)
    expect(registry.getStorage(BigInt).size).toBe(0)

    const managed = new SparseSet()
    registry.createRange(toRange(entity))
    managed.pushRange(toRange(entity))
    registry.insert(BigInt, managed.begin(), managed.end(), 0n)
    
    expect(registry.valid(managed.access(0)!)).toBe(true)
    expect(registry.valid(managed.access(1)!)).toBe(true)
    expect(registry.valid(managed.access(2)!)).toBe(true)
    expect(registry.getStorage(BigInt).size).toBe(3)
    registry.destroyRange(managed.begin(), managed.end())
    
    expect(registry.valid(managed.access(0)!)).toBe(false)
    expect(registry.valid(managed.access(1)!)).toBe(false)
    expect(registry.valid(managed.access(2)!)).toBe(false)
    expect(registry.getStorage(BigInt).size).toBe(0)
  })

  test('Stable Destroy', function () {
    const registry = new Registry()
    const iview = registry.view([BigInt])
    const icview = registry.view([BigInt, PointerStable])
    const entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>[] = Array(3).fill(0)
    registry.createRange(toRange(entity))

    registry.emplace(entity[0], BigInt, 0)
    registry.emplace(entity[0], PointerStable)
    registry.emplace(entity[0], Double)

    registry.emplace(entity[1], BigInt, 0)
    registry.emplace(entity[1], PointerStable)

    registry.emplace(entity[2], BigInt, 0)

    expect(registry.valid(entity[0])).toBe(true)
    expect(registry.valid(entity[1])).toBe(true)
    expect(registry.valid(entity[2])).toBe(true)

    registry.destroyRange(icview)

    expect(registry.valid(entity[0])).toBe(false)
    expect(registry.valid(entity[1])).toBe(false)
    expect(registry.valid(entity[2])).toBe(true)

    expect(registry.getStorage(BigInt).size).toBe(1)
    expect(registry.getStorage(PointerStable).size).toBe(2)
    expect(registry.getStorage(Double).size).toBe(0)

    registry.destroyRange(iview)

    expect(registry.valid(entity[2])).toBe(false)
    expect(iview.size).toBe(0)
    expect(icview.sizeHint()).toBe(0)

    expect(registry.getStorage(BigInt).size).toBe(0)
    expect(registry.getStorage(PointerStable).size).toBe(2)
    expect(registry.getStorage(Double).size).toBe(0)
  })

  test('Emplace', function () {
    const registry = new Registry()
    const entity = registry.create()

    expect(registry.allOf(entity, BigInt)).toBe(false)

    const ref = registry.emplace(entity, BigInt, 4)

    expect(registry.allOf(entity, BigInt)).toBe(true)
    expect(registry.get(entity, BigInt)).toBe(ref)
    expect(ref).toBe(4n)
  })

  test('Emplace Empty', function () {
    const registry = new Registry()
    const entity = registry.create()

    expect(registry.allOf(entity, Empty)).toBe(false)

    registry.emplace(entity, Empty)

    expect(registry.allOf(entity, Empty)).toBe(true)
  })

  test('Emplace Aggregate', function () {
    const registry = new Registry()
    const entity = registry.create()

    expect(registry.allOf(entity, Aggregate)).toBe(false)

    const ref = registry.emplace(entity, Aggregate, 4)

    expect(registry.allOf(entity, Aggregate)).toBe(true)
    expect(registry.get(entity, Aggregate)!.value).toBe(ref.value)
    expect(ref.value).toBe(4)
  })

  test('Emplace Types From Standard Template Library', function () {
    const registry = new Registry()
    const entity = registry.create()
    registry.emplace(entity, Set).add(1)
    expect(registry.get(entity, Set)!.has(1)).toBe(true)
    registry.destroy(entity)
  })

  test('Emplace With Components', function () {
    const registry = new Registry()
    const value = 0
    registry.emplace(registry.create(), BigInt, value)
  })

  test('Stable Emplace', function () {
    const registry = new Registry()
    registry.onConstruct(BigInt).connect((registry) => Listener.sort(BigInt, registry))
    expect(registry.emplace(registry.create(), BigInt, 0)).toBe(0n)
    expect(registry.emplace(registry.create(), BigInt, 1)).toBe(1n)
  })

  test('Emplace Death Test', function () {
    const registry = new Registry()
    const entity = registry.create()
    registry.destroy(entity)
    expect(() => registry.emplace(entity, BigInt, 0)).toThrow()
  })

  test('Insert', function () {
    const registry = new Registry()
    const entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>[] = Array(3).fill(0)
    registry.createRange(toRange(entity))

    registry.emplace(entity[0], BigInt, 0)
    registry.emplace(entity[0], String)
    registry.emplace(entity[0], Double)

    registry.emplace(entity[1], BigInt, 0)
    registry.emplace(entity[1], String)

    registry.emplace(entity[2], BigInt, 0)

    class Float extends Number {
      equals (other: Number) {
        return Number(this) === Number(other)
      }
    }
    expect(registry.allOf(entity[0], Float)).toBe(false)
    expect(registry.allOf(entity[1], Float)).toBe(false)
    expect(registry.allOf(entity[2], Float)).toBe(false)

    const icview = registry.view([BigInt, String])
    registry.insert(Float, icview.begin(), icview.end(), new Float(3))
    expect(registry.get(entity[0], Float)!.equals(3)).toBe(true)
    expect(registry.get(entity[1], Float)!.equals(3)).toBe(true)
    expect(registry.allOf(entity[2], Float)).toBe(false)
    registry.clear(Float)
    const value = [new Float(0), new Float(1), new Float(2)]

    const iview = registry.view([BigInt])
    registry.insertRange(Float, iview.rbegin(), iview.rend(), toRange(value).begin())

    expect(registry.get(entity[0], Float)!.equals(0)).toBe(true)
    expect(registry.get(entity[1], Float)!.equals(1)).toBe(true)
    expect(registry.get(entity[2], Float)!.equals(2)).toBe(true)
  })

  test('Insert Death Test', function () {
    const registry = new Registry()
    const entity = [registry.create()]
    const value = [0n]

    registry.destroy(entity[0])

    expect(() => registry.insert(BigInt, toRange(entity).begin(), toRange(entity).end(), value[0])).toThrow()
    expect(() => registry.insertRange(BigInt, toRange(entity).begin(), toRange(entity).end(), toRange(value).begin())).toThrow()
  })

  test('EmplaceOrReplace', function () {
    const registry = new Registry()
    const entity = registry.create()

    expect(registry.allOf(entity, BigInt)).toBe(false)

    const ref = registry.emplaceOrReplace(entity, BigInt, 4)

    expect(registry.allOf(entity, BigInt)).toBe(true)
    expect(registry.get(entity, BigInt)).toBe(ref)
    expect(ref).toBe(4n)

    registry.emplaceOrReplace(entity, BigInt, 0)

    expect(registry.get(entity, BigInt)).toBe(0n)
  })

  test('EmplaceOrReplaceEmpty', function () {
    const registry = new Registry()
    const entity = registry.create()

    expect(registry.allOf(entity, Empty)).toBe(false)

    registry.emplaceOrReplace(entity, Empty)

    expect(registry.allOf(entity, Empty)).toBe(true)

    registry.emplaceOrReplace(entity, Empty)

    expect(registry.getStorage(Empty).size).toBe(1)
  })

  test('EmplaceOrReplace Aggregate', function () {
    const registry = new Registry()
    const entity = registry.create()
    const instance = registry.emplaceOrReplace(entity, Aggregate, 1)

    expect(instance.value).toBe(1)
  })

  test('EmplaceOrReplace Death Test', function () {
    const registry = new Registry()
    const entity = registry.create()
    registry.destroy(entity)
    expect(() => registry.emplaceOrReplace(entity, BigInt, 0)).toThrow()
  })

  test('Patch', function () {
    const registry = new Registry()
    const entity = registry.create()

    registry.emplace(entity, BigInt, 3)

    expect(registry.get(entity, BigInt)).toBe(3n)

    registry.patch(entity, BigInt)
    expect(registry.get(entity, BigInt)).toBe(3n)

    registry.patch(entity, BigInt, (value) => {
      value = 1n
      return value
    })

    expect(registry.get(entity, BigInt)).toBe(1n)
  })

  test('Replace', function () {
    const registry = new Registry()
    const entity = registry.create()

    registry.emplace(entity, BigInt, 3)
    expect(registry.get(entity, BigInt)).toBe(3n)

    registry.replace(entity, BigInt, 0)
    expect(registry.get(entity, BigInt)).toBe(0n)

    registry.replace(entity, BigInt, 1)
    expect(registry.get(entity, BigInt)).toBe(1n)
  })

  test('Replace Aggregate', function () {
    const registry = new Registry()
    const entity = registry.create()

    registry.emplace(entity, Aggregate, 0)
    const instance = registry.replace(entity, Aggregate, 1)

    expect(instance.value).toBe(1)
  })

  test('Remove', function () {
    const registry = new Registry()
    const iview = registry.view([BigInt])
    const icview = registry.view([BigInt, String])
    const entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>[] = Array(3).fill(0)
    registry.createRange(toRange(entity))

    registry.emplace(entity[0], BigInt, 0)
    registry.emplace(entity[0], String, 'c')
    registry.emplace(entity[0], Double, 0.0)

    registry.emplace(entity[1], BigInt, 0)
    registry.emplace(entity[1], String, 'c')

    registry.emplace(entity[2], BigInt, 0)

    expect(registry.anyOf(entity[0], BigInt)).toBe(true)
    expect(registry.allOf(entity[1], BigInt)).toBe(true)
    expect(registry.anyOf(entity[2], BigInt)).toBe(true)

    registry.remove(entity[0], BigInt, String)

    expect(registry.removeRange(icview.begin(), icview.end(), BigInt, String)).toBe(2)
    expect(registry.removeRange(icview.begin(), icview.end(), BigInt, String)).toBe(0)

    expect(registry.anyOf(entity[0], BigInt)).toBe(false)
    expect(registry.allOf(entity[1], BigInt)).toBe(false)
    expect(registry.anyOf(entity[2], BigInt)).toBe(true)

    expect(registry.getStorage(BigInt).size).toBe(1)
    expect(registry.getStorage(String).size).toBe(0)
    expect(registry.getStorage(Double).size).toBe(1)

    expect(registry.removeRange(iview.begin(), iview.end(), BigInt)).toBe(1)

    expect(registry.removeRange(icview.begin(), icview.end())).toBe(0)
    expect(registry.removeRange(icview.begin(), icview.end())).toBe(0)

    expect(registry.anyOf(entity[2], BigInt)).toBe(false)
    expect(registry.removeRange(iview.begin(), iview.end(), BigInt)).toBe(0)

    expect(registry.getStorage(BigInt).size).toBe(0)
    expect(registry.getStorage(String).size).toBe(0)
    expect(registry.getStorage(Double).size).toBe(1)

    registry.insert(BigInt, toRange(entity).begin().plus(1), toRange(entity).end().minus(1), 0n)
    registry.insert(String, toRange(entity).begin().plus(1), toRange(entity).end().minus(1), '\0')

    expect(registry.getStorage(BigInt).size).toBe(1)
    expect(registry.getStorage(String).size).toBe(1)

    registry.removeRange(iview.begin(), iview.end(), BigInt, String)
    registry.removeRange(iview.begin(), iview.end(), BigInt, String)

    expect(registry.getStorage(BigInt).size).toBe(0)
    expect(registry.getStorage(String).size).toBe(0)

    registry.insert(BigInt, toRange(entity).begin(), toRange(entity).end(), 0n)
    registry.insert(String, toRange(entity).begin(), toRange(entity).end(), '\0')

    expect(registry.getStorage(BigInt).size).toBe(3)
    expect(registry.getStorage(String).size).toBe(3)

    registry.removeRange(toRange(entity).begin(), toRange(entity).end(), BigInt, String)
    registry.removeRange(toRange(entity).begin(), toRange(entity).end(), BigInt, String)

    expect(registry.getStorage(BigInt).size).toBe(0)
    expect(registry.getStorage(String).size).toBe(0)

    expect(registry.orphan(entity[0])).toBe(false)
    expect(registry.orphan(entity[1])).toBe(true)
    expect(registry.orphan(entity[2])).toBe(true)
  })

  test('Stable Remove', function () {
    const registry = new Registry()
    const iview = registry.view([BigInt])
    const icview = registry.view([BigInt, PointerStable])
    const entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>[] = Array(3).fill(0)
    registry.createRange(toRange(entity))

    registry.emplace(entity[0], BigInt, 0)
    registry.emplace(entity[0], PointerStable)
    registry.emplace(entity[0], Double)

    registry.emplace(entity[1], BigInt, 0)
    registry.emplace(entity[1], PointerStable)

    registry.emplace(entity[2], BigInt, 0)

    expect(registry.anyOf(entity[0], BigInt)).toBe(true)
    expect(registry.allOf(entity[1], BigInt)).toBe(true)
    expect(registry.anyOf(entity[2], BigInt)).toBe(true)

    registry.remove(entity[0], BigInt, PointerStable)

    expect(registry.removeRange(icview.begin(), icview.end(), BigInt, PointerStable)).toBe(2)
    expect(registry.removeRange(icview.begin(), icview.end(), BigInt, PointerStable)).toBe(0)

    expect(registry.anyOf(entity[0], BigInt)).toBe(false)
    expect(registry.allOf(entity[1], BigInt)).toBe(false)
    expect(registry.anyOf(entity[2], BigInt)).toBe(true)

    expect(registry.getStorage(BigInt).size).toBe(1)
    expect(registry.getStorage(PointerStable).size).toBe(2)
    expect(registry.getStorage(Double).size).toBe(1)

    expect(registry.removeRange(iview.begin(), iview.end(), BigInt)).toBe(1)

    expect(registry.remove(entity[0], BigInt)).toBe(0)
    expect(registry.remove(entity[1], BigInt)).toBe(0)
    
    expect(registry.anyOf(entity[2], BigInt)).toBe(false)
    expect(registry.getStorage(BigInt).size).toBe(0)
    expect(registry.getStorage(PointerStable).size).toBe(2)
    expect(registry.getStorage(Double).size).toBe(1)
  })

  test('Erase', function () {
    const registry = new Registry()
    const iview = registry.view([BigInt])
    const icview = registry.view([BigInt, String])
    const entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>[] = Array(3).fill(0)
    registry.createRange(toRange(entity))

    registry.emplace(entity[0], BigInt, 0)
    registry.emplace(entity[0], String)
    registry.emplace(entity[0], Double)

    registry.emplace(entity[1], BigInt, 0)
    registry.emplace(entity[1], String)

    registry.emplace(entity[2], BigInt, 0)

    expect(registry.anyOf(entity[0], BigInt)).toBe(true)
    expect(registry.allOf(entity[1], BigInt)).toBe(true)
    expect(registry.anyOf(entity[2], BigInt)).toBe(true)

    registry.erase(entity[0], BigInt, String)
    registry.eraseRange(icview.begin(), icview.end(), BigInt, String)

    expect(registry.anyOf(entity[0], BigInt)).toBe(false)
    expect(registry.allOf(entity[1], BigInt)).toBe(false)
    expect(registry.anyOf(entity[2], BigInt)).toBe(true)

    expect(registry.getStorage(BigInt).size).toBe(1)
    expect(registry.getStorage(String).size).toBe(0)
    expect(registry.getStorage(Double).size).toBe(1)

    registry.eraseRange(iview.begin(), iview.end(), BigInt)

    expect(registry.anyOf(entity[2], BigInt)).toBe(false)

    expect(registry.getStorage(BigInt).size).toBe(0)
    expect(registry.getStorage(String).size).toBe(0)
    expect(registry.getStorage(Double).size).toBe(1)

    registry.insert(BigInt, toRange(entity).begin().plus(1), toRange(entity).end().minus(1))
    registry.insert(String, toRange(entity).begin().plus(1), toRange(entity).end().minus(1))

    expect(registry.getStorage(BigInt).size).toBe(1)
    expect(registry.getStorage(String).size).toBe(1)

    registry.eraseRange(iview.begin(), iview.end(), BigInt, String)

    expect(registry.getStorage(BigInt).size).toBe(0)
    expect(registry.getStorage(String).size).toBe(0)

    registry.insert(BigInt, toRange(entity).begin(), toRange(entity).end())
    registry.insert(String, toRange(entity).begin(), toRange(entity).end())

    expect(registry.getStorage(BigInt).size).toBe(3)
    expect(registry.getStorage(String).size).toBe(3)

    registry.eraseRange(toRange(entity).begin(), toRange(entity).end(), BigInt, String)

    expect(registry.getStorage(BigInt).size).toBe(0)
    expect(registry.getStorage(String).size).toBe(0)

    expect(registry.orphan(entity[0])).toBe(false)
    expect(registry.orphan(entity[1])).toBe(true)
    expect(registry.orphan(entity[2])).toBe(true)
  })

  test('Erase Death Test', function () {
    const registry = new Registry()
    const entity = [registry.create()]

    expect(registry.anyOf(entity[0], BigInt)).toBe(false)
    expect(() => { registry.eraseRange(toRange(entity).begin(), toRange(entity).end(), BigInt) }).toThrow()
    expect(() => { registry.erase(entity[0], BigInt)  }).toThrow()
  })

  test('Stable Erase', function () {
    const registry = new Registry()
    const iview = registry.view([BigInt])
    const icview = registry.view([BigInt, PointerStable])
    const entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>[] = Array(3).fill(0)
    registry.createRange(toRange(entity))

    registry.emplace(entity[0], BigInt, 0)
    registry.emplace(entity[0], PointerStable)
    registry.emplace(entity[0], Double)

    registry.emplace(entity[1], BigInt, 0)
    registry.emplace(entity[1], PointerStable)

    registry.emplace(entity[2], BigInt, 0)

    expect(registry.anyOf(entity[0], BigInt)).toBe(true)
    expect(registry.allOf(entity[1], BigInt)).toBe(true)
    expect(registry.anyOf(entity[2], BigInt)).toBe(true)

    registry.erase(entity[0], BigInt, PointerStable)
    registry.eraseRange(icview.begin(), icview.end(), BigInt, PointerStable)
    registry.eraseRange(icview.begin(), icview.end(), BigInt, PointerStable)

    expect(registry.anyOf(entity[0], BigInt)).toBe(false)
    expect(registry.allOf(entity[1], BigInt)).toBe(false)
    expect(registry.anyOf(entity[2], BigInt)).toBe(true)

    expect(registry.getStorage(BigInt).size).toBe(1)
    expect(registry.getStorage(PointerStable).size).toBe(2)
    expect(registry.getStorage(Double).size).toBe(1)

    registry.eraseRange(iview.begin(), iview.end(), BigInt)

    expect(registry.anyOf(entity[2], BigInt)).toBe(false)

    expect(registry.getStorage(BigInt).size).toBe(0)
    expect(registry.getStorage(PointerStable).size).toBe(2)
    expect(registry.getStorage(Double).size).toBe(1)
  })

  test('Erase If', function () {
    const registry = new Registry()
    const entity = registry.create()

    registry.emplace(entity, BigInt, 0)
    registry.getStorage([BigInt, 'other']).emplace(entity, 0)
    registry.emplace(entity, String)

    expect(registry.getStorage(BigInt).has(entity)).toBe(true)
    expect(registry.getStorage([BigInt, 'other']).has(entity)).toBe(true)
    expect(registry.getStorage(String).has(entity)).toBe(true)

    registry.eraseIf(entity, (_id, _storage) => false)

    expect(registry.getStorage(BigInt).has(entity)).toBe(true)
    expect(registry.getStorage([BigInt, 'other']).has(entity)).toBe(true)
    expect(registry.getStorage(String).has(entity)).toBe(true)

    registry.eraseIf(entity, (id, _storage) => id === 'other')

    expect(registry.getStorage(BigInt).has(entity)).toBe(true)
    expect(registry.getStorage([BigInt, 'other']).has(entity)).toBe(false)
    expect(registry.getStorage(String).has(entity)).toBe(true)

    registry.eraseIf(entity, (_id, storage) => storage.type() === String)

    expect(registry.getStorage(BigInt).has(entity)).toBe(true)
    expect(registry.getStorage([BigInt, 'other']).has(entity)).toBe(false)
    expect(registry.getStorage(String).has(entity)).toBe(false)
  })

  test('Compact', function () {
    const registry = new Registry()
    const entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>[] = Array(2).fill(0)
    registry.createRange(toRange(entity))

    registry.emplace(entity[0], BigInt, 0)
    registry.emplace(entity[0], PointerStable)

    registry.emplace(entity[1], BigInt, 0)
    registry.emplace(entity[1], PointerStable)

    expect(registry.getStorage(BigInt).size).toBe(2)
    expect(registry.getStorage(PointerStable).size).toBe(2)

    registry.destroyRange(toRange(entity))

    expect(registry.getStorage(BigInt).size).toBe(0)
    expect(registry.getStorage(PointerStable).size).toBe(2)

    registry.compact(BigInt)

    expect(registry.getStorage(BigInt).size).toBe(0)
    expect(registry.getStorage(PointerStable).size).toBe(2)

    registry.compact()

    expect(registry.getStorage(BigInt).size).toBe(0)
    expect(registry.getStorage(PointerStable).size).toBe(0)
  })

  test('AllAnyOf', function () {
    const registry = new Registry()
    const entity = registry.create()

    expect(registry.allOf(entity, BigInt)).toBe(false)
    expect(registry.allOf(entity, BigInt, String)).toBe(false)
    expect(registry.anyOf(entity, BigInt, String)).toBe(false)

    registry.emplace(entity, BigInt, 0)

    expect(registry.allOf(entity, BigInt)).toBe(true)
    expect(registry.allOf(entity, BigInt, String)).toBe(false)
    expect(registry.anyOf(entity, BigInt, String)).toBe(true)

    registry.emplace(entity, String, '')

    expect(registry.allOf(entity, BigInt)).toBe(true)
    expect(registry.allOf(entity, BigInt, String)).toBe(true)
    expect(registry.anyOf(entity, BigInt, String)).toBe(true)
  })

  test('Get', function () {
    const registry = new Registry()
    const entity = registry.create()

    registry.emplace(entity, BigInt, 1)
    registry.emplace(entity, String, 'c')

    expect(registry.get(entity, BigInt)).toBe(1n)
    expect(registry.get(entity, BigInt, String)).toStrictEqual([1n, 'c'])

    registry.replace(entity, BigInt, 3n)
    registry.replace(entity, String, 'a')

    expect(registry.get(entity, BigInt)).toBe(3n)
    expect(registry.get(entity, BigInt, String)).toStrictEqual([3n, 'a'])
  })

  test('Get Or Emplace', function () {
    const registry = new Registry()
    const entity = registry.create()
    const value = 3n
    const other = 1.0

    expect(registry.getOrEmplace(entity, BigInt, value)).toBe(value)
    expect(registry.getOrEmplace(entity, Double, other) == other).toBe(true)

    expect(registry.allOf(entity, BigInt, Double)).toBe(true)

    expect(registry.get(entity, BigInt)).toBe(value)
    expect(registry.get(entity, Double) == other).toBe(true)
  })

  test('Get Or Emplace Empty', function () {
    const registry = new Registry()
    const entity = registry.create()

    registry.getOrEmplace(entity, Empty)

    expect(registry.allOf(entity, Empty)).toBe(true)
  })

  test('Get Or Emplace Death Test', function () {
    const registry = new Registry()
    const entity = registry.create()
    registry.destroy(entity)
    expect(() => { registry.getOrEmplace(entity, BigInt, 0) }).toThrow()
  })

  test('Try Get', function () {
    const registry = new Registry()
    const entity = registry.create()

    expect(registry.tryGet(entity, BigInt)).toBeUndefined()
    expect(registry.tryGet(entity, BigInt)).toBeUndefined()

    expect(registry.getStorage(BigInt, true)).toBeUndefined()

    const elem = registry.emplace(entity, BigInt, 0n)

    expect(registry.getStorage(BigInt)).toBeDefined()

    expect(registry.tryGet(entity, BigInt)).toBe(elem)
    expect(registry.tryGet(entity, BigInt)).toBe(elem)
  })

  test('Clear', function () {
    const registry = new Registry()
    const entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>[] = [registry.create(), registry.create()]

    registry.insert(BigInt, toRange(entity).begin(), toRange(entity).end(), 0n)
    registry.insert(String, toRange(entity).begin(), toRange(entity).end(), '')

    expect(registry.allOf(entity[0], BigInt, String)).toBe(true)
    expect(registry.allOf(entity[1], BigInt, String)).toBe(true)

    registry.clear(BigInt)

    expect(registry.valid(entity[0])).toBe(true)
    expect(registry.valid(entity[1])).toBe(true)

    expect(registry.allOf(entity[0], BigInt)).toBe(false)
    expect(registry.allOf(entity[1], BigInt)).toBe(false)

    expect(registry.allOf(entity[0], String)).toBe(true)
    expect(registry.allOf(entity[1], String)).toBe(true)

    registry.clear()

    expect(registry.valid(entity[0])).toBe(false)
    expect(registry.valid(entity[1])).toBe(false)

    expect(registry.getStorage(BigInt).size).toBe(0)
    expect(registry.getStorage(String).size).toBe(0)
  })

  test('Orphan', function () {
    const registry = new Registry()
    const entity = Array(3).fill(0)
    registry.createRange(toRange(entity))

    registry.emplace(entity[0], BigInt, 0)
    registry.emplace(entity[2], BigInt, 0)

    for (const [entt] of registry.getStorage(Entity).each()) {
      expect(entt !== entity[1] || registry.orphan(entt)).toBe(true)
    }

    registry.erase(entity[0], BigInt)
    registry.erase(entity[2], BigInt)

    for (const [entt] of registry.getStorage(Entity).each()) {
      expect(registry.orphan(entt)).toBe(true)
    }
  })

  test('Signals', function () {
    const registry = new Registry()
    const entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>[] = Array(2).fill(0)
    registry.createRange(toRange(entity))
    const listener = new Listener()

    registry.onConstruct(Empty).connect(Listener.prototype.incr, listener)
    registry.onDestroy(Empty).connect(Listener.prototype.decr, listener)
    registry.onConstruct(BigInt).connect(Listener.prototype.incr, listener)
    registry.onDestroy(BigInt).connect(Listener.prototype.decr, listener)

    registry.insert(Empty, toRange(entity).begin(), toRange(entity).end())

    expect(listener.counter).toBe(2)
    expect(listener.last).toBe(entity[1])

    registry.insert(BigInt, toRange(entity).rbegin(), toRange(entity).rend())

    expect(listener.counter).toBe(4)
    expect(listener.last).toBe(entity[0])

    registry.erase(entity[0], Empty, BigInt)

    expect(listener.counter).toBe(2)
    expect(listener.last).toBe(entity[0])

    registry.onDestroy(Empty).disconnect(Listener.prototype.decr, listener)
    registry.onDestroy(BigInt).disconnect(Listener.prototype.decr, listener)

    registry.erase(entity[1], Empty, BigInt)

    expect(listener.counter).toBe(2)
    expect(listener.last).toBe(entity[0])

    registry.onConstruct(Empty).disconnect(Listener.prototype.incr, listener)
    registry.onConstruct(BigInt).disconnect(Listener.prototype.incr, listener)

    registry.emplace(entity[1], Empty)
    registry.emplace(entity[1], BigInt, 0n)

    expect(listener.counter).toBe(2)
    expect(listener.last).toBe(entity[0])

    registry.onConstruct(BigInt).connect(Listener.prototype.incr, listener)
    registry.onDestroy(BigInt).connect(Listener.prototype.decr, listener)

    registry.emplace(entity[0], BigInt, 0n)
    registry.erase(entity[1], BigInt)

    expect(listener.counter).toBe(2)
    expect(listener.last).toBe(entity[1])

    registry.onConstruct(Empty).connect(Listener.prototype.incr, listener)
    registry.onDestroy(Empty).connect(Listener.prototype.decr, listener)

    registry.erase(entity[1], Empty)
    registry.emplace(entity[0], Empty)

    expect(listener.counter).toBe(2)
    expect(listener.last).toBe(entity[0])

    registry.clear(Empty, BigInt)

    expect(listener.counter).toBe(0)
    expect(listener.last).toBe(entity[0])

    registry.insert(Empty, toRange(entity).begin(), toRange(entity).end())
    registry.insert(BigInt, toRange(entity).begin(), toRange(entity).end())
    registry.destroy(entity[1])

    expect(listener.counter).toBe(2)
    expect(listener.last).toBe(entity[1])

    registry.erase(entity[0], BigInt, Empty)
    registry.emplaceOrReplace(entity[0], BigInt, 0n)
    registry.emplaceOrReplace(entity[0], Empty)

    expect(listener.counter).toBe(2)
    expect(listener.last).toBe(entity[0])

    registry.onDestroy(Empty).disconnect(Listener.prototype.decr, listener)
    registry.onDestroy(BigInt).disconnect(Listener.prototype.decr, listener)

    registry.emplaceOrReplace(entity[0], Empty)
    registry.emplaceOrReplace(entity[0], BigInt, 0n)

    expect(listener.counter).toBe(2)
    expect(listener.last).toBe(entity[0])

    registry.onUpdate(Empty).connect(Listener.prototype.incr, listener)
    registry.onUpdate(BigInt).connect(Listener.prototype.incr, listener)

    registry.emplaceOrReplace(entity[0], Empty)
    registry.emplaceOrReplace(entity[0], BigInt, 0n)

    expect(listener.counter).toBe(4)
    expect(listener.last).toBe(entity[0])

    registry.replace(entity[0], Empty)
    registry.replace(entity[0], BigInt, 1n)

    expect(listener.counter).toBe(6)
    expect(listener.last).toBe(entity[0])
  })

  test('Signals On Runtime Pool', function () {
    const registry = new Registry()
    const entity = registry.create()
    const listener = new Listener()

    registry.onConstruct([BigInt, 'custom']).connect(Listener.prototype.incr, listener)
    registry.onUpdate([BigInt, 'custom']).connect(Listener.prototype.incr, listener)
    registry.onDestroy([BigInt, 'custom']).connect(Listener.prototype.incr, listener)

    expect(listener.counter).toBe(0)

    registry.emplace(entity, BigInt, 0n)
    registry.patch(entity, BigInt)
    registry.erase(entity, BigInt)

    expect(listener.counter).toBe(0)

    registry.getStorage([BigInt, 'custom']).emplace(entity, 0n)
    registry.patch(entity, [BigInt, 'custom'])
    registry.getStorage([BigInt, 'custom']).erase(entity)

    expect(listener.counter).toBe(3)
  })

  test('Signals On Entity', function () {
    const registry = new Registry()
    const listener = new Listener()

    registry.onConstruct(Entity).connect(Listener.prototype.incr, listener)

    const entity = registry.create()
    const other = registry.create()

    expect(listener.counter).toBe(2)
    expect(listener.last).toBe(other)

    registry.destroy(other)
    registry.destroy(entity)

    expect(listener.counter).toBe(2)
    expect(listener.last).toBe(other)

    registry.onConstruct(Entity).disconnect(Listener.prototype.incr, listener)

    const another = registry.create()
    const entt = registry.create()

    expect(listener.counter).toBe(2)
    expect(listener.last).not.toBe(entt)
    expect(listener.last).not.toBe(another)

    registry.onUpdate(Entity).connect(Listener.prototype.decr, listener)
    registry.patch(entt, Entity)

    expect(listener.counter).toBe(1)
    expect(listener.last).toBe(entt)

    registry.onUpdate(Entity).disconnect(Listener.prototype.decr, listener)
    registry.patch(another, Entity)

    expect(listener.counter).toBe(1)
    expect(listener.last).not.toBe(another)

    registry.onDestroy(Entity).connect(Listener.prototype.decr, listener)
    registry.destroy(entt)

    expect(listener.counter).toBe(0)
    expect(listener.last).toBe(entt)

    registry.onDestroy(Entity).disconnect(Listener.prototype.decr, listener)
    registry.destroy(another)

    expect(listener.counter).toBe(0)
    expect(listener.last).not.toBe(another)
  })

  test('Signal When Destroying', function () {
    const registry = new Registry()
    const entity = registry.create()

    registry.onDestroy(Double).connect((r, entity) => {
      return Registry.prototype.remove.call(r, entity, String)
    })

    registry.emplace(entity, Double)
    registry.emplace(entity, String, '')

    expect(registry.getStorage(Double)).toBeDefined()
    expect(registry.getStorage(String)).toBeDefined()
    expect(registry.valid(entity)).toBe(true)

    registry.destroy(entity)

    expect(registry.getStorage(String)).toBeDefined()
    expect(registry.valid(entity)).toBe(false)
  })

  test('Self Signal', function () {
    const registry = new Registry()
    const entity = registry.create()
    const emplaceOrReplace = (r: BasicRegistry<number, number>, entt: ValueType<EnttTraits<NumberConstructor>['ValueType']>) => {
      return Registry.prototype.emplaceOrReplace.call(r, entt, Double, 0.0)
    }
    const remove = (r: BasicRegistry<number, number>, entt: ValueType<EnttTraits<NumberConstructor>['ValueType']>) => {
      return Registry.prototype.remove.call(r, entt, Double)
    }

    registry.onConstruct(BigInt).connect(emplaceOrReplace)
    registry.onDestroy(BigInt).connect(remove)

    registry.emplace(entity, Double, 0.3)
    expect(registry.allOf(entity, BigInt)).toBe(false)
    expect(registry.get(entity, Double) == 0.3).toBe(true)

    registry.emplace(entity, BigInt, 0n)
    expect(registry.allOf(entity, BigInt)).toBe(true)
    expect(registry.get(entity, Double) == 0).toBe(true)

    registry.erase(entity, BigInt)
    expect(registry.anyOf(entity, BigInt, Double)).toBe(false)

    registry.onConstruct(BigInt).disconnect(emplaceOrReplace)
    registry.onDestroy(BigInt).disconnect(remove)

    registry.emplace(entity, BigInt, 0n)
    expect(registry.anyOf(entity, BigInt, Double)).toBe(true)
    expect(registry.allOf(entity, Double)).toBe(false)
  })

  test('View', function () {
    const registry = new Registry()
    const entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>[] = Array(3).fill(0)

    const iview = registry.view([BigInt])
    const cview = registry.view([String])

    const mview = registry.view([BigInt, String])
    const fview = registry.view([BigInt], [String])
    expect(mview.ok()).toBe(true)
    expect(fview.ok()).toBe(true)

    expect(registry.getStorage(BigInt, true)).not.toBeUndefined()
    expect(registry.getStorage(String, true)).not.toBeUndefined()

    registry.createRange(toRange(entity))
    registry.emplace(entity[0], BigInt, 0n)
    registry.emplace(entity[0], String, 'c')

    registry.emplace(entity[1], BigInt, 0n)

    registry.emplace(entity[2], BigInt, 0n)
    registry.emplace(entity[2], String, 'c')
    
    expect(iview.size).toBe(3)
    expect(cview.size).toBe(2)

    expect(mview.sizeHint()).toBe(3)
    expect(fview.sizeHint()).toBe(3)
    
    mview.refresh()

    expect(mview.sizeHint()).toBe(2)
    expect(fview.sizeHint()).toBe(3)
    
    expect(mview.begin().equals(mview.end())).toBe(false)
    expect(fview.begin().equals(fview.end())).toBe(false)

    expect(distance(mview.begin(), mview.end())).toBe(2)
    expect(distance(fview.begin(), fview.end())).toBe(1)

    let first = true
    mview.each((entt, _int, _char) => {
      expect(entt === (first ? entity[2] : entity[0])).toBe(true)
      first = false
    })

    fview.each((entt, _int) => {
      expect(entt === entity[1]).toBe(true)
    })
  })

  test('Exclude Only View', function () {
    const registry = new Registry()
    const entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>[] = Array(4).fill(0)

    const view = registry.view([Entity], [BigInt])

    registry.createRange(toRange(entity))

    registry.emplace(entity[0], BigInt, 0)
    registry.emplace(entity[2], BigInt, 0)
    registry.emplace(entity[3], BigInt, 0)

    registry.destroy(entity[3])

    expect(view.sizeHint()).toBe(3)
    expect(view.begin().equals(view.end())).toBe(false)

    expect(distance(view.begin(), view.end())).toBe(1)
    expect(view.begin().deref()).toStrictEqual(entity[1])

    for (const [entt] of view.each()) {
      expect(entt === entity[1]).toBe(true)
    }

    view.each((entt) => {
      expect(entt === entity[1]).toBe(true)
    })
  })

  test('Clean View After Remove And Clear', function () {
    const registry = new Registry()
    const view = registry.view([BigInt, String])

    const entity = registry.create()
    registry.emplace(entity, BigInt, 0)
    registry.emplace(entity, String, '')
    expect(view.sizeHint()).toBe(1)

    registry.erase(entity, String)
    expect(view.sizeHint()).toBe(1)

    registry.emplace(entity, String, '')
    expect(view.sizeHint()).toBe(1)

    registry.clear(BigInt)
    expect(view.sizeHint()).toBe(0)

    registry.emplace(entity, BigInt, 0)
    expect(view.sizeHint()).toBe(1)

    registry.clear()
    expect(view.sizeHint()).toBe(0)
  })

  test('Non Owning Group Init On First Use', function () {
    const registry = new Registry()
    const entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>[] = Array(3).fill(0)
    registry.createRange(toRange(entity))
    registry.insert(BigInt, toRange(entity).begin(), toRange(entity).end(), 0n)
    registry.emplace(entity[0], String, 'c')
    registry.emplace(entity[2], String, 'c')

    let cnt = 0
    const group = registry.group([], [BigInt, String])
    group.each((_entt, _num, _char) => {
      ++cnt
    })

    expect(registry.owned(BigInt, String)).toBe(false)
    expect(cnt).toBe(2)
  })

  test('Non Owning Group Init On Emplace', function () {
    const registry = new Registry()
    const entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>[] = Array(3).fill(0)
    registry.createRange(toRange(entity))
    const group = registry.group([], [BigInt, String])

    registry.insert(BigInt, toRange(entity).begin(), toRange(entity).end(), 0n)
    registry.emplace(entity[0], String, 'c')
    registry.emplace(entity[2], String, 'c')

    let cnt = 0
    group.each((_entt, _num, _char) => {
      ++cnt
    })

    expect(registry.owned(BigInt, String)).toBe(false)
    expect(cnt).toBe(2)
  })

  test('Full Owning Group Init On First Use', function () {
    const registry = new Registry()
    const entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>[] = Array(3).fill(0)
    registry.createRange(toRange(entity))
    registry.insert(BigInt, toRange(entity).begin(), toRange(entity).end(), 0n)
    registry.emplace(entity[0], String, 'c')
    registry.emplace(entity[2], String, 'c')

    let cnt = 0
    const group = registry.group([BigInt, String])
    group.each(() => {
      ++cnt
    })

    expect(registry.owned(BigInt)).toBe(true)
    expect(registry.owned(String)).toBe(true)
    expect(registry.owned(Double)).toBe(false)
    expect(cnt).toBe(2)
  })

  test('Full Owning Group Init On Emplace', function () {
    const registry = new Registry()
    const entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>[] = Array(3).fill(0)
    registry.createRange(toRange(entity))
    const group = registry.group([BigInt, String])

    registry.insert(BigInt, toRange(entity).begin(), toRange(entity).end(), 0n)
    registry.emplace(entity[0], String, 'c')
    registry.emplace(entity[2], String, 'c')

    let cnt = 0
    group.each(() => {
      ++cnt
    })

    expect(registry.owned(BigInt)).toBe(true)
    expect(registry.owned(String)).toBe(true)
    expect(registry.owned(Double)).toBe(false)
    expect(cnt).toBe(2)
  })

  test('Partial Owning Group Init On First Use', function () {
    const registry = new Registry()
    const entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>[] = Array(3).fill(0)
    registry.createRange(toRange(entity))
    registry.insert(BigInt, toRange(entity).begin(), toRange(entity).end(), 0n)
    registry.emplace(entity[0], String, 'c')
    registry.emplace(entity[2], String, 'c')

    let cnt = 0
    const group = registry.group([BigInt], [String])
    group.each((_entt, _num, _char) => {
      ++cnt
    })

    expect(registry.owned(BigInt, String)).toBe(true)
    expect(registry.owned(BigInt)).toBe(true)
    expect(registry.owned(String)).toBe(false)
    expect(cnt).toBe(2)
  })

  test('Partial Owning Group Init On Emplace', function () {
    const registry = new Registry()
    const entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>[] = Array(3).fill(0)
    registry.createRange(toRange(entity))
    const group = registry.group([BigInt], [String])

    registry.insert(BigInt, toRange(entity).begin(), toRange(entity).end(), 0n)
    registry.emplace(entity[0], String, 'c')
    registry.emplace(entity[2], String, 'c')

    let cnt = 0
    group.each((_entt, _num, _char) => {
      ++cnt
    })

    expect(registry.owned(BigInt, String)).toBe(true)
    expect(registry.owned(BigInt)).toBe(true)
    expect(registry.owned(String)).toBe(false)
    expect(cnt).toBe(2)
  })

  test('Clean Non Owning Group View After Remove And Clear', function () {
    const registry = new Registry()
    const group = registry.group([], [BigInt, String])

    const entity = registry.create()
    registry.emplace(entity, BigInt, 0n)
    registry.emplace(entity, String, 'c')

    expect(group.size).toBe(1)

    registry.erase(entity, String)

    expect(group.size).toBe(0)

    registry.emplace(entity, String, 'c')

    expect(group.size).toBe(1)

    registry.clear(BigInt)

    expect(group.size).toBe(0)

    registry.emplace(entity, BigInt, 0n)

    expect(group.size).toBe(1)

    registry.clear()

    expect(group.size).toBe(0)
  })

  test('Clean Full Owning Group View After Remove And Clear', function () {
    const registry = new Registry()
    const group = registry.group([BigInt], [String])

    const entity = registry.create()
    registry.emplace(entity, BigInt, 0n)
    registry.emplace(entity, String, 'c')
    
    expect(group.size).toBe(1)
    registry.erase(entity, String)

    expect(group.size).toBe(0)

    registry.emplace(entity, String, 'c')

    expect(group.size).toBe(1)

    registry.clear(BigInt)

    expect(group.size).toBe(0)

    registry.emplace(entity, BigInt, 0n)

    expect(group.size).toBe(1)

    registry.clear()

    expect(group.size).toBe(0)
  })

  test('Clean Partial Owning Group View After Remove And Clear', function () {
    const registry = new Registry()
    const group = registry.group([BigInt], [String])

    const entity = registry.create()
    registry.emplace(entity, BigInt, 0n)
    registry.emplace(entity, String, 'c')

    expect(group.size).toBe(1)

    registry.erase(entity, String)

    expect(group.size).toBe(0)

    registry.emplace(entity, String, 'c')

    expect(group.size).toBe(1)

    registry.clear(BigInt)

    expect(group.size).toBe(0)

    registry.emplace(entity, BigInt, 0n)

    expect(group.size).toBe(1)

    registry.clear()

    expect(group.size).toBe(0)
  })

  test('Nested Groups Death Test', function () {
    const registry = new Registry()
    registry.group([BigInt, Double], [String])

    expect(() => { registry.group([BigInt], [String]) }).toThrow()
    expect(() => { registry.group([BigInt], [String, Double]) }).toThrow()
    expect(() => { registry.group([BigInt], [String], [Double]) }).toThrow()
    expect(() => { registry.group([BigInt, Double]) }).toThrow()
  })

  test('Conflicting Groups Death Test', function () {
    const registry = new Registry()
    registry.group([String], [Double])
    class Float extends Number {}
    expect(() => { registry.group([Float], [Double]) }).toThrow()
  })

  test('Group If Exists', function () {
    const registry = new Registry()
    const entity = registry.create()
    let group = registry.groupIfExists([BigInt], [String])

    expect(group.ok()).toBe(false)

    registry.emplace(entity, BigInt, 0n)
    group = registry.groupIfExists([BigInt], [String])

    expect(group.ok()).toBe(false)

    registry.emplace(entity, String, 'c')
    group = registry.groupIfExists([BigInt], [String])

    expect(group.ok()).toBe(false)

    registry.emplace(entity, Double, 0.0)
    group = registry.groupIfExists([BigInt], [String])

    expect(group.ok()).toBe(false)

    registry.group([BigInt], [String])
    group = registry.groupIfExists([BigInt], [String])

    expect(group.ok()).toBe(true)
  })

  test('Sort Single', function () {
    const registry = new Registry()

    let val = 0n

    registry.emplace(registry.create(), BigInt, val++)
    registry.emplace(registry.create(), BigInt, val++)
    registry.emplace(registry.create(), BigInt, val++)

    for (const entity of registry.view([BigInt])) {
      expect(registry.get(entity, BigInt)).toBe(--val)
    }

    registry.sort(BigInt, (a, b) => a < b ? -1 : a > b ? 1 : 0)

    for (const entity of registry.view([BigInt])) {
      expect(registry.get(entity, BigInt)).toBe(val++)
    }
  })

  test('Sort Multiple', function () {
    const registry = new Registry()

    let uval = 0
    let ival = 0

    for (let i = 0; i < 3; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Uint, uval++)
      registry.emplace(entity, Int, ival++)
    }

    for (const entity of registry.view([Uint])) {
      expect(registry.get(entity, Uint)).toBe(--uval)
    }

    for (const entity of registry.view([Int])) {
      expect(registry.get(entity, Int)).toBe(--ival)
    }

    registry.sort(Uint, (a, b) => (a < b ? -1 : a > b ? 1 : 0))
    registry.sortAs(Int, Uint)

    for (const entity of registry.view([Uint])) {
      expect(registry.get(entity, Uint)).toBe(uval++)
    }

    for (const entity of registry.view([Int])) {
      expect(registry.get(entity, Int)).toBe(ival++)
    }
  })

  test('Sort Empty', function () {
    const registry = new Registry()

    registry.emplace(registry.create(), Empty)
    registry.emplace(registry.create(), Empty)
    registry.emplace(registry.create(), Empty)

    const storage = registry.getStorage(Empty)
    expect(storage.data()[0]).toBeLessThan(storage.data()[1])
    expect(storage.data()[1]).toBeLessThan(storage.data()[2])

    registry.sortByEntity(Empty, (a, b) => (a < b ? -1 : a > b ? 1 : 0))

    expect(storage.data()[0]).toBeGreaterThan(storage.data()[1])
    expect(storage.data()[1]).toBeGreaterThan(storage.data()[2])
  })

  test('Assign Entities', function () {
    const traitsType = enttTraitsTemplate.instantiate(Entity)
    const registry = new Registry()
    const entity: ValueType<EnttTraits<NumberConstructor>['ValueType']>[] = Array(3).fill(0)
    registry.createRange(toRange(entity))
    registry.destroy(entity[1])
    registry.destroy(entity[2])

    const other = new Registry()
    const src = registry.getStorage(Entity)
    const dst = other.getStorage(Entity)

    dst.pushRange(src.rbegin(), src.rend())
    dst.freeList(src.freeList())

    expect(registry.getStorage(Entity).size).toBe(other.getStorage(Entity).size)
    expect(other.valid(entity[0])).toBe(true)
    expect(other.valid(entity[1])).toBe(false)
    expect(other.valid(entity[2])).toBe(false)
    expect(registry.create()).toStrictEqual(other.create())
    expect(traitsType.toEntity(other.create())).toStrictEqual(traitsType.toIntegral(entity[1]))
  })

  test('Scrambling Pools Is Allowed', function () {
    const registry = new Registry()
    registry.onDestroy(BigInt).connect((registry) => Listener.sort(BigInt, registry))

    for (let i = 0; i < 2; ++i) {
      const entity = registry.create()
      registry.emplace(entity, BigInt, i)
    }

    registry.destroy(registry.view([BigInt]).back())

    registry.view([BigInt]).each((entity, value) => {
      expect(enttTraitsTemplate.instantiate(Entity).toIntegral(entity)).toBe(Number(value))
    })
  })

  test('Assure Mixin Loop', function () {
    const registry = new Registry()
    const entity = registry.create()

    expect(registry.getStorage(AssureLoop, true)).toBeUndefined()
    expect(registry.getStorage(Int, true)).toBeUndefined()

    registry.emplace(entity, AssureLoop)

    expect(registry.getStorage(AssureLoop, true)).toBeDefined()
    expect(registry.getStorage(Int, true)).toBeDefined()

    expect(registry.allOf(entity, AssureLoop)).toBe(true)
    expect(registry.allOf(entity, Int)).toBe(false)
  })

  test('Void Type', function () {
    const registry = new Registry()
    const entity = registry.create()
    const storage = registry.getStorage([undefined, 'custom'])
    storage.emplace(entity)

    expect(registry.getStorage(undefined).empty()).toBe(true)
    expect(registry.getStorage([undefined, 'custom']).empty()).toBe(false)
    expect(registry.getStorage([undefined, 'custom']).has(entity)).toBe(true)

    expect(registry.getStorage(undefined).type()).toBe(undefined)
    expect(registry.getStorage([undefined, 'custom']).type()).toBe(undefined)
  })

  test('No Eto Type', function () {
    class NoEtoType {
      static pageSize = 1024
    }
    const registry = new Registry()
    const entity = registry.create()

    registry.emplace(entity, NoEtoType)
    registry.emplace(entity, Int, 1)

    expect(registry.getStorage(NoEtoType) != null).toBe(true)
    expect(registry.tryGet(entity, NoEtoType) != null).toBe(true)
    expect(registry.view([NoEtoType]).get(entity)).toStrictEqual(registry.view([NoEtoType]).get(entity))

    const view = registry.view([NoEtoType, Int])
    const cview = registry.view([NoEtoType, Int])

    expect(view.getByElementType(entity, NoEtoType, Int)[0]).toStrictEqual(cview.getByElementType(entity, NoEtoType, Int)[0])
  })
})
