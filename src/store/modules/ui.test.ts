import { beforeAll, describe, expect, it, vi } from 'vitest'
import { LOGOUT } from 'shared/actionTypes'

// the ui slice reads window/navigator at module scope, so it must be
// imported lazily after the globals are stubbed
vi.stubGlobal('window', {
  innerWidth: 1280,
  innerHeight: 720,
  navigator: { language: 'en-US' },
  localStorage: {
    getItem: (): string | null => null,
    setItem: (): void => {},
    removeItem: (): void => {},
  },
})
vi.stubGlobal('navigator', { language: 'en-US' })

let ui: typeof import('./ui')

beforeAll(async () => {
  ui = await import('./ui')
})

describe('ui queue filters', () => {
  it('starts with no filters', () => {
    const state = ui.default(undefined, { type: '@@INIT' })

    expect(state.filterStr).toBe('')
    expect(state.filterStarred).toBe(false)
    expect(state.filterUserId).toBe(null)
  })

  it('sets and resets the queue search string', () => {
    let state = ui.default(undefined, ui.setQueueFilterStr('joyride'))

    expect(state.filterStr).toBe('joyride')

    state = ui.default(state, ui.resetQueueFilterStr())

    expect(state.filterStr).toBe('')
  })

  it('toggles the starred-only queue filter', () => {
    let state = ui.default(undefined, ui.toggleQueueFilterStarred())

    expect(state.filterStarred).toBe(true)

    state = ui.default(state, ui.toggleQueueFilterStarred())

    expect(state.filterStarred).toBe(false)
  })

  it('sets and clears the queue user filter', () => {
    let state = ui.default(undefined, ui.setQueueFilterUser(3))

    expect(state.filterUserId).toBe(3)

    state = ui.default(state, ui.setQueueFilterUser(null))

    expect(state.filterUserId).toBe(null)
  })

  it('resets every queue filter on logout', () => {
    let state = ui.default(undefined, ui.setQueueFilterStr('roxette'))
    state = ui.default(state, ui.toggleQueueFilterStarred())
    state = ui.default(state, ui.setQueueFilterUser(3))

    state = ui.default(state, { type: LOGOUT })

    expect(state.filterStr).toBe('')
    expect(state.filterStarred).toBe(false)
    expect(state.filterUserId).toBe(null)
  })
})
