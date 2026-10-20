import { CANCEL } from 'redux-throttle'
import { LIBRARY_FILTER_STRING } from 'shared/actionTypes'
import { setFilterStrNow } from '../../Library/modules/library'
import { pushRecentSearch } from 'lib/recentSearches'
import type { AppDispatch } from 'store/store'

/**
 * Hands the queue's search text over to the library: remembers it in the
 * library history, settles any pending throttled library search and applies
 * the text synchronously (the LibraryHeader remounting on the route change
 * seeds its input from the store)
 */
export function prepareLibrarySearch (dispatch: AppDispatch, text: string): void {
  const trimmed = text.trim()

  if (!trimmed) return

  pushRecentSearch('library', trimmed)

  dispatch({ type: CANCEL, payload: { type: LIBRARY_FILTER_STRING } })
  dispatch(setFilterStrNow(trimmed))
}
