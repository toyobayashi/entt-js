export interface NotConstructorError extends TypeError {
  name: 'NotConstructorError'
}
export interface NotConstructorErrorConstructor extends TypeErrorConstructor {
  new (message?: string): NotConstructorError
  (message?: string): never
  readonly prototype: NotConstructorError
}
export const NotConstructorError = /*#__PURE__*/ (function () {
  class NotConstructorError extends TypeError {
    constructor (message?: string) {
      super(message)
    }
  }

  Object.defineProperty(NotConstructorError.prototype, 'name', {
    value: 'NotConstructorError',
    configurable: true,
  })

  return NotConstructorError as NotConstructorErrorConstructor
})()
