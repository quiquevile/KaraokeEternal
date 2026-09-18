import { execFile } from 'child_process'
import path from 'path'
import { readdir } from 'fs/promises'
import Library from '../Library/Library.js'
import Media from '../Media/Media.js'
import pushQueuesAndLibrary from '../lib/pushQueuesAndLibrary.js'
import getLogger from '../lib/Log.js'
import type { DownloadJob } from './downloadManager.js'

const log = getLogger('YoutubeRegister')

const VIDEO_EXTENSIONS = /\.(?:mp4|mkv|webm|mov|avi|flv)$/i

function getDuration (filePath: string): Promise<number> {
  const bin = process.env.KES_FFPROBE_BIN || 'ffprobe'

  return new Promise((resolve, reject) => {
    execFile(
      bin,
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
      (err, stdout) => {
        if (err) {
          reject(new Error(`ffprobe failed for ${filePath}: ${err.message}`))

          return
        }

        const duration = parseFloat(stdout.trim())

        if (!Number.isFinite(duration)) {
          reject(new Error(`invalid duration from ffprobe: ${stdout.trim()}`))

          return
        }

        resolve(Math.round(duration))
      },
    )
  })
}

/**
 * Locates the downloaded file on disk, probes its duration, matches/creates
 * artist+song and inserts the media row, mirroring what FileScanner does on
 * a rescan so the entry behaves identically to scanned files.
 */
export default async function registerDownload (options: { job: DownloadJob, io: unknown }): Promise<void> {
  const { job, io } = options

  let filePath: string | null = null
  let relPath: string | null = null

  for (const filename of await readdir(job.destDir)) {
    if (filename.startsWith(`${job.baseName}.`) && VIDEO_EXTENSIONS.test(filename)) {
      filePath = path.join(job.destDir, filename)
      relPath = path.join(job.destDir, filename).substring(job.pathRoot.length).replace(/\\/g, '/').replace(/^\//, '')
      break
    }
  }

  if (!filePath || !relPath) {
    throw new Error(`could not locate downloaded file for ${job.baseName}`)
  }

  let duration = 0

  try {
    duration = await getDuration(filePath)
  } catch (err) {
    log.warn('could not probe duration of %s: %s', filePath, err instanceof Error ? err.message : String(err))
  }

  const match = Library.matchSong({
    artist: job.artist,
    artistNorm: job.artistNorm,
    title: job.title,
    titleNorm: job.titleNorm,
  })

  if (!match.songId || !match.artistId) {
    throw new Error(`could not match song for ${job.artist} - ${job.title}`)
  }

  Media.add({
    songId: match.songId,
    artistId: match.artistId,
    duration,
    pathId: job.pathId,
    relPath,
    youtubeVideoId: job.id,
    dateAdded: Math.round(Date.now() / 1000),
  })

  log.info('registered download: %s (%s)', relPath, job.id)

  if (io) pushQueuesAndLibrary(io)
}
