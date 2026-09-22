import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { open, close, db } from '../lib/Database.js'
import Library from './Library.js'
import { deriveNorms } from '../Youtube/metadata.js'
import { ConflictError, ValidationError } from '../lib/Errors.js'

let dir: string
let musicDir: string

const norms = (artist: string, title: string) => ({ artist, title, ...deriveNorms(artist, title) })

const relPaths = (songId: number): string[] => (
  (db.all<{ relPath: string }>('SELECT relPath FROM media WHERE songId = ? ORDER BY relPath', [songId]) ?? [])
    .map(row => row.relPath)
)

const abs = (...parts: string[]) => join(musicDir, ...parts)

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'ke-library-test-'))
  musicDir = join(dir, 'music')
  mkdirSync(join(musicDir, 'set1'), { recursive: true })
  mkdirSync(join(musicDir, 'set2'), { recursive: true })
  open({ file: join(dir, 'test.sqlite3'), ro: false })

  db.run('INSERT INTO artists (name, nameNorm) VALUES (?, ?), (?, ?)', ['ABBA', 'ABBA', 'Queen', 'Queen'])
  db.run('INSERT INTO songs (artistId, title, titleNorm) VALUES (?, ?, ?), (?, ?, ?)',
    [1, 'Dancing Queen', 'Dancing Queen', 2, 'Bohemian Rhapsody', 'Bohemian Rhapsody'])
  db.run('INSERT INTO paths (path, priority, data) VALUES (?, ?, ?)', [musicDir, 1, '{}'])
  db.run('INSERT INTO media (songId, pathId, relPath, duration) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)',
    [1, 1, ['set1', 'ABBA - Dancing Queen.mp3'].join(sep), 200,
      1, 1, ['set2', 'ABBA - Dancing Queen.mp4'].join(sep), 210,
      2, 1, ['set1', 'Queen - Bohemian Rhapsody.mp4'].join(sep), 355])
  db.run('INSERT INTO users (username, password, name, roleId) VALUES (?, ?, ?, ?)',
    ['tester', 'x', 'Tester', 3])
  db.run('INSERT INTO artistStars (userId, artistId) VALUES (?, ?)', [1, 1])

  // real files matching the media rows (mp3+g pair + second copy elsewhere)
  writeFileSync(abs('set1', 'ABBA - Dancing Queen.mp3'), 'audio')
  writeFileSync(abs('set1', 'ABBA - Dancing Queen.cdg'), 'graphics')
  writeFileSync(abs('set2', 'ABBA - Dancing Queen.mp4'), 'video')
  writeFileSync(abs('set1', 'Queen - Bohemian Rhapsody.mp4'), 'video')
})

afterAll(() => {
  close()
  rmSync(dir, { recursive: true, force: true })
})

describe('Library.updateSong', () => {
  it('retags the title reusing the same artist and renames every file', () => {
    Library.updateSong(1, norms('ABBA', 'Dancing Queen (Live)'))

    const row = db.get<{ title: string, titleNorm: string, artistId: number }>(
      'SELECT title, titleNorm, artistId FROM songs WHERE songId = 1',
    )
    expect(row?.title).toBe('Dancing Queen (Live)')
    expect(row?.artistId).toBe(1)
    expect(db.get<{ count: number }>('SELECT COUNT(*) AS count FROM artists')?.count).toBe(2)

    // every media file (in different folders) renamed, cdg sidecar included
    expect(existsSync(abs('set1', 'ABBA - Dancing Queen.mp3'))).toBe(false)
    expect(existsSync(abs('set1', 'ABBA - Dancing Queen.cdg'))).toBe(false)
    expect(existsSync(abs('set2', 'ABBA - Dancing Queen.mp4'))).toBe(false)
    expect(existsSync(abs('set1', 'ABBA - Dancing Queen (Live).mp3'))).toBe(true)
    expect(existsSync(abs('set1', 'ABBA - Dancing Queen (Live).cdg'))).toBe(true)
    expect(existsSync(abs('set2', 'ABBA - Dancing Queen (Live).mp4'))).toBe(true)
    expect(relPaths(1).map(p => p.split(sep).join('/'))).toEqual([
      'set1/ABBA - Dancing Queen (Live).mp3',
      'set2/ABBA - Dancing Queen (Live).mp4',
    ])
  })

  it('reuses an existing artist and removes the orphaned one with its stars', () => {
    Library.updateSong(1, norms('Queen', 'Dancing Queen (Live)'))

    const row = db.get<{ artistId: number }>('SELECT artistId FROM songs WHERE songId = 1')
    expect(row?.artistId).toBe(2)

    // ABBA has no songs left: artist row and its stars are gone
    expect(db.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM artists WHERE name = ?',
      ['ABBA'],
    )?.count).toBe(0)
    expect(db.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM artistStars WHERE artistId = ?',
      [1],
    )?.count).toBe(0)
    expect(db.get<{ count: number }>('SELECT COUNT(*) AS count FROM artists')?.count).toBe(1)

    expect(existsSync(abs('set1', 'Queen - Dancing Queen (Live).mp3'))).toBe(true)
    expect(existsSync(abs('set1', 'Queen - Dancing Queen (Live).cdg'))).toBe(true)
    expect(existsSync(abs('set2', 'Queen - Dancing Queen (Live).mp4'))).toBe(true)
  })

  it('creates a new artist when the norm is unknown', () => {
    Library.updateSong(1, norms('Roxette', 'Dancing Queen (Live)'))

    const row = db.get<{ artistId: number, name: string }>(
      'SELECT artists.artistId, artists.name FROM songs INNER JOIN artists USING (artistId) WHERE songId = 1',
    )
    expect(row?.name).toBe('Roxette')
    expect(db.get<{ count: number }>('SELECT COUNT(*) AS count FROM artists')?.count).toBe(2)
    expect(existsSync(abs('set1', 'Roxette - Dancing Queen (Live).mp3'))).toBe(true)
    expect(existsSync(abs('set1', 'Roxette - Dancing Queen (Live).cdg'))).toBe(true)
  })

  it('trims whitespace', () => {
    Library.updateSong(1, norms('  Roxette  ', '  Dancing Queen (Live)  '))
    const row = db.get<{ title: string }>('SELECT title FROM songs WHERE songId = 1')
    expect(row?.title).toBe('Dancing Queen (Live)')
  })

  it('throws ConflictError when another song already has that artist and title, changing nothing', () => {
    expect(() => Library.updateSong(1, norms('Queen', 'Bohemian Rhapsody')))
      .toThrowError(ConflictError)

    // no orphaned artist created by the failed update, files untouched
    expect(db.get<{ count: number }>('SELECT COUNT(*) AS count FROM artists')?.count).toBe(2)
    expect(db.get<{ title: string }>('SELECT title FROM songs WHERE songId = 1')?.title)
      .toBe('Dancing Queen (Live)')
    expect(existsSync(abs('set1', 'Roxette - Dancing Queen (Live).mp3'))).toBe(true)
  })

  it('throws ConflictError when a destination file exists, changing nothing', () => {
    writeFileSync(abs('set1', 'Roxette - Clash.mp3'), 'blocking file')

    expect(() => Library.updateSong(1, norms('Roxette', 'Clash')))
      .toThrowError(ConflictError)

    expect(db.get<{ title: string }>('SELECT title FROM songs WHERE songId = 1')?.title)
      .toBe('Dancing Queen (Live)')
    expect(relPaths(1).map(p => p.split(sep).join('/'))).toEqual([
      'set1/Roxette - Dancing Queen (Live).mp3',
      'set2/Roxette - Dancing Queen (Live).mp4',
    ])
    expect(existsSync(abs('set1', 'Roxette - Dancing Queen (Live).mp3'))).toBe(true)
    expect(existsSync(abs('set1', 'Roxette - Clash.mp3'))).toBe(true)
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
    expect(existsSync(abs('set1', 'Roxette - Sleeping In My Car.mp3'))).toBe(true)
  })
})

describe('Library.findSong', () => {
  it('finds a song by normalized artist and title without creating anything', () => {
    const { artistNorm, titleNorm } = deriveNorms('Queen', 'Bohemian Rhapsody')

    expect(Library.findSong(artistNorm, titleNorm)).toBe(2)
    expect(db.get<{ count: number }>('SELECT COUNT(*) AS count FROM artists')?.count).toBe(2)
  })

  it('returns null for unknown artists or titles', () => {
    expect(Library.findSong(...Object.values(deriveNorms('Nobody', 'Nothing')) as [string, string])).toBeNull()

    const { titleNorm } = deriveNorms('Queen', 'No Such Title')
    const { artistNorm } = deriveNorms('Queen', 'Bohemian Rhapsody')
    expect(Library.findSong(artistNorm, titleNorm)).toBeNull()
  })
})
