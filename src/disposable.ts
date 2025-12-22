export interface Disposable extends globalThis.Disposable {
  dispose (): void
}

export interface DisposableConstructor {
  new (): Disposable
  prototype: Disposable
}

export const Disposable = /*#__PURE__*/ (function () {
  class Disposable implements globalThis.Disposable {
    /** @virtual */
    public dispose (): void {}

    public [Symbol.dispose] (): void {
      this.dispose()
    }
  }

  if (typeof Symbol.dispose !== 'symbol') {
    delete Disposable.prototype[Symbol.dispose]
  }

  return Disposable as DisposableConstructor
})()
