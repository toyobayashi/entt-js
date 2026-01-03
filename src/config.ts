import { NotConstructorError } from "./error"
import { Entity, Float32, Float64, Int16, Int32, Int64, Int8, Uint16, Uint32, Uint64, Uint8 } from "./type"

export type SafeInstanceType<T, Default = any> = T extends BooleanConstructor ? boolean
  : T extends NumberConstructor ? number
  : T extends BigIntConstructor ? bigint
  : T extends StringConstructor ? string
  : T extends SymbolConstructor ? symbol
  : T extends new (...args: any[]) => infer R ? R
  : T extends (...args: any[]) => infer R ? R
  : Default

export type SafeParameters<T> = T extends BooleanConstructor ? Parameters<BooleanConstructor>
  : T extends NumberConstructor ? Parameters<NumberConstructor>
  : T extends BigIntConstructor ? Partial<Parameters<BigIntConstructor>>
  : T extends StringConstructor ? Parameters<StringConstructor>
  : T extends SymbolConstructor ? Parameters<SymbolConstructor>
  : T extends abstract new (...args: infer P) => any ? P
  : T extends (...args: infer P) => any ? P
  : any[]

export const EmptyTypeOptimization = {
  Disabled: 0,
  Static: 1,
  0: 'Disabled',
  1: 'Static',
} as const
export type EmptyTypeOptimization = Extract<typeof EmptyTypeOptimization[keyof typeof EmptyTypeOptimization], number>

export const directCall = (Type: Function, ...args: any[]) => Type(...args)

export const config = /*#__PURE__*/ (() => {
  const customCalls = new WeakMap<Function, (Type: Function, ...args: any[]) => any>()
  customCalls.set(Boolean, directCall)
  customCalls.set(Number, directCall)
  customCalls.set(String, directCall)
  customCalls.set(Symbol, directCall)
  customCalls.set(Entity, directCall)
  customCalls.set(Uint8, directCall)
  customCalls.set(Int8, directCall)
  customCalls.set(Uint16, directCall)
  customCalls.set(Int16, directCall)
  customCalls.set(Uint32, directCall)
  customCalls.set(Int32, directCall)
  customCalls.set(Uint64, directCall)
  customCalls.set(Int64, directCall)
  customCalls.set(Float32, directCall)
  customCalls.set(Float64, directCall)
  customCalls.set(BigInt, (Type: Function, ...args: any[]) => Type(args.length === 0 ? 0 : args[0]))

  return {
    customCalls,
    emptyClasses: new WeakMap<Function, boolean>(),
    eto: typeof ENTT_NO_ETO !== 'undefined' ? (ENTT_NO_ETO ? EmptyTypeOptimization.Disabled : EmptyTypeOptimization.Static) : EmptyTypeOptimization.Static as EmptyTypeOptimization,
    mixin: typeof ENTT_NO_MIXIN !== 'undefined' ? !ENTT_NO_MIXIN : true,
    sparsePage: typeof ENTT_SPARSE_PAGE !== 'undefined' ? Number(ENTT_SPARSE_PAGE) : 4096,
    packedPage: typeof ENTT_PACKED_PAGE !== 'undefined' ? Number(ENTT_PACKED_PAGE) : 1024
  }
})()

export function createSafeNew<T extends Function> (Type: T): (...args: SafeParameters<T> | []) => SafeInstanceType<T> {
  if (config.customCalls.has(Type as any)) {
    const func = config.customCalls.get(Type as any)!
    return (...args: SafeParameters<T> | []) => func(Type, ...args)
  }
  return (...args: SafeParameters<T> | []) => {
    try {
      return new (Type as any)(...args)
    } catch (err: any) {
      if (err instanceof NotConstructorError || (err instanceof TypeError && err.message.includes('is not a constructor'))) {
        return (Type as any)(...args)
      }
      throw err
    }
  }
}

function getBlockBody (str: string, match: RegExpMatchArray | null): string {
  if (!match) return ''
  let bracketCount = 0
  const begin = match.index! + match[0].length - 1
  let curr = begin
  do {
    const char = str[curr]
    if (char === '{') {
      bracketCount++
    } else if (char === '}') {
      bracketCount--
    }
    curr++
  } while (bracketCount > 0 && curr < str.length)
  return str.slice(begin, curr)
}

export function isEmptyClass (Type: Function): boolean {
  if (config.eto === EmptyTypeOptimization.Disabled) {
    return false
  }

  if (typeof Type !== 'function' || Type.prototype == null) {
    return false
  }
  if (config.emptyClasses.has(Type)) {
    return config.emptyClasses.get(Type)!
  }

  if (config.eto === EmptyTypeOptimization.Static) {
    let str = ''
    try {
      str = Function.prototype.toString.call(Type)
    } catch (_) {
      return false
    }
    if (str.startsWith('class')) {
      const match = str.match(/^class(\s+\w*)?(\s+extends\s+[\w$]+)?\s*{/)
      const classBody = getBlockBody(str, match)
      if (!classBody) throw new Error('impossible')
      if (/^\{\s*(\r?\n)*\s*\}$/.test(classBody)) {
        const ret = match![1] ? isEmptyClass(Object.getPrototypeOf(Type)) : true
        // console.log(`isEmptyClass(${Type.name}) = ${ret}`)
        return ret
      }
      return false
    } else if (str.startsWith('function')) {
      const constructorBody = getBlockBody(str, str.match(/^function\s+\w*\s*\(([^)]*)\)\s*{/))
      if (constructorBody) {
        const ret = constructorBody === '{ [native code] }' ? false : !/this|return/.test(constructorBody)
        // console.log(`isEmptyClass(${Type.name}) = ${ret}`)
        return ret
      } else {
        throw new Error('impossible')
      }
    } else {
      return false
    }
  }

  return false
}
