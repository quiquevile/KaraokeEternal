import { setYoutubeQuery, searchYoutubeVideos } from 'store/modules/youtube'
import { pushRecentSearch } from 'lib/recentSearches'
import type { AppDispatch } from 'store/store'

/**
 * Jumps to the YouTube tab searching for the given text: an explicit search
 * counts for both histories (each push honors its own limit)
 */
export function openYoutubeSearch (dispatch: AppDispatch, text: string): void {
  const trimmed = text.trim()

  if (!trimmed) return

  pushRecentSearch('library', trimmed)
  pushRecentSearch('youtube', trimmed)

  dispatch(setYoutubeQuery(trimmed))
  void dispatch(searchYoutubeVideos(trimmed))
}
