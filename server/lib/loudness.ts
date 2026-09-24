import { execFile } from 'child_process'
import getLogger from './Log.js'

const log = getLogger('loudness')

// ReplayGain reference level in LUFS: measured loudness is brought to
// this target, producing gains on the same scale as tag-based values.
export const LOUDNESS_TARGET_LUFS = -14

export interface Loudness {
  gainDb: number
  peakRatio: number
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
 * when ffmpeg is missing or the measurement fails.
 */
export function measureLoudness (filePath: string): Promise<Loudness | null> {
  const bin = process.env.KES_FFMPEG_BIN || 'ffmpeg'

  return new Promise((resolve) => {
    execFile(bin, [
      '-hide_banner',
      '-i', filePath,
      '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json',
      '-f', 'null', '-',
    ], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        log.debug('could not measure loudness of %s: %s', filePath, err.message)
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
