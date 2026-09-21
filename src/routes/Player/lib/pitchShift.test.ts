import { describe, expect, it } from 'vitest'
import {
  PITCH_SEMITONE_MAX,
  PITCH_SEMITONE_MIN,
  clampPitchSemitones,
  isPitchShiftSupported,
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
})
