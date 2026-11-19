import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DatabaseWrapper } from '../lib/Database.js'

describe('provider visibility migration', () => {
  it('makes existing providers public without changing their other settings', () => {
    const db = new DatabaseWrapper(':memory:')

    try {
      db.exec('CREATE TABLE providers (providerId integer PRIMARY KEY, data text NOT NULL);')
      db.run('INSERT INTO providers VALUES (?, ?)', [1, '{"apiKey":"secret","prefs":{"enabled":true}}'])
      const file = fileURLToPath(new URL('../lib/schemas/021-provider-visibility.sql', import.meta.url))
      const up = readFileSync(file, 'utf8').split(/^-- Down/m)[0].replace(/^-- Up/m, '')
      db.exec(up)

      const row = db.get<{ data: string }>('SELECT data FROM providers WHERE providerId = 1')
      expect(JSON.parse(row?.data ?? '')).toEqual({ apiKey: 'secret', prefs: { enabled: true }, visibility: 'public' })
    } finally {
      db.close()
    }
  })
})
