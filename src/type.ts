import { defineStaticMethod, inherits } from "./util"

export interface Uint8Constructor extends NumberConstructor {
  (num?: unknown): number
  readonly MIN_VALUE: 0
  readonly MAX_VALUE: 255
  is (instance: unknown): boolean
  super_: NumberConstructor
}
export const Uint8 = /*#__PURE__*/ (function () {
  const Uint8 = function Uint8 (this: any, num?: any) {
    if (typeof num === 'bigint') return Math.fround(Number(num & BigInt(0xFF)))
    return (num & 0xFF)
  } as unknown as Uint8Constructor
  inherits(Uint8, Number)
  Object.defineProperty(Uint8, 'MIN_VALUE', { value: 0 })
  Object.defineProperty(Uint8, 'MAX_VALUE', { value: 255 })
  defineStaticMethod(Uint8, 'is', function (instance: any) {
    if (typeof instance === 'number' || Object.getPrototypeOf(instance) === Number.prototype) {
      return (Uint8(instance)) === Number(instance)
    }
    return false
  })
  return Uint8
})()

export interface Float32Constructor extends NumberConstructor {
  (num?: unknown): number
  super_: NumberConstructor
}
export const Float32 = /*#__PURE__*/ (function () {
  const Float32 = function Float32 (this: any, num?: any) {
    if (typeof num === 'bigint') return Math.fround(Number(num & BigInt(0xFFFFFFFF)) | 0)
    return Math.fround(num ?? 0)
  } as unknown as Float32Constructor
  inherits(Float32, Number)
  return Float32
})()

export interface Float64Constructor extends NumberConstructor {
  (num?: unknown): number
  readonly MIN_VALUE: number
  readonly MAX_VALUE: number
  is (instance: unknown): boolean
  super_: NumberConstructor
}
export const Float64 = /*#__PURE__*/ (function () {
  const Float64 = function Float64 (this: any, num?: any) {
    return Number(num ?? 0)
  } as unknown as Float64Constructor
  inherits(Float64, Number)
  return Float64
})()

export interface Int8Constructor extends NumberConstructor {
  (num?: unknown): number
  readonly MIN_VALUE: -128
  readonly MAX_VALUE: 127
  is (instance: unknown): boolean
  super_: NumberConstructor
}
export const Int8 = /*#__PURE__*/ (function () {
  const Int8 = function Int8 (this: any, num?: any) {
    if (typeof num === 'bigint') return ((Number(num & BigInt(0xFF))) << 24) >> 24
    return ((num << 24) >> 24)
  } as unknown as Int8Constructor
  inherits(Int8, Number)
  Object.defineProperty(Int8, 'MIN_VALUE', { value: -128 })
  Object.defineProperty(Int8, 'MAX_VALUE', { value: 127 })
  defineStaticMethod(Int8, 'is', function (instance: any) {
    if (typeof instance === 'number' || Object.getPrototypeOf(instance) === Number.prototype) {
      return (Int8(instance)) === Number(instance)
    }
    return false
  })
  return Int8
})()

export interface Uint16Constructor extends NumberConstructor {
  (num?: unknown): number
  readonly MIN_VALUE: 0
  readonly MAX_VALUE: 65535
  is (instance: unknown): boolean
  super_: NumberConstructor
}
export const Uint16 = /*#__PURE__*/ (function () {
  const Uint16 = function Uint16 (this: any, num?: any) {
    if (typeof num === 'bigint') return Number(num & BigInt(0xFFFF))
    return (num & 0xFFFF)
  } as unknown as Uint16Constructor
  inherits(Uint16, Number)
  Object.defineProperty(Uint16, 'MIN_VALUE', { value: 0 })
  Object.defineProperty(Uint16, 'MAX_VALUE', { value: 65535 })
  defineStaticMethod(Uint16, 'is', function (instance: any) {
    if (typeof instance === 'number' || Object.getPrototypeOf(instance) === Number.prototype) {
      return (Uint16(instance)) === Number(instance)
    }
    return false
  })
  return Uint16
})()

export interface Int16Constructor extends NumberConstructor {
  (num?: unknown): number
  readonly MIN_VALUE: -32768
  readonly MAX_VALUE: 32767
  is (instance: unknown): boolean
  super_: NumberConstructor
}
export const Int16 = /*#__PURE__*/ (function () {
  const Int16 = function Int16 (this: any, num?: any) {
    if (typeof num === 'bigint') return ((Number(num & BigInt(0xFFFF))) << 16) >> 16
    return ((num << 16) >> 16)
  } as unknown as Int16Constructor
  inherits(Int16, Number)
  Object.defineProperty(Int16, 'MIN_VALUE', { value: -32768 })
  Object.defineProperty(Int16, 'MAX_VALUE', { value: 32767 })
  defineStaticMethod(Int16, 'is', function (instance: any) {
    if (typeof instance === 'number' || Object.getPrototypeOf(instance) === Number.prototype) {
      return (Int16(instance)) === Number(instance)
    }
    return false
  })
  return Int16
})()

export interface Uint32Constructor extends NumberConstructor {
  (num?: unknown): number
  readonly MIN_VALUE: 0
  readonly MAX_VALUE: 4294967295
  is (instance: unknown): boolean
  super_: NumberConstructor
}
export const Uint32 = /*#__PURE__*/ (function () {
  const Uint32 = function Uint32 (this: any, num?: any) {
    if (typeof num === 'bigint') return Number(num & BigInt(0xFFFFFFFF))
    return (num | 0) >>> 0
  } as unknown as Uint32Constructor
  inherits(Uint32, Number)
  Object.defineProperty(Uint32, 'MIN_VALUE', { value: 0 })
  Object.defineProperty(Uint32, 'MAX_VALUE', { value: 4294967295 })
  defineStaticMethod(Uint32, 'is', function (instance: any) {
    if (typeof instance === 'number' || Object.getPrototypeOf(instance) === Number.prototype) {
      return (Uint32(instance)) === Number(instance)
    }
    return false
  })
  return Uint32
})()

export interface Int32Constructor extends NumberConstructor {
  (num?: unknown): number
  readonly MIN_VALUE: -2147483648
  readonly MAX_VALUE: 2147483647
  is (instance: unknown): boolean
  super_: NumberConstructor
}
export const Int32 = /*#__PURE__*/ (function () {
  const Int32 = function Int32 (this: any, num?: any) {
    if (typeof num === 'bigint') return Number(num & BigInt(0xFFFFFFFF)) | 0
    return (num | 0)
  } as unknown as Int32Constructor
  inherits(Int32, Number)
  Object.defineProperty(Int32, 'MIN_VALUE', { value: -2147483648 })
  Object.defineProperty(Int32, 'MAX_VALUE', { value: 2147483647 })
  defineStaticMethod(Int32, 'is', function (instance: any) {
    if (typeof instance === 'number' || Object.getPrototypeOf(instance) === Number.prototype) {
      return (Int32(instance)) === Number(instance)
    }
    return false
  })
  return Int32
})()

const maxUint64 = /*#__PURE__*/ BigInt('0xFFFFFFFFFFFFFFFF')
export interface Uint64Constructor extends BigIntConstructor {
  (num?: unknown): bigint
  readonly MIN_VALUE: 0n
  readonly MAX_VALUE: 18446744073709551615n
  is (instance: unknown): boolean
  super_: BigIntConstructor
}
export const Uint64 = /*#__PURE__*/ (function () {
  const Uint64 = function Uint64 (this: any, num?: any) {
    if (num == null) return BigInt(0)
    try {
      return BigInt(num) & maxUint64
    } catch (_) {
      return BigInt(0)
    }
  } as unknown as Uint64Constructor
  inherits(Uint64, BigInt)
  Object.defineProperty(Uint64, 'MIN_VALUE', { value: BigInt(0) })
  Object.defineProperty(Uint64, 'MAX_VALUE', { value: maxUint64 })
  defineStaticMethod(Uint64, 'is', function (instance: any) {
    if (typeof instance === 'bigint' || Object.getPrototypeOf(instance) === BigInt.prototype) {
      return (Uint64(instance)) === BigInt(instance)
    }
    return false
  })
  return Uint64
})()

export interface Int64Constructor extends BigIntConstructor {
  (num?: unknown): bigint
  readonly MIN_VALUE: -9223372036854775808n
  readonly MAX_VALUE: 9223372036854775807n
  is (instance: unknown): boolean
  super_: BigIntConstructor
}
export const Int64 = /*#__PURE__*/ (function () {
  const minInt64 = -BigInt('0x8000000000000000')
  const maxInt64 = BigInt('0x7FFFFFFFFFFFFFFF')
  const Int64 = function Int64 (this: any, num?: any) {
    if (num == null) return BigInt(0)
    try {
      const value = BigInt(num)
      if (value < minInt64) {
        return (value & maxUint64)
      } else if (value > maxInt64) {
        return (value & maxUint64) - (maxUint64 + BigInt(1))
      }
      return value
    } catch (_) {
      return BigInt(0)
    }
  } as unknown as Int64Constructor
  inherits(Int64, BigInt)
  Object.defineProperty(Int64, 'MIN_VALUE', { value: minInt64 })
  Object.defineProperty(Int64, 'MAX_VALUE', { value: maxInt64 })
  defineStaticMethod(Int64, 'is', function (instance: any) {
    if (typeof instance === 'bigint' || Object.getPrototypeOf(instance) === BigInt.prototype) {
      return (Int64(instance)) === BigInt(instance)
    }
    return false
  })
  return Int64
})()

export interface DefaultEntityConstructor extends Uint32Constructor {
  (num?: unknown): Entity
  super_: Uint32Constructor
}
export type Entity = number
export const Entity = /*#__PURE__*/ (function () {
  const Entity = function Entity (this: any, value?: number) {
    return Uint32(value)
  } as unknown as DefaultEntityConstructor
  inherits(Entity, Uint32)
  return Entity
})()
