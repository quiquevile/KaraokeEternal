import { describe, expect, it } from 'vitest'
import {
  PITCH_SEMITONE_MAX,
  PITCH_SEMITONE_MIN,
  clampPitchSemitones,
  isPitchShiftSupported,
  retryAsync,
} from './pitchShift'

describe('pitchShift', () => {
  it('clamps semitones to the supported karaoke range', () => {
    expect(clampPitchSemitones(PITCH_SEMITONE_MIN - 2)).toBe(PITCH_SEMITONE_MIN)
    expect(clampPitchSemitones(PITCH_SEMITONE_MAX + 2)).toBe(PITCH_SEMITONE_MAX)
  })

  it('rounds fractional semitones to whole steps', () => {
    expect(clampPitchSemitones(2.4)).toBe(2)
    expect(clampPitchSemitones(-2.6)).toBe(-3)
  })

  it('treats a non-finite value as no pitch shift', () => {
    expect(clampPitchSemitones(Number.NaN)).toBe(0)
  })

  it('reports AudioWorklet support as unavailable without a window', () => {
    expect(isPitchShiftSupported()).toBe(false)
  })

  it('detects support without invoking the audioWorklet getter (Firefox)', () => {
    const prototype = {}
    Object.defineProperty(prototype, 'audioWorklet', {
      configurable: true,
      get () {
        throw new TypeError('requires a BaseAudioContext instance')
      },
    })

    const FakeAudioContext = function () {}
    FakeAudioContext.prototype = prototype

    const globalWindow = globalThis as { window?: unknown }
    const previousWindow = globalWindow.window
    globalWindow.window = { AudioContext: FakeAudioContext }

    try {
      expect(isPitchShiftSupported()).toBe(true)
    } finally {
      if (typeof previousWindow === 'undefined') {
        delete globalWindow.window
      } else {
        globalWindow.window = previousWindow
      }
    }
  })

  it('reports support as unavailable when the prototype has no audioWorklet', () => {
    const globalWindow = globalThis as { window?: unknown }
    const previousWindow = globalWindow.window
    globalWindow.window = { AudioContext: function () {} }

    try {
      expect(isPitchShiftSupported()).toBe(false)
    } finally {
      if (typeof previousWindow === 'undefined') {
        delete globalWindow.window
      } else {
        globalWindow.window = previousWindow
      }
    }
  })

  it('retries failures and returns the first success', async () => {
    const sleeps: number[] = []
    let calls = 0

    const result = await retryAsync(async () => {
      calls += 1
      if (calls < 3) throw new Error(`boom ${calls}`)
      return 'ok'
    }, 3, [500, 2000], async (ms) => { sleeps.push(ms) })

    expect(result).toBe('ok')
    expect(calls).toBe(3)
    expect(sleeps).toEqual([500, 2000])
  })

  it('throws the last error when attempts run out', async () => {
    let calls = 0

    await expect(retryAsync(async () => {
      calls += 1
      throw new Error(`boom ${calls}`)
    }, 2, [100], async () => {})).rejects.toThrow('boom 2')
    expect(calls).toBe(2)
  })

  it('succeeds first try without sleeping', async () => {
    let slept = false
    const sleep = async () => {
      slept = true
    }

    const result = await retryAsync(async () => 'fast', 3, [500], sleep)

    expect(result).toBe('fast')
    expect(slept).toBe(false)
  })
})
