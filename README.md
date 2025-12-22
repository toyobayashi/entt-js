# entt-js

[![npm version](https://img.shields.io/npm/v/entt-js.svg)](https://www.npmjs.com/package/entt-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/toyobayashi/toyobayashi/sponsorkit/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/toyobayashi/toyobayashi/sponsorkit/sponsors.svg'/>
  </a>
</p>

## Overview

A TypeScript port of [EnTT](https://github.com/skypjack/entt) - a fast and reliable Entity Component System (ECS) implementation.

`entt-js` brings the power of EnTT's battle-tested ECS architecture to TypeScript/JavaScript, offering a high-performance solution for entity management and component-based game development. This library maintains the core design philosophy of the original C++ implementation while leveraging TypeScript's type system for enhanced developer experience.

### What is ECS?

Entity Component System (ECS) is an architectural pattern commonly used in game development that separates data (Components) from entities (Entities) and logic (Systems). This approach provides:

- **High Performance**: Cache-friendly data layouts and efficient iteration
- **Flexibility**: Easy composition of game objects from reusable components
- **Scalability**: Handles thousands to millions of entities efficiently
- **Maintainability**: Clear separation of concerns

## Features

- 🚀 **High Performance**: Optimized sparse set implementation with cache-friendly memory layouts
- 📦 **Full TypeScript Support**: Comprehensive type definitions with advanced type inference
- 🎯 **Type-Safe API**: Leverages TypeScript's type system to catch errors at compile time
- 🔄 **Entity Lifecycle**: Complete entity creation, destruction, and recycling
- 🧩 **Component Management**: Add, remove, and query components with ease
- 👁️ **Views & Groups**: Efficient iteration over entities with specific components
- 📡 **Signals**: Event system for component lifecycle hooks
- 🔍 **Runtime Views**: Dynamic component queries without compile-time types
- 📸 **Snapshots**: Save and restore registry state
- 🌐 **Multi-Platform**: Works in Node.js and browsers

## Installation

```bash
npm install entt-js
```

## Quick Start

```typescript
import { Registry } from 'entt-js'

// Define your components
class Position {
  x: number
  y: number
  constructor(x = 0, y = 0) {
    this.x = x
    this.y = y
  }
}

class Velocity {
  dx: number
  dy: number
  constructor(dx = 0, dy = 0) {
    this.dx = dx
    this.dy = dy
  }
}

// Create a registry
const registry = new Registry()

// Create entities and attach components
const entity = registry.create()
registry.emplace(entity, Position, 10, 20)
registry.emplace(entity, Velocity, 1, 0)

// Query entities with specific components
const view = registry.view([Position, Velocity])
view.each((entity, position, velocity) => {
  position.x += velocity.dx
  position.y += velocity.dy
})

// for-of iteration
for (const [entity, position, velocity] of view.each()) {
  position.x += velocity.dx
  position.y += velocity.dy
}
```

## Browser Support

The library supports both Node.js and modern browsers. For browser usage:

### No Bundler

```html
<!-- IIFE -->
<script src="https://cdn.jsdelivr.net/npm/entt-js/dist/browser/entt.min.js"></script>

<script>
const { Registry } = window.entt
</script>
```

or

```html
<!-- ESM -->
<script type="module">
import { Registry } from 'https://cdn.jsdelivr.net/npm/entt-js/dist/browser/index.min.js'
</script>
```

### With Bundler

```javascript
import { Registry } from 'entt-js'
```


## Core Concepts

### Registry

The `Registry` is the central hub for managing entities and components:

```typescript
const registry = new Registry()

// Create entities
const entity1 = registry.create()
const entity2 = registry.create()

// Check if entity is valid
registry.valid(entity1) // true

// Destroy entity
registry.destroy(entity1)
```

### Components

Components are plain TypeScript classes or objects that hold data:

```typescript
class Health {
  value: number
  constructor(value = 0) {
    this.value = value
  }
}

class Transform {
  x: number
  y: number
  rotation: number

  constructor(x = 0, y = 0, rotation = 0) {
    this.x = x
    this.y = y
    this.rotation = rotation
  }
}

// Attach components to entities
registry.emplace(entity, Health, 100)
registry.emplace(entity, Transform, 10, 20, 0)

// Retrieve components
const health = registry.get(entity, Health)
const transform = registry.get(entity, Transform)

// Check component existence
registry.allOf(entity, Health, Transform) // true
registry.anyOf(entity, Health) // true

// Remove components
registry.remove(entity, Health)
```

### Views

Views provide efficient iteration over entities with specific component sets:

```typescript
// Create a view for entities with Position and Velocity
const view = registry.view([Position, Velocity])

// Iterate with entity and components
view.each((entity, position, velocity) => {
  position.x += velocity.dx
  position.y += velocity.dy
})

// Iterate with components only
view.each((position, velocity) => {
  console.log(`Position: (${position.x}, ${position.y})`)
}, true)

// Exclude certain components
const viewWithExclusion = registry.view([Position], [Velocity])
```

### Groups

Groups offer even better performance for frequently accessed component combinations:

```typescript
// Owning group - optimizes storage layout
const group = registry.group([Position, Velocity])

group.each((entity, position, velocity) => {
  // High-performance iteration
  position.x += velocity.dx
  position.y += velocity.dy
})

// Non-owning group with additional components
const complexGroup = registry.group([], [Position, Velocity, Health])
```

### Signals

React to component lifecycle events:

```typescript
// Listen for component creation
registry.onConstruct(Position).connect((registry, entity) => {
  console.log(`Position component added to entity ${entity}`)
})

// Listen for component updates
registry.onUpdate(Health).connect((registry, entity) => {
  const health = registry.get(entity, Health)
  console.log(`Health updated to ${health.value}`)
})

// Listen for component destruction
registry.onDestroy(Position).connect((registry, entity) => {
  console.log(`Position component removed from entity ${entity}`)
})
```

### Sorting

Sort entities based on component values:

```typescript
// Sort by component property
registry.sort(Position, (a, b) => a.x - b.x)

// Sort by entity relationship
registry.sortByEntity(Position, (e1, e2) => e1 - e2)

// Sort to match another component's order
registry.sortAs(Velocity, Position)
```

## Advanced Features

### Runtime Views

When component types aren't known at compile time:

```typescript
import { RuntimeView } from 'entt-js'

const runtimeView = new RuntimeView()
runtimeView.iterate(registry.getStorage(Position))
runtimeView.iterate(registry.getStorage(Velocity))

for (const entity of runtimeView) {
  // Process entities
}
```

### Snapshots

Save and restore registry state:

```typescript
import { Snapshot, SnapshotLoader, Registry } from 'entt-js'

const registry = new Registry()
const snapshot = new Snapshot(registry)
const output = {
  saveSize(size) { /* ... */ }
  saveEntity(entity) { /* ... */ }
  saveComponent(component) { /* ... */ }
}
snapshot
  .get(output, Position)
  .get(output, Velocity)

// Load snapshot into another registry
const newRegistry = new Registry()
const loader = new SnapshotLoader(newRegistry)
const input = {
  loadSize(ref) { ref.set(/* size */) }
  loadEntity(ref) { ref.set(/* entity */) }
  loadComponent(ref) {
    const defaultComponent = ref.get()
    ref.set(/* ... */)
  }
}
loader
  .get(input, Position)
  .get(input, Velocity)
```

### Custom Entity Types

Use custom entity identifiers:

```typescript
import { basicRegistryTemplate } from 'entt-js'

// Use BigInt entities for larger capacity
const BigIntRegistry = basicRegistryTemplate.instantiate(BigInt)
const bigintRegistry = new BigIntRegistry()

// Custom entity class
class EntityObject {
  // static member `EntityType` is required
  static EntityType = Number

  version: number
  value: number

  constructor(value = 0) {
    this.version = ((value >>> 20) & 0xFFF) >>> 0
    this.value = (value & 0xFFFFF) >>> 0
  }

  // required for internal implicit convertion
  [Symbol.toPrimitive]() {
    return ((this.value & 0xFFFFF)
      | ((this.version & 0xFFF) << 20)) >>> 0
  }
}

const EntityObjectRegistry = basicRegistryTemplate.instantiate(EntityObject)
const entityObjectRegistry = new EntityObjectRegistry()
```

### Config Flags

The library supports several compile-time configuration flags to customize behavior and optimize performance:

#### Available Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `ENTT_SPARSE_PAGE` | `number` | `4096` | Size of sparse array pages (affects memory layout) |
| `ENTT_PACKED_PAGE` | `number` | `1024` | Size of packed array pages (affects memory layout) |
| `ENTT_NO_ETO` | `boolean` | `false` | Disable Empty Type Optimization (ETO) |
| `ENTT_NO_MIXIN` | `boolean` | `false` | Disable signal mixin functionality |

#### Usage in Different Environments

**Node.js (without bundler):**

Define flags as global variables before importing the library:

```javascript
global.ENTT_SPARSE_PAGE = 8192
global.ENTT_PACKED_PAGE = 2048
global.ENTT_NO_ETO = true
global.ENTT_NO_MIXIN = false

const { Registry } = require('entt-js')
```

**Browser (no bundler):**

Define flags on the window object before loading the script:

```html
<script>
  window.ENTT_SPARSE_PAGE = 8192
  window.ENTT_PACKED_PAGE = 2048
  window.ENTT_NO_ETO = true
  window.ENTT_NO_MIXIN = false
</script>
<script src="https://cdn.jsdelivr.net/npm/entt-js/dist/browser/entt.min.js"></script>
```

**With Bundler (Webpack, Vite, Rollup, etc.):**

Use bundler's define plugin to set flags at build time:

```javascript
// vite.config.js
export default {
  define: {
    ENTT_SPARSE_PAGE: 8192,
    ENTT_PACKED_PAGE: 2048,
    ENTT_NO_ETO: true,
    ENTT_NO_MIXIN: false
  }
}

// webpack.config.js
module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      ENTT_SPARSE_PAGE: 8192,
      ENTT_PACKED_PAGE: 2048,
      ENTT_NO_ETO: true,
      ENTT_NO_MIXIN: false
    })
  ]
}

// rollup.config.js
import replace from '@rollup/plugin-replace'

export default {
  plugins: [
    replace({
      ENTT_SPARSE_PAGE: 8192,
      ENTT_PACKED_PAGE: 2048,
      ENTT_NO_ETO: true,
      ENTT_NO_MIXIN: false,
      preventAssignment: true
    })
  ]
}
```

#### Flag Details

**ENTT_SPARSE_PAGE**: Controls the page size for sparse arrays in the sparse set implementation. Larger values use more memory but may reduce allocations. Adjust based on your entity count and memory constraints.

**ENTT_PACKED_PAGE**: Controls the page size for packed component arrays. Larger values improve cache locality for component iteration but increase memory overhead.

**ENTT_NO_ETO**: When `true`, disables Empty Type Optimization. ETO allows empty components (tag components) to avoid memory allocation. Disable if you encounter issues with empty class detection.

**ENTT_NO_MIXIN**: When `true`, disables the signal mixin system. This removes lifecycle event support (`onConstruct`, `onUpdate`, `onDestroy`) but slightly reduces memory overhead.

## Performance

The library is designed for high performance with:

- **Sparse Set Architecture**: O(1) component access and iteration
- **Cache-Friendly Layouts**: Contiguous memory for better CPU cache utilization  
- **Efficient Iteration**: Direct array access without indirection
- **Minimal Allocations**: Object pooling and reuse where possible

### Benchmark Results

Performance benchmarks with 1,000,000 entities on Node.js v24 (Apple M2):

| Operation | Time | Description |
|-----------|------|-------------|
| Create entities | 0.55s | Creating 1M entities |
| Single component iteration | 0.013s | Iterating over 1M entities with 1 component |
| Two components iteration | 0.40s | Iterating over 1M entities with 2 components |
| Owning group iteration | 0.25s | Iterating 1M entities in full owning group (2 components) |
| Component access (registry) | 0.12s | Getting component from registry for 1M entities |
| Component access (view) | 0.11s | Getting component from view for 1M entities |

> **Note**: These are raw JavaScript performance numbers. While not matching native C++ speeds, the library provides excellent performance for JS-based applications and games.

### Real-World Performance

For practical game development scenarios:

- **Typical games** process 1,000-50,000 entities per frame
- At 60 FPS (16.67ms budget per frame):
  - Iterating 10,000 entities with 2 components: ~0.004ms
  - Iterating 50,000 entities with 2 components: ~0.02ms
- **Iteration overhead is negligible** - rendering and game logic are typically the bottlenecks

**Performance characteristics:**
- ✅ Component iteration speed rivals native array performance
- ✅ Owning groups provide 1.6x speedup over regular views
- ✅ Component access is near-optimal (~0.0001ms per operation)

**Compared to alternatives:**
- More user-friendly than ArrayBuffer-based libraries (e.g., bitECS) while maintaining competitive performance
- Superior type safety and developer experience compared to other JS ECS implementations
- Excellent performance/usability balance for TypeScript projects

Run benchmarks yourself:
```bash
npm run benchmark
```

See `tests/benchmark` for detailed performance tests.

## Development

Install dependencies:

Node.js v24+

```bash
npm install
```

Run tests:

```bash
npm run test
```

Run benchmarks:

```bash
npm run benchmark
```

Build the library:

```bash
npm run build
```

Type checking:

```bash
npm run typecheck
```

## Differences from C++ EnTT

While this library aims to maintain API compatibility with the original EnTT, some differences exist due to TypeScript/JavaScript limitations:

- **No Template Specialization**: Uses runtime type registration instead
- **Memory Management**: Relies on JavaScript garbage collection
- **Performance**: Generally slower than C++ but highly optimized for JS
- **Type Safety**: Leverages TypeScript's type system for compile-time safety

## Credits

This project is a TypeScript port of [EnTT](https://github.com/skypjack/entt) by [@skypjack](https://github.com/skypjack/entt).

## Related Projects

- [EnTT](https://github.com/skypjack/entt) - The original C++ implementation
- [bitecs](https://github.com/NateTheGreatt/bitECS) - Another ECS library for JavaScript

## Links

- [GitHub Repository](https://github.com/toyobayashi/entt-js)
- [npm Package](https://www.npmjs.com/package/entt-js)
- [Issue Tracker](https://github.com/toyobayashi/entt-js/issues)
