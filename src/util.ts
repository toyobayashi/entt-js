import type { SafeInstanceType } from "./config"

export const assert = __DEV__
  ? typeof ENTT_ASSERT !== 'undefined' ? ENTT_ASSERT : /*@__NO_SIDE_EFFECTS__*/ function (condition: boolean, message: string): void {
      if (!condition) {
        throw new AssertionError(message)
      }
    }
  : undefined!

function cloneObject <T extends object> (obj: T, result?: any): T {
  if (typeof (obj as any).clone === 'function') {
    return (obj as any).clone()
  }
  const descriptors = Object.getOwnPropertyDescriptors(obj)
  result ??= Object.create(Object.getPrototypeOf(obj))
  for (const [key, descriptor] of Object.entries(descriptors)) {
    Object.defineProperty(result, key, {
      ...descriptor,
      ...('value' in descriptor ? { value: clone(descriptor.value) } : undefined)
    })
  }
  return result
}

export function clone<T> (obj: T): T {
  const type = typeof obj
  if (type !== 'object' || obj === null) {
    if (type === 'symbol') {
      if (Symbol.keyFor(obj as symbol) != null) {
        throw new Error('Cannot clone global symbol')
      }
      return Symbol((obj as symbol).description) as any
    }
    if (type === 'function') {
      return function (this: any) {
        return (obj as Function).apply(this, arguments)
      } as T
    }
    return obj
  }

  if (Array.isArray(obj)
    || obj instanceof ArrayBuffer
    || ArrayBuffer.isView(obj)
    || obj instanceof DataView
    || obj instanceof Date
    || obj instanceof RegExp
    || obj instanceof Map
    || obj instanceof Set
    || obj instanceof Error
    || obj instanceof Number
    || obj instanceof String
    || obj instanceof Boolean
  ) {
    try {
      const result = structuredClone(obj)
      Object.setPrototypeOf(result, Object.getPrototypeOf(obj))
      return result
    } catch (_) {
      if (Array.isArray(obj)) {
        return obj.map((v) => clone(v)) as any
      }
      if (obj instanceof ArrayBuffer) {
        return obj.slice(0) as any
      }
      if (ArrayBuffer.isView(obj)) {
        return new (obj.constructor as any)(obj.buffer, obj.byteOffset, obj.byteLength / (obj.constructor as any).BYTES_PER_ELEMENT) as any
      }
      if (obj instanceof DataView) {
        return new DataView(obj.buffer, obj.byteOffset, obj.byteLength) as any
      }
      if (obj instanceof Date) {
        return new Date(obj.getTime()) as any
      }
      if (obj instanceof RegExp) {
        return new RegExp(obj.source, obj.flags) as any
      }
      if (obj instanceof Map) {
        const result = new Map()
        obj.forEach((v, k) => {
          result.set(clone(k), clone(v))
        })
        return result as any
      }
      if (obj instanceof Set) {
        const result = new Set()
        obj.forEach((v) => {
          result.add(clone(v))
        })
        return result as any
      }
      if (obj instanceof Error) {
        const error = new (obj.constructor as any)(obj.message)
        return cloneObject(obj, error)
      }
      if (obj instanceof Number || obj instanceof String || obj instanceof Boolean) {
        const Ctor = obj.constructor as any
        return new Ctor(obj.valueOf()) as any
      }
    }
  }

  if (obj instanceof Promise) {
    return obj.then(clone) as T
  }

  return cloneObject(obj!)
}

export function popcount (value: number | bigint): number {
  const b = typeof value === 'bigint'
  if (!b) {
    value = value as number >>> 0
  }
  const _1 = (b ? BigInt(1) : 1)
  // @ts-expect-error -- ignore
  return value ? Number((value & _1) + (b ? BigInt(popcount(value >> _1)) : popcount(value >>> _1))) : 0
}

export function defineMethod<C extends Function> (Class: C, name: string | symbol, method: (this: SafeInstanceType<C>, ...args: any[]) => any) {
  Object.defineProperty(Class.prototype, name, {
    value: method,
    configurable: true,
    writable: true,
  })
}

export function defineStaticMethod<C extends Function> (Class: C, name: string | symbol, method: (this: C, ...args: any[]) => any) {
  Object.defineProperty(Class, name, {
    value: method,
    configurable: true,
    writable: true,
  })
}

export function inherits<C extends Function> (Derived: C, Base: Function): void {
  Object.setPrototypeOf(Derived, Base)
  Object.setPrototypeOf(Derived.prototype, Base.prototype)
  Object.defineProperty(Derived, 'super_', {
    value: Base,
    writable: true,
    configurable: true,
  })
}

export function hasSingleBit (value: bigint): boolean {
  if (__DEV__) {
    if (!(value >= 0 && ((value | 0n) === value))) throw new TypeError('value must be unsigned integer')
  }
  return value !== 0n && ((value & (value - 1n)) === 0n)
}

export function fastMod (value: bigint, mod: bigint): number {
  if (__DEV__) {
    if (!(value >= 0n && ((value | 0n) === value))) throw new TypeError('value must be unsigned integer')
    assert(hasSingleBit(mod), 'mod must be a power of two')
  }
  return Number((value) & ((mod) - 1n))
}

export interface IRef<T> {
  get (): T
  set (value: T): void
}

export function isExtendsFrom (Type: Function, Classes: Function[]): any {
  let T: any = Type
  do {
    if (Classes.includes(T)) return T
    T = Object.getPrototypeOf(T)
  } while (T != null)
  return null
}

export const AssertionError = /*#__PURE__*/ (function () {
  class AssertionError extends Error {
    constructor (message?: string) {
      super(message)
    }
  }

  Object.defineProperty(AssertionError.prototype, 'name', {
    value: 'AssertionError',
    configurable: true,
  })

  return AssertionError
})()

export const less = (a: any, b: any): number => {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

export function defaultSort<T> (arr: T[], compareFn: (a: T, b: T) => number = less): T[] {
  return arr.sort(compareFn)
}

export function insertionSort<T> (arr: T[], compareFn: (a: T, b: T) => number = less): T[] {
  const last = arr.length
  if (last > 0) {
    const first = 0
    for (let it = first + 1; it < last; ++it) {
      const value = arr[it]
      let pre = it

      for (; pre > first && compareFn(value, arr[pre - 1]) < 0; --pre) {
        arr[pre] = arr[pre - 1]
      }

      arr[pre] = value
    }
  }
  return arr
}

export type StorageKey<U extends Function | undefined> = U | [U, any]

export function destructKey<U extends Function>(k: StorageKey<U> | PropertyKey): [U | null, any] {
  return Array.isArray(k) ? k : (typeof k === 'function' || k === undefined) ? [k, k] : [null, k]
}

export class Ref<T> implements IRef<T> {
  value: T

  constructor (value: T) {
    this.value = value
  }

  get (): T {
    return this.value
  }

  set (value: T): void {
    this.value = value
  }
}
