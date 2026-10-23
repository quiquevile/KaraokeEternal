import { SoundTouchNode } from '@soundtouchjs/audio-worklet'
import processorSource from '@soundtouchjs/audio-worklet/processor'

export const PITCH_SEMITONE_MIN = -6
export const PITCH_SEMITONE_MAX = 6

// setup attempts before giving up: slow devices (e.g. Raspberry Pi)
// can fail transiently while compiling the worklet
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

// the processor source ships inside the bundle and is registered from a
// Blob URL, so pitch works without any network access (offline players)
let processorUrl: string | null = null

function getProcessorUrl (): string {
  if (!processorUrl) {
    processorUrl = URL.createObjectURL(
      new Blob([processorSource], { type: 'text/javascript' }),
    )
  }

  return processorUrl
}

// worklet modules are registered per AudioContext: a remounted Player
// gets a fresh context that still needs its own addModule()
const registeredContexts = new WeakSet<BaseAudioContext>()
let inFlight: { context: BaseAudioContext, promise: Promise<boolean> } | null = null

async function registerPitchProcessor (context: BaseAudioContext): Promise<boolean> {
  if (!isPitchShiftSupported()) return false

  if (registeredContexts.has(context)) return true
  if (inFlight?.context === context) return inFlight.promise

  const promise: Promise<boolean> = retryAsync(
    () => SoundTouchNode.register(context, getProcessorUrl()),
    PITCH_SETUP_ATTEMPTS,
    [...PITCH_SETUP_RETRY_DELAYS_MS],
  ).then(() => {
    registeredContexts.add(context)
    return true
  }).catch((err) => {
    console.error('[pitch] worklet registration failed', err)
    return false
  }).finally(() => {
    if (inFlight?.context === context) inFlight = null
  })

  inFlight = { context, promise }
  return promise
}

/**
 * Pre-registers the worklet processor on the given context. Call it while
 * the app shell was freshly loaded (network still up or assets cached) so
 * later pitch changes — even offline — only need a local Blob URL.
 */
export function warmPitchEngine (context: BaseAudioContext): Promise<boolean> {
  return registerPitchProcessor(context)
}

export async function createPitchNode (context: AudioContext): Promise<SoundTouchNode | null> {
  if (!(await registerPitchProcessor(context))) return null

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
