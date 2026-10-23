import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    // mirror webpack's resolve.modules + alias so client modules are importable in tests
    alias: [
      // webpack inlines the processor as a string (asset/source); point tests at a stub
      {
        find: /^@soundtouchjs\/audio-worklet\/processor$/,
        replacement: path.resolve(__dirname, './test-stubs/soundtouch-processor.ts'),
      },
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
      // scratch specs (e.g. Playwright e2e) live here
      'tmp/**',
    ],
    setupFiles: [
      path.resolve(__dirname, '../server/lib/test-setup.ts'),
      path.resolve(__dirname, './test-setup-client.ts'),
    ],
  },
})
