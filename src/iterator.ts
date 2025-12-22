export interface ForwardPointer<T, Self extends ForwardPointer<T, Self>> {
  clone (target?: Self): Self
  swap (other: Self): void
  deref (): T
  write (value: T): T
  selfPlus (): this
  equals (other: Self): boolean
}

export interface BidirectionalPointer<T, Self extends BidirectionalPointer<T, Self>> extends ForwardPointer<T, Self> {
  clone (target?: Self): Self
  swap (other: Self): void
  selfMinus (): this
}

export interface RandomAccessPointer<T, Self extends RandomAccessPointer<T, Self>> extends BidirectionalPointer<T, Self> {
  clone (target?: Self): Self
  swap (other: Self): void
  selfPlus (n?: number): this
  plus (n: number): Self
  selfMinus (n?: number): this
  minus (n: number): Self
  diff (other: Self): number
  access (n: number): T
  set (n: number, value: T): void
  lt (other: Self): boolean
  gt (other: Self): boolean
  le (other: Self): boolean
  ge (other: Self): boolean
}

export interface Range<It extends ForwardPointer<any, any>> extends Iterable<It extends ForwardPointer<infer T, any> ? T : any> {
  begin (): It
  end (): It
}

export interface ReversableRange<It extends BidirectionalPointer<any, any>> extends Range<It> {
  rbegin (): ReversePointer<It>
  rend (): ReversePointer<It>
}

export interface IterableHelpers<K, V, T = any> extends Iterable<V> {
  keys (): IteratorObject<K>
  values (): IteratorObject<V>
  entries (): IteratorObject<[K, V]>
  forEach (callback: (value: V, key: K, self: T) => void, thisArg?: any): void
}

export class ReversePointer<It extends BidirectionalPointer<any, any>> {
  private readonly it: any

  constructor (it: It) {
    this.it = it.clone() as It
  }

  clone (target?: ReversePointer<It>): ReversePointer<It> {
    if (target) {
      if (this === target) return target
      this.it.clone(target.it)
      return target
    }
    return new ReversePointer(this.it)
  }

  swap (other: ReversePointer<It>): void {
    if (this === other) return
    this.it.swap(other.it)
  }

  base () {
    return this.it.clone()
  }

  selfPlus (n = 1): this {
    this.it.selfMinus(n)
    return this
  }

  selfMinus (n = 1): this {
    this.it.selfPlus(n)
    return this
  }

  plus (n: number) {
    return new ReversePointer<It>(this.it.minus(n))
  }

  minus (n: number) {
    return new ReversePointer<It>(this.it.plus(n))
  }

  diff (other: ReversePointer<It>): number {
    return other.it.diff(this.it)
  }

  equals (other: ReversePointer<It>): boolean {
    return this.it.equals(other.it)
  }

  lt (other: ReversePointer<It>): boolean {
    return this.it.gt(other.it)
  }

  gt (other: ReversePointer<It>): boolean {
    return this.it.lt(other.it)
  }

  le (other: ReversePointer<It>): boolean {
    return this.it.ge(other.it)
  }

  ge (other: ReversePointer<It>): boolean {
    return this.it.le(other.it)
  }

  deref (): It extends BidirectionalPointer<infer U, any> ? U : never {
    return this.it.clone().selfMinus().deref()
  }

  write (value: It extends BidirectionalPointer<infer U, any> ? U : never): It extends BidirectionalPointer<infer U, any> ? U : never {
    return this.it.write(value)
  }

  access (value: number): It extends BidirectionalPointer<infer U, any> ? U : never {
    return this.it.access(-1 - value)
  }

  set (off: number, value: It extends BidirectionalPointer<infer U, any> ? U : never): void {
    this.it.set(-1 - off, value)
  }
}

export function makeReversePointer<It extends BidirectionalPointer<any, any>> (it: It): ReversePointer<It> {
  return new ReversePointer(it)
}

// export function makeRangePointer<It extends ForwardPointer<any, any>> (range: Range<It>): [It, It]
// export function makeRangePointer<It extends ForwardPointer<any, any>, Sentinel extends ForwardPointer<any, any> = It> (first: It, last: Sentinel): [It, Sentinel]
export function makeRangePointer<It extends ForwardPointer<any, any>, Sentinel extends ForwardPointer<any, any> = It> (first: Range<It> | It, last?: Sentinel): [It, Sentinel] {
  const f = last != null ? (first as It).clone() : (first as Range<It>).begin()
  const l = last != null ? last.clone() : (first as Range<It>).end()
  return [f, l]
}

export class RangeIterator<It extends ForwardPointer<any, any>, Sentinel extends ForwardPointer<any, any> = It> extends Iterator<It extends ForwardPointer<infer U, any> ? U : any> {
  private readonly first: It
  private readonly curr: It
  private readonly last: Sentinel

  constructor (first: It, last: Sentinel) {
    super()
    this.first = first.clone()
    this.last = last.clone()
    this.curr = first.clone()
  }

  begin (): It {
    return this.first.clone()
  }

  end (): Sentinel {
    return this.last.clone()
  }

  next (): IteratorResult<It extends ForwardPointer<infer U, any> ? U : any> {
    if (this.curr.equals(this.last)) {
      return { done: true, value: undefined! }
    }
    const value = this.curr.deref()
    this.curr.selfPlus()
    return { done: false, value }
  }

  [Symbol.iterator]() {
    return this
  }
}

export class AggregatePointer<const T extends Array<ForwardPointer<any, any>>> implements ForwardPointer<{ [K in keyof T]: T[K] extends ForwardPointer<infer U, any> ? U : any }, AggregatePointer<T>> {
  private pointers: T

  constructor (pointers: T) {
    this.pointers = pointers
  }

  base (): T[0] {
    return this.pointers[0]
  }

  deref (): { [K in keyof T]: T[K] extends ForwardPointer<infer U, any> ? U : any } {
    return this.pointers.map(p => p.deref()) as any
  }

  write (value: { [K in keyof T]: T[K] extends ForwardPointer<infer U, any> ? U : any }): { [K in keyof T]: T[K] extends ForwardPointer<infer U, any> ? U : any } {
    this.pointers.forEach((p, i) => p.write(value[i]))
    return value
  }

  clone (target?: AggregatePointer<T>): AggregatePointer<T> {
    if (target) {
      if (this === target) return target
      this.pointers.forEach((p, i) => { target.pointers[i] = p.clone() })
      return target
    }
    const clonedPointers = this.pointers.map(p => p.clone()) as T
    return new AggregatePointer(clonedPointers)
  }

  swap (other: AggregatePointer<T>): void {
    if (this === other) return
    const tmp = this.pointers
    this.pointers = other.pointers
    other.pointers = tmp
  }

  selfPlus (): this {
    this.pointers.forEach(p => p.selfPlus())
    return this
  }

  equals (other: AggregatePointer<T>): boolean {
    return this.pointers.every((p, i) => p.equals(other.pointers[i]))
  }
}

export function toIterator<It extends ForwardPointer<any, any>> (first: Range<It>): RangeIterator<It, It>
export function toIterator<It extends ForwardPointer<any, any>, Sentinel extends ForwardPointer<any, any> = It> (first: It, last: Sentinel): RangeIterator<It, Sentinel>
export function toIterator<It extends ForwardPointer<any, any>, Sentinel extends ForwardPointer<any, any> = It> (first: Range<It> | It, last?: Sentinel): RangeIterator<It, Sentinel> {
  const [f, l] = makeRangePointer<It, Sentinel>(first as any, last as any)
  return new RangeIterator(f, l)
}

export class ArrayPointer<T> implements RandomAccessPointer<T, ArrayPointer<T>> {
  private array: T[]
  private pos: number

  constructor (array: T[], index: number) {
    this.array = array
    this.pos = index
  }

  clone (target?: ArrayPointer<T>): ArrayPointer<T> {
    if (target) {
      if (this === target) return target
      target.array = this.array
      target.pos = this.pos
      return target
    }
    return new ArrayPointer(this.array, this.pos)
  }

  swap (other: ArrayPointer<T>): void {
    if (this === other) return
    const tmpArray = this.array
    const tmpIndex = this.pos

    this.array = other.array
    this.pos = other.pos

    other.array = tmpArray
    other.pos = tmpIndex
  }

  selfPlus (n = 1): this {
    this.pos += n
    return this
  }

  plus (n: number): ArrayPointer<T> {
    return new ArrayPointer(this.array, this.pos + n)
  }

  selfMinus (n = 1): this {
    this.pos -= n
    return this
  }

  minus (n: number): ArrayPointer<T> {
    return new ArrayPointer(this.array, this.pos - n)
  }

  diff (other: ArrayPointer<T>): number {
    return this.pos - other.pos
  }

  lt (other: ArrayPointer<T>): boolean {
    return this.pos < other.pos
  }

  gt (other: ArrayPointer<T>): boolean {
    return this.pos > other.pos
  }
  le (other: ArrayPointer<T>): boolean {
    return this.pos <= other.pos
  }

  ge (other: ArrayPointer<T>): boolean {
    return this.pos >= other.pos
  }

  equals (other: ArrayPointer<T>): boolean {
    return this.pos === other.pos
  }

  deref(): T {
    return this.array[this.pos]
  }

  write(value: T): T {
    this.array[this.pos] = value
    return value
  }

  access(n: number): T {
    return this.array[this.pos + n]
  }

  set(n: number, value: T): void {
    this.array[this.pos + n] = value
  }
}

export class ArrayRange<T> implements Range<ArrayPointer<T>> {
  private readonly array: T[]

  constructor (array: T[]) {
    this.array = array
  }

  data (): T[] {
    return this.array
  }

  begin (): ArrayPointer<T> {
    return new ArrayPointer(this.array, 0)
  }

  end (): ArrayPointer<T> {
    return new ArrayPointer(this.array, this.array.length)
  }

  rbegin (): ReversePointer<ArrayPointer<T>> {
    return new ReversePointer(this.end())
  }

  rend (): ReversePointer<ArrayPointer<T>> {
    return new ReversePointer(this.begin())
  }

  [Symbol.iterator](): RangeIterator<ArrayPointer<T>> {
    return toIterator(this)
  }
}

export function toRange<T> (value: T): T extends Array<infer U> ? ArrayRange<U> : Range<ForwardPointer<any, any>> {
  if (Array.isArray(value)) {
    return new ArrayRange(value) as any
  }
  throw new Error('Invalid argument')
}

export function distance<It extends ForwardPointer<any, any>> (first: It, last: It): number {
  first = first.clone()
  last = last.clone()
  if (typeof (first as any).diff === 'function' && typeof (last as any).diff === 'function') {
    return (last as any).diff(first)
  }
  let r = 0
  for (; !first.equals(last); first.selfPlus()) {
    ++r
  }
  return r
}

