import chalk from 'chalk'

const builtinCtx = {}

type InputContext<Output extends object> = { [K in keyof Output]: Output[K] | ((ctx: typeof builtinCtx, use: (value: Output[K]) => Promise<any>) => Promise<void>) } & typeof builtinCtx

class Test<Ctx extends Record<string, any>> {
  name: string
  func: (ctx: Ctx) => any
  context: InputContext<Ctx> | undefined
  skip: boolean

  constructor (ctx: InputContext<Ctx> | undefined, name: string, func: (ctx: typeof builtinCtx & Ctx) => any, skip?: boolean) {
    this.name = name
    this.func = func
    this.context = ctx
    this.skip = skip ?? false
  }

  async invoke (): Promise<void> {
    const name = this.name

    const ctx = {} as any
    const promises = new Map<string, { promise: Promise<any>; resolve: (value?: any) => void; reject: (err: any) => void }>()
    const readyToRunPromises: Promise<void>[] = []
    if (this.context != null) {
      const keys = Object.keys(this.context)
      for (const key of keys) {
        const original = (this.context as any)[key]
        if (typeof original === 'function') {
          readyToRunPromises.push(new Promise((resolve) => {
            original(builtinCtx, (value: any) => {
              ctx[key] = value
              const item: any = {}
              item.promise = new Promise<any>((resolve, reject) => {
                item.resolve = resolve
                item.reject = reject
              })
              promises.set(key, item)
              resolve()
              return item.promise
            })
          }))
        } else {
          ctx[key] = original
        }
      }
    }

    await Promise.all(readyToRunPromises)

    if (this.skip) {
      console.log(`${chalk.yellow('[  SKIPPED ]')} Benchmark.${name}`)
      return
    }

    console.log(`${chalk.green('[ RUN      ]')} Benchmark.${name}`)
    const start = performance.now()
    try {
      await this.func(ctx)
    } catch (err) {
      promises.forEach(({ reject }) => reject(err))
      promises.clear()
      throw err
    }
    const ms = performance.now() - start
    console.log(`${chalk.green('[       OK ]')} Benchmark.${name} (${ms | 0} ms)`)
    promises.forEach(({ resolve }) => resolve())
    promises.clear()
  }
}

const suites = new Map<string, Suite>()

function countTotalTests (): number {
  let total = 0
  for (const [, suite] of suites) {
    total += suite.tests.size
  }
  return total
}

export function it (name: string, func: (ctx: typeof builtinCtx) => any): void {
  Suite.current?.test(name, new Test(undefined, name, func))
}
it.skip = function (name: string, func: (ctx: typeof builtinCtx) => any): void {
  Suite.current?.test(name, new Test(undefined, name, func))
}
it.extend = function <Ctx extends object> (ctx: InputContext<Ctx>) {
  const test = function (name: string, func: (ctx: Ctx & typeof builtinCtx) => any): void {
    Suite.current?.test(name, new Test(ctx, name, func))
  }
  test.skip = function (name: string, func: (ctx: Ctx & typeof builtinCtx) => any): void {
    Suite.current?.test(name, new Test(ctx, name, func, true))
  }
  return test
}

class Suite {
  name: string
  tests: Map<string, Test<any>>

  static current: Suite | null = null

  constructor (name: string) {
    this.name = name
    this.tests = new Map<string, Test<any>>()
  }

  async run (testNames?: string[]): Promise<void> {
    if (testNames) {
      for (const [name, test] of this.tests) {
        if (!testNames.includes(name)) {
          test.skip = true
        }
      }
    }
    const start = performance.now()
    console.log(`${chalk.green('[----------]')} ${this.tests.size} tests from ${this.name}`)
    for (const [, test] of this.tests) {
      await test.invoke()
    }
    console.log(`${chalk.green('[----------]')} ${this.tests.size} tests from ${this.name} (${(performance.now() - start) | 0} ms total)\n`)
  }

  test (name: string, test: Test<any>): void {
    this.tests.set(name, test)
  }
}

export function describe (name: string, func: () => void): void {
  const suite = new Suite(name)
  Suite.current = suite
  func()
  Suite.current = null
  suites.set(name, suite)
}

(async function main (argc, argv) {
  console.log(`Running main() from ${import.meta.filename}`)
  await import('./benchmark.ts')

  const total = countTotalTests()
  if (total === 0) {
    console.log(chalk.yellow('No benchmark test found.'))
  } else {
    const start = performance.now()
    console.log(`${chalk.green('[==========]')} Running ${total} tests from ${suites.size} test suite.`)
    console.log(`${chalk.green('[----------]')} Global test environment set-up.`)
    
    if (argv[1]) {
      const [s, t] = argv[1].split('.')
      const suite = suites.get(s)
      await suite!.run([t])
    } else {
      for (const [_, suite] of suites) {
        await suite.run()
      }
    }

    console.log(`${chalk.green('[----------]')} Global test environment tear-down`)
    console.log(`${chalk.green('[==========]')} ${total} tests from ${suites.size} test suite ran. (${(performance.now() - start) | 0} ms total)`)
    console.log(`${chalk.green('[  PASSED  ]')} ${total} tests.`)
  }
})(process.argv.length - 1, process.argv.slice(1)).catch((err) => {
  console.error(err)
  process.exit(1)
})
