import { execFile } from 'child_process'
import { parseFile } from 'music-metadata'
import getLogger from './Log.js'

const log = getLogger('loudness')

// ReplayGain reference level in LUFS: measured loudness is brought to
// this target, producing gains on the same scale as tag-based values.
export const LOUDNESS_TARGET_LUFS = -14

export interface Loudness {
  gainDb: number
  peakRatio: number
}

export interface TagGain {
  gainDb: number
  peakRatio: number | null
}

export const MEASURE_TIMEOUT_MS = 180000
export const TAG_READ_TIMEOUT_MS = 60000

export interface MeasureOptions {
  timeoutMs?: number
  signal?: AbortSignal
}

/**
 * Reads ReplayGain tags from a file (same scale as measured values, no
 * conversion). Returns null when the file has no usable tags, cannot
 * be parsed, times out or is aborted.
 */
export async function readTagGain (
  filePath: string,
  { timeoutMs = TAG_READ_TIMEOUT_MS, signal }: MeasureOptions = {},
): Promise<TagGain | null> {
  if (signal?.aborted) return null

  let timer: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined

  const abort = new Promise<null>((resolve) => {
    onAbort = () => resolve(null)

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        log.warn('timed out reading tags of %s', filePath)
        resolve(null)
      }, timeoutMs)
      timer.unref?.()
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })

  try {
    const parsed = await Promise.race([
      parseFile(filePath, { duration: false, skipCovers: true }),
      abort,
    ])

    const gainDb = parsed?.common?.replaygain_track_gain?.dB

    if (typeof gainDb !== 'number' || !Number.isFinite(gainDb)) return null

    const peak = parsed?.common?.replaygain_track_peak?.ratio

    return {
      gainDb,
      peakRatio: typeof peak === 'number' && Number.isFinite(peak) ? peak : null,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    if (onAbort) signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * Parses ffmpeg loudnorm JSON output into track gain (dB) and true peak
 * (linear ratio). Returns null when the output is unusable.
 */
export function parseLoudnorm (json: string): Loudness | null {
  let parsed: { measured_I?: unknown, measured_TP?: unknown, input_i?: unknown, input_tp?: unknown }

  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }

  // newer ffmpeg reports input_i/input_tp instead of measured_I/measured_TP
  const integrated = Number(parsed?.measured_I ?? parsed?.input_i)
  const truePeak = Number(parsed?.measured_TP ?? parsed?.input_tp)

  if (!Number.isFinite(integrated) || !Number.isFinite(truePeak)) return null

  return {
    gainDb: Math.round((LOUDNESS_TARGET_LUFS - integrated) * 10) / 10,
    peakRatio: Math.pow(10, truePeak / 20),
  }
}

/**
 * Measures a file's loudness with ffmpeg (single pass). Returns null
 * when ffmpeg is missing, the measurement fails, times out or is aborted.
 */
export function measureLoudness (
  filePath: string,
  { timeoutMs = MEASURE_TIMEOUT_MS, signal }: MeasureOptions = {},
): Promise<Loudness | null> {
  if (signal?.aborted) return Promise.resolve(null)

  const bin = process.env.KES_FFMPEG_BIN || 'ffmpeg'

  return new Promise((resolve) => {
    execFile(bin, [
      '-hide_banner',
      '-i', filePath,
      '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json',
      '-f', 'null', '-',
    ], {
      maxBuffer: 10 * 1024 * 1024,
      timeout: timeoutMs > 0 ? timeoutMs : undefined,
      signal,
    }, (err, stdout, stderr) => {
      if (err) {
        if ((err as Error & { code?: unknown }).code === 'ABORT_ERR') {
          log.debug('loudness measurement of %s aborted', filePath)
        } else if ((err as NodeJS.ErrnoException).killed) {
          log.warn('timed out measuring loudness of %s', filePath)
        } else {
          log.debug('could not measure loudness of %s: %s', filePath, err.message)
        }

        resolve(null)

        return
      }

      // ffmpeg prints the loudnorm JSON block to stderr
      const lines = `${stdout}\n${stderr}`.split('\n')
      const start = lines.findIndex(line => line.trim() === '{')
      const end = lines.lastIndexOf('}')

      if (start === -1 || end === -1 || end < start) {
        log.debug('no loudnorm JSON found for %s', filePath)
        resolve(null)

        return
      }

      resolve(parseLoudnorm(lines.slice(start, end + 1).join('\n')))
    })
  })
}
