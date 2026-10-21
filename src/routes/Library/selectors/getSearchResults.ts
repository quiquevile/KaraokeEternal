import { ensureState } from 'redux-optimistic-ui'
import { createSelector } from '@reduxjs/toolkit'
import { Searcher } from 'fast-fuzzy'
import { RootState } from 'store/store'

const getArtists = (state: RootState) => state.artists
const getSongs = (state: RootState) => state.songs
const getFilterStr = (state: RootState) => state.library.filterStr.trim().toLowerCase()
const getFilterStarred = (state: RootState) => state.library.filterStarred
const getFilterFlawed = (state: RootState) => state.library.filterFlawed
const getFilterFolder = (state: RootState) => state.library.filterFolder
const getFilterMultiVersion = (state: RootState) => state.library.filterMultiVersion
const getFilterPreferred = (state: RootState) => state.library.filterPreferred
const getStarredSongs = (state: RootState) => ensureState(state.userStars).starredSongs
const getFlawedSongs = (state: RootState) => ensureState(state.userFlaws).flawedSongs

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
// the flag/folder/version filters); a name-matching artist lists all its
// passing songs, otherwise only the title-matching ones
const getSearchTree = createSelector(
  [getArtists, getSongs, getArtistSearcher, getSongSearcher, getFilterStr, getFilterStarred, getStarredSongs, getFilterFlawed, getFlawedSongs, getFilterFolder, getFilterMultiVersion, getFilterPreferred],
  (artists, songs, artistSearcher, songSearcher, str, filterStarred, starredSongs, filterFlawed, flawedSongs, filterFolder, filterMultiVersion, filterPreferred) => {
    const hasText = str.length > 0
    // fast-fuzzy ignores symbols by default, so a query with no letters
    // or digits at all ("&", "!!!") normalizes to an empty string and
    // matches nothing — fall back to a literal substring match, same
    // semantics as the queue text filter
    const literalOnly = hasText && !/[a-z0-9]/.test(str)
    const nameHits = new Set<number>(hasText
      ? literalOnly
        ? artists.result.filter(artistId => artists.entities[artistId]?.name.toLowerCase().includes(str))
        : artistSearcher.search(str, { returnMatchData: true }).map(match => match.item as unknown as number)
      : [])
    const titleHits = new Set<number>(hasText
      ? literalOnly
        ? songs.result.filter(songId => songs.entities[songId]?.title.toLowerCase().includes(str))
        : songSearcher.search(str, { returnMatchData: true }).map(match => match.item as unknown as number)
      : [])

    const flagOK = (songId: number): boolean => {
      const song = songs.entities[songId]

      if (filterStarred && !starredSongs.includes(songId)) return false
      if (filterFlawed && !flawedSongs.includes(songId)) return false
      if (filterFolder !== null && !song?.folders.includes(filterFolder)) return false
      if (filterMultiVersion && (song?.numMedia ?? 0) < 2) return false
      if (filterPreferred === 'with' && !song?.isPreferred) return false
      if (filterPreferred === 'without' && !!song?.isPreferred) return false
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
