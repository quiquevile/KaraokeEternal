import { describe, expect, it, vi } from 'vitest'
import { needsGainAnalysis, type NeedsGainAnalysisInput } from './needsGainAnalysis'

const unmeasured: NeedsGainAnalysisInput = {
  isReplayGainEnabled: true,
  mediaId: 1,
  rgTrackGain: null,
  rgTrackPeak: null,
}

const stored: NeedsGainAnalysisInput = {
  isReplayGainEnabled: true,
  mediaId: 1,
  rgTrackGain: -3.2,
  rgTrackPeak: 0.98,
}

describe('needsGainAnalysis', () => {
  it('measures on first play when no values are stored', () => {
    expect(needsGainAnalysis(unmeasured, () => false)).toBe(true)
  })

  it('never measures while the room toggle is off', () => {
    const hasFailed = vi.fn()
    expect(needsGainAnalysis({ ...unmeasured, isReplayGainEnabled: false }, hasFailed)).toBe(false)
    expect(hasFailed).not.toHaveBeenCalled()
  })

  it('never re-measures media that already has values', () => {
    expect(needsGainAnalysis(stored, () => false)).toBe(false)
  })

  it('measures again when only one of the two values is stored', () => {
    expect(needsGainAnalysis({ ...stored, rgTrackPeak: null }, () => false)).toBe(true)
  })

  it('skips media that already failed this session', () => {
    expect(needsGainAnalysis(unmeasured, () => true)).toBe(false)
  })

  it('does nothing without a mediaId', () => {
    expect(needsGainAnalysis({ ...unmeasured, mediaId: null }, () => false)).toBe(false)
  })
})
