import { defineConfig } from 'vitest/config'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  define: {
    __DEV__: 'true',
    __VERSION__: `"${pkg.version}"`,
  },
  test: {
    coverage: {
      // include: ['src/**/*.ts'],
      // exclude: ['**/*.d.ts']
    }
  }
})
