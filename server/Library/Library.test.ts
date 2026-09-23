import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { open, close, db } from '../lib/Database.js'
import Library from './Library.js'
import { deriveNorms } from '../Youtube/metadata.js'
import { ConflictError, NotFoundError, ValidationError } from '../lib/Errors.js'

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

  it('throws ValidationError for empty artist/title and NaN', () => {
    expect(() => Library.updateSong(1, norms('', 'Title'))).toThrowError(ValidationError)
    expect(() => Library.updateSong(1, norms('ABBA', '  '))).toThrowError(ValidationError)
    expect(() => Library.updateSong(Number.NaN, norms('ABBA', 'Title'))).toThrowError(ValidationError)
  })

  it('throws NotFoundError for unknown songIds', () => {
    expect(() => Library.updateSong(999, norms('ABBA', 'Title'))).toThrowError(NotFoundError)
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

describe('Library.deleteSong', () => {
  it('deletes files, rows, queue items and the orphaned artist', () => {
    db.run('INSERT INTO artists (name, nameNorm) VALUES (?, ?)', ['Disposable', 'Disposable'])
    const artistId = Number(db.get<{ artistId: number }>(
      'SELECT artistId FROM artists WHERE nameNorm = ?', ['Disposable'],
    )?.artistId)
    db.run('INSERT INTO songs (artistId, title, titleNorm) VALUES (?, ?, ?)',
      [artistId, 'Bye Bye', 'Bye Bye'])
    const songId = Number(db.get<{ songId: number }>(
      'SELECT songId FROM songs WHERE titleNorm = ?', ['Bye Bye'],
    )?.songId)
    db.run('INSERT INTO media (songId, pathId, relPath, duration) VALUES (?, ?, ?, ?)',
      [songId, 1, ['set1', 'Disposable - Bye Bye.mp3'].join(sep), 200])
    db.run('INSERT INTO songStars (userId, songId) VALUES (?, ?)', [1, songId])
    db.run('INSERT INTO artistStars (userId, artistId) VALUES (?, ?)', [1, artistId])
    db.run('INSERT INTO rooms (name, status) VALUES (?, ?)', ['Room 1', 'open'])
    // queue chain q1 -> q2 (deleted song) -> q3
    db.run('INSERT INTO queue (roomId, songId, userId, prevQueueId) VALUES (?, ?, ?, ?)', [1, 2, 1, null])
    const q1 = Number(db.get<{ queueId: number }>('SELECT last_insert_rowid() AS queueId')?.queueId)
    db.run('INSERT INTO queue (roomId, songId, userId, prevQueueId) VALUES (?, ?, ?, ?)', [1, songId, 1, q1])
    const q2 = Number(db.get<{ queueId: number }>('SELECT last_insert_rowid() AS queueId')?.queueId)
    db.run('INSERT INTO queue (roomId, songId, userId, prevQueueId) VALUES (?, ?, ?, ?)', [1, 2, 1, q2])
    const q3 = Number(db.get<{ queueId: number }>('SELECT last_insert_rowid() AS queueId')?.queueId)
    writeFileSync(abs('set1', 'Disposable - Bye Bye.mp3'), 'audio')
    writeFileSync(abs('set1', 'Disposable - Bye Bye.cdg'), 'graphics')

    Library.cache.version = 123
    Library.deleteSong(songId)

    // files gone, sidecar included
    expect(existsSync(abs('set1', 'Disposable - Bye Bye.mp3'))).toBe(false)
    expect(existsSync(abs('set1', 'Disposable - Bye Bye.cdg'))).toBe(false)
    // rows gone
    expect(db.get('SELECT songId FROM songs WHERE songId = ?', [songId])).toBeUndefined()
    expect(db.get('SELECT mediaId FROM media WHERE songId = ?', [songId])).toBeUndefined()
    expect(db.get('SELECT * FROM songStars WHERE songId = ?', [songId])).toBeUndefined()
    // queue gap closed: q3 now follows q1
    expect(db.get('SELECT queueId FROM queue WHERE queueId = ?', [q2])).toBeUndefined()
    expect(db.get<{ prevQueueId: number }>(
      'SELECT prevQueueId FROM queue WHERE queueId = ?', [q3],
    )?.prevQueueId).toBe(q1)
    // orphaned artist and its stars gone
    expect(db.get('SELECT artistId FROM artists WHERE artistId = ?', [artistId])).toBeUndefined()
    expect(db.get('SELECT * FROM artistStars WHERE artistId = ?', [artistId])).toBeUndefined()
    expect(Library.cache.version).toBeNull()
  })

  it('skips files that are already gone and still deletes rows', () => {
    db.run('INSERT INTO artists (name, nameNorm) VALUES (?, ?)', ['Ghost', 'Ghost'])
    const artistId = Number(db.get<{ artistId: number }>(
      'SELECT artistId FROM artists WHERE nameNorm = ?', ['Ghost'],
    )?.artistId)
    db.run('INSERT INTO songs (artistId, title, titleNorm) VALUES (?, ?, ?)',
      [artistId, 'Vanished', 'Vanished'])
    const songId = Number(db.get<{ songId: number }>(
      'SELECT songId FROM songs WHERE titleNorm = ?', ['Vanished'],
    )?.songId)
    db.run('INSERT INTO media (songId, pathId, relPath, duration) VALUES (?, ?, ?, ?)',
      [songId, 1, ['set1', 'missing-file.mp3'].join(sep), 200])

    Library.deleteSong(songId)

    expect(db.get('SELECT songId FROM songs WHERE songId = ?', [songId])).toBeUndefined()
  })

  it('throws NotFoundError for unknown songIds and ValidationError for NaN', () => {
    expect(() => Library.deleteSong(999)).toThrowError(NotFoundError)
    expect(() => Library.deleteSong(Number.NaN)).toThrowError(ValidationError)
  })
})

describe('Library.deleteMedia', () => {
  const songIdOf = () => Number(db.get<{ songId: number }>(
    'SELECT songId FROM songs WHERE titleNorm = ?', ['Two Ways'],
  )?.songId)

  beforeAll(() => {
    db.run('INSERT INTO artists (name, nameNorm) VALUES (?, ?)', ['Multiversion', 'Multiversion'])
    db.run('INSERT INTO songs (artistId, title, titleNorm) VALUES ((SELECT artistId FROM artists WHERE nameNorm = ?), ?, ?)',
      ['Multiversion', 'Two Ways', 'Two Ways'])
    db.run('INSERT INTO media (songId, pathId, relPath, duration) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
      [songIdOf(), 1, ['set1', 'Multiversion - Two Ways.mp3'].join(sep), 200,
        songIdOf(), 1, ['set2', 'Multiversion - Two Ways.mp4'].join(sep), 210])
    writeFileSync(abs('set1', 'Multiversion - Two Ways.mp3'), 'audio')
    writeFileSync(abs('set1', 'Multiversion - Two Ways.cdg'), 'graphics')
    writeFileSync(abs('set2', 'Multiversion - Two Ways.mp4'), 'video')
  })

  it('deletes a single version keeping the song', () => {
    const mediaId = Number(db.get<{ mediaId: number }>(
      'SELECT mediaId FROM media WHERE songId = ? AND relPath LIKE ?', [songIdOf(), '%.mp3'],
    )?.mediaId)

    const res = Library.deleteMedia(mediaId)

    expect(res).toEqual({ songId: songIdOf() })
    expect(existsSync(abs('set1', 'Multiversion - Two Ways.mp3'))).toBe(false)
    expect(existsSync(abs('set1', 'Multiversion - Two Ways.cdg'))).toBe(false)
    expect(existsSync(abs('set2', 'Multiversion - Two Ways.mp4'))).toBe(true)
    expect(db.get('SELECT songId FROM songs WHERE songId = ?', [songIdOf()])).not.toBeUndefined()
    expect(relPaths(songIdOf()).map(p => p.split(sep).join('/'))).toEqual([
      'set2/Multiversion - Two Ways.mp4',
    ])
  })

  it('purges the whole song when deleting the last version', () => {
    db.run('INSERT INTO queue (roomId, songId, userId, prevQueueId) VALUES (?, ?, ?, ?)',
      [1, songIdOf(), 1, null])
    db.run('INSERT INTO songStars (userId, songId) VALUES (?, ?)', [1, songIdOf()])
    const mediaId = Number(db.get<{ mediaId: number }>(
      'SELECT mediaId FROM media WHERE songId = ?', [songIdOf()],
    )?.mediaId)

    Library.deleteMedia(mediaId)

    expect(existsSync(abs('set2', 'Multiversion - Two Ways.mp4'))).toBe(false)
    expect(db.get('SELECT songId FROM songs WHERE songId = ?', [songIdOf()])).toBeUndefined()
    expect(db.get('SELECT * FROM queue WHERE songId = ?', [songIdOf()])).toBeUndefined()
    expect(db.get('SELECT artistId FROM artists WHERE nameNorm = ?', ['Multiversion'])).toBeUndefined()
  })

  it('throws NotFoundError for unknown mediaIds and ValidationError for NaN', () => {
    expect(() => Library.deleteMedia(999)).toThrowError(NotFoundError)
    expect(() => Library.deleteMedia(Number.NaN)).toThrowError(ValidationError)
  })
})
