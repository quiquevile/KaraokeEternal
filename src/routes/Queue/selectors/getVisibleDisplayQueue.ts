import { RootState } from 'store/store'
import { createSelector } from '@reduxjs/toolkit'
import getDisplayQueue, { type DisplayRow } from './getDisplayQueue'
import getVisibleQueue from './getVisibleQueue'

const getFilterStr = (state: RootState) => state.ui.filterStr.trim().toLowerCase()
const getFilterStarred = (state: RootState) => state.ui.filterStarred
const getFilterUserId = (state: RootState) => state.ui.filterUserId

// The queue as shown, minus rows excluded by the queue filters. Queued rows
// defer to getVisibleQueue's predicates; an in-flight provider song has no
// songId yet, so text matches its own title/artist, the user filter applies
// to its requester, and a starred filter can only exclude it.
const getVisibleDisplayQueue = createSelector(
  [getDisplayQueue, getVisibleQueue, getFilterStr, getFilterStarred, getFilterUserId],
  (rows, visibleQueue, str, filterStarred, filterUserId): DisplayRow[] => {
    if (!str && !filterStarred && filterUserId === null) return rows

    const visibleIds = new Set(visibleQueue.result)

    return rows.filter((row) => {
      if (row.kind === 'queue') return visibleIds.has(row.queueId)

      if (filterStarred) return false
      if (filterUserId !== null && row.userId !== filterUserId) return false

      if (str) {
        const haystack = `${row.item.title} ${row.item.artist}`.toLowerCase()
        if (!haystack.includes(str)) return false
      }

      return true
    })
  },
)

export default getVisibleDisplayQueue
