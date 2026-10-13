import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// source files already migrated to react-intl: every literal `id` used
// must exist in es.json, and es.json must not carry dead keys.
// Extend this list as each area migrates.
const MIGRATED_FILES = [
  'src/routes/Account/views/SignedOutView/SignIn/SignIn.tsx',
  'src/routes/Account/views/SignedOutView/Create/Create.tsx',
  'src/routes/Account/views/SignedOutView/SelectRoom/SelectRoom.tsx',
  'src/routes/Account/views/SignedOutView/SignedOutView.tsx',
  'src/routes/Account/views/FirstRun/FirstRun.tsx',
]

const collectIds = (source: string): string[] => {
  const ids: string[] = []
  const pattern = /\bid\s*[:=]\s*['"]([^'"]+)['"]/g

  let match: RegExpExecArray | null

  while ((match = pattern.exec(source)) !== null) {
    ids.push(match[1])
  }

  return ids
}

describe('locale parity', () => {
  it('es.json matches exactly the IDs used by migrated files', () => {
    const root = path.resolve(__dirname, '../..')
    const used = new Set<string>()

    for (const file of MIGRATED_FILES) {
      const source = fs.readFileSync(path.join(root, file), 'utf8')

      for (const id of collectIds(source)) used.add(id)
    }

    const es = JSON.parse(fs.readFileSync(path.join(root, 'shared/locales/es.json'), 'utf8')) as Record<string, string>
    const keys = new Set(Object.keys(es))

    expect([...used].filter(id => !keys.has(id))).toEqual([])
    expect([...keys].filter(key => !used.has(key))).toEqual([])
  })
})
