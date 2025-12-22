import { expect, test, describe, vi } from 'vitest'
import { distance, Entity, Int32, RuntimeView, RuntimeViewIterator, storageTemplate } from '../src'
import { PointerStable } from './custom-types'

describe('RuntimeView', () => {

  test('Functionalities', () => {
    const storage = [
      new (storageTemplate.instantiate(Int32))(),
      new (storageTemplate.instantiate(String))()
    ] as const
    const entity = [1, 3]
    const view = new RuntimeView()

    expect(view.ok()).toBe(false)
    expect(view.sizeHint()).toBe(0)
    expect(view.begin().equals(view.end())).toBe(true)
    expect(view.contains(entity[0])).toBe(false)
    expect(view.contains(entity[1])).toBe(false)

    view.iterate(storage[0]).iterate(storage[1])
    expect(view.ok()).toBe(true)
    expect(view.sizeHint()).toBe(0)

    storage[1].emplace(entity[0])
    storage[0].emplace(entity[1])
    expect(view.sizeHint()).not.toBe(0)

    storage[1].emplace(entity[1])
    expect(view.sizeHint()).toBe(1)

    const it = view.begin()
    expect(it.deref()).toBe(entity[1])
    expect(it.selfPlus().equals(view.end())).toBe(true)

    expect(() => { view.begin().selfPlus() }).not.toThrow()

    expect(view.begin().equals(view.end())).toBe(false)
    expect(view.sizeHint()).toBe(1)

    storage[1].getAsRef(entity[0]).set('1')
    storage[1].getAsRef(entity[1]).set('2')
    storage[0].getAsRef(entity[1]).set(3)

    for (const entt of view) {
      expect(storage[0].get(entt)).toBe(3)
      expect(storage[1].get(entt)).toBe('2')
    }

    view.clear()
    expect(view.sizeHint()).toBe(0)
    expect(view.begin().equals(view.end())).toBe(true)
  })

  test('InvalidView', () => {
    const view = new RuntimeView()

    expect(view.ok()).toBe(false)
    expect(view.sizeHint()).toBe(0)
    expect(view.contains(RuntimeView.CommonType.TraitsType.null)).toBe(false)
    expect(view.begin().equals(view.end())).toBe(true)

    view.each(() => {
      throw new Error('Should not be called')
    })

    const storage = new (storageTemplate.instantiate(Int32))()
    storage.emplace(0)
    view.iterate(storage)

    expect(view.ok()).toBe(true)
  })

  test('Iterator', () => {
    const storage = new (storageTemplate.instantiate(Int32))()
    const entity = 0
    const view = new RuntimeView()

    storage.emplace(entity)
    view.iterate(storage)

    const end = view.begin().clone()
    const begin = new RuntimeViewIterator<number>()
    view.end().clone(begin)
    begin.swap(end)

    expect(begin.equals(view.begin())).toBe(true)
    expect(end.equals(view.end())).toBe(true)
    expect(begin.equals(end)).toBe(false)

    expect(begin.equals(view.begin())).toBe(true)
    begin.selfPlus()
    expect(begin.equals(view.end())).toBe(true)
    begin.selfMinus()

    begin.selfPlus()
    expect(begin.equals(view.end())).toBe(true)
    begin.selfMinus()
    expect(begin.equals(view.begin())).toBe(true)

    expect(begin.deref()).toBe(entity)
  })

  test('Contains', () => {
    const storage = new (storageTemplate.instantiate(Int32))()
    const entity = [1, 3]
    const view = new RuntimeView()

    storage.emplace(entity[0])
    storage.emplace(entity[1])

    storage.erase(entity[0])

    view.iterate(storage)

    expect(view.contains(entity[0])).toBe(false)
    expect(view.contains(entity[1])).toBe(true)
  })

  test('Empty', () => {
    const storage = new (storageTemplate.instantiate(Int32))()
    const entity = 0
    const view = new RuntimeView()

    view.iterate(storage)

    expect(view.contains(entity)).toBe(false)
    expect(view.begin().equals(view.end())).toBe(true)
    expect(Array.from(view).includes(entity)).toBe(false)

    storage.emplace(entity)

    expect(view.contains(entity)).toBe(true)
    expect(view.begin().equals(view.end())).toBe(false)
    expect(Array.from(view).includes(entity)).toBe(true)
  })

  test('Each', () => {
    const storage = [
      new (storageTemplate.instantiate(Int32))(),
      new (storageTemplate.instantiate(String))()
    ] as const
    const entity = [1, 3]
    const view = new RuntimeView()

    storage[0].emplace(entity[0])
    storage[1].emplace(entity[0])
    storage[1].emplace(entity[1])

    view.iterate(storage[0]).iterate(storage[1])

    view.each((entt) => {
      expect(entt).toStrictEqual(entity[0])
    })
  })

  test('EachWithHoles', () => {
    const storage = [
      new (storageTemplate.instantiate(Int32))(),
      new (storageTemplate.instantiate(String))()
    ] as const
    const entity = [0, 1, 3]
    const view = new RuntimeView()

    storage[1].emplace(entity[0], '0')
    storage[1].emplace(entity[1], '1')

    storage[0].emplace(entity[0], 0)
    storage[0].emplace(entity[2], 2)

    view.iterate(storage[0]).iterate(storage[1])

    view.each((entt) => {
      expect(entt).toStrictEqual(entity[0])
    })
  })

  test('Exclude', () => {
    const storage = [
      new (storageTemplate.instantiate(Int32))(),
      new (storageTemplate.instantiate(String))()
    ] as const
    const entity = [1, 3]
    const view = new RuntimeView()

    storage[0].emplace(entity[0])
    storage[0].emplace(entity[1])
    storage[1].emplace(entity[1])

    view.iterate(storage[0]).exclude(storage[1])

    expect(view.contains(entity[0])).toBe(true)
    expect(view.contains(entity[1])).toBe(false)

    view.each((entt) => {
      expect(entt).toStrictEqual(entity[0])
    })
  })

  test('StableType', () => {
    const storage = [
      new (storageTemplate.instantiate(Int32))(),
      new (storageTemplate.instantiate(PointerStable))()
    ] as const
    const entity = [0, 1, 3]
    const view = new RuntimeView()

    storage[0].emplace(entity[0])
    storage[0].emplace(entity[1])
    storage[0].emplace(entity[2])

    storage[1].emplace(entity[0])
    storage[1].emplace(entity[1])

    storage[1].erase(entity[1])

    view.iterate(storage[0]).iterate(storage[1])

    expect(view.sizeHint()).toBe(2)
    expect(view.contains(entity[0])).toBe(true)
    expect(view.contains(entity[1])).toBe(false)

    const it = view.begin()
    expect(it.deref()).toBe(entity[0])
    expect(it.selfPlus().equals(view.end())).toBe(true)

    view.each((entt) => {
      expect(entt).toBe(entity[0])
    })

    for (const entt of view) {
      expect(entt).toBe(entity[0])
    }

    storage[1].compact()

    expect(view.sizeHint()).toBe(1)
  })

  test('StableTypeWithExclude', () => {
    const storage = [
      new (storageTemplate.instantiate(Int32))(),
      new (storageTemplate.instantiate(PointerStable))()
    ] as const
    const entity = [1, 3]
    const view = new RuntimeView()

    storage[1].emplace(entity[0], 0)
    storage[1].emplace(entity[1], 1)
    storage[0].emplace(entity[0])

    view.iterate(storage[1]).exclude(storage[0])

    expect(view.sizeHint()).toBe(2)
    expect(view.contains(entity[0])).toBe(false)
    expect(view.contains(entity[1])).toBe(true)

    storage[0].erase(entity[0])
    storage[1].erase(entity[0])

    expect(view.sizeHint()).toBe(2)
    expect(view.contains(entity[0])).toBe(false)
    expect(view.contains(entity[1])).toBe(true)

    for (const entt of view) {
      expect(RuntimeView.CommonType.isTombstone(entt)).toBe(false)
      expect(entt).toBe(entity[1])
    }

    view.each((entt) => {
      expect(RuntimeView.CommonType.isTombstone(entt)).toBe(false)
      expect(entt).toBe(entity[1])
    })
  })

  test('SameStorageTypes', () => {
    const storage = [
      new (storageTemplate.instantiate(Int32))(),
      new (storageTemplate.instantiate(Int32))()
    ] as const
    const entity = [1, 3]
    const view = new RuntimeView()

    storage[0].emplace(entity[0], 2)

    storage[1].emplace(entity[0], 3)
    storage[1].emplace(entity[1], 1)

    view.iterate(storage[0]).iterate(storage[1])

    expect(view.contains(entity[0])).toBe(true)
    expect(view.contains(entity[1])).toBe(false)

    for (const entt of view) {
      expect(entt).toBe(entity[0])
    }

    view.each((entt) => {
      expect(entt).toBe(entity[0])
    })
  })

  test('StorageEntity', () => {
    const storage = [
      new (storageTemplate.instantiate(Entity))(),
      new (storageTemplate.instantiate(String))()
    ] as const
    const entity = [storage[0].generate(), storage[0].generate()]
    const view = new RuntimeView()

    storage[1].emplace(entity[0])
    storage[1].emplace(entity[1])

    storage[1].erase(entity[0])
    storage[0].erase(entity[0])
    storage[0].bump(entity[0])

    view.iterate(storage[0]).iterate(storage[1])

    expect(view.contains(entity[0])).toBe(false)
    expect(view.contains(entity[1])).toBe(true)

    expect(view.sizeHint()).toBe(1)
    expect(view.begin().equals(view.end())).toBe(false)

    expect(distance(view.begin(), view.end())).toBe(1)
    expect(view.begin().deref()).toBe(entity[1])

    for (const entt of view) {
      expect(entt).toBe(entity[1])
    }

    view.each((entt) => {
      expect(entt).toBe(entity[1])
    })
  })

  test('StorageEntityWithExclude', () => {
    const storage = [
      new (storageTemplate.instantiate(Entity))(),
      new (storageTemplate.instantiate(Int32))(),
      new (storageTemplate.instantiate(String))()
    ] as const
    const entity = [
      storage[0].generate(),
      storage[0].generate(),
      storage[0].generate()
    ]
    const view = new RuntimeView()

    storage[1].emplace(entity[0])
    storage[1].emplace(entity[1])
    storage[1].emplace(entity[2])

    storage[2].emplace(entity[2])

    storage[1].erase(entity[0])
    storage[0].erase(entity[0])
    storage[0].bump(entity[0])

    view.iterate(storage[0]).iterate(storage[1]).exclude(storage[2])

    expect(view.contains(entity[0])).toBe(false)
    expect(view.contains(entity[1])).toBe(true)
    expect(view.contains(entity[2])).toBe(false)

    expect(view.sizeHint()).toBe(2)
    expect(view.begin().equals(view.end())).toBe(false)

    expect(distance(view.begin(), view.end())).toBe(1)
    expect(view.begin().deref()).toBe(entity[1])

    for (const entt of view) {
      expect(entt).toBe(entity[1])
    }
    
    view.each((entt) => {
      expect(entt).toBe(entity[1])
    })
  })

  test('StorageEntityExcludeOnly', () => {
    const storage = [
      new (storageTemplate.instantiate(Entity))(),
      new (storageTemplate.instantiate(Int32))()
    ] as const
    const entity = [
      storage[0].generate(),
      storage[0].generate(),
      storage[0].generate()
    ]
    const view = new RuntimeView()

    storage[1].emplace(entity[2])

    storage[0].erase(entity[0])
    storage[0].bump(entity[0])

    view.iterate(storage[0]).exclude(storage[1])

    expect(view.contains(entity[0])).toBe(false)
    expect(view.contains(entity[1])).toBe(true)
    expect(view.contains(entity[2])).toBe(false)

    expect(view.sizeHint()).toBe(2)
    expect(view.begin().equals(view.end())).toBe(false)

    expect(distance(view.begin(), view.end())).toBe(1)
    expect(view.begin().deref()).toBe(entity[1])

    for (const entt of view) {
      expect(entt).toBe(entity[1])
    }

    view.each((entt) => {
      expect(entt).toBe(entity[1])
    })
  })
})
