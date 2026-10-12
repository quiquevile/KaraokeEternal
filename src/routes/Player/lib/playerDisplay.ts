import type { PlayerDisplayPrefs } from 'store/modules/prefs'

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
