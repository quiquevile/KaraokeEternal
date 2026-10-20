import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('store/modules/youtube', () => ({
  setYoutubeQuery: (payload: string) => ({ type: 'youtube/query', payload }),
  searchYoutubeVideos: (payload: string) => ({ type: 'youtube/search', payload }),
}))

vi.mock('lib/recentSearches', () => ({
  pushRecentSearch: vi.fn(),
}))

import { openYoutubeSearch } from './youtubeSearch'
import { pushRecentSearch } from 'lib/recentSearches'

describe('openYoutubeSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('remembers the text in both histories and hands it to the youtube search', () => {
    const dispatch = vi.fn()

    openYoutubeSearch(dispatch, '  Roxette  ')

    expect(vi.mocked(pushRecentSearch)).toHaveBeenCalledWith('library', 'Roxette')
    expect(vi.mocked(pushRecentSearch)).toHaveBeenCalledWith('youtube', 'Roxette')
    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'youtube/query', payload: 'Roxette' })
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'youtube/search', payload: 'Roxette' })
    expect(dispatch).toHaveBeenCalledTimes(2)
  })

  it('does nothing without text', () => {
    const dispatch = vi.fn()

    openYoutubeSearch(dispatch, '')

    expect(pushRecentSearch).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })
})
