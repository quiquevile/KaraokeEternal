import { RootState } from 'store/store'
import { ensureState } from 'redux-optimistic-ui'
import { createSelector } from '@reduxjs/toolkit'
import getRoundRobinQueue from './getRoundRobinQueue'

const getFilterStr = (state: RootState) => state.ui.filterStr.trim().toLowerCase()
const getFilterStarred = (state: RootState) => state.ui.filterStarred
const getFilterUserId = (state: RootState) => state.ui.filterUserId
const getSongs = (state: RootState) => state.songs
const getArtists = (state: RootState) => state.artists
const getStarredSongs = (state: RootState) => ensureState(state.userStars).starredSongs

// display-only queue: round-robin order minus songs excluded by the
// queue filters (header, status and movement keep the raw queue)
const getVisibleQueue = createSelector(
  [getRoundRobinQueue, getFilterStr, getFilterStarred, getFilterUserId, getSongs, getArtists, getStarredSongs],
  (queue, str, filterStarred, filterUserId, songs, artists, starredSongs) => {
    if (!str && !filterStarred && filterUserId === null) return queue

    const result = queue.result.filter((queueId) => {
      const item = queue.entities[queueId]

      if (filterStarred && !starredSongs.includes(item.songId)) return false
      if (filterUserId !== null && item.userId !== filterUserId) return false

      if (str) {
        const song = songs.entities[item.songId]
        if (!song) return false

        const artist = artists.entities[song.artistId]
        const haystack = `${song.title} ${artist?.name ?? ''}`.toLowerCase()

        if (!haystack.includes(str)) return false
      }

      return true
    })

    if (result.length === queue.result.length) return queue

    return { result, entities: queue.entities }
  },
)

export default getVisibleQueue
