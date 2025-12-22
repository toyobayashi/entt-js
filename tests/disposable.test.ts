import { expect, test, describe, vi } from 'vitest'

describe('Disposable', () => {
  const OriginalSymbol = globalThis.Symbol
  function S (s: string) {
    return OriginalSymbol(s)
  }
  S.for = OriginalSymbol.for

  vi.stubGlobal('Symbol', S)

  test('Symbol.dispose undefined', async () => {
    const { Disposable } = await import('../src')
    class MyDisposable extends Disposable {
      public override dispose (): void {
        // do nothing
      }
    }
    expect(MyDisposable.prototype[Symbol.dispose]).toBeUndefined()
    expect(() => {
      using obj = new MyDisposable()
      obj
    }).toThrow(TypeError)
  })

  test('can be disposed', async () => {
    vi.unstubAllGlobals()
    const { Disposable } = await import('../src')
    Disposable.prototype[Symbol.dispose] = function () {
      this.dispose()
    }
    let disposed = false
    class MyDisposable extends Disposable {
      public override dispose (): void {
        disposed = true
      }
    }
    
    expect(disposed).toBe(false)
    {
      using obj = new MyDisposable()
      obj
    }
    expect(disposed).toBe(true)
  })
})
