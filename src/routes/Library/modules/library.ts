import { createAction, createReducer } from '@reduxjs/toolkit'
import {
  LIBRARY_FILTER_STRING,
  LIBRARY_FILTER_STRING_RESET,
  LIBRARY_FILTER_TOGGLE_STARRED,
  LIBRARY_FILTER_TOGGLE_FLAWED,
  LIBRARY_PUSH,
  LOCATE_BLINKED,
  LOCATE_SONG,
  TOGGLE_ARTIST_EXPANDED,
  TOGGLE_ARTIST_RESULT_EXPANDED,
  SCROLL_ARTISTS,
} from 'shared/actionTypes'

// ------------------------------------
// Actions
// ------------------------------------
export const scrollArtists = createAction<number>(SCROLL_ARTISTS)
export const setLocateSongId = createAction<number | null>(LOCATE_SONG)
// the locate blink plays once: fired by the highlighted row when its
// pulse animation ends, so remounts (e.g. scrolling back) don't replay it
export const markLocateBlinked = createAction<void>(LOCATE_BLINKED)
export const toggleArtistExpanded = createAction<number>(TOGGLE_ARTIST_EXPANDED)
export const toggleArtistResultExpanded = createAction<{ artistId: number, isExpanded: boolean }>(TOGGLE_ARTIST_RESULT_EXPANDED)
const libraryPush = createAction<LibraryState>(LIBRARY_PUSH)

export const resetFilterStr = createAction(LIBRARY_FILTER_STRING_RESET)
export const toggleFilterStarred = createAction<void>(LIBRARY_FILTER_TOGGLE_STARRED)
export const toggleFilterFlawed = createAction<void>(LIBRARY_FILTER_TOGGLE_FLAWED)
export const setFilterStr = createAction(LIBRARY_FILTER_STRING, (payload: string) => ({
  payload,
  meta: {
    throttle: {
      wait: 350,
      leading: false,
    },
  },
}))

// ------------------------------------
// Reducer
// ------------------------------------
export interface LibraryState {
  isLoading: boolean
  version: number
  filterStr: string
  filterStarred: boolean
  filterFlawed: boolean
  scrollRow: number
  locateSongId: number | null
  locateBlinked: boolean
  expandedArtists: number[]
  expandedArtistResults: number[]
  collapsedArtistResults: number[]
}

const initialState: LibraryState = {
  isLoading: true,
  version: 0,
  filterStr: '',
  filterStarred: false,
  filterFlawed: false,
  scrollRow: 0,
  locateSongId: null,
  locateBlinked: false,
  expandedArtists: [],
  expandedArtistResults: [],
  collapsedArtistResults: [],
}

const libraryReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(setFilterStr, (state, { payload }) => {
      state.filterStr = payload
      state.locateSongId = null
    })
    .addCase(resetFilterStr, (state) => {
      state.filterStr = ''
      state.locateSongId = null
    })
    .addCase(toggleFilterStarred, (state) => {
      state.filterStarred = !state.filterStarred
      state.locateSongId = null
    })
    .addCase(toggleFilterFlawed, (state) => {
      state.filterFlawed = !state.filterFlawed
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
      state.scrollRow = payload
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
})

export default libraryReducer
