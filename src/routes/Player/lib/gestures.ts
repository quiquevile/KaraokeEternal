import { clampPitchSemitones } from './pitchShift'

// zone widths as a fraction of the player container width
export const SIDE_ZONE_RATIO = 0.18

// vertical drag sensitivity
export const VOLUME_PX_PER_STEP = 8 // 1% volume per 8px
export const PITCH_PX_PER_STEP = 24 // 1 semitone per 24px

// horizontal swipe recognition
export const SWIPE_MIN_DX = 100 // px
export const SWIPE_MIN_DX_RATIO = 0.15 // of container width
export const SWIPE_MAX_DY_RATIO = 0.35 // vertical drift allowed vs width

// double-tap
export const DOUBLE_TAP_MS = 300
export const DOUBLE_TAP_MAX_MOVE_PX = 24

export type GestureZone = 'volume' | 'pitch' | 'center'

export type GestureIntent
  = | { type: 'volume', value: number }
    | { type: 'pitch', semitones: number }
    | { type: 'next' }
    | { type: 'replay' }
    | { type: 'playPause' }
    | null

export interface GesturePoint {
  x: number
  y: number
  time: number
}

export interface GestureState {
  startX: number
  startY: number
  startTime: number
  startVolume: number
  startPitch: number
  zone: GestureZone
  width: number
  lastVolumeStep: number
  lastPitchStep: number
}

const clampVolume = (vol: number): number => (
  Math.min(1, Math.max(0, Math.round(vol * 100) / 100))
)

/**
 * Which side zone a touch-down lands in: leftmost/rightmost SIDE_ZONE_RATIO
 * of the container width, or center (no continuous vertical control).
 */
export function classifyZone (x: number, width: number): GestureZone {
  const w = Math.max(1, width)
  if (x <= w * SIDE_ZONE_RATIO) return 'pitch'
  if (x >= w * (1 - SIDE_ZONE_RATIO)) return 'volume'
  return 'center'
}

/**
 * Begin a gesture at a pointer-down. `startVolume`/`startPitch` are the
 * values at gesture start so vertical deltas are absolute (not cumulative).
 */
export function beginGesture (
  point: GesturePoint,
  width: number,
  startVolume: number,
  startPitch: number,
): GestureState {
  return {
    startX: point.x,
    startY: point.y,
    startTime: point.time,
    startVolume,
    startPitch,
    zone: classifyZone(point.x, width),
    width: Math.max(1, width),
    lastVolumeStep: 0,
    lastPitchStep: 0,
  }
}

/**
 * Continuous vertical-drag intents for the side zones: volume on the right,
 * pitch on the left. Returns null in the center zone or when the step hasn't
 * changed since the last call (so callers can throttle dispatches).
 */
export function moveGesture (state: GestureState, point: GesturePoint): GestureIntent {
  if (state.zone === 'center') return null

  const dy = state.startY - point.y // up = positive

  if (state.zone === 'volume') {
    const step = Math.trunc(dy / VOLUME_PX_PER_STEP)
    if (step === state.lastVolumeStep) return null
    state.lastVolumeStep = step
    return { type: 'volume', value: clampVolume(state.startVolume + step / 100) }
  }

  // pitch
  const step = Math.trunc(dy / PITCH_PX_PER_STEP)
  if (step === state.lastPitchStep) return null
  state.lastPitchStep = step
  return { type: 'pitch', semitones: clampPitchSemitones(state.startPitch + step) }
}

/**
 * End-of-gesture intent: horizontal swipe (next / replay) and double-tap
 * (play/pause). Vertical side-zone drags resolve to null here (they were
 * emitted continuously by moveGesture).
 */
export function endGesture (
  state: GestureState,
  point: GesturePoint,
  prevTap: GesturePoint | null,
): GestureIntent {
  const dx = point.x - state.startX
  const dy = point.y - state.startY
  const elapsed = point.time - state.startTime

  // side-zone vertical drag: already handled by moveGesture
  if (state.zone !== 'center') return null

  const minDx = Math.max(SWIPE_MIN_DX, state.width * SWIPE_MIN_DX_RATIO)
  const maxDy = state.width * SWIPE_MAX_DY_RATIO

  if (Math.abs(dx) >= minDx && Math.abs(dy) <= maxDy) {
    return dx < 0 ? { type: 'next' } : { type: 'replay' }
  }

  // double-tap: two quick taps with little movement
  const moved = Math.hypot(dx, dy)
  if (
    moved <= DOUBLE_TAP_MAX_MOVE_PX
    && elapsed <= DOUBLE_TAP_MS
    && prevTap
    && point.time - prevTap.time <= DOUBLE_TAP_MS
    && Math.hypot(point.x - prevTap.x, point.y - prevTap.y) <= DOUBLE_TAP_MAX_MOVE_PX
  ) {
    return { type: 'playPause' }
  }

  return null
}

/**
 * The tap point to remember after a short, non-swiping pointer-up (for
 * double-tap detection); null when the gesture was too long or moved too far.
 */
export function tapPoint (state: GestureState, point: GesturePoint): GesturePoint | null {
  if (state.zone !== 'center') return null

  const moved = Math.hypot(point.x - state.startX, point.y - state.startY)
  const elapsed = point.time - state.startTime

  if (moved <= DOUBLE_TAP_MAX_MOVE_PX && elapsed <= DOUBLE_TAP_MS) return point
  return null
}

/**
 * Whether a pointer-down originated on an interactive element (button, link,
 * input) or inside a dialog, where gestures must not fire.
 */
export function isInteractiveTarget (target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  return !!target.closest('button, a, input, select, textarea, [role="dialog"]')
}
