import { describe, expect, it, vi } from 'vitest'
import {
  EQ_FREQUENCIES,
  EQ_GAIN_MAX,
  EQ_GAIN_MIN,
  EQ_PRESETS,
  clampEqGain,
  createEqualizer,
  setEqualizerGains,
} from './equalizer'

describe('equalizer', () => {
  it('uses ten VLC-style bands', () => {
    expect(EQ_FREQUENCIES).toEqual([60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000])
  })

  it('clamps gains to ±12 dB', () => {
    expect(clampEqGain(EQ_GAIN_MIN - 5)).toBe(EQ_GAIN_MIN)
    expect(clampEqGain(EQ_GAIN_MAX + 5)).toBe(EQ_GAIN_MAX)
    expect(clampEqGain(Number.NaN)).toBe(0)
    expect(clampEqGain(3.5)).toBe(3.5)
  })

  it('ships one gain per band in every preset', () => {
    expect(EQ_PRESETS.length).toBeGreaterThan(1)

    for (const preset of EQ_PRESETS) {
      expect(preset.gains).toHaveLength(EQ_FREQUENCIES.length)
    }

    expect(EQ_PRESETS[0]).toEqual({ name: 'Flat', gains: new Array(10).fill(0) })
  })

  it('builds shelving ends and peaking middles at the right frequencies', () => {
    const makeFilter = () => ({ type: '', Q: { value: 0 }, frequency: { value: 0 }, gain: { value: 99 } })
    const context = { createBiquadFilter: vi.fn(makeFilter) }

    const nodes = createEqualizer(context as unknown as BaseAudioContext)

    expect(nodes).toHaveLength(10)
    expect(context.createBiquadFilter).toHaveBeenCalledTimes(10)
    expect(nodes[0]).toMatchObject({ type: 'lowshelf', frequency: { value: 60 }, gain: { value: 0 } })
    expect(nodes[9]).toMatchObject({ type: 'highshelf', frequency: { value: 16000 }, gain: { value: 0 } })
    expect(nodes[4]).toMatchObject({ type: 'peaking', frequency: { value: 1000 }, gain: { value: 0 } })
    expect(nodes[4].Q.value).toBe(1)
  })

  it('applies gains with clamping and zero default', () => {
    const nodes = EQ_FREQUENCIES.map(() => ({ gain: { value: 0 } }))

    setEqualizerGains(nodes as unknown as BiquadFilterNode[], [20, -20])

    expect(nodes[0].gain.value).toBe(EQ_GAIN_MAX)
    expect(nodes[1].gain.value).toBe(EQ_GAIN_MIN)
    expect(nodes[2].gain.value).toBe(0)
  })
})
