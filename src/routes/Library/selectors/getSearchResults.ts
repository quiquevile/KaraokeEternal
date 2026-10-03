import { ensureState } from 'redux-optimistic-ui'
import { createSelector } from '@reduxjs/toolkit'
import { Searcher } from 'fast-fuzzy'
import { RootState } from 'store/store'

const getArtists = (state: RootState) => state.artists
const getSongs = (state: RootState) => state.songs
const getFilterStr = (state: RootState) => state.library.filterStr.trim().toLowerCase()
const getFilterStarred = (state: RootState) => state.library.filterStarred
const getFilterDownloaded = (state: RootState) => state.library.filterDownloaded
const getStarredSongs = (state: RootState) => ensureState(state.userStars).starredSongs

const getArtistSearcher = createSelector(
  [getArtists],
  artists => new Searcher(artists.result as unknown as object[], {
    keySelector: ((artistId: number) => artists.entities[artistId].name) as unknown as (s: object) => string,
    threshold: 0.8,
  }),
)

const getSongSearcher = createSelector(
  [getSongs],
  songs => new Searcher(songs.result as unknown as object[], {
    keySelector: ((songId: number) => songs.entities[songId].title) as unknown as (s: object) => string,
    threshold: 0.8,
  }),
)

export interface SearchTreeNode {
  artistId: number
  songIds: number[]
  autoExpanded: boolean
}

// the search view is always an artist tree (never loose songs): an artist
// is listed when its name matches or one of its songs matches (and passes
// the starred/downloaded filters); a name-matching artist lists all its
// passing songs, otherwise only the title-matching ones
const getSearchTree = createSelector(
  [getArtists, getSongs, getArtistSearcher, getSongSearcher, getFilterStr, getFilterStarred, getStarredSongs, getFilterDownloaded],
  (artists, songs, artistSearcher, songSearcher, str, filterStarred, starredSongs, filterDownloaded) => {
    const hasText = str.length > 0
    const nameHits = new Set<number>(hasText
      ? artistSearcher.search(str, { returnMatchData: true }).map(match => match.item as unknown as number)
      : [])
    const titleHits = new Set<number>(hasText
      ? songSearcher.search(str, { returnMatchData: true }).map(match => match.item as unknown as number)
      : [])

    const flagOK = (songId: number): boolean => {
      if (filterStarred && !starredSongs.includes(songId)) return false
      if (filterDownloaded && !songs.entities[songId]?.isDownloaded) return false
      return true
    }

    const tree: SearchTreeNode[] = []

    for (const artistId of artists.result) {
      const songIds = artists.entities[artistId]?.songIds ?? []
      const nameOK = !hasText || nameHits.has(artistId)
      const listed = songIds.filter(songId =>
        flagOK(songId) && (titleHits.has(songId) || nameOK),
      )

      if (!listed.length) continue

      tree.push({
        artistId,
        songIds: listed,
        autoExpanded: !hasText || listed.some(songId => titleHits.has(songId)),
      })
    }

    return tree
  },
)

export default getSearchTree
