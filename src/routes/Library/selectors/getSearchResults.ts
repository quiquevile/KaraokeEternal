import { ensureState } from 'redux-optimistic-ui'
import { createSelector } from '@reduxjs/toolkit'
import { Searcher } from 'fast-fuzzy'
import { RootState } from 'store/store'

const THRESHOLD = 0.7

// strip accents and all punctuation/symbols from keys and query alike; fast-fuzzy's
// ignoreSymbols only knows ASCII ones, so curly quotes (iOS smart punctuation) and
// accented letters would otherwise cost a full edit each. A spaced "&" reads as "and"
// so either spelling finds the other; unspaced ones (R&B, M&M) just drop out, since
// single-letter tokens would match nearly everything
const fold = (str: string) => str
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+&\s+/g, ' and ')
  .replace(/[\p{P}\p{S}]/gu, '')
  .normalize('NFC')

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

// titles only: an artist-name hit is reported through nameHits and keeps the
// row collapsed, so feeding artist names in here would defeat autoExpanded
const getTreeSongSearcher = createSelector(
  [getSongs],
  songs => new Searcher(songs.result as unknown as object[], {
    keySelector: ((songId: number) => songs.entities[songId].title) as unknown as (s: object) => string,
    threshold: 0.8,
  }),
)

// flat search matches "artist title" so a single-word artist query returns
// all of their songs
const getSongSearcher = createSelector(
  [getSongs, getArtists],
  (songs, artists) => new Searcher(songs.result as unknown as object[], {
    keySelector: ((songId: number) => {
      const song = songs.entities[songId]
      const artist = artists.entities[song.artistId]
      return fold(`${artist?.name ?? ''} ${song.title}`)
    }) as unknown as (s: object) => string,
    threshold: THRESHOLD,
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
  [getArtists, getSongs, getArtistSearcher, getTreeSongSearcher, getFilterStr, getFilterStarred, getStarredSongs, getFilterFlawed, getFlawedSongs, getFilterFolder, getFilterMultiVersion, getFilterPreferred],
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

const getRankedSongs = createSelector(
  [getSongs, getFilterStr, getSongSearcher],
  (songs, filterStr, searcher) => {
    if (!filterStr) return songs.result

    // symbol-only tokens like "&" fold to nothing; an empty term matches no songs
    const tokens = fold(filterStr).split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return songs.result

    // run each token through the trie-backed searcher; intersect across tokens
    let scores: Map<number, number> | null = null

    for (const token of tokens) {
      const matches = searcher.search(token, { returnMatchData: true })
      const tokenScores = new Map<number, number>()
      for (const m of matches) {
        tokenScores.set(m.item as unknown as number, m.score)
      }

      if (scores === null) {
        scores = tokenScores
      } else {
        // intersect: keep only songs present in every token's matches; sum scores
        const next = new Map<number, number>()
        for (const [id, prev] of scores) {
          const s = tokenScores.get(id)
          if (s !== undefined) next.set(id, prev + s)
        }
        scores = next
      }

      if (scores.size === 0) return []
    }

    if (!scores) return songs.result

    return [...scores.entries()]
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1]
        const titleA = songs.entities[a[0]]?.title ?? ''
        const titleB = songs.entities[b[0]]?.title ?? ''
        return titleA.localeCompare(titleB)
      })
      .map(([id]) => id)
  },
)

const getSongsByView = createSelector(
  [getRankedSongs, getFilterStarred, getStarredSongs],
  (rankedSongs, filterStarred, starredSongs) =>
    filterStarred
      ? rankedSongs.filter(songId => starredSongs.includes(songId))
      : rankedSongs,
)

const getSearchResults = createSelector(
  [getSongsByView],
  songsResult => ({ songsResult }),
)

export { getSearchResults }
