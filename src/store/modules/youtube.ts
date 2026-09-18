import { createAction, createAsyncThunk, createReducer } from '@reduxjs/toolkit'
import HttpApi from 'lib/HttpApi'

const api = new HttpApi('youtube')

// ------------------------------------
// Types
// ------------------------------------
export interface YouTubeResult {
  alreadyDownloaded?: boolean
  artist: string
  duration: number
  durationLabel: string
  id: string
  thumbnail: string
  title: string
  url: string
}

export type DownloadJobStatus = 'queued' | 'downloading' | 'merging' | 'registering' | 'complete' | 'failed'

export interface DownloadJob {
  artist: string
  artistNorm: string
  baseName: string
  dateCompleted: number | null
  dateQueued: number
  destDir: string
  error: string | null
  extraArgs?: string[]
  id: string
  pathId: number
  pathRoot: string
  progress: number
  status: DownloadJobStatus
  thumbnail: string | null
  title: string
  titleNorm: string
  url: string
}

export interface DownloadReport {
  active: DownloadJob | null
  history: DownloadJob[]
  queue: DownloadJob[]
}

export interface ConvertedMetadata {
  artist: string
  artistNorm: string
  title: string
  titleNorm: string
}

// ------------------------------------
// Actions
// ------------------------------------
export const selectYoutubeResult = createAction<YouTubeResult>('youtube/selectResult')
export const closeYoutubeDialog = createAction('youtube/closeDialog')
export const closeYoutubePreview = createAction('youtube/closePreview')
export const setYoutubeQuery = createAction<string>('youtube/query')

export const searchYoutubeVideos = createAsyncThunk<YouTubeResult[], string>(
  'youtube/search',
  async (query) => {
    const res = await api.post<{ results: YouTubeResult[] }>('/search', { body: { query } })
    return res.results
  },
)

export const identifyVideo = createAsyncThunk<ConvertedMetadata, { title: string, channel?: string }>(
  'youtube/identify',
  async (payload) => {
    const res = await api.post<ConvertedMetadata>('/identify', { body: payload })
    return res
  },
)

export const downloadVideo = createAsyncThunk<DownloadJob, {
  url: string
  artist: string
  title: string
  thumbnail: string | null
}>(
  'youtube/download',
  async (payload) => {
    const job = await api.post<DownloadJob>('/download', { body: payload })
    return job
  },
)

export const openPreview = createAsyncThunk<{ streamUrl: string, item: YouTubeResult }, YouTubeResult>(
  'youtube/preview',
  async (item) => {
    const res = await api.get<{ url: string }>(`/stream?url=${encodeURIComponent(item.url)}`)
    return { streamUrl: res.url, item }
  },
)

export const fetchDownloads = createAsyncThunk<DownloadReport, void>(
  'youtube/fetchDownloads',
  async () => {
    const res = await api.get<DownloadReport>('/downloads')
    return res
  },
)

// ------------------------------------
// Reducer
// ------------------------------------
interface YouTubeState {
  downloads: DownloadReport | null
  error: string | null
  isSearching: boolean
  metadata: ConvertedMetadata | null
  preview: { streamUrl: string, item: YouTubeResult } | null
  query: string
  results: YouTubeResult[]
  selected: YouTubeResult | null
}

const initialState: YouTubeState = {
  downloads: null,
  error: null,
  isSearching: false,
  metadata: null,
  preview: null,
  query: '',
  results: [],
  selected: null,
}

const youtubeReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(selectYoutubeResult, (state, { payload }) => ({
      ...state,
      error: null,
      metadata: null,
      selected: payload,
    }))
    .addCase(closeYoutubeDialog, state => ({
      ...state,
      metadata: null,
      selected: null,
    }))
    .addCase(closeYoutubePreview, state => ({
      ...state,
      preview: null,
    }))
    .addCase(setYoutubeQuery, (state, { payload }) => ({
      ...state,
      query: payload,
    }))
    .addCase(searchYoutubeVideos.pending, state => ({
      ...state,
      error: null,
      isSearching: true,
    }))
    .addCase(searchYoutubeVideos.fulfilled, (state, { payload }) => ({
      ...state,
      isSearching: false,
      results: payload,
    }))
    .addCase(searchYoutubeVideos.rejected, (state, action) => ({
      ...state,
      error: action.error.message ?? 'search failed',
      isSearching: false,
      results: [],
    }))
    .addCase(identifyVideo.fulfilled, (state, { payload }) => ({
      ...state,
      metadata: payload,
    }))
    .addCase(openPreview.fulfilled, (state, { payload }) => ({
      ...state,
      preview: payload,
    }))
    .addCase(downloadVideo.fulfilled, state => ({
      ...state,
      metadata: null,
      selected: null,
    }))
    .addCase(fetchDownloads.fulfilled, (state, { payload }) => ({
      ...state,
      downloads: payload,
    }))
})

export default youtubeReducer
