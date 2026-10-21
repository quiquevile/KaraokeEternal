import { describe, expect, it } from 'vitest'
import {
  DOUBLE_TAP_MAX_MOVE_PX,
  DOUBLE_TAP_MS,
  PITCH_PX_PER_STEP,
  SIDE_ZONE_RATIO,
  SWIPE_MIN_DX,
  SWIPE_MIN_DX_RATIO,
  VOLUME_PX_PER_STEP,
  beginGesture,
  classifyZone,
  endGesture,
  moveGesture,
  tapPoint,
  type GesturePoint,
} from './gestures'

const WIDTH = 1000
const HEIGHT = 700

const pt = (x: number, y: number, time = 0): GesturePoint => ({ x, y, time })

describe('classifyZone', () => {
  it('splits the container into pitch / center / volume zones', () => {
    expect(classifyZone(0, WIDTH)).toBe('pitch')
    expect(classifyZone(WIDTH * SIDE_ZONE_RATIO, WIDTH)).toBe('pitch')
    expect(classifyZone(WIDTH * SIDE_ZONE_RATIO + 1, WIDTH)).toBe('center')
    expect(classifyZone(WIDTH / 2, WIDTH)).toBe('center')
    expect(classifyZone(WIDTH * (1 - SIDE_ZONE_RATIO) - 1, WIDTH)).toBe('center')
    expect(classifyZone(WIDTH * (1 - SIDE_ZONE_RATIO), WIDTH)).toBe('volume')
    expect(classifyZone(WIDTH, WIDTH)).toBe('volume')
  })
})

describe('volume drag (right zone)', () => {
  it('increases volume moving up, decreases moving down', () => {
    const start = pt(WIDTH - 10, 500, 0)
    const state = beginGesture(start, WIDTH, 0.5, 0)

    // 80px up = +10%
    const up = moveGesture(state, pt(WIDTH - 10, 420, 100))
    expect(up).toEqual({ type: 'volume', value: 0.6 })

    // another 8px up = +1%
    const up2 = moveGesture(state, pt(WIDTH - 10, 412, 110))
    expect(up2).toEqual({ type: 'volume', value: 0.61 })
  })

  it('clamps to [0, 1]', () => {
    // start near the bottom, drag far down → clamped to 0
    const state = beginGesture(pt(WIDTH - 10, 0, 0), WIDTH, 0.05, 0)
    expect(moveGesture(state, pt(WIDTH - 10, 600, 100))).toEqual({ type: 'volume', value: 0 })
  })

  it('returns null when the step has not changed (throttle)', () => {
    const state = beginGesture(pt(WIDTH - 10, 500, 0), WIDTH, 0.5, 0)
    expect(moveGesture(state, pt(WIDTH - 10, 496, 50))).toBe(null) // 4px < 8px step
    expect(moveGesture(state, pt(WIDTH - 10, 420, 100))).toEqual({ type: 'volume', value: 0.6 })
    // 1px up keeps dy in the same 8px step bucket (80 → 81)
    expect(moveGesture(state, pt(WIDTH - 10, 419, 110))).toBe(null)
  })
})

describe('pitch drag (left zone)', () => {
  it('steps one semitone per 24px up, clamped at ±6', () => {
    const state = beginGesture(pt(10, 500, 0), WIDTH, 0.5, 0)
    expect(moveGesture(state, pt(10, 476, 100))).toEqual({ type: 'pitch', semitones: 1 })
    expect(moveGesture(state, pt(10, 452, 110))).toEqual({ type: 'pitch', semitones: 2 })
    // clamped at +6 (PITCH_SEMITONE_MAX)
    const state2 = beginGesture(pt(10, 500, 0), WIDTH, 0.5, 6)
    expect(moveGesture(state2, pt(10, 400, 100))).toEqual({ type: 'pitch', semitones: 6 })
  })

  it('decreases pitch moving down', () => {
    const state = beginGesture(pt(10, 300, 0), WIDTH, 0.5, 0)
    expect(moveGesture(state, pt(10, 324, 100))).toEqual({ type: 'pitch', semitones: -1 })
  })
})

describe('horizontal swipe (center zone)', () => {
  // threshold is max(SWIPE_MIN_DX, width * SWIPE_MIN_DX_RATIO) = 150 for width 1000
  const swipeDx = Math.max(SWIPE_MIN_DX, WIDTH * SWIPE_MIN_DX_RATIO) + 1

  it('swipe left → next, swipe right → replay', () => {
    const left = beginGesture(pt(500, 350, 0), WIDTH, 0.5, 0)
    expect(endGesture(left, pt(500 - swipeDx, 350, 100), null))
      .toEqual({ type: 'next' })

    const right = beginGesture(pt(500, 350, 0), WIDTH, 0.5, 0)
    expect(endGesture(right, pt(500 + swipeDx, 350, 100), null))
      .toEqual({ type: 'replay' })
  })

  it('ignores mostly-vertical drags', () => {
    const state = beginGesture(pt(500, 350, 0), WIDTH, 0.5, 0)
    // dx exceeds threshold but dy drifts too far
    expect(endGesture(state, pt(500 - swipeDx, 350 + WIDTH * 0.4, 100), null)).toBe(null)
  })

  it('ignores short drags', () => {
    const state = beginGesture(pt(500, 350, 0), WIDTH, 0.5, 0)
    expect(endGesture(state, pt(500 - 50, 350, 100), null)).toBe(null)
  })
})

describe('double-tap (center zone)', () => {
  it('detects two quick taps in the same spot', () => {
    const state = beginGesture(pt(500, 350, 0), WIDTH, 0.5, 0)
    const first = tapPoint(state, pt(500, 350, 100))
    expect(first).toEqual(pt(500, 350, 100))

    // second tap within the double-tap window
    const state2 = beginGesture(pt(502, 351, 150), WIDTH, 0.5, 0)
    const intent = endGesture(state2, pt(502, 351, 200), first)
    expect(intent).toEqual({ type: 'playPause' })
  })

  it('ignores a single tap (no prev tap)', () => {
    const state = beginGesture(pt(500, 350, 0), WIDTH, 0.5, 0)
    expect(endGesture(state, pt(500, 350, 100), null)).toBe(null)
  })

  it('ignores a tap after the double-tap window', () => {
    const prev = pt(500, 350, 0)
    const state = beginGesture(pt(500, 350, DOUBLE_TAP_MS + 10), WIDTH, 0.5, 0)
    expect(endGesture(state, pt(500, 350, DOUBLE_TAP_MS + 200), prev)).toBe(null)
  })

  it('ignores a second tap too far from the first', () => {
    const prev = pt(500, 350, 0)
    const state = beginGesture(pt(500, 350, 100), WIDTH, 0.5, 0)
    const far = pt(500 + DOUBLE_TAP_MAX_MOVE_PX + 1, 350, 200)
    expect(endGesture(state, far, prev)).toBe(null)
  })
})

describe('tapPoint', () => {
  it('returns null for side-zone gestures', () => {
    const state = beginGesture(pt(WIDTH - 10, 500, 0), WIDTH, 0.5, 0)
    expect(tapPoint(state, pt(WIDTH - 10, 500, 100))).toBe(null)
  })

  it('returns null for long or far drags', () => {
    const state = beginGesture(pt(500, 350, 0), WIDTH, 0.5, 0)
    expect(tapPoint(state, pt(500, 350, DOUBLE_TAP_MS + 1))).toBe(null)
    expect(tapPoint(state, pt(500 + DOUBLE_TAP_MAX_MOVE_PX + 1, 350, 100))).toBe(null)
  })
})

describe('step constants', () => {
  it('exposes tunable sensitivity values', () => {
    expect(VOLUME_PX_PER_STEP).toBeGreaterThan(0)
    expect(PITCH_PX_PER_STEP).toBeGreaterThan(0)
    expect(HEIGHT).toBeGreaterThan(0)
  })
})
