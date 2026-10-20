import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CANCEL } from 'redux-throttle'
import { LIBRARY_FILTER_STRING } from 'shared/actionTypes'
import { setFilterStrNow } from '../../Library/modules/library'

vi.mock('lib/recentSearches', () => ({
  pushRecentSearch: vi.fn(),
}))

import { prepareLibrarySearch } from './librarySearch'
import { pushRecentSearch } from 'lib/recentSearches'

describe('prepareLibrarySearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('remembers the text and applies it synchronously', () => {
    const dispatch = vi.fn()

    prepareLibrarySearch(dispatch, '  Joyride  ')

    expect(vi.mocked(pushRecentSearch)).toHaveBeenCalledWith('library', 'Joyride')
    // settle any pending throttled library search first…
    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: CANCEL,
      payload: { type: LIBRARY_FILTER_STRING },
    })
    // …then the raw (unthrottled) action so a remounted header seeds right
    expect(dispatch).toHaveBeenNthCalledWith(2, setFilterStrNow('Joyride'))
    expect(dispatch).toHaveBeenCalledTimes(2)
  })

  it('does nothing without text in the box', () => {
    const dispatch = vi.fn()

    prepareLibrarySearch(dispatch, '   ')

    expect(pushRecentSearch).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })
})
