import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { open, close, db } from '../lib/Database.js'
import Media from './Media.js'

let dir: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'ke-media-test-'))
  open({ file: join(dir, 'test.sqlite3'), ro: false })

  db.run('INSERT INTO paths (path, priority, data) VALUES (?, ?, ?)', ['/media', 1, '{}'])
  db.run('INSERT INTO artists (name, nameNorm) VALUES (?, ?)', ['ABBA', 'ABBA'])
  db.run('INSERT INTO songs (artistId, title, titleNorm) VALUES (?, ?, ?)', [1, 'Dancing Queen', 'Dancing Queen'])
  db.run('INSERT INTO media (songId, pathId, relPath, duration, dateUpdated) VALUES (?, ?, ?, ?, ?)',
    [1, 1, 'ABBA - Dancing Queen.mp3', 200, 1790000000])
  db.run('INSERT INTO media (songId, pathId, relPath, duration) VALUES (?, ?, ?, ?)',
    [1, 1, 'ABBA - Dancing Queen.mp4', 210])
})

afterAll(() => {
  close()
  rmSync(dir, { recursive: true, force: true })
})

describe('Media.scanRows', () => {
  it('creates the scan-cache indexes', () => {
    const row = db.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM sqlite_master WHERE name IN ('idxMediaPathRelPath', 'idxMediaPath', 'idxSongArtistTitleNorm')",
    )

    expect(row?.count).toBe(3)
  })

  it('returns rows keyed by relPath for one path', () => {
    const rows = Media.scanRows(1)

    expect(Object.keys(rows).sort()).toEqual(['ABBA - Dancing Queen.mp3', 'ABBA - Dancing Queen.mp4'])
    expect(rows['ABBA - Dancing Queen.mp3']).toMatchObject({
      mediaId: expect.any(Number),
      songId: 1,
      pathId: 1,
      duration: 200,
      dateUpdated: 1790000000,
    })
  })

  it('returns an empty map for unknown paths', () => {
    expect(Media.scanRows(999)).toEqual({})
  })
})
