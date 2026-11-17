import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DatabaseWrapper } from '../lib/Database.js'

describe('song tags migration', () => {
  it('turns the union of every user\'s defect marks into one admin tag', () => {
    const db = new DatabaseWrapper(':memory:')
    try {
      db.exec(`CREATE TABLE songs (songId integer PRIMARY KEY);
        CREATE TABLE users (userId integer PRIMARY KEY, permissions text);
        CREATE TABLE songFlaws (userId integer, songId integer);`)
      db.exec('INSERT INTO songs VALUES (1), (2), (3); INSERT INTO songFlaws VALUES (1, 1), (2, 1), (2, 2);')
      db.run('INSERT INTO users (userId, permissions) VALUES (?, ?)', [1, '{"songFlaws":true,"queueMove":true}'])
      const file = fileURLToPath(new URL('../lib/schemas/019-song-tags.sql', import.meta.url))
      const up = readFileSync(file, 'utf8').split(/^-- Down/m)[0].replace(/^-- Up/m, '')
      db.exec(up)
      const tag = db.get<{ tagId: number, name: string, visibility: string }>('SELECT * FROM tags')
      expect(tag).toMatchObject({ name: 'error', visibility: 'admin' })
      expect(db.all('SELECT songId FROM songTags ORDER BY songId')).toEqual([{ songId: 1 }, { songId: 2 }])
      expect(db.get('SELECT name FROM sqlite_master WHERE name = \'songFlaws\'')).toBeUndefined()
      expect(db.get<{ permissions: string }>('SELECT permissions FROM users WHERE userId = 1')?.permissions).toBe('{"queueMove":true}')
    } finally {
      db.close()
    }
  })
})
