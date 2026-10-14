import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// all message IDs must be defined exactly once, in a messages.ts catalogue
// next to the code that uses them (or src/lib/messages.ts for shared
// ones); es.json (minus server.* keys) must contain exactly those IDs.
// UI copy never lives inline: no defaultMessage literals are allowed
// outside catalogue files.
const collectDefinedIds = (source: string): string[] => {
  const ids: string[] = []
  const pattern = /\bid\s*:\s*['"]([^'"]*\.[^'"]*)['"]/g

  let match: RegExpExecArray | null

  while ((match = pattern.exec(source)) !== null) {
    ids.push(match[1])
  }

  return ids
}

function walkFiles (dir: string, exts: string[]): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)

    if (entry.isDirectory()) return walkFiles(full, exts)

    return entry.isFile() && exts.some(ext => full.endsWith(ext)) ? [full] : []
  })
}

describe('locale parity', () => {
  it('es.json matches exactly the IDs defined in messages.ts catalogues', () => {
    const root = path.resolve(__dirname, '../..')
    const catalogues = walkFiles(path.join(root, 'src'), ['.ts'])
      .filter(file => file.endsWith('/messages.ts'))
    const defined = new Set<string>()

    for (const file of catalogues) {
      const source = fs.readFileSync(file, 'utf8')

      for (const id of collectDefinedIds(source)) defined.add(id)
    }

    expect(catalogues.length).toBeGreaterThan(0)

    const es = JSON.parse(fs.readFileSync(path.join(root, 'shared/locales/es.json'), 'utf8')) as Record<string, string>
    const keys = new Set(Object.keys(es).filter(key => !key.startsWith('server.')))

    expect([...defined].filter(id => !keys.has(id))).toEqual([])
    expect([...keys].filter(key => !defined.has(key))).toEqual([])
  })
})
