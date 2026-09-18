import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
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
