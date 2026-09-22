import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { open, close, db } from '../lib/Database.js'
import Library from './Library.js'
import { deriveNorms } from '../Youtube/metadata.js'
import { ConflictError, ValidationError } from '../lib/Errors.js'

let dir: string

const norms = (artist: string, title: string) => ({ artist, title, ...deriveNorms(artist, title) })

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'ke-library-test-'))
  open({ file: join(dir, 'test.sqlite3'), ro: false })

  db.run('INSERT INTO artists (name, nameNorm) VALUES (?, ?), (?, ?)', ['ABBA', 'ABBA', 'Queen', 'Queen'])
  db.run('INSERT INTO songs (artistId, title, titleNorm) VALUES (?, ?, ?), (?, ?, ?)',
    [1, 'Dancing Queen', 'Dancing Queen', 2, 'Bohemian Rhapsody', 'Bohemian Rhapsody'])
  db.run(`INSERT INTO paths (path, priority, data) VALUES (?, ?, ?)`, ['/music', 1, '{}'])
  db.run('INSERT INTO media (songId, pathId, relPath, duration) VALUES (?, ?, ?, ?)', [1, 1, 'abba.mp3', 200])
})

afterAll(() => {
  close()
  rmSync(dir, { recursive: true, force: true })
})

describe('Library.updateSong', () => {
  it('retags the title reusing the same artist', () => {
    Library.updateSong(1, norms('ABBA', 'Dancing Queen (Live)'))

    const row = db.get<{ title: string, titleNorm: string, artistId: number }>(
      'SELECT title, titleNorm, artistId FROM songs WHERE songId = 1',
    )
    expect(row?.title).toBe('Dancing Queen (Live)')
    expect(row?.artistId).toBe(1)
    expect(db.get<{ count: number }>('SELECT COUNT(*) AS count FROM artists')?.count).toBe(2)
  })

  it('reuses an existing artist when the norm matches', () => {
    Library.updateSong(1, norms('Queen', 'Dancing Queen (Live)'))

    const row = db.get<{ artistId: number }>('SELECT artistId FROM songs WHERE songId = 1')
    expect(row?.artistId).toBe(2)
    expect(db.get<{ count: number }>('SELECT COUNT(*) AS count FROM artists')?.count).toBe(2)
  })

  it('creates a new artist when the norm is unknown', () => {
    Library.updateSong(1, norms('Roxette', 'Dancing Queen (Live)'))

    const row = db.get<{ artistId: number, name: string }>(
      'SELECT artists.artistId, artists.name FROM songs INNER JOIN artists USING (artistId) WHERE songId = 1',
    )
    expect(row?.name).toBe('Roxette')
    expect(db.get<{ count: number }>('SELECT COUNT(*) AS count FROM artists')?.count).toBe(3)
  })

  it('trims whitespace', () => {
    Library.updateSong(1, norms('  Roxette  ', '  Dancing Queen (Live)  '))
    const row = db.get<{ title: string }>('SELECT title FROM songs WHERE songId = 1')
    expect(row?.title).toBe('Dancing Queen (Live)')
  })

  it('throws ConflictError when another song already has that artist and title', () => {
    expect(() => Library.updateSong(1, norms('Queen', 'Bohemian Rhapsody')))
      .toThrowError(ConflictError)
  })

  it('throws ValidationError for empty artist/title, unknown songId and NaN', () => {
    expect(() => Library.updateSong(1, norms('', 'Title'))).toThrowError(ValidationError)
    expect(() => Library.updateSong(1, norms('ABBA', '  '))).toThrowError(ValidationError)
    expect(() => Library.updateSong(999, norms('ABBA', 'Title'))).toThrowError(ValidationError)
    expect(() => Library.updateSong(Number.NaN, norms('ABBA', 'Title'))).toThrowError(ValidationError)
  })

  it('invalidates the library cache and getSong reflects the change', () => {
    Library.cache.version = 123
    Library.updateSong(1, norms('Roxette', 'Sleeping In My Car'))

    expect(Library.cache.version).toBeNull()
    expect(Library.getSong(1)[1]?.title).toBe('Sleeping In My Car')
  })
})
