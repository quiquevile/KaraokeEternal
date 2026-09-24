import type { SoundTouchNode } from '@soundtouchjs/audio-worklet'

export const PITCH_SEMITONE_MIN = -6
export const PITCH_SEMITONE_MAX = 6

// setup attempts before giving up: slow devices (e.g. Raspberry Pi)
// can fail transiently while importing/compiling the worklet
export const PITCH_SETUP_ATTEMPTS = 3
export const PITCH_SETUP_RETRY_DELAYS_MS = [500, 2000]

export function clampPitchSemitones (value: number): number {
  if (!Number.isFinite(value)) return 0

  return Math.min(PITCH_SEMITONE_MAX, Math.max(PITCH_SEMITONE_MIN, Math.round(value)))
}

export function isPitchShiftSupported (): boolean {
  if (typeof window === 'undefined' || !window.AudioContext) return false

  try {
    // NOTE: use `in` instead of reading the property: on some browsers
    // (Firefox) the audioWorklet getter throws unless called on a real
    // BaseAudioContext instance.
    return 'audioWorklet' in window.AudioContext.prototype
  } catch {
    return false
  }
}

let processorRegistration: Promise<boolean> | null = null

/**
 * Runs fn until it succeeds, waiting between attempts. Throws the last
 * error when attempts run out. The sleep function is injectable for tests.
 */
export async function retryAsync<T> (
  fn: () => Promise<T>,
  attempts: number,
  delaysMs: number[],
  sleep: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt >= attempts) throw err

      await sleep(delaysMs[attempt - 1] ?? 0)
    }
  }
}

async function registerPitchProcessor (context: AudioContext): Promise<boolean> {
  if (!isPitchShiftSupported()) return false

  if (!processorRegistration) {
    processorRegistration = (async () => {
      const { SoundTouchNode } = await import('@soundtouchjs/audio-worklet')
      const processorUrl = new URL('@soundtouchjs/audio-worklet/processor', import.meta.url).href

      await retryAsync(
        () => SoundTouchNode.register(context, processorUrl),
        PITCH_SETUP_ATTEMPTS,
        [...PITCH_SETUP_RETRY_DELAYS_MS],
      )
      return true
    })().catch((err) => {
      console.error('[pitch] worklet registration failed', err)
      processorRegistration = null
      return false
    })
  }

  return processorRegistration
}

export async function createPitchNode (context: AudioContext): Promise<SoundTouchNode | null> {
  if (!(await registerPitchProcessor(context))) return null

  const { SoundTouchNode } = await import('@soundtouchjs/audio-worklet')
  const pitchNode = new SoundTouchNode({ context })

  pitchNode.playbackRate.value = 1
  pitchNode.pitch.value = 1
  pitchNode.pitchSemitones.value = 0

  return pitchNode
}

export function setPitchNodeSemitones (pitchNode: SoundTouchNode, semitones: number): void {
  pitchNode.playbackRate.value = 1
  pitchNode.pitch.value = 1
  pitchNode.pitchSemitones.value = clampPitchSemitones(semitones)
}
