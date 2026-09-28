import { describe, expect, it } from 'vitest'
import { LOGOUT } from 'shared/actionTypes.js'
import reducer, { fetchGainStatus } from './prefs'

const activeStatus = {
  active: true,
  paused: false,
  measured: 3,
  tagged: 0,
  skipped: 0,
  total: 10,
  pct: 30,
  text: 'Measuring loudness (3/10)',
}

describe('prefs gain status', () => {
  it('populates scan progress from an active job', () => {
    const state = reducer(undefined, fetchGainStatus.fulfilled(activeStatus, ''))

    expect(state).toMatchObject({
      isScanning: true,
      scannerPct: 30,
      scannerText: 'Measuring loudness (3/10)',
      scannerJob: 'gain',
    })
  })

  it('ignores idle status', () => {
    const state = reducer(undefined, fetchGainStatus.fulfilled({ ...activeStatus, active: false }, ''))

    expect(state.isScanning).toBe(false)
  })

  it('clears scan progress on logout', () => {
    const running = reducer(undefined, fetchGainStatus.fulfilled(activeStatus, ''))
    expect(running.isScanning).toBe(true)

    const state = reducer(running, { type: LOGOUT })

    expect(state).toMatchObject({
      isScanning: false,
      scannerPct: 0,
      scannerText: '',
      scannerJob: null,
    })
  })
})
