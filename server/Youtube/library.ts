import sql from 'sqlate'
import { db } from '../lib/Database.js'

/**
 * Returns the set of youtubeVideoIds that already exist in the media library.
 */
export function getAlreadyDownloadedIds (videoIds: string[]): Set<string> {
  if (!videoIds.length) return new Set()

  const query = sql`
    SELECT youtubeVideoId
    FROM media
    WHERE youtubeVideoId IN ${sql.tuple(videoIds)}
      AND youtubeVideoId IS NOT NULL
  `

  const rows = db.all<{ youtubeVideoId: string }>(String(query), query.parameters)

  return new Set(rows.map(row => row.youtubeVideoId))
}
