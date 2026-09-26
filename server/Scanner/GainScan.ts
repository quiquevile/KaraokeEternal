import path from 'node:path'
import throttle from '@jcoreio/async-throttle'
import { db } from '../lib/Database.js'
import getLogger from '../lib/Log.js'
import { measureLoudness } from '../lib/loudness.js'
import Media from '../Media/Media.js'
import Prefs from '../Prefs/Prefs.js'
import pushQueuesAndLibrary from '../lib/pushQueuesAndLibrary.js'
import { SCANNER_WORKER_STATUS } from '../../shared/actionTypes.js'

const log = getLogger('GainScan')
const BATCH_SIZE = 500

type GainState = 'idle' | 'running' | 'paused'

let state: GainState = 'idle'
let cancelRequested = false
let attempted: Set<number> = new Set()
let measured = 0
let skipped = 0
let total = 0
let emit: ((action: object) => void) | null = null

export function isGainActive (): boolean {
  return state !== 'idle'
}

export function isGainPaused (): boolean {
  return state === 'paused'
}

function sendStatus (payload: object): void {
  if (emit) emit({ type: SCANNER_WORKER_STATUS, payload })
}

function progressText (done: number): string {
  return `Measuring loudness (${done}/${total})`
}

/**
 * Measures loudness for every media row without a stored gain, reporting
 * progress through the same channel as library scans (job: 'gain').
 * Runs in the server process; at most one job at a time. Returns false
 * when a job is already active.
 */
export function startGainScan (io): boolean {
  if (state !== 'idle') return false

  state = 'running'
  cancelRequested = false
  attempted = new Set()
  measured = 0
  skipped = 0

  const row = db.get<{ count: number }>(
    'SELECT COUNT(*) AS count FROM media WHERE rgTrackGain IS NULL',
  )
  total = row?.count ?? 0

  emit = throttle(action => io.emit('action', action), 1000)

  log.info('starting gain scan (%s without level)', total)
  sendStatus({ isScanning: true, pct: 0, text: progressText(0), job: 'gain' })

  // fire and forget; completion is reported through status events
  void run(io)

  return true
}

/**
 * Pauses a running job after the current file (a library scan is about
 * to start). Returns true when a running job was paused.
 */
export function pauseGainScan (): boolean {
  if (state !== 'running') return false

  state = 'paused'
  log.info('gain scan paused')
  sendStatus({ isScanning: true, pct: pct(), text: 'Gain scan paused (library scan running)', job: 'gain' })

  return true
}

/**
 * Resumes a paused job. Files attempted before the pause are retried, as
 * the interrupting library scan may have cleared values measured earlier.
 */
export function resumeGainScan (): void {
  if (state !== 'paused') return

  attempted = new Set()
  state = 'running'
  log.info('gain scan resumed')
}

/**
 * Cancels the job (running or paused); completion is reported as stopped.
 */
export function stopGainScan (): void {
  if (state === 'idle') return

  cancelRequested = true
  log.info('gain scan stopping')
}

function pct (): number {
  if (total <= 0) return 100

  return Math.min(99, Math.round(((measured + skipped) / total) * 100))
}

function nextBatch (): { mediaId: number, fullPath: string }[] {
  const rows = db.all<{ mediaId: number, pathId: number, relPath: string }>(
    `SELECT mediaId, pathId, relPath FROM media
     WHERE rgTrackGain IS NULL ORDER BY mediaId LIMIT ${BATCH_SIZE}`,
  )

  const { paths } = Prefs.get()
  const batch = []

  for (const row of rows) {
    if (attempted.has(row.mediaId)) continue

    const basePath = paths.entities[row.pathId]?.path
    if (!basePath) {
      attempted.add(row.mediaId)
      skipped += 1
      continue
    }

    batch.push({ mediaId: row.mediaId, fullPath: path.join(basePath, row.relPath) })
  }

  return batch
}

async function waitIfPaused (): Promise<void> {
  while (state === 'paused' && !cancelRequested) {
    await new Promise(resolve => setTimeout(resolve, 500))
  }
}

async function run (io): Promise<void> {
  try {
    for (;;) {
      if (cancelRequested) break
      await waitIfPaused()
      if (cancelRequested) break

      const batch = nextBatch()
      if (!batch.length) break

      for (const item of batch) {
        if (cancelRequested) break
        await waitIfPaused()
        if (cancelRequested) break

        const loudness = await measureLoudness(item.fullPath)

        if (loudness) {
          Media.update({
            mediaId: item.mediaId,
            rgTrackGain: loudness.gainDb,
            rgTrackPeak: loudness.peakRatio,
            dateUpdated: Math.round(Date.now() / 1000),
          })
          measured += 1
        } else {
          log.verbose('could not measure %s, skipping', item.fullPath)
          skipped += 1
        }

        attempted.add(item.mediaId)
        sendStatus({ isScanning: true, pct: pct(), text: progressText(measured + skipped), job: 'gain' })
      }
    }
  } catch (err) {
    log.error('gain scan failed: %s', (err as Error).message)
  }

  const cancelled = cancelRequested
  state = 'idle'
  cancelRequested = false
  emit = null

  log.info('gain scan %s (%s measured, %s skipped)',
    cancelled ? 'stopped' : 'finished', measured, skipped)

  if (measured > 0) pushQueuesAndLibrary(io)

  // final status bypasses the (now discarded) throttle so clients update
  io.emit('action', {
    type: SCANNER_WORKER_STATUS,
    payload: {
      isScanning: false,
      pct: 100,
      text: cancelled
        ? `Gain scan stopped (${measured} measured, ${skipped} skipped)`
        : `Gain scan finished (${measured} measured, ${skipped} skipped)`,
      job: 'gain',
    },
  })
}
