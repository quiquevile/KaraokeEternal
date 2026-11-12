import { createAction, createReducer } from '@reduxjs/toolkit'
import type {
  ProviderFetchRequester,
  ProviderFetchStatus,
  ProviderFetchView,
  ProviderSearchError,
  ProviderSearchResult,
} from 'shared/types'
import {
  LIBRARY_FILTER_STRING,
  LIBRARY_FILTER_STRING_RESET,
  LIBRARY_FILTER_TOGGLE_STARRED,
  LIBRARY_FILTER_TOGGLE_FLAWED,
  LIBRARY_FILTER_FOLDER,
  LIBRARY_FILTER_MULTI,
  LIBRARY_FILTER_PREFERRED,
  LIBRARY_PUSH,
  LOCATE_BLINKED,
  LOCATE_SONG,
  TOGGLE_ARTIST_EXPANDED,
  TOGGLE_ARTIST_RESULT_EXPANDED,
  SCROLL_ARTISTS,
  SCROLL_SEARCH_RESULTS,
  PROVIDER_SEARCH_REQUEST,
  PROVIDER_SEARCH_CANCEL,
  PROVIDER_SEARCH_RESULT,
  PROVIDER_SEARCH_PROVIDER_ERROR,
  PROVIDER_SEARCH_COMPLETE,
  PROVIDER_SEARCH_CLEAR,
  PROVIDER_FETCH_REQUEST,
  PROVIDER_FETCH_CANCEL,
  PROVIDER_FETCH_STATUS,
  _ERROR,
} from 'shared/actionTypes'

// ------------------------------------
// Actions
// ------------------------------------
export const scrollArtists = createAction<number>(SCROLL_ARTISTS)
export const setLocateSongId = createAction<number | null>(LOCATE_SONG)
// the locate blink plays once: fired by the highlighted row when its
// pulse animation ends, so remounts (e.g. scrolling back) don't replay it
export const markLocateBlinked = createAction<void>(LOCATE_BLINKED)
export const scrollSearchResults = createAction<number>(SCROLL_SEARCH_RESULTS)
export const toggleArtistExpanded = createAction<number>(TOGGLE_ARTIST_EXPANDED)
export const toggleArtistResultExpanded = createAction<{ artistId: number, isExpanded: boolean }>(TOGGLE_ARTIST_RESULT_EXPANDED)
const libraryPush = createAction<LibraryState>(LIBRARY_PUSH)

export const resetFilterStr = createAction(LIBRARY_FILTER_STRING_RESET)
export const toggleFilterStarred = createAction<void>(LIBRARY_FILTER_TOGGLE_STARRED)
export const toggleFilterFlawed = createAction<void>(LIBRARY_FILTER_TOGGLE_FLAWED)
// null = no folder filter; payload is a song folder entry ("pathId:dir")
export const setFilterFolder = createAction<string | null>(LIBRARY_FILTER_FOLDER)
export const toggleFilterMultiVersion = createAction<void>(LIBRARY_FILTER_MULTI)
// null = any; 'without'/'with' = only songs with no/preferred version marked
export const setFilterPreferred = createAction<'without' | 'with' | null>(LIBRARY_FILTER_PREFERRED)
// off → without → with → off, shared by the header cycle and any reset
export const nextPreferred = (current: 'without' | 'with' | null): 'without' | 'with' | null => {
  if (current === null) return 'without'
  if (current === 'without') return 'with'
  return null
}
export const setFilterStr = createAction(LIBRARY_FILTER_STRING, (payload: string) => ({
  payload,
  meta: {
    throttle: {
      wait: 350,
      leading: false,
    },
  },
}))

// same target, no throttle meta: external callers (queue search, song
// locate) need the value applied synchronously so a LibraryHeader remounted
// by the route change seeds its input with the new text
export const setFilterStrNow = createAction(LIBRARY_FILTER_STRING, (payload: string) => ({
  payload,
}))
export const providerSearchRequest = createAction<{ query: string, providerIds: number[] }>(PROVIDER_SEARCH_REQUEST)
export const providerSearchCancel = createAction(PROVIDER_SEARCH_CANCEL)
export const clearProviderSearch = createAction(PROVIDER_SEARCH_CLEAR)

const providerSearchResult = createAction<{ query: string, providerId: number, results: ProviderSearchResult[] }>(PROVIDER_SEARCH_RESULT)
const providerSearchProviderError = createAction<{ query: string, providerId: number, message: string }>(PROVIDER_SEARCH_PROVIDER_ERROR)
const providerSearchComplete = createAction<{ query: string }>(PROVIDER_SEARCH_COMPLETE)
// server rejected the request outright (no results or COMPLETE will follow)
const providerSearchRequestError = createAction(PROVIDER_SEARCH_REQUEST + _ERROR)

export type { ProviderFetchRequester, ProviderFetchStatus, ProviderFetchView }

export const providerFetchRequest = createAction<{
  providerId: number
  itemId: string
  title: string
  artist: string
  // optimistic display only; the server takes source/iconUrl from the provider
  source?: string
  iconUrl?: string
  duration?: number
  userId: number
  userDisplayName: string
  userDateUpdated: number
}>(PROVIDER_FETCH_REQUEST)
// userId: whose request to withdraw (a row in the queue); omitted, the
// caller's own, or every request in the room for an admin holding none
export const providerFetchCancel = createAction<{ providerId: number, itemId: string, userId?: number }>(PROVIDER_FETCH_CANCEL)
const providerFetchStatus = createAction<ProviderFetchView[]>(PROVIDER_FETCH_STATUS)

export const providerFetchKey = (providerId: number, itemId: string) => `${providerId}:${itemId}`

// ------------------------------------
// Reducer
// ------------------------------------
export interface LibraryState {
  isLoading: boolean
  version: number
  filterStr: string
  filterStarred: boolean
  filterFlawed: boolean
  filterFolder: string | null
  filterMultiVersion: boolean
  filterPreferred: 'without' | 'with' | null
  scrollRow: number
  locateSongId: number | null
  locateBlinked: boolean
  expandedArtists: number[]
  expandedArtistResults: number[]
  collapsedArtistResults: number[]
  searchScrollOffset: number
  providerSearchQuery: string
  isProviderSearchActive: boolean
  providerResults: ProviderSearchResult[]
  providerErrors: ProviderSearchError[]
  providerFetches: Record<string, ProviderFetchView>
}

const initialState: LibraryState = {
  isLoading: true,
  version: 0,
  filterStr: '',
  filterStarred: false,
  filterFlawed: false,
  filterFolder: null,
  filterMultiVersion: false,
  filterPreferred: null,
  scrollRow: 0,
  locateSongId: null,
  locateBlinked: false,
  expandedArtists: [],
  expandedArtistResults: [],
  collapsedArtistResults: [],
  searchScrollOffset: 0,
  providerSearchQuery: '',
  isProviderSearchActive: false,
  providerResults: [],
  providerErrors: [],
  providerFetches: {},
}

const resetProviderSearch = (state: LibraryState) => {
  state.providerSearchQuery = ''
  state.isProviderSearchActive = false
  state.providerResults = []
  state.providerErrors = []
}

const libraryReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(setFilterStr, (state, { payload }) => {
      state.filterStr = payload
      state.locateSongId = null
      state.searchScrollOffset = 0

      if (payload !== state.providerSearchQuery) {
        state.providerResults = []
        state.providerErrors = []
        state.isProviderSearchActive = false
      }
    })
    .addCase(resetFilterStr, (state) => {
      state.filterStr = ''
      state.locateSongId = null
      state.searchScrollOffset = 0
      resetProviderSearch(state)
    })
    .addCase(toggleFilterStarred, (state) => {
      state.filterStarred = !state.filterStarred
      state.locateSongId = null
      state.searchScrollOffset = 0
    })
    .addCase(toggleFilterFlawed, (state) => {
      state.filterFlawed = !state.filterFlawed
      state.locateSongId = null
    })
    .addCase(setFilterFolder, (state, { payload }) => {
      state.filterFolder = payload
      state.locateSongId = null
    })
    .addCase(toggleFilterMultiVersion, (state) => {
      state.filterMultiVersion = !state.filterMultiVersion
      state.locateSongId = null
    })
    .addCase(setFilterPreferred, (state, { payload }) => {
      state.filterPreferred = payload
      state.locateSongId = null
    })
    .addCase(setLocateSongId, (state, { payload }) => {
      state.locateSongId = payload
      state.locateBlinked = false
    })
    .addCase(markLocateBlinked, (state) => {
      state.locateBlinked = true
    })
    .addCase(scrollArtists, (state, { payload }) => {
      // ArtistList saves/restores visible rows (locate-aware), not pixels
      state.scrollRow = payload
    })
    .addCase(scrollSearchResults, (state, { payload }) => {
      state.searchScrollOffset = payload
    })
    .addCase(toggleArtistExpanded, (state, { payload }) => {
      const idx = state.expandedArtists.indexOf(payload)

      if (idx === -1) state.expandedArtists.push(payload)
      else state.expandedArtists.splice(idx, 1)
    })
    .addCase(toggleArtistResultExpanded, (state, { payload }) => {
      // explicit user collapse wins over auto-expansion and vice versa
      const inExpanded = state.expandedArtistResults.indexOf(payload.artistId)
      const inCollapsed = state.collapsedArtistResults.indexOf(payload.artistId)

      if (payload.isExpanded) {
        if (inExpanded !== -1) state.expandedArtistResults.splice(inExpanded, 1)
        if (inCollapsed === -1) state.collapsedArtistResults.push(payload.artistId)
      } else {
        if (inCollapsed !== -1) state.collapsedArtistResults.splice(inCollapsed, 1)
        if (inExpanded === -1) state.expandedArtistResults.push(payload.artistId)
      }
    })
    .addCase(libraryPush, (state, { payload }) => ({
      ...state,
      isLoading: false,
      version: payload.version,
    }))
    .addCase(providerSearchRequest, (state, { payload }) => {
      state.providerSearchQuery = payload.query
      state.isProviderSearchActive = true
      state.providerResults = []
      state.providerErrors = []
      // The server omits items whose song is in the library, so 'complete'
      // entries (which only hide results) could only go stale, e.g. if the
      // song has since been removed
      for (const [k, item] of Object.entries(state.providerFetches)) {
        if (item.status === 'complete') delete state.providerFetches[k]
      }
    })
    .addCase(providerSearchResult, (state, { payload }) => {
      if (payload.query !== state.providerSearchQuery) return
      for (const r of payload.results) {
        state.providerResults.push(r)
      }
    })
    .addCase(providerSearchProviderError, (state, { payload }) => {
      if (payload.query !== state.providerSearchQuery) return
      state.providerErrors.push({ providerId: payload.providerId, message: payload.message })
    })
    .addCase(providerSearchComplete, (state, { payload }) => {
      if (payload.query !== state.providerSearchQuery) return
      state.isProviderSearchActive = false
    })
    .addCase(providerSearchCancel, (state) => {
      state.isProviderSearchActive = false
    })
    .addCase(providerSearchRequestError, (state) => {
      state.isProviderSearchActive = false
    })
    .addCase(clearProviderSearch, resetProviderSearch)
    .addCase(providerFetchRequest, (state, { payload }) => {
      const k = providerFetchKey(payload.providerId, payload.itemId)
      const existing = state.providerFetches[k]
      const requester: ProviderFetchRequester = {
        userId: payload.userId,
        userDisplayName: payload.userDisplayName,
        userDateUpdated: payload.userDateUpdated,
        timestamp: Math.floor(Date.now() / 1000),
      }
      // Already in flight (or done) for someone here: join it rather than
      // clobbering the server-pushed status
      if (existing && existing.status !== 'error' && existing.status !== 'canceled') {
        if (!existing.requests.some(r => r.userId === payload.userId)) existing.requests.push(requester)
        return
      }
      // A retry after an error keeps the other requesters, as the server does;
      // a canceled fetch has none left
      const others = existing?.status === 'error'
        ? existing.requests.filter(r => r.userId !== payload.userId)
        : []
      state.providerFetches[k] = {
        providerId: payload.providerId,
        itemId: payload.itemId,
        status: 'pending',
        progress: 0,
        title: payload.title,
        artist: payload.artist,
        source: payload.source,
        iconUrl: payload.iconUrl,
        duration: payload.duration,
        requests: [...others, requester],
      }
    })
    .addCase(providerFetchStatus, (state, { payload }) => {
      for (const item of payload) {
        state.providerFetches[providerFetchKey(item.providerId, item.itemId)] = item
      }
    })
})

export default libraryReducer
