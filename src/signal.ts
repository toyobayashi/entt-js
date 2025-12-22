import { createSafeNew, type SafeInstanceType, type SafeParameters } from "./config"
import { Disposable } from "./disposable"
import { defineTemplate } from "./template"
import { assert as ENTT_ASSERT } from "./util"

export class Delegate<T extends (this: any, ...args: any[]) => any> extends Disposable {
  private fn: T
  private instance: any

  constructor (fn: T, instance?: any) {
    super()
    this.fn = fn
    this.instance = instance
  }

  dispose(): void {
    this.reset()
  }

  reset (): void {
    this.fn = null!
    this.instance = null
  }

  empty (): boolean {
    return this.fn == null
  }

  connect (fn: T, instance?: any): void {
    this.fn = fn
    this.instance = instance
  }

  invoke (...args: Parameters<T>): ReturnType<T> {
    const fn = this.fn
    return this.instance ? fn.apply(this.instance, args) : fn(...args)
  }
}

export class Sink<Ret, Args extends any[]> extends Disposable {
  private signal: Sigh<(...args: Args) => Ret> | undefined

  constructor (signal?: Sigh<(...args: Args) => Ret>) {
    super()
    this.signal = signal
  }

  dispose(): void {
    this.signal?.dispose()
    this.signal = undefined
  }

  empty (): boolean {
    __DEV__ && ENTT_ASSERT(this.signal != null, 'Invalid reference to signal')
    return (this.signal as any).calls.length === 0
  }

  private disconnectIf (callback: (elem: Delegate<(...args: Args) => Ret>) => boolean): void {
    __DEV__ && ENTT_ASSERT(this.signal != null, 'Invalid reference to signal')
    for (let pos = (this.signal as any).calls.length - 1; pos >= 0; --pos) {
      const elem = (this.signal as any).calls[pos]
      if (callback(elem)) {
        const tmp = (this.signal as any).calls[pos]
        ;(this.signal as any).calls[pos] = (this.signal as any).calls[(this.signal as any).calls.length - 1]
        ;(this.signal as any).calls[(this.signal as any).calls.length - 1] = tmp
        ;(this.signal as any).calls.pop()
      }
    }
  }

  disconnect (fn?: (...args: Args) => Ret, instance?: any): void {
    __DEV__ && ENTT_ASSERT(this.signal != null, 'Invalid reference to signal')
    if (fn != null && instance != null) {
      this.disconnectIf((elem: any) => Object.is(elem.fn, fn) && Object.is(elem.instance, instance))
    } else if (fn != null) {
      this.disconnectIf((elem: any) => Object.is(elem.fn, fn))
    } else if (instance != null) {
      this.disconnectIf((elem: any) => Object.is(elem.instance, instance))
    } else {
      (this.signal as any).calls.length = 0
    }
  }

  connect (fn: (...args: Args) => Ret, instance?: any): Connection {
    this.disconnect(fn, instance)
    const delegate = new Delegate(fn, instance)
    ;(this.signal as any).calls.push(delegate)

    const conn = new Connection(new Delegate(function (this: any, signal: any) {
      new Sink<Ret, Args>(signal).disconnect(fn, this)
    }, instance), this.signal)
    return conn
  }
}

export class Sigh<T extends (this: any, ...args: any[]) => any> extends Disposable {
  private readonly calls: Array<Delegate<T>>
  static SinkType = Sink

  constructor () {
    super()
    this.calls = []
  }

  dispose (): void {
    this.calls.length = 0
  }

  get size (): number {
    return this.calls.length
  }

  empty (): boolean {
    return this.calls.length === 0
  }

  publish (...args: Parameters<T>): void {
    for (let i = this.calls.length - 1; i >= 0; --i) {
      this.calls[i].invoke(...args)
    }
  }

  collect<U extends (value: ReturnType<T>) => boolean | undefined> (fn: U, ...args: Parameters<T>): void {
    for (let i = this.calls.length - 1; i >= 0; --i) {
      const res = this.calls[i].invoke(...args)
      if (fn(res)) {
        break
      }
    }
  }
}

export class Connection {
  private readonly signal: any
  private readonly disconnect: Delegate<(signal: any) => void>

  constructor (fn: Delegate<(signal: any) => void>, ref: any) {
    this.disconnect = fn
    this.signal = ref
  }

  empty (): boolean {
    return this.disconnect.empty()
  }

  release (): void {
    if (!this.disconnect.empty()) {
      this.disconnect.invoke(this.signal)
      this.disconnect.reset()
    }
  }
}

export class ScopedConnection extends Disposable {
  private readonly conn: Connection

  constructor (conn: Connection) {
    super()
    this.conn = conn
  }

  dispose(): void {
    this.conn.release()
  }

  empty (): boolean {
    return this.conn.empty()
  }

  release (): void {
    this.conn.release()
  }
}

abstract class BasicDispatcherHandler extends Disposable {
  abstract publish (): void
  abstract disconnect (instance: any): void
  abstract clear (): void
  abstract get size (): number
}

interface DispatcherHandler<T, Params extends any[]> extends BasicDispatcherHandler {
  bucket (): Sink<void, [payload: T]>
  trigger (event: T): void
  enqueue (...args: Params): void
}

interface DispatcherHandlerConstructor<C extends Function> {
  new (): DispatcherHandler<SafeInstanceType<C>, SafeParameters<C>>
  prototype: DispatcherHandler<SafeInstanceType<C>, SafeParameters<C>>
}

const dispatcherHandlerTemplate = defineTemplate(function<C extends Function> (Type: C): DispatcherHandlerConstructor<C> {
  type T = SafeInstanceType<C>
  const newType = createSafeNew(Type)

  return class DispatcherHandler extends BasicDispatcherHandler {
    private readonly signal: Sigh<(payload: T) => void>
    private readonly events: T[]

    constructor () {
      super()
      this.signal = new Sigh<(payload: T) => void>()
      this.events = []
    }

    dispose(): void {
      this.signal.dispose()
      this.events.length = 0
    }

    publish (): void {
      while (this.events.length > 0) {
        const event = this.events.shift()!
        this.signal.publish(event)
      }
    }

    disconnect (instance: any): void {
      new Sigh.SinkType<void, [payload: T]>(this.signal).disconnect(undefined, instance)
    }

    clear(): void {
      this.events.length = 0
    }

    bucket (): Sink<void, [payload: T]> {
      return new Sigh.SinkType<void, [payload: T]>(this.signal)
    }

    trigger (event: T): void {
      this.signal.publish(event)
    }

    enqueue (...args: SafeParameters<C>): void {
      this.events.push(newType(...args) as T)
    }

    get size(): number {
      return this.events.length
    }
  }
})

export class BasicDispatcher extends Disposable {
  private readonly pools: Map<Function, BasicDispatcherHandler>

  constructor () {
    super()
    this.pools = new Map<Function, BasicDispatcherHandler>()
  }

  dispose(): void {
    this.pools.forEach((pool) => { pool.dispose() })
    this.pools.clear()
  }

  private assure <C extends Function> (Type: C): DispatcherHandler<SafeInstanceType<C>, SafeParameters<C>> {
    if (!this.pools.has(Type)) {
      const Handler = dispatcherHandlerTemplate.instantiate(Type)
      const handler = new Handler()
      this.pools.set(Type, handler)
      return handler
    }
    return this.pools.get(Type)! as DispatcherHandler<SafeInstanceType<C>, SafeParameters<C>>
  }

  private constAssure <C extends Function> (Type: C): DispatcherHandler<SafeInstanceType<C>, SafeParameters<C>> | undefined {
    return this.pools.get(Type) as DispatcherHandler<SafeInstanceType<C>, SafeParameters<C>> | undefined
  }

  size <C extends Function> (Type?: C): number {
    if (Type != null) {
      const cpool = this.constAssure(Type)
      return cpool ? cpool.size : 0
    }
    let size = 0
    this.pools.forEach((cpool) => { size += cpool.size })
    return size
  }

  sink <C extends Function> (Type: C): Sink<void, [payload: SafeInstanceType<C>]> {
    return this.assure(Type).bucket()
  }

  trigger <C extends Function> (Type: C, event: SafeInstanceType<C>): void {
    this.assure(Type).trigger(event)
  }

  enqueue <C extends Function> (Type: C, ...args: SafeParameters<C>): void {
    this.assure(Type).enqueue(...args)
  }

  disconnect (instance: any): void {
    this.pools.forEach((handler) => { handler.disconnect(instance) })
  }

  clear <C extends Function> (Type?: C): void {
    if (Type != null) {
      this.assure(Type).clear()
    } else {
      this.pools.forEach((handler) => { handler.clear() })
    }
  }

  update <C extends Function> (Type?: C): void {
    if (Type != null) {
      this.assure(Type).publish()
    } else {
      this.pools.forEach((handler) => { handler.publish() })
    }
  }
}

export class Emitter<Derived extends Emitter<Derived>> extends Disposable {
  private readonly handlers: Map<Function, (value: any) => void>

  constructor () {
    super()
    this.handlers = new Map<Function, (value: any) => void>()
  }

  dispose(): void {
    this.handlers.clear()
  }

  on <C extends Function> (Type: C, fn: (value: SafeInstanceType<C>, thisArg: Derived) => void): void {
    this.handlers.set(Type, (value: any) => {
      fn(value, this as unknown as Derived)
    })
  }

  publish (value: NonNullable<unknown>): void {
    const Constructor = value.constructor as Function
    const handler = this.handlers.get(Constructor)
    if (handler) {
      handler(value)
    }
  }

  erase (Type: Function): void {
    this.handlers.delete(Type)
  }

  clear (): void {
    this.handlers.clear()
  }

  contains (Type: Function): boolean {
    return this.handlers.has(Type)
  }

  empty (): boolean {
    return this.handlers.size === 0
  }
}
