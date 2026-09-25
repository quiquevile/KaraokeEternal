import path from 'path'
import { db } from '../lib/Database.js'
import sql from 'sqlate'
import { NotFoundError, ValidationError } from '../lib/Errors.js'
import { QueueItem } from '../../shared/types.js'

class Queue {
  /**
   * Add a songId to a room's queue
   */
  static add ({ roomId, songId, userId }: { roomId: number, songId: number, userId: number }): void {
    const fields = new Map()
    fields.set('roomId', roomId)
    fields.set('songId', songId)
    fields.set('userId', userId)
    fields.set('prevQueueId', sql`(
      SELECT queueId
      FROM queue
      WHERE roomId = ${roomId} AND queueId NOT IN (
        SELECT prevQueueId
        FROM queue
        WHERE prevQueueId IS NOT NULL
      )
    )`)

    const query = sql`
      INSERT INTO queue ${sql.tuple(Array.from(fields.keys()).map(sql.column))}
      VALUES ${sql.tuple(Array.from(fields.values()))}
    `
    const res = db.run(String(query), query.parameters)

    if (res.changes !== 1) {
      throw new Error('Could not add song to queue')
    }
  }

  /**
   * Get queued items for a given room
   */
  static get (roomId: number): { result: number[], entities: Record<number, QueueItem> } {
    const result: number[] = []
    const entities: Record<number, any> = {}
    const map = new Map()
    const pathData = new Map()
    let curQueueId = null

    const query = sql`
      SELECT queueId, songId, userId, prevQueueId,
        media.mediaId, media.relPath, media.rgTrackGain, media.rgTrackPeak,
        users.name AS userDisplayName, users.dateUpdated AS userDateUpdated,
        paths.pathId, paths.data AS pathData,
        MAX(isPreferred) AS isPreferred
      FROM queue
        INNER JOIN users USING(userId)
        INNER JOIN media USING(songId)
        INNER JOIN paths USING(pathId)
      WHERE roomId = ${roomId}
      GROUP BY queueId
      ORDER BY queueId, paths.priority ASC
    `
    const rows = db.all<{
      queueId: number
      songId: number
      userId: number
      prevQueueId: number
      mediaId: number
      relPath: string
      rgTrackGain: number
      rgTrackPeak: number
      userDisplayName: string
      userDateUpdated: number
      pathId: number
      pathData: string
      isPreferred: number
    }>(String(query), query.parameters)

    for (const row of rows) {
      if (!pathData.has(row.pathId)) {
        pathData.set(row.pathId, JSON.parse(row.pathData))
      }

      const pathPrefs = pathData.get(row.pathId)?.prefs

      entities[row.queueId] = row
      entities[row.queueId].mediaType = this.getType(row.relPath)
      entities[row.queueId].isVideoKeyingEnabled = !!pathPrefs?.isVideoKeyingEnabled

      // don't send over the wire
      delete entities[row.queueId].relPath
      delete entities[row.queueId].isPreferred
      delete entities[row.queueId].pathData

      if (row.prevQueueId === null) {
        // found the first item
        result.push(row.queueId)
        curQueueId = row.queueId
      } else {
        // map indexed by prevQueueId
        map.set(row.prevQueueId, row.queueId)
      }
    }

    while (result.length < rows.length) {
      // get the item whose prevQueueId references the current one;
      // a corrupt chain ends the walk instead of crashing or spinning
      const nextQueueId = map.get(curQueueId)

      if (nextQueueId === undefined || !entities[nextQueueId]) break

      result.push(entities[nextQueueId].queueId)
      curQueueId = nextQueueId
    }

    return { result, entities }
  }

  /**
  * Move a queue item after another one (or to the head with null)
  */
  static move ({ prevQueueId, queueId, roomId }: { prevQueueId: number | null, queueId: number, roomId: number }): void {
    if (queueId === prevQueueId) {
      throw new ValidationError('Invalid prevQueueId')
    }

    if (prevQueueId === -1) prevQueueId = null

    const currentQuery = sql`
      SELECT prevQueueId
      FROM queue
      WHERE queueId = ${queueId} AND roomId = ${roomId}
    `
    const current = db.get<{ prevQueueId: number | null }>(String(currentQuery), currentQuery.parameters)

    if (!current) {
      throw new NotFoundError(`queueId ${queueId} not found`)
    }

    // no-op: already right after the target
    if (current.prevQueueId === prevQueueId) return

    if (prevQueueId !== null) {
      const targetQuery = sql`
        SELECT queueId
        FROM queue
        WHERE queueId = ${prevQueueId} AND roomId = ${roomId}
      `
      const target = db.get<{ queueId: number }>(String(targetQuery), targetQuery.parameters)

      if (!target) {
        throw new ValidationError(`prevQueueId ${prevQueueId} not found`)
      }
    }

    db.transaction(() => {
      // close the gap left behind
      const detachQuery = sql`
        UPDATE queue
        SET prevQueueId = ${current.prevQueueId}
        WHERE prevQueueId = ${queueId} AND roomId = ${roomId}
      `
      db.run(String(detachQuery), detachQuery.parameters)

      // whoever followed the target now follows the moved item
      const followerQuery = prevQueueId === null
        ? sql`
          UPDATE queue
          SET prevQueueId = ${queueId}
          WHERE prevQueueId IS NULL AND queueId != ${queueId} AND roomId = ${roomId}
        `
        : sql`
          UPDATE queue
          SET prevQueueId = ${queueId}
          WHERE prevQueueId = ${prevQueueId} AND queueId != ${queueId} AND roomId = ${roomId}
        `
      db.run(String(followerQuery), followerQuery.parameters)

      // link the moved item after the target
      const moveQuery = sql`
        UPDATE queue
        SET prevQueueId = ${prevQueueId}
        WHERE queueId = ${queueId} AND roomId = ${roomId}
      `
      db.run(String(moveQuery), moveQuery.parameters)
    })
  }

  /**
   * Delete a queue item
   */
  static remove (queueId: number): void {
    db.exec('BEGIN IMMEDIATE')
    db.exec('PRAGMA defer_foreign_keys = ON') // v0.9 betas didn't have prevQueueId DEFERRABLE

    try {
      const deleteQuery = sql`
        DELETE FROM queue
        WHERE queueId = ${queueId}
        RETURNING prevQueueId
      `
      const deletedRow = db.get<{ prevQueueId: number | null }>(String(deleteQuery), deleteQuery.parameters)

      if (deletedRow === undefined) {
        throw new Error(`Could not remove queueId: ${queueId}`)
      }

      // close the gap
      const updateQuery = sql`
        UPDATE queue
        SET prevQueueId = ${deletedRow.prevQueueId}
        WHERE prevQueueId = ${queueId}
      `
      db.run(String(updateQuery), updateQuery.parameters)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }

  /**
   * Check if user owns queue item(s)
   */
  static isOwner (userId: number, queueId: number | number[]): boolean {
    const ids = Array.isArray(queueId) ? queueId : [queueId]
    if (ids.length === 0) return false

    const query = sql`
      SELECT COUNT(*) AS count
      FROM queue
      WHERE userId = ${userId} AND queueId IN ${sql.tuple(ids)}
    `
    const res = db.get<{ count: number }>(String(query), query.parameters)
    return res.count === ids.length
  }

  /**
   * Get media type from file extension
   */
  static getType (file: string): string {
    return /\.mp4/i.test(path.extname(file)) ? 'mp4' : 'cdg'
  }
}

export default Queue
