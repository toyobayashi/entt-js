import { defineConfig } from 'tsdown'
import pkg from './package.json' with { type: 'json' }

const version = pkg.version

export default defineConfig([
  {
    entry: {
      entt: './src/index.ts',
    },
    platform: 'neutral',
    dts: false,
    define: {
      __DEV__: 'process.env.NODE_ENV !== "production"',
      __VERSION__: `"${version}"`,
    },
  },
  {
    entry: {
      ['entt.min']: './src/index.ts',
    },
    platform: 'neutral',
    minify: true,
    dts: false,
    define: {
      __DEV__: 'false',
      __VERSION__: `"${version}"`,
    },
  },
  {
    entry: './src/index.ts',
    platform: 'browser',
    globalName: 'entt',
    outDir: 'dist/browser',
    outputOptions: {
      file: 'dist/browser/entt.js',
      dir: undefined,
    },
    format: 'iife',
    noExternal: ['stable-hash'],
    dts: false,
    define: {
      __DEV__: 'true',
      __VERSION__: `"${version}"`,
    }
  },
  {
    entry: './src/index.ts',
    platform: 'browser',
    globalName: 'entt',
    outDir: 'dist/browser',
    outputOptions: {
      file: 'dist/browser/entt.min.js',
      dir: undefined,
    },
    minify: true,
    format: 'iife',
    noExternal: ['stable-hash'],
    dts: false,
    define: {
      __DEV__: 'false',
      __VERSION__: `"${version}"`,
    }
  },
  {
    entry: './src/index.ts',
    platform: 'browser',
    outDir: 'dist/browser',
    noExternal: ['stable-hash'],
    dts: false,
    define: {
      __DEV__: 'true',
      __VERSION__: `"${version}"`,
    }
  },
  {
    entry: './src/index.ts',
    platform: 'browser',
    outputOptions: {
      file: 'dist/browser/index.min.js',
      dir: undefined,
    },
    minify: true,
    noExternal: ['stable-hash'],
    dts: false,
    define: {
      __DEV__: 'false',
      __VERSION__: `"${version}"`,
    }
  },
])
