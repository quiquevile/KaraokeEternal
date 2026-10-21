import { describe, expect, it } from 'vitest'
import {
  PLAYER_DISPLAY_DEFAULTS,
  PROGRESS_CYCLE,
  formatPitch,
  formatRemaining,
  getPlayerDisplayPrefs,
  isNextUpVisible,
  isProgressVisible,
  nextProgressState,
  progressElements,
} from './playerDisplay'

describe('playerDisplay', () => {
  it('fills missing prefs with defaults', () => {
    expect(getPlayerDisplayPrefs()).toEqual(PLAYER_DISPLAY_DEFAULTS)
    expect(getPlayerDisplayPrefs(null)).toEqual(PLAYER_DISPLAY_DEFAULTS)
    expect(getPlayerDisplayPrefs({ nextUpLeadMs: 10000 })).toEqual({
      ...PLAYER_DISPLAY_DEFAULTS,
      nextUpLeadMs: 10000,
    })
  })

  it('rejects non-numeric or negative pref values', () => {
    const prefs = getPlayerDisplayPrefs({ pitchToastMs: -5, upNowDurationMs: NaN } as never)

    expect(prefs.pitchToastMs).toBe(PLAYER_DISPLAY_DEFAULTS.pitchToastMs)
    expect(prefs.upNowDurationMs).toBe(PLAYER_DISPLAY_DEFAULTS.upNowDurationMs)
  })

  it('shows the next singer only inside the lead window', () => {
    // 3:30 song, 20 s left, 30 s lead: visible
    expect(isNextUpVisible(190, 210, 30000, 5000, true)).toBe(true)
    // 40 s left: hidden
    expect(isNextUpVisible(170, 210, 30000, 5000, true)).toBe(false)
    // no next song: hidden
    expect(isNextUpVisible(190, 210, 30000, 5000, false)).toBe(false)
    // unknown duration: hidden
    expect(isNextUpVisible(190, 0, 30000, 5000, true)).toBe(false)
  })

  it('hides the next singer while the current one is still announced', () => {
    // 2 s in on a 20 s song with a 30 s lead: hidden until the UpNow badge is gone
    expect(isNextUpVisible(2, 20, 30000, 5000, true)).toBe(false)
    expect(isNextUpVisible(6, 20, 30000, 5000, true)).toBe(true)
  })

  it('formats remaining time as -M:SS', () => {
    expect(formatRemaining(190, 210)).toBe('-0:20')
    expect(formatRemaining(0, 210)).toBe('-3:30')
    expect(formatRemaining(209.6, 210)).toBe('-0:00')
    expect(formatRemaining(0, 0)).toBe(null)
    expect(formatRemaining(0, NaN)).toBe(null)
  })

  it('shows progress only while playing a known song with an element enabled', () => {
    expect(isProgressVisible(true, false, 210, {}, true)).toBe(true)
    expect(isProgressVisible(true, false, 210, undefined, true)).toBe(true)
    expect(isProgressVisible(false, false, 210, {}, true)).toBe(false)
    expect(isProgressVisible(true, true, 210, {}, true)).toBe(false)
    expect(isProgressVisible(true, false, 210, {}, false)).toBe(false)
    expect(isProgressVisible(true, false, 0, {}, true)).toBe(false)
    // hiding the bar alone keeps the row (the other elements stay on)
    expect(isProgressVisible(true, false, 210, { isEnabled: false }, true)).toBe(true)
    // only the bar enabled keeps the row too
    expect(
      isProgressVisible(true, false, 210, { showTitle: false, showSinger: false, showTime: false }, true),
    ).toBe(true)
    // every element off hides the whole row
    expect(
      isProgressVisible(
        true,
        false,
        210,
        { isEnabled: false, showTitle: false, showSinger: false, showTime: false },
        true,
      ),
    ).toBe(false)
  })

  it('formats pitch with an explicit sign except zero', () => {
    expect(formatPitch(0)).toBe('0 st')
    expect(formatPitch(2)).toBe('+2 st')
    expect(formatPitch(-2)).toBe('-2 st')
  })

  it('cycles through the five canonical progress states', () => {
    // default prefs (all on) → wraps to start of cycle
    expect(nextProgressState(undefined)).toEqual(PROGRESS_CYCLE[0])
    expect(nextProgressState({})).toEqual(PROGRESS_CYCLE[0])
    // bar-only (prefs shape) → +time
    expect(nextProgressState({ showTime: false, showTitle: false, showSinger: false }))
      .toEqual(PROGRESS_CYCLE[2])
    // step through the ring from the start (input in prefs shape)
    expect(nextProgressState({ isEnabled: false, showTime: false, showTitle: false, showSinger: false }))
      .toEqual(PROGRESS_CYCLE[1])
    expect(nextProgressState({ showTime: false, showTitle: false, showSinger: false }))
      .toEqual(PROGRESS_CYCLE[2])
    expect(nextProgressState({ showTitle: false, showSinger: false }))
      .toEqual(PROGRESS_CYCLE[3])
    expect(nextProgressState({ showSinger: false }))
      .toEqual(PROGRESS_CYCLE[4])
    expect(nextProgressState({})).toEqual(PROGRESS_CYCLE[0])
  })

  it('resets to the start of the cycle for a non-canonical combination', () => {
    // singer-only (hand-tuned in Player Options) is not in the ring
    expect(nextProgressState({ isEnabled: false, showSinger: true, showTime: false, showTitle: false }))
      .toEqual(PROGRESS_CYCLE[0])
    // bar + title but no time is also non-canonical
    expect(nextProgressState({ showTime: false, showTitle: true, showSinger: false }))
      .toEqual(PROGRESS_CYCLE[0])
  })

  it('maps progress prefs to elements consistently', () => {
    expect(progressElements({ showTime: false, showTitle: false, showSinger: false })).toEqual({
      bar: true, time: false, title: false, singer: false,
    })
    expect(progressElements({})).toEqual({
      bar: true, time: true, title: true, singer: true,
    })
  })
})
