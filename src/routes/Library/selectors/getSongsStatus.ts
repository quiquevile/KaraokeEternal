import { RootState } from 'store/store'
import { createSelector, type Selector } from '@reduxjs/toolkit'
import { ensureState } from 'redux-optimistic-ui'
import { parseNumberArray } from 'lib/util'

const getQueue = (state: RootState) => ensureState(state.queue)
const getCurrentQueueId = (state: RootState) => state.status.isAtQueueEnd ? undefined : state.status.queueId
const getPlayerHistoryJSON = (state: RootState) => state.status.historyJSON

type SongsStatus = {
  played: Set<number>
  upcoming: Set<number>
  current: number | undefined
}

const getSongsStatus: Selector<RootState, SongsStatus> = createSelector(
  [getQueue, getCurrentQueueId, getPlayerHistoryJSON],
  (queue, curId, historyJSON): SongsStatus => {
    // parseNumberArray tolerates a corrupted/legacy value where a bare
    // JSON.parse would throw inside the selector and take down the view
    const historySet = new Set(parseNumberArray(historyJSON))
    const played = new Set<number>()
    const upcoming = new Set<number>()

    queue.result.forEach((queueId) => {
      const songId = queue.entities[queueId].songId
      if (historySet.has(queueId)) {
        played.add(songId)
      } else if (queueId !== curId) {
        upcoming.add(songId)
      }
    })

    return { played, upcoming, current: queue.entities[curId]?.songId }
  },
)

export default getSongsStatus
