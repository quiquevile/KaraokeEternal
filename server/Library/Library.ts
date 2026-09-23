import sql from 'sqlate'
import fs from 'fs'
import path from 'path'
import { db } from '../lib/Database.js'
import getLogger from '../lib/Log.js'
import getCdgName from '../lib/getCdgName.js'
import { assertNoRenameClash, atomicRenameAll } from '../lib/fsUtils.js'
import { ConflictError, DUPLICATE_SONG_MESSAGE, NotFoundError, ValidationError } from '../lib/Errors.js'
import { performance } from 'perf_hooks'
import { Song, Artist } from '../../shared/types.js'
import Media from '../Media/Media.js'
import { toFilename } from '../Youtube/metadata.js'

const log = getLogger('Library')

class Library {
  static cache: {
    version: number | null
    artists?: { result: number[], entities: Record<number, Artist> }
    songs?: { result: number[], entities: Record<number, Song> }
  } = { version: null }

  static starCountsCache: {
    version: number | null
    artists?: Record<number, number>
    songs?: Record<number, number>
  } = { version: null }

  /**
  * Get artists and songs in a format suitable for sending to clients.
  * Should not include songs or artists for which there are no media.
  */
  static get (): typeof Library.cache {
    // already cached?
    if (this.cache.version) return this.cache

    const startTime = performance.now()

    const SongIdsByArtist = {}
    const artists = {
      result: [],
      entities: {},
    }
    const songs = {
      result: [],
      entities: {},
    }

    // query #1: songs
    {
      const query = sql`
        SELECT duration, songs.artistId AS artistId, songs.songId AS songId, songs.title AS title,
          MAX(isPreferred) AS isPreferred, COUNT(DISTINCT media.mediaId) AS numMedia
        FROM media
          INNER JOIN songs USING (songId)
          INNER JOIN paths USING (pathId)
        GROUP BY songId
        ORDER BY songs.titleNorm, paths.priority ASC
      `
      const rows = db.all<Song & { isPreferred: number }>(String(query), query.parameters)

      for (const row of rows) {
        delete row.isPreferred
        songs.entities[row.songId] = row
        songs.result.push(row.songId)

        // add to artist's songIds
        if (typeof SongIdsByArtist[row.artistId] === 'undefined') {
          SongIdsByArtist[row.artistId] = []
        }

        SongIdsByArtist[row.artistId].push(row.songId)
      }
    }

    // query #2: artists
    {
      const query = sql`
        SELECT artistId, name
        FROM artists
        ORDER BY nameNorm ASC
      `
      const rows = db.all<Artist>(String(query), query.parameters)

      for (const row of rows) {
        if (SongIdsByArtist[row.artistId]) {
          artists.result.push(row.artistId)
          artists.entities[row.artistId] = row
          artists.entities[row.artistId].songIds = SongIdsByArtist[row.artistId]
        }
      }
    }

    log.info('built library cache in %sms', (performance.now() - startTime).toFixed(3))

    // cache result
    this.cache = {
      artists,
      songs,
      version: Date.now(),
    }

    return this.cache
  }

  /**
  * Get single song in format similar to get()
  */
  static getSong (songId: number): Record<number, Song> {
    const { result, entities } = Media.search({ songId })
    if (!result.length) return {}

    // should be in order of path priority...
    let media = entities[result[0]]

    // ...but are any preferred?
    for (const mediaId of result) {
      if (entities[mediaId].isPreferred) media = entities[mediaId]
    }

    return {
      [songId]: {
        artistId: media.artistId,
        duration: media.duration,
        songId: media.songId,
        title: media.title,
        numMedia: result.length,
      },
    }
  }

  /**
  * Matches an existing artist by norm or creates it
  */
  static matchArtist (parsed: { artist: string, artistNorm: string }): {
    artistId: number
    artist: string
    artistNorm: string
  } {
    const query = sql`
      SELECT *
      FROM artists
      WHERE nameNorm = ${parsed.artistNorm}
    `
    const row = db.get<{ artistId: number, name: string, nameNorm: string }>(String(query), query.parameters)

    if (row) {
      log.debug('matched artist: %s', row.name)
      return { artistId: row.artistId, artist: row.name, artistNorm: row.nameNorm }
    }

    log.debug('new artist: %s', parsed.artist)

    const fields = new Map()
    fields.set('name', parsed.artist)
    fields.set('nameNorm', parsed.artistNorm)

    const insert = sql`
      INSERT INTO artists ${sql.tuple(Array.from(fields.keys()).map(sql.column))}
      VALUES ${sql.tuple(Array.from(fields.values()))}
    `
    const res = db.run(String(insert), insert.parameters)

    if (!Number.isInteger(res.lastID)) {
      throw new Error('invalid artistId after insert')
    }

    return { artistId: res.lastID as number, artist: parsed.artist, artistNorm: parsed.artistNorm }
  }

  /**
  * Matches or creates artist and song
  */
  static matchSong (parsed: { artist: string, artistNorm: string, title: string, titleNorm: string }): {
    artistId?: number
    artist?: string
    artistNorm?: string
    songId?: number
    title?: string
    titleNorm?: string
  } {
    const match: { artistId?: number, artist?: string, artistNorm?: string, songId?: number, title?: string, titleNorm?: string } = {}

    // match artist
    {
      const artist = Library.matchArtist(parsed)
      match.artistId = artist.artistId
      match.artist = artist.artist
      match.artistNorm = artist.artistNorm
    }

    // match song title
    {
      const query = sql`
        SELECT *
        FROM songs
        WHERE artistId = ${match.artistId} AND titleNorm = ${parsed.titleNorm}
      `
      const row = db.get<{ songId: number, title: string, titleNorm: string }>(String(query), query.parameters)

      if (row) {
        log.debug('matched song: %s', row.title)
        match.songId = row.songId
        match.title = row.title
        match.titleNorm = row.titleNorm
      } else {
        log.debug('new song: %s', parsed.title)

        const fields = new Map()
        fields.set('artistId', match.artistId)
        fields.set('title', parsed.title)
        fields.set('titleNorm', parsed.titleNorm)

        const query = sql`
          INSERT INTO songs ${sql.tuple(Array.from(fields.keys()).map(sql.column))}
          VALUES ${sql.tuple(Array.from(fields.values()))}
        `
        const res = db.run(String(query), query.parameters)

        if (!Number.isInteger(res.lastID)) {
          throw new Error('invalid songId after insert')
        }

        match.songId = res.lastID
        match.title = parsed.title
        match.titleNorm = parsed.titleNorm
      }
    }

    return match
  }

  /**
  * Finds a song by normalized artist + title without creating anything.
  * Returns the songId, or null when there is no match.
  */
  static findSong (artistNorm: string, titleNorm: string): number | null {
    const artistLookup = sql`SELECT artistId FROM artists WHERE nameNorm = ${artistNorm}`
    const artist = db.get<{ artistId: number }>(String(artistLookup), artistLookup.parameters)

    if (!artist) return null

    const songLookup = sql`SELECT songId FROM songs WHERE artistId = ${artist.artistId} AND titleNorm = ${titleNorm}`
    const song = db.get<{ songId: number }>(String(songLookup), songLookup.parameters)

    return song?.songId ?? null
  }

  /**
  * Retags a song (admin only): updates its artist/title, matching or
  * creating the artist as needed, and renames its media files to match
  * (`Artist - Title.ext`, same format as downloads). Throws ConflictError
  * if another song already has the resulting artist + title, or if any
  * destination file already exists (nothing is changed in that case).
  * Artists left without songs are removed (their stars are lost with them).
  */
  static updateSong (songId: number, parsed: { artist: string, artistNorm: string, title: string, titleNorm: string }): void {
    if (!Number.isInteger(songId)) {
      throw new ValidationError('Invalid songId')
    }

    const artist = parsed.artist?.trim()
    const title = parsed.title?.trim()

    if (!artist || !title) {
      throw new ValidationError('Artist and title are required')
    }

    const existingQuery = sql`SELECT artistId AS oldArtistId FROM songs WHERE songId = ${songId}`
    const song = db.get<{ oldArtistId: number }>(String(existingQuery), existingQuery.parameters)

    if (!song) {
      throw new NotFoundError(`songId ${songId} not found`)
    }

    // resolve the target artist without creating it yet, so that a
    // conflict doesn't leave an orphaned artist row behind
    const clash = Library.findSong(parsed.artistNorm, parsed.titleNorm)

    if (clash !== null && clash !== songId) {
      throw new ConflictError(DUPLICATE_SONG_MESSAGE)
    }

    const resolved = Library.matchArtist({ artist, artistNorm: parsed.artistNorm })

    // resolve media files and their new names
    const { result, entities } = Media.search({ songId })
    const renames: Array<{ mediaId: number, from: string, to: string, newRelPath: string }> = []

    for (const mediaId of result) {
      const media = entities[mediaId]
      const from = path.join(media.path, ...media.relPath.split('/'))
      const dir = path.posix.dirname(media.relPath)
      const newRelPath = (dir === '.' ? '' : `${dir}/`)
        + toFilename(resolved.artist, title)
        + path.posix.extname(media.relPath)
      const to = path.join(media.path, ...newRelPath.split('/'))

      if (!fs.existsSync(from)) {
        throw new Error(`media file not found: ${from}`)
      }

      renames.push({ mediaId, from, to, newRelPath })

      // mp3+g sidecar travels with its audio file
      const cdg = getCdgName(from)

      if (cdg) {
        const cdgTo = to.substring(0, to.lastIndexOf('.') + 1) + cdg.substring(cdg.lastIndexOf('.') + 1)
        renames.push({ mediaId, from: cdg, to: cdgTo, newRelPath: '' })
      }
    }

    // rename files (asserted clash-free above, rolls back on failure)
    assertNoRenameClash(renames)
    atomicRenameAll(renames)

    const rollbackFiles = () => {
      atomicRenameAll(renames.map(({ from, to }) => ({ from: to, to: from })))
    }

    // update db in a single transaction
    try {
      db.transaction(() => {
        const query = sql`
          UPDATE songs
          SET artistId = ${resolved.artistId}, title = ${title}, titleNorm = ${parsed.titleNorm}
          WHERE songId = ${songId}
        `
        db.run(String(query), query.parameters)

        for (const { mediaId, newRelPath } of renames) {
          if (!newRelPath) continue // sidecar: no db row

          const mediaQuery = sql`
            UPDATE media
            SET relPath = ${newRelPath}
            WHERE mediaId = ${mediaId}
          `
          db.run(String(mediaQuery), mediaQuery.parameters)
        }

        // drop the previous artist if it has no songs left (its stars go with it)
        if (song.oldArtistId !== resolved.artistId) {
          Library.dropOrphanArtist(song.oldArtistId)
        }
      })
    } catch (err) {
      rollbackFiles()
      throw err
    }

    // library cache holds song/artist entities: force a rebuild
    Library.cache.version = null

    log.debug('updated song %s: %s - %s', songId, artist, title)
  }

  /**
  * Drops an artist left without songs (its stars are lost with it).
  * Runs inside the caller's transaction.
  */
  static dropOrphanArtist (artistId: number): void {
    const remainingQuery = sql`SELECT songId FROM songs WHERE artistId = ${artistId} LIMIT 1`
    const remaining = db.get<{ songId: number }>(String(remainingQuery), remainingQuery.parameters)

    if (!remaining) {
      const deleteStars = sql`DELETE FROM artistStars WHERE artistId = ${artistId}`
      db.run(String(deleteStars), deleteStars.parameters)

      const deleteArtist = sql`DELETE FROM artists WHERE artistId = ${artistId}`
      db.run(String(deleteArtist), deleteArtist.parameters)
    }
  }

  /**
  * Removes every row belonging to a song: queue items in all rooms
  * (closing each linked-list gap, as in Queue.remove), media, song and
  * song stars, plus the artist when orphaned. Runs inside the caller's
  * transaction.
  */
  static purgeSongRows (songId: number, artistId: number): void {
    const queueQuery = sql`SELECT queueId, prevQueueId FROM queue WHERE songId = ${songId}`
    const queueRows = db.all<{ queueId: number, prevQueueId: number | null }>(
      String(queueQuery), queueQuery.parameters,
    )

    for (const { queueId, prevQueueId } of queueRows) {
      const deleteQuery = sql`
        DELETE FROM queue
        WHERE queueId = ${queueId}
      `
      db.run(String(deleteQuery), deleteQuery.parameters)

      const updateQuery = sql`
        UPDATE queue
        SET prevQueueId = ${prevQueueId}
        WHERE prevQueueId = ${queueId}
      `
      db.run(String(updateQuery), updateQuery.parameters)
    }

    const { result } = Media.search({ songId })
    Media.remove([...result])

    const deleteSongStars = sql`DELETE FROM songStars WHERE songId = ${songId}`
    db.run(String(deleteSongStars), deleteSongStars.parameters)

    const deleteSong = sql`DELETE FROM songs WHERE songId = ${songId}`
    db.run(String(deleteSong), deleteSong.parameters)

    Library.dropOrphanArtist(artistId)
  }

  /**
  * Resolves a song's media files on disk (mp3+g sidecars travel with
  * their audio file).
  */
  static songFiles (songId: number): string[] {
    const { result, entities } = Media.search({ songId })
    const files: string[] = []

    for (const mediaId of result) {
      const media = entities[mediaId]
      const file = path.join(media.path, ...media.relPath.split('/'))
      files.push(file)

      const cdg = getCdgName(file)

      if (cdg) files.push(cdg)
    }

    return files
  }

  /**
  * Deletes files from disk, skipping the ones that are already gone.
  */
  static deleteFiles (files: string[]): void {
    for (const file of files) {
      try {
        fs.unlinkSync(file)
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') throw err

        log.debug('file already gone: %s', file)
      }
    }
  }

  /**
  * Deletes a song (admin only): removes its media files from disk, its
  * queue items in every room, and its song/media/star rows. Artists left
  * without songs are removed (their stars are lost with them). Files
  * that are already gone from disk are skipped.
  */
  static deleteSong (songId: number): void {
    if (!Number.isInteger(songId)) {
      throw new ValidationError('Invalid songId')
    }

    const existingQuery = sql`SELECT artistId FROM songs WHERE songId = ${songId}`
    const song = db.get<{ artistId: number }>(String(existingQuery), existingQuery.parameters)

    if (!song) {
      throw new NotFoundError(`songId ${songId} not found`)
    }

    // delete files first; missing files are already gone, so skip them
    Library.deleteFiles(Library.songFiles(songId))

    // everything else in a single transaction
    db.transaction(() => {
      Library.purgeSongRows(songId, song.artistId)
    })

    // library cache holds song/artist entities: force a rebuild
    Library.cache.version = null

    log.debug('deleted song %s', songId)
  }

  /**
  * Deletes a single media version (admin only): removes its file from
  * disk and its media row. When it was the song's last version, the
  * whole song is purged as in deleteSong.
  */
  static deleteMedia (mediaId: number): { songId: number } {
    if (!Number.isInteger(mediaId)) {
      throw new ValidationError('Invalid mediaId')
    }

    const found = Media.search({ mediaId })

    if (!found.result.length) {
      throw new NotFoundError(`mediaId ${mediaId} not found`)
    }

    const media = found.entities[mediaId]
    const file = path.join(media.path, ...media.relPath.split('/'))
    const files = [file]
    const cdg = getCdgName(file)

    if (cdg) files.push(cdg)

    const songQuery = sql`SELECT artistId FROM songs WHERE songId = ${media.songId}`
    const song = db.get<{ artistId: number }>(String(songQuery), songQuery.parameters)

    if (!song) {
      throw new NotFoundError(`songId ${media.songId} not found`)
    }

    Library.deleteFiles(files)

    db.transaction(() => {
      const deleteQuery = sql`DELETE FROM media WHERE mediaId = ${mediaId}`
      db.run(String(deleteQuery), deleteQuery.parameters)

      const remainingQuery = sql`SELECT mediaId FROM media WHERE songId = ${media.songId} LIMIT 1`
      const remaining = db.get<{ mediaId: number }>(String(remainingQuery), remainingQuery.parameters)

      if (!remaining) {
        Library.purgeSongRows(media.songId, song.artistId)
      }
    })

    // library cache holds song/artist entities: force a rebuild
    Library.cache.version = null

    log.debug('deleted media %s (song %s)', mediaId, media.songId)

    return { songId: media.songId }
  }

  /**
  * Gets a user's starred artists and songs
  */
  static getUserStars (userId: number): { starredArtists: number[], starredSongs: number[] } {
    let starredArtists, starredSongs

    // get starred artists
    {
      const query = sql`
        SELECT artistId
        FROM artistStars
        WHERE userId = ${userId}
      `
      const rows = db.all<{ artistId: number }>(String(query), query.parameters)

      starredArtists = rows.map(row => row.artistId)
    }

    // get starred songs
    {
      const query = sql`
        SELECT songId
        FROM songStars
        WHERE userId = ${userId}
      `
      const rows = db.all<{ songId: number }>(String(query), query.parameters)

      starredSongs = rows.map(row => row.songId)
    }

    return { starredArtists, starredSongs }
  }

  /**
  * Add a user's star to a song
  */
  static starSong (songId: number, userId: number): number {
    const fields = new Map()
    fields.set('songId', songId)
    fields.set('userId', userId)

    const query = sql`
      INSERT OR IGNORE INTO songStars ${sql.tuple(Array.from(fields.keys()).map(sql.column))}
      VALUES ${sql.tuple(Array.from(fields.values()))}
    `
    const res = db.run(String(query), query.parameters)

    if (res.changes) {
      // invalidate cache
      this.starCountsCache.version = null
    }

    return res.changes
  }

  /**
  * Remove a user's star from a song
  */
  static unstarSong (songId: number, userId: number): number {
    const query = sql`
      DELETE FROM songStars
      WHERE userId = ${userId} AND songId = ${songId}
    `
    const res = db.run(String(query), query.parameters)

    if (res.changes) {
      // invalidate cache
      this.starCountsCache.version = null
    }

    return res.changes
  }

  /**
  * Gets artist and song star counts
  */
  static getStarCounts (): typeof Library.starCountsCache {
    // already cached?
    if (this.starCountsCache.version) return this.starCountsCache

    const startTime = performance.now()

    const artists = {}
    const songs = {}

    // get artist star counts
    {
      const query = sql`
        SELECT artistId, COUNT(userId) AS count
        FROM artistStars
        GROUP BY artistId
      `
      const rows = db.all<{ artistId: number, count: number }>(String(query), query.parameters)

      rows.forEach((row) => {
        artists[row.artistId] = row.count
      })
    }

    // get song star counts
    {
      const query = sql`
        SELECT songId, COUNT(userId) AS count
        FROM songStars
        GROUP BY songId
      `
      const rows = db.all<{ songId: number, count: number }>(String(query), query.parameters)

      rows.forEach((row) => {
        songs[row.songId] = row.count
      })
    }

    log.info('built star count cache in %sms', (performance.now() - startTime).toFixed(3))

    this.starCountsCache = {
      artists,
      songs,
      version: Date.now(),
    }

    return this.starCountsCache
  }
}

export default Library
