import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    // mirror webpack's resolve.modules + alias so client modules are importable in tests
    alias: [
      { find: /^shared\//, replacement: `${path.resolve(__dirname, '../shared')}/` },
      { find: /^lib\//, replacement: `${path.resolve(__dirname, '../src/lib')}/` },
      { find: /^store\//, replacement: `${path.resolve(__dirname, '../src/store')}/` },
      { find: /^routes\//, replacement: `${path.resolve(__dirname, '../src/routes')}/` },
      { find: /^components\//, replacement: `${path.resolve(__dirname, '../src/components')}/` },
    ],
  },
  test: {
    exclude: [
      'build/**',
      'node_modules/**',
      'dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
    setupFiles: [path.resolve(__dirname, '../server/lib/test-setup.ts')],
  },
})
