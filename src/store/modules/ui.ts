import { AnyAction, createAction, createAsyncThunk, createReducer } from '@reduxjs/toolkit'
import {
  CLEAR_ERROR_MESSAGE,
  FOOTER_HEIGHT_CHANGE,
  HEADER_HEIGHT_CHANGE,
  LOGOUT,
  QUEUE_FILTER_STRING,
  QUEUE_FILTER_STRING_RESET,
  QUEUE_FILTER_TOGGLE_STARRED,
  QUEUE_FILTER_USER,
  SHOW_ERROR_MESSAGE,
  UI_SET_LOCALE,
  UI_WINDOW_RESIZE,
} from 'shared/actionTypes'
import { getInitialLocale, persistLocale, type LocaleCode } from 'lib/intl'
import { AppThunk, RootState } from 'store/store'

const MAX_CONTENT_WIDTH = 768
let scrollLockTimer: ReturnType<typeof setTimeout> | null

// ------------------------------------
// Actions
// ------------------------------------
export const clearErrorMessage = createAction(CLEAR_ERROR_MESSAGE)
export const showErrorMessage = createAction<string>(SHOW_ERROR_MESSAGE)

// per-device UI language (localStorage, not a server pref: one room,
// many languages)
export const setLocale = createAction<LocaleCode>(UI_SET_LOCALE)

export const requestLocale = (locale: LocaleCode): AppThunk => (dispatch) => {
  persistLocale(locale)
  dispatch(setLocale(locale))
}

export const setHeaderHeight = createAsyncThunk<void, number, { state: RootState }>('ui/SET_HEADER_HEIGHT', async (height: number, { dispatch, getState }) => {
  if (getState().ui.headerHeight === height) return
  dispatch({
    type: HEADER_HEIGHT_CHANGE,
    payload: height ?? 0, // height might be undefined if Header renders nothing
  })
})

export const setFooterHeight = createAsyncThunk<void, number, { state: RootState }>('ui/SET_FOOTER_HEIGHT', async (height: number, { dispatch, getState }) => {
  if (getState().ui.footerHeight === height) return
  dispatch({
    type: FOOTER_HEIGHT_CHANGE,
    payload: height ?? 0, // height might be undefined if Header renders nothing
  })
})

export const windowResize = createAction(UI_WINDOW_RESIZE, window => ({
  payload: window,
  meta: {
    throttle: {
      wait: 200,
      leading: false,
    },
  },
}))

// queue filters (client-side only, reset on logout); the text filter is
// not throttled: the list is small and a trailing dispatch would race
// with an immediate reset (Escape/Clear) and resurrect stale text
export const setQueueFilterStr = createAction<string>(QUEUE_FILTER_STRING)

export const resetQueueFilterStr = createAction(QUEUE_FILTER_STRING_RESET)
export const toggleQueueFilterStarred = createAction(QUEUE_FILTER_TOGGLE_STARRED)
export const setQueueFilterUser = createAction<number | null>(QUEUE_FILTER_USER)

// does not dispatch anything (only affects the DOM)
export const lockScrolling = (lock: boolean) => {
  if (lock) {
    clearTimeout(scrollLockTimer)
    scrollLockTimer = null
    document.body.classList.add('scroll-lock')
  } else if (!scrollLockTimer) {
    scrollLockTimer = setTimeout(() => {
      scrollLockTimer = null
      document.body.classList.remove('scroll-lock')
    }, 200)
  }
}
const footerHeightChange = createAction<number>(FOOTER_HEIGHT_CHANGE)
const headerHeightChange = createAction<number>(HEADER_HEIGHT_CHANGE)

// ------------------------------------
// Reducer
// ------------------------------------
export interface UIState {
  isErrored: boolean
  errorMessage: string | null
  footerHeight: number
  headerHeight: number
  innerWidth: number
  innerHeight: number
  contentWidth: number
  locale: LocaleCode
  filterStr: string
  filterStarred: boolean
  filterUserId: number | null
}

const initialState: UIState = {
  isErrored: false,
  errorMessage: null,
  footerHeight: 0,
  headerHeight: 0,
  innerWidth: window.innerWidth,
  innerHeight: window.innerHeight,
  contentWidth: Math.min(window.innerWidth, MAX_CONTENT_WIDTH),
  locale: getInitialLocale(),
  filterStr: '',
  filterStarred: false,
  filterUserId: null,
}

const uiReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(headerHeightChange, (state, { payload }) => {
      state.headerHeight = payload
    })
    .addCase(footerHeightChange, (state, { payload }) => {
      state.footerHeight = payload
    })
    .addCase(showErrorMessage, (state, { payload }) => {
      state.isErrored = true
      state.errorMessage = payload
    })
    .addCase(clearErrorMessage, (state) => {
      state.isErrored = false
    })
    .addCase(windowResize, (state, { payload }) => {
      state.innerWidth = payload.innerWidth
      state.innerHeight = payload.innerHeight
      state.contentWidth = Math.min(payload.innerWidth, MAX_CONTENT_WIDTH)
    })
    .addCase(setLocale, (state, { payload }) => {
      state.locale = payload
    })
    .addCase(setQueueFilterStr, (state, { payload }) => {
      state.filterStr = payload
    })
    .addCase(resetQueueFilterStr, (state) => {
      state.filterStr = ''
    })
    .addCase(toggleQueueFilterStarred, (state) => {
      state.filterStarred = !state.filterStarred
    })
    .addCase(setQueueFilterUser, (state, { payload }) => {
      state.filterUserId = payload
    })
    .addCase(LOGOUT, (state) => {
      state.filterStr = ''
      state.filterStarred = false
      state.filterUserId = null
    })
    .addMatcher(
      (action): action is AnyAction => !!action.error,
      (state, { error }) => {
        state.isErrored = true
        state.errorMessage = error.message ?? error
      },
    )
})

export default uiReducer
