import type { PlayerDisplayPrefs } from 'store/modules/prefs'
import type { IRoomPrefs } from 'shared/types'

export const PLAYER_DISPLAY_DEFAULTS: PlayerDisplayPrefs = {
  nextUpLeadMs: 30000,
  upNowDurationMs: 5000,
  pitchToastMs: 2500,
  nextUpBlinkMs: 5000,
}

// fixed (non-configurable) fade duration for the NextUp blink, in ms
export const NEXTUP_FADE_MS = 1000

function asNonNegativeInt (value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback
}

export function formatPitch (pitchSemitones: number): string {
  return `${pitchSemitones > 0 ? '+' : ''}${pitchSemitones} st`
}

export function getPlayerDisplayPrefs (stored?: Partial<PlayerDisplayPrefs> | null): PlayerDisplayPrefs {
  return {
    nextUpLeadMs: asNonNegativeInt(stored?.nextUpLeadMs, PLAYER_DISPLAY_DEFAULTS.nextUpLeadMs),
    upNowDurationMs: asNonNegativeInt(stored?.upNowDurationMs, PLAYER_DISPLAY_DEFAULTS.upNowDurationMs),
    pitchToastMs: asNonNegativeInt(stored?.pitchToastMs, PLAYER_DISPLAY_DEFAULTS.pitchToastMs),
    nextUpBlinkMs: asNonNegativeInt(stored?.nextUpBlinkMs, PLAYER_DISPLAY_DEFAULTS.nextUpBlinkMs),
  }
}

/**
 * Whether the next-singer badge should be on screen: some time is left but
 * not more than the lead window, the current singer's badge is already gone,
 * and there is a next song.
 */
export function isNextUpVisible (
  positionS: number,
  durationS: number,
  leadMs: number,
  upNowMs: number,
  hasNext: boolean,
): boolean {
  if (!hasNext || !(durationS > 0) || !(positionS >= 0)) return false

  const remainingMs = (durationS - positionS) * 1000

  return remainingMs <= leadMs && positionS * 1000 >= upNowMs
}

/**
 * Remaining time as `-M:SS` for the song progress readout, or null when
 * the duration is unknown.
 */export function formatRemaining (positionS: number, durationS: number): string | null {
  if (!(durationS > 0) || !(positionS >= 0)) return null

  const remainingS = Math.max(0, Math.round(durationS - positionS))
  const minutes = Math.floor(remainingS / 60)
  const seconds = String(remainingS % 60).padStart(2, '0')

  return `-${minutes}:${seconds}`
}

/**
 * Which parts of the song progress readout are on for this room. Each
 * element toggles independently (defaults on); `isEnabled` is the bar
 * track itself, kept under its legacy key so stored prefs stay valid.
 */
export function progressElements (progress?: IRoomPrefs['progress']): {
  bar: boolean
  title: boolean
  singer: boolean
  time: boolean
} {
  return {
    bar: progress?.isEnabled ?? true,
    title: progress?.showTitle ?? true,
    singer: progress?.showSinger ?? true,
    time: progress?.showTime ?? true,
  }
}

/**
 * The five canonical progress readout states cycled by the B shortcut:
 * nothing, bar only, + remaining time, + title, + singer. `nextProgressState`
 * advances one step through the ring; a non-canonical combination (hand-tuned
 * in Player Options) falls back to the start of the cycle.
 */
export const PROGRESS_CYCLE = [
  { bar: false, time: false, title: false, singer: false },
  { bar: true, time: false, title: false, singer: false },
  { bar: true, time: true, title: false, singer: false },
  { bar: true, time: true, title: true, singer: false },
  { bar: true, time: true, title: true, singer: true },
] as const

export type ProgressElements = {
  bar: boolean
  time: boolean
  title: boolean
  singer: boolean
}

export function nextProgressState (progress?: IRoomPrefs['progress']): ProgressElements {
  const current = progressElements(progress)
  const index = PROGRESS_CYCLE.findIndex(state =>
    state.bar === current.bar
    && state.time === current.time
    && state.title === current.title
    && state.singer === current.singer,
  )

  return PROGRESS_CYCLE[index === -1 ? 0 : (index + 1) % PROGRESS_CYCLE.length]
}

/**
 * Whether the song progress row is on screen: playing an unerrored song
 * with known duration and at least one readout element enabled. Shared
 * by the readout itself and the QR badge (which lifts to clear it).
 */
export function isProgressVisible (
  isPlaying: boolean,
  isErrored: boolean,
  durationS: number,
  progress: IRoomPrefs['progress'] | undefined,
  hasQueueItem: boolean,
): boolean {
  if (!isPlaying || isErrored || !hasQueueItem || !(durationS > 0)) return false

  const elements = progressElements(progress)

  return elements.bar || elements.title || elements.singer || elements.time
}
