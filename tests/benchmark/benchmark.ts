import type {
  Entity,
  BasicRegistry,
} from '../../src'

import stableHash from 'stable-hash'
import { describe, it } from './main.ts'

type EnttModule = typeof import('../../src')

const test = it.extend<{ entt: EnttModule }>({
  entt: async ({}, use) => {
    const entt = await import('../../dist/entt.min.js' as any) as unknown as EnttModule
    await use(entt)
  }
})

class Position {
  x: bigint
  y: bigint

  constructor (x?: number | bigint, y?: number | bigint) {
    this.x = BigInt(x ?? 0) & BigInt('0xFFFFFFFFFFFFFFFF')
    this.y = BigInt(y ?? 0) & BigInt('0xFFFFFFFFFFFFFFFF')
  }
}

class Velocity extends Position { }

class StablePosition extends Position {
  static inPlaceDelete = true
}

interface Comp {
  x: number
}

interface CompConstructor {
  new (x?: number | bigint): Comp
  prototype: Comp
}

const compCache = new Map<any, CompConstructor>()
function comp (value: any): CompConstructor {
  const key = stableHash(value)
  if (compCache.has(key)) {
    return compCache.get(key)!
  }

  const Comp = class Comp {
    x: number

    constructor (x?: number | bigint) {
      const value = x ?? 0
      this.x = typeof value === 'bigint' ? (Number(value & BigInt(0xFFFFFFFF)) | 0) : (value | 0)
    }
  }
  compCache.set(key, Comp)
  return Comp
}

const Comp0 = comp(0)
const Comp1 = comp(1)
const Comp2 = comp(2)

class Timer {
  private start: number

  constructor () {
    this.start = performance.now()
  }

  elapsed (): void {
    const now = performance.now()
    console.log(`${((now - this.start) / 1000).toFixed(6)} seconds`)
  }
}

function genericWith (func: (...args: any[]) => any) {
  const timer = new Timer()
  func()
  timer.elapsed()
}

function iterateWith (iterable: { each(func: (...args: any[]) => any, componentsOnly?: boolean): any }, func: (...args: any[]) => any, componentsOnly: boolean) {
  const timer = new Timer()
  iterable.each(func, componentsOnly)
  timer.elapsed()
}

function pathologicalWith ({ Registry, Entity }: EnttModule, func: (registry: BasicRegistry<number, number>) => { each (func: (...args: any[]) => any, componentsOnly?: boolean): void }) {
  const registry = new Registry()
  const view = func(registry)

  const count = 500000n

  for (let i = 0n; i < count; ++i) {
    const entt = registry.create()
    registry.emplace(entt, Position)
    registry.emplace(entt, Velocity)
    registry.emplace(entt, Comp0)
  }

  for (let i = 0; i < 10; ++i) {
    let curr = 0

    for (const [entt] of registry.getStorage(Entity).each()) {
      if (!(++curr % 7)) {
        registry.remove(entt, Position)
      }

      if (!(++curr % 11)) {
        registry.remove(entt, Velocity)
      }

      if (!(++curr % 13)) {
        registry.remove(entt, Comp0)
      }

      if (!(++curr % 17)) {
        registry.destroy(entt)
      }
    }

    for (let j = 0n; j < count / 10n; j++) {
      const entt = registry.create()
      registry.emplace(entt, Position)
      registry.emplace(entt, Velocity)
      registry.emplace(entt, Comp0)
    }
  }

  const timer = new Timer()
  view.each((...comps: any[]) => {
    for (const comp of comps) {
      comp.x = comp.x.constructor(0)
    }
  }, true)
  timer.elapsed()
}

const ENTITY_COUNT = 1000000
const SORT_COUNT = 150000
const SPECIAL_INDEX = 500000

function makeEntityRange (entt: EnttModule, count = ENTITY_COUNT) {
  const entity = Array(count).fill(0) as Entity[]
  const range = entt.toRange(entity)
  return { entity, range }
}

describe('Benchmark', () => {
  test('Create', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Creating 1000000 entities')

    genericWith(() => {
      for (let i = 0; i < ENTITY_COUNT; i++) {
        registry.create()
      }
    })
  })

  test('CreateMany', ({ entt }) => {
    using registry = new entt.Registry()
    const { range } = makeEntityRange(entt)

    console.log('Creating 1000000 entities at once')

    genericWith(() => {
      registry.createRange(range)
    })
  })

  test('CreateManyAndEmplaceComponents', ({ entt }) => {
    using registry = new entt.Registry()
    const { entity, range } = makeEntityRange(entt)

    console.log('Creating 1000000 entities at once and emplace components')

    genericWith(() => {
      registry.createRange(range)

      for (const entt of entity) {
        registry.emplace(entt, Position)
        registry.emplace(entt, Velocity)
      }
    })
  })

  test('CreateManyWithComponents', ({ entt }) => {
    using registry = new entt.Registry()
    const { entity, range } = makeEntityRange(entt)

    console.log('Creating 1000000 entities at once with components')

    genericWith(() => {
      registry.createRange(range)
      registry.insert(Position, range.begin(), range.end())
      registry.insert(Velocity, range.begin(), range.end())
    })
  })

  test('Erase', ({ entt }) => {
    using registry = new entt.Registry()
    const { range } = makeEntityRange(entt)
    const view = registry.view([Position])

    console.log('Erasing 1000000 components from their entities')

    registry.createRange(range)
    registry.insert(Position, range.begin(), range.end())

    genericWith(() => {
      for (const entt of view) {
        registry.erase(entt, Position)
      }
    })
  })

  test('EraseMany', ({ entt }) => {
    using registry = new entt.Registry()
    const { range } = makeEntityRange(entt)
    const view = registry.view([Position])

    console.log('Erasing 1000000 components from their entities at once')

    registry.createRange(range)
    registry.insert(Position, range.begin(), range.end())

    genericWith(() => {
      registry.eraseRange(view.begin(), view.end(), Position)
    })
  })

  test('EraseManyMulti', ({ entt }) => {
    using registry = new entt.Registry()
    const { range } = makeEntityRange(entt)
    const view = registry.view([Position])

    console.log('Erasing 1000000 components per type from their entities at once')

    registry.createRange(range)
    registry.insert(Position, range.begin(), range.end())
    registry.insert(Velocity, range.begin(), range.end())

    genericWith(() => {
      registry.eraseRange(view.begin(), view.end(), Position, Velocity)
    })
  })

  test('Remove', ({ entt }) => {
    using registry = new entt.Registry()
    const { range } = makeEntityRange(entt)
    const view = registry.view([Position])

    console.log('Removing 1000000 components from their entities')

    registry.createRange(range)
    registry.insert(Position, range.begin(), range.end())

    genericWith(() => {
      for (const entity of view) {
        registry.remove(entity, Position)
      }
    })
  })

  test('RemoveMany', ({ entt }) => {
    using registry = new entt.Registry()
    const { range } = makeEntityRange(entt)
    const view = registry.view([Position])

    console.log('Removing 1000000 components from their entities at once')

    registry.createRange(range)
    registry.insert(Position, range.begin(), range.end())

    genericWith(() => {
      registry.removeRange(view.begin(), view.end(), Position)
    })
  })

  test('RemoveManyMulti', ({ entt }) => {
    using registry = new entt.Registry()
    const { range } = makeEntityRange(entt)
    const view = registry.view([Position])

    console.log('Removing 1000000 components per type from their entities at once')

    registry.createRange(range)
    registry.insert(Position, range.begin(), range.end())
    registry.insert(Velocity, range.begin(), range.end())

    genericWith(() => {
      registry.removeRange(view.begin(), view.end(), Position, Velocity)
    })
  })

  test('Clear', ({ entt }) => {
    using registry = new entt.Registry()
    const { range } = makeEntityRange(entt)

    console.log('Clearing 1000000 components from their entities')

    registry.createRange(range)
    registry.insert(Position, range.begin(), range.end())

    genericWith(() => {
      registry.clear(Position)
    })
  })

  test('ClearMulti', ({ entt }) => {
    using registry = new entt.Registry()
    const { range } = makeEntityRange(entt)

    console.log('Clearing 1000000 components per type from their entities')

    registry.createRange(range)
    registry.insert(Position, range.begin(), range.end())
    registry.insert(Velocity, range.begin(), range.end())

    genericWith(() => {
      registry.clear(Position, Velocity)
    })
  })

  test('ClearStable', ({ entt }) => {
    using registry = new entt.Registry()
    const { range } = makeEntityRange(entt)

    console.log('Clearing 1000000 stable components from their entities')

    registry.createRange(range)
    registry.insert(StablePosition, range.begin(), range.end())

    genericWith(() => {
      registry.clear(StablePosition)
    })
  })

  test('Recycle', ({ entt }) => {
    using registry = new entt.Registry()
    const { entity, range } = makeEntityRange(entt)

    console.log('Recycling 1000000 entities')

    registry.createRange(range)
    registry.destroyRange(range.begin(), range.end())

    genericWith(() => {
      for (let next = entity.length; next > 0; --next) {
        entity[next - 1] = registry.create()
      }
    })
  })

  test('RecycleMany', ({ entt }) => {
    using registry = new entt.Registry()
    const { range } = makeEntityRange(entt)

    console.log('Recycling 1000000 entities')

    registry.createRange(range)
    registry.destroyRange(range.begin(), range.end())

    genericWith(() => {
      registry.createRange(range)
    })
  })

  test('Destroy', ({ entt }) => {
    using registry = new entt.Registry()
    const { range } = makeEntityRange(entt)
    const view = registry.view([Position])

    console.log('Destroying 1000000 entities')

    registry.createRange(range)
    registry.insert(Position, range.begin(), range.end())

    genericWith(() => {
      for (const entity of view) {
        registry.destroy(entity)
      }
    })
  })

  test('DestroyMany', ({ entt }) => {
    using registry = new entt.Registry()
    const { range } = makeEntityRange(entt)
    const view = registry.view([Position])

    console.log('Destroying 1000000 entities at once')

    registry.createRange(range)
    registry.insert(Position, range.begin(), range.end())

    genericWith(() => {
      registry.destroyRange(view.begin(), view.end())
    })
  })

  test('DestroyManyMulti', ({ entt }) => {
    using registry = new entt.Registry()
    const { range } = makeEntityRange(entt)
    const view = registry.view([Position])

    console.log('Destroying 1000000 entities at once, multiple components')

    registry.createRange(range)
    registry.insert(Position, range.begin(), range.end())
    registry.insert(Velocity, range.begin(), range.end())

    genericWith(() => {
      registry.destroyRange(view.begin(), view.end())
    })
  })

  test('GetFromRegistry', ({ entt }) => {
    using registry = new entt.Registry()
    const { entity, range } = makeEntityRange(entt)

    console.log('Getting data for 1000000 entities from a registry, one component')

    registry.createRange(range)
    registry.insert(Position, range.begin(), range.end())

    genericWith(() => {
      for (const current of entity) {
        registry.get(current, Position).x = 0n
      }
    })
  })

  test('GetFromRegistryMulti', ({ entt }) => {
    using registry = new entt.Registry()
    const { entity, range } = makeEntityRange(entt)

    console.log('Getting data for 1000000 entities from a registry, multiple components')

    registry.createRange(range)
    registry.insert(Position, range.begin(), range.end())
    registry.insert(Velocity, range.begin(), range.end())

    genericWith(() => {
      for (const current of entity) {
        registry.get(current, Position).x = 0n
        registry.get(current, Velocity).y = 0n
      }
    })
  })

  test('GetFromView', ({ entt }) => {
    using registry = new entt.Registry()
    const { entity, range } = makeEntityRange(entt)
    const view = registry.view([Position])

    console.log('Getting data for 1000000 entities from a view, one component')

    registry.createRange(range)
    registry.insert(Position, range.begin(), range.end())

    genericWith(() => {
      for (const current of entity) {
        view.getByElementType(current, Position).x = 0n
      }
    })
  })

  test('GetFromViewMulti', ({ entt }) => {
    using registry = new entt.Registry()
    const { entity, range } = makeEntityRange(entt)
    const view = registry.view([Position, Velocity])

    console.log('Getting data for 1000000 entities from a view, multiple components')

    registry.createRange(range)
    registry.insert(Position, range.begin(), range.end())
    registry.insert(Velocity, range.begin(), range.end())

    genericWith(() => {
      for (const current of entity) {
        view.getByElementType(current, Position).x = 0n
        view.getByElementType(current, Velocity).y = 0n
      }
    })
  })

  test('IterateSingleComponent1M', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, one component')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Position)
    }

    iterateWith(registry.view([Position]), (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateSingleStableComponent1M', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, one stable component')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, StablePosition)
    }

    iterateWith(registry.view([StablePosition]), (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateSingleComponentRuntime1M', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, one component, runtime view')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Position)
    }

    const view = new entt.RuntimeView()
    view.iterate(registry.getStorage(Position))

    iterateWith(view, (entity: Entity, _component: unknown) => {
      registry.get(entity, Position).x = 0n
    }, false)
  })

  test('IterateTwoComponents1M', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, two components')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Position)
      registry.emplace(entity, Velocity)
    }

    iterateWith(registry.view([Position, Velocity]), (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateTwoStableComponents1M', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, two stable components')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, StablePosition)
      registry.emplace(entity, Velocity)
    }

    iterateWith(registry.view([StablePosition, Velocity]), (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateTwoComponents1MHalf', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, two components, half of the entities have all the components')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Velocity)
      if (i % 2 === 1) {
        registry.emplace(entity, Position)
      }
    }

    iterateWith(registry.view([Position, Velocity]), (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateTwoComponents1MOne', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, two components, only one entity has all the components')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Velocity)
      if (i === SPECIAL_INDEX) {
        registry.emplace(entity, Position)
      }
    }

    iterateWith(registry.view([Position, Velocity]), (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateTwoComponentsNonOwningGroup1M', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, two components, non owning group')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Position)
      registry.emplace(entity, Velocity)
    }

    const group = registry.group([], [Position, Velocity])
    iterateWith(group, (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateTwoComponentsFullOwningGroup1M', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, two components, full owning group')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Position)
      registry.emplace(entity, Velocity)
    }

    const group = registry.group([Position, Velocity])
    iterateWith(group, (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateTwoComponentsPartialOwningGroup1M', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, two components, partial owning group')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Position)
      registry.emplace(entity, Velocity)
    }

    const group = registry.group([Position], [Velocity])
    iterateWith(group, (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateTwoComponentsRuntime1M', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, two components, runtime view')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Position)
      registry.emplace(entity, Velocity)
    }

    const view = new entt.RuntimeView()
    view.iterate(registry.getStorage(Position))
      .iterate(registry.getStorage(Velocity))

    iterateWith(view, (entity: Entity) => {
      registry.get(entity, Position).x = 0n
      registry.get(entity, Velocity).x = 0n
    }, false)
  })

  test('IterateTwoComponentsRuntime1MHalf', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, two components, half of the entities have all the components, runtime view')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Velocity)
      if (i % 2 === 1) {
        registry.emplace(entity, Position)
      }
    }

    const view = new entt.RuntimeView()
    view.iterate(registry.getStorage(Position))
      .iterate(registry.getStorage(Velocity))

    iterateWith(view, (entity: Entity) => {
      registry.get(entity, Position).x = 0n
      registry.get(entity, Velocity).x = 0n
    }, false)
  })

  test('IterateTwoComponentsRuntime1MOne', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, two components, only one entity has all the components, runtime view')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Velocity)
      if (i === SPECIAL_INDEX) {
        registry.emplace(entity, Position)
      }
    }

    const view = new entt.RuntimeView()
    view.iterate(registry.getStorage(Position))
      .iterate(registry.getStorage(Velocity))

    iterateWith(view, (entity: Entity) => {
      registry.get(entity, Position).x = 0n
      registry.get(entity, Velocity).x = 0n
    }, false)
  })

  test('IterateThreeComponents1M', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, three components')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Position)
      registry.emplace(entity, Velocity)
      registry.emplace(entity, Comp0)
    }

    iterateWith(registry.view([Position, Velocity, Comp0]), (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateThreeStableComponents1M', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, three stable components')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, StablePosition)
      registry.emplace(entity, Velocity)
      registry.emplace(entity, Comp0)
    }

    iterateWith(registry.view([StablePosition, Velocity, Comp0]), (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateThreeComponents1MHalf', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, three components, half of the entities have all the components')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Velocity)
      registry.emplace(entity, Comp0)
      if (i % 2 === 1) {
        registry.emplace(entity, Position)
      }
    }

    iterateWith(registry.view([Position, Velocity, Comp0]), (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateThreeComponents1MOne', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, three components, only one entity has all the components')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Velocity)
      registry.emplace(entity, Comp0)
      if (i === SPECIAL_INDEX) {
        registry.emplace(entity, Position)
      }
    }

    iterateWith(registry.view([Position, Velocity, Comp0]), (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateThreeComponentsNonOwningGroup1M', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, three components, non owning group')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Position)
      registry.emplace(entity, Velocity)
      registry.emplace(entity, Comp0)
    }

    const group = registry.group([], [Position, Velocity, Comp0])
    iterateWith(group, (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateThreeComponentsFullOwningGroup1M', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, three components, full owning group')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Position)
      registry.emplace(entity, Velocity)
      registry.emplace(entity, Comp0)
    }

    const group = registry.group([Position, Velocity, Comp0])
    iterateWith(group, (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateThreeComponentsPartialOwningGroup1M', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, three components, partial owning group')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Position)
      registry.emplace(entity, Velocity)
      registry.emplace(entity, Comp0)
    }

    const group = registry.group([Position, Velocity], [Comp0])
    iterateWith(group, (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateThreeComponentsRuntime1M', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, three components, runtime view')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Position)
      registry.emplace(entity, Velocity)
      registry.emplace(entity, Comp0)
    }

    const view = new entt.RuntimeView()
    view.iterate(registry.getStorage(Position))
      .iterate(registry.getStorage(Velocity))
      .iterate(registry.getStorage(Comp0))

    iterateWith(view, (entity: Entity) => {
      registry.get(entity, Position).x = 0n
      registry.get(entity, Velocity).x = 0n
      registry.get(entity, Comp0).x = 0
    }, false)
  })

  test('IterateThreeComponentsRuntime1MHalf', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, three components, half of the entities have all the components, runtime view')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Velocity)
      registry.emplace(entity, Comp0)
      if (i % 2 === 1) {
        registry.emplace(entity, Position)
      }
    }

    const view = new entt.RuntimeView()
    view.iterate(registry.getStorage(Position))
      .iterate(registry.getStorage(Velocity))
      .iterate(registry.getStorage(Comp0))

    iterateWith(view, (entity: Entity) => {
      registry.get(entity, Position).x = 0n
      registry.get(entity, Velocity).x = 0n
      registry.get(entity, Comp0).x = 0
    }, false)
  })

  test('IterateThreeComponentsRuntime1MOne', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, three components, only one entity has all the components, runtime view')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Velocity)
      registry.emplace(entity, Comp0)
      if (i === SPECIAL_INDEX) {
        registry.emplace(entity, Position)
      }
    }

    const view = new entt.RuntimeView()
    view.iterate(registry.getStorage(Position))
      .iterate(registry.getStorage(Velocity))
      .iterate(registry.getStorage(Comp0))

    iterateWith(view, (entity: Entity) => {
      registry.get(entity, Position).x = 0n
      registry.get(entity, Velocity).x = 0n
      registry.get(entity, Comp0).x = 0
    }, false)
  })

  test('IterateFiveComponents1M', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, five components')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Position)
      registry.emplace(entity, Velocity)
      registry.emplace(entity, Comp0)
      registry.emplace(entity, Comp1)
      registry.emplace(entity, Comp2)
    }

    iterateWith(registry.view([Position, Velocity, Comp0, Comp1, Comp2]), (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateFiveStableComponents1M', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, five stable components')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, StablePosition)
      registry.emplace(entity, Velocity)
      registry.emplace(entity, Comp0)
      registry.emplace(entity, Comp1)
      registry.emplace(entity, Comp2)
    }

    iterateWith(registry.view([StablePosition, Velocity, Comp0, Comp1, Comp2]), (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateFiveComponents1MHalf', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, five components, half of the entities have all the components')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Velocity)
      registry.emplace(entity, Comp0)
      registry.emplace(entity, Comp1)
      registry.emplace(entity, Comp2)
      if (i % 2 === 1) {
        registry.emplace(entity, Position)
      }
    }

    iterateWith(registry.view([Position, Velocity, Comp0, Comp1, Comp2]), (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateFiveComponents1MOne', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, five components, only one entity has all the components')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Velocity)
      registry.emplace(entity, Comp0)
      registry.emplace(entity, Comp1)
      registry.emplace(entity, Comp2)
      if (i === SPECIAL_INDEX) {
        registry.emplace(entity, Position)
      }
    }

    iterateWith(registry.view([Position, Velocity, Comp0, Comp1, Comp2]), (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateFiveComponentsNonOwningGroup1M', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, five components, non owning group')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Position)
      registry.emplace(entity, Velocity)
      registry.emplace(entity, Comp0)
      registry.emplace(entity, Comp1)
      registry.emplace(entity, Comp2)
    }

    const group = registry.group([], [Position, Velocity, Comp0, Comp1, Comp2])
    iterateWith(group, (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateFiveComponentsFullOwningGroup1M', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, five components, full owning group')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Position)
      registry.emplace(entity, Velocity)
      registry.emplace(entity, Comp0)
      registry.emplace(entity, Comp1)
      registry.emplace(entity, Comp2)
    }

    const group = registry.group([Position, Velocity, Comp0, Comp1, Comp2])
    iterateWith(group, (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateFiveComponentsPartialFourOfFiveOwningGroup1M', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, five components, partial (4 of 5) owning group')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Position)
      registry.emplace(entity, Velocity)
      registry.emplace(entity, Comp0)
      registry.emplace(entity, Comp1)
      registry.emplace(entity, Comp2)
    }

    const group = registry.group([Position, Velocity, Comp0, Comp1], [Comp2])
    iterateWith(group, (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateFiveComponentsPartialThreeOfFiveOwningGroup1M', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, five components, partial (3 of 5) owning group')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Position)
      registry.emplace(entity, Velocity)
      registry.emplace(entity, Comp0)
      registry.emplace(entity, Comp1)
      registry.emplace(entity, Comp2)
    }

    const group = registry.group([Position, Velocity, Comp0], [Comp1, Comp2])
    iterateWith(group, (...args: any[]) => {
      for (const comp of args) {
        comp.x = comp.x.constructor(0)
      }
    }, true)
  })

  test('IterateFiveComponentsRuntime1M', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, five components, runtime view')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Position)
      registry.emplace(entity, Velocity)
      registry.emplace(entity, Comp0)
      registry.emplace(entity, Comp1)
      registry.emplace(entity, Comp2)
    }

    const view = new entt.RuntimeView()
    view.iterate(registry.getStorage(Position))
      .iterate(registry.getStorage(Velocity))
      .iterate(registry.getStorage(Comp0))
      .iterate(registry.getStorage(Comp1))
      .iterate(registry.getStorage(Comp2))

    iterateWith(view, (entity: Entity) => {
      registry.get(entity, Position).x = 0n
      registry.get(entity, Velocity).x = 0n
      registry.get(entity, Comp0).x = 0
      registry.get(entity, Comp1).x = 0
      registry.get(entity, Comp2).x = 0
    }, false)
  })

  test('IterateFiveComponentsRuntime1MHalf', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, five components, half of the entities have all the components, runtime view')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Velocity)
      registry.emplace(entity, Comp0)
      registry.emplace(entity, Comp1)
      registry.emplace(entity, Comp2)
      if (i % 2 === 1) {
        registry.emplace(entity, Position)
      }
    }

    const view = new entt.RuntimeView()
    view.iterate(registry.getStorage(Position))
      .iterate(registry.getStorage(Velocity))
      .iterate(registry.getStorage(Comp0))
      .iterate(registry.getStorage(Comp1))
      .iterate(registry.getStorage(Comp2))

    iterateWith(view, (entity: Entity) => {
      registry.get(entity, Position).x = 0n
      registry.get(entity, Velocity).x = 0n
      registry.get(entity, Comp0).x = 0
      registry.get(entity, Comp1).x = 0
      registry.get(entity, Comp2).x = 0
    }, false)
  })

  test('IterateFiveComponentsRuntime1MOne', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Iterating over 1000000 entities, five components, only one entity has all the components, runtime view')

    for (let i = 0; i < ENTITY_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Velocity)
      registry.emplace(entity, Comp0)
      registry.emplace(entity, Comp1)
      registry.emplace(entity, Comp2)
      if (i === SPECIAL_INDEX) {
        registry.emplace(entity, Position)
      }
    }

    const view = new entt.RuntimeView()
    view.iterate(registry.getStorage(Position))
      .iterate(registry.getStorage(Velocity))
      .iterate(registry.getStorage(Comp0))
      .iterate(registry.getStorage(Comp1))
      .iterate(registry.getStorage(Comp2))

    iterateWith(view, (entity: Entity) => {
      registry.get(entity, Position).x = 0n
      registry.get(entity, Velocity).x = 0n
      registry.get(entity, Comp0).x = 0
      registry.get(entity, Comp1).x = 0
      registry.get(entity, Comp2).x = 0
    }, false)
  })

  test('IteratePathological', ({ entt }) => {
    console.log('Pathological case')
    pathologicalWith(entt, registry => registry.view([Position, Velocity, Comp0]))
  })

  test('IteratePathologicalNonOwningGroup', ({ entt }) => {
    console.log('Pathological case (non-owning group)')
    pathologicalWith(entt, registry => registry.group([], [Position, Velocity, Comp0]))
  })

  test('IteratePathologicalFullOwningGroup', ({ entt }) => {
    console.log('Pathological case (full-owning group)')
    pathologicalWith(entt, registry => registry.group([Position, Velocity, Comp0]))
  })

  test('IteratePathologicalPartialOwningGroup', ({ entt }) => {
    console.log('Pathological case (partial-owning group)')
    pathologicalWith(entt, registry => registry.group([Position, Velocity], [Comp0]))
  })

  test('SortSingle', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Sort 150000 entities, one component')

    for (let i = 0; i < SORT_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Position, i, i)
    }

    genericWith(() => {
      registry.sort(Position, (lhs, rhs) => {
        if (lhs.x < rhs.x && lhs.y < rhs.y) return -1
        return lhs.x === rhs.x && lhs.y === rhs.y ? 0 : 1
      })
    })
  })

  test('SortMulti', ({ entt }) => {
    using registry = new entt.Registry()

    console.log('Sort 150000 entities, two components')

    for (let i = 0; i < SORT_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Position, i, i)
      registry.emplace(entity, Velocity, i, i)
    }

    registry.sort(Position, (lhs, rhs) => {
      if (lhs.x < rhs.x && lhs.y < rhs.y) return -1
      return lhs.x === rhs.x && lhs.y === rhs.y ? 0 : 1
    })

    genericWith(() => {
      registry.sortAs(Velocity, Position)
    })
  })

  test('AlmostSortedStdSort', ({ entt }) => {
    using registry = new entt.Registry()
    const special: Array<Entity> = Array(3)

    console.log('Sort 150000 entities, almost sorted, std::sort')

    for (let i = 0; i < SORT_COUNT; ++i) {
      const entity = registry.create()
      registry.emplace(entity, Position, i, i)
      if (i % 50000 === 0) {
        special[((i / 50000) | 0)] = entity
      }
    }

    for (let i = 0; i < special.length; ++i) {
      registry.destroy(special[i])
      const entity = registry.create()
      registry.emplace(entity, Position, 50000 * i, 50000 * i)
    }

    genericWith(() => {
      registry.sort(Position, (lhs, rhs) => {
        if (lhs.x > rhs.x && lhs.y > rhs.y) return -1
        return lhs.x === rhs.x && lhs.y === rhs.y ? 0 : 1
      })
    })
  })

  test('AlmostSortedInsertionSort', ({ entt }) => {
    using registry = new entt.Registry()
    const special: Array<Entity> = Array(3)

    console.log('Sort 150000 entities, almost sorted, insertion sort')

    for (let i = 0; i < SORT_COUNT; i++) {
      const entity = registry.create()
      registry.emplace(entity, Position, i, i)
      if (i % 50000 === 0) {
        special[((i / 50000) | 0)] = entity
      }
    }

    for (let i = 0; i < special.length; ++i) {
      registry.destroy(special[i])
      const entity = registry.create()
      registry.emplace(entity, Position, 50000 * i, 50000 * i)
    }

    genericWith(() => {
      registry.sort(Position, (lhs, rhs) => {
        if (lhs.x > rhs.x && lhs.y > rhs.y) return -1
        return lhs.x === rhs.x && lhs.y === rhs.y ? 0 : 1
      }, entt.insertionSort)
    })
  })
})
