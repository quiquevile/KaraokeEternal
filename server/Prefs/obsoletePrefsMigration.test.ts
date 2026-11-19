import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DatabaseWrapper } from '../lib/Database.js'

describe('obsolete download settings migration', () => {
  it('removes former settings and permissions while preserving other values', () => {
    const db = new DatabaseWrapper(':memory:')

    try {
      db.exec('CREATE TABLE prefs (key text PRIMARY KEY, data text); CREATE TABLE users (userId integer PRIMARY KEY, permissions text);')
      db.run('INSERT INTO prefs (key, data) VALUES (?, ?)', ['youtubeYtdlDir', '"/bin"'])
      db.run('INSERT INTO prefs (key, data) VALUES (?, ?)', ['youtubeDownloadPathId', '1'])
      db.run('INSERT INTO prefs (key, data) VALUES (?, ?)', ['youtubeDlExtraArgs', '""'])
      db.run('INSERT INTO prefs (key, data) VALUES (?, ?)', ['isReplayGainEnabled', 'true'])
      db.run('INSERT INTO users (userId, permissions) VALUES (?, ?)', [1, '{"youtubeDownload":true,"downloadForOthers":true,"queueForOthers":true}'])

      const file = fileURLToPath(new URL('../lib/schemas/020-remove-youtube-downloads.sql', import.meta.url))
      const up = readFileSync(file, 'utf8').split(/^-- Down/m)[0].replace(/^-- Up/m, '')
      db.exec(up)

      expect(db.all('SELECT key, data FROM prefs')).toEqual([{ key: 'isReplayGainEnabled', data: 'true' }])
      expect(db.get<{ permissions: string }>('SELECT permissions FROM users WHERE userId = 1')?.permissions)
        .toBe('{"queueForOthers":true}')
    } finally {
      db.close()
    }
  })
})
