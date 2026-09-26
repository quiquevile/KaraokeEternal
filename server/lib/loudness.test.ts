import { describe, it, expect, vi } from 'vitest'

vi.mock('music-metadata', () => ({
  parseFile: vi.fn(),
}))

import { parseFile } from 'music-metadata'
import { LOUDNESS_TARGET_LUFS, parseLoudnorm, readTagGain } from './loudness.js'

const LOUDNORM_JSON = `{
  "input_i" : "-16.42",
  "input_tp" : "-1.50",
  "measured_I" : "-16.42",
  "measured_TP" : "-1.50",
  "measured_LRA" : "4.20",
  "measured_thresh" : "-26.42",
  "offset" : "0.42",
  "linear" : true
}`

describe('parseLoudnorm', () => {
  it('derives gain and peak from ffmpeg output', () => {
    expect(parseLoudnorm(LOUDNORM_JSON)).toEqual({
      gainDb: Math.round((LOUDNESS_TARGET_LUFS + 16.42) * 10) / 10,
      peakRatio: Math.pow(10, -1.5 / 20),
    })
  })

  it('supports newer ffmpeg input_i/input_tp keys', () => {
    expect(parseLoudnorm('{"input_i":"-13.53","input_tp":"1.19"}')).toEqual({
      gainDb: Math.round((LOUDNESS_TARGET_LUFS + 13.53) * 10) / 10,
      peakRatio: Math.pow(10, 1.19 / 20),
    })
  })

  it('returns null for invalid JSON', () => {
    expect(parseLoudnorm('not json')).toBeNull()
  })

  it('returns null when measurements are missing or non-finite', () => {
    expect(parseLoudnorm('{}')).toBeNull()
    expect(parseLoudnorm('{"measured_I":"-inf","measured_TP":"-1.5"}')).toBeNull()
    expect(parseLoudnorm('{"measured_I":"-16.42"}')).toBeNull()
  })
})

describe('readTagGain', () => {
  it('reads gain and peak from ReplayGain tags', async () => {
    vi.mocked(parseFile).mockResolvedValueOnce({
      common: {
        replaygain_track_gain: { dB: -3.5 },
        replaygain_track_peak: { ratio: 0.9 },
      },
    } as never)

    await expect(readTagGain('/media/a.mp3')).resolves.toEqual({
      gainDb: -3.5,
      peakRatio: 0.9,
    })
  })

  it('allows missing peak', async () => {
    vi.mocked(parseFile).mockResolvedValueOnce({
      common: { replaygain_track_gain: { dB: 2 } },
    } as never)

    await expect(readTagGain('/media/a.mp3')).resolves.toEqual({
      gainDb: 2,
      peakRatio: null,
    })
  })

  it('returns null without usable tags or on parse errors', async () => {
    vi.mocked(parseFile).mockResolvedValueOnce({ common: {} } as never)
    await expect(readTagGain('/media/a.mp3')).resolves.toBeNull()

    vi.mocked(parseFile).mockRejectedValueOnce(new Error('no such file'))
    await expect(readTagGain('/media/missing.mp3')).resolves.toBeNull()
  })
})
