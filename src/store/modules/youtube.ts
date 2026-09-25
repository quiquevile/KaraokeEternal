import { createAction, createAsyncThunk, createReducer } from '@reduxjs/toolkit'
import HttpApi from 'lib/HttpApi'

const api = new HttpApi('youtube')
const rootApi = new HttpApi()

// ------------------------------------
// Types
// ------------------------------------
export interface YouTubeResult {
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
export const clearYoutubeResults = createAction('youtube/clearResults')

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
  queueUserId: number | null
}>(
  'youtube/download',
  async (payload) => {
    const job = await api.post<DownloadJob>('/download', { body: payload })
    return job
  },
)

export const fetchDownloadUsers = createAsyncThunk<Array<{ userId: number, username: string, name: string }>, number | null | undefined>(
  'youtube/fetchDownloadUsers',
  async (roomId) => {
    try {
      return await rootApi.get(roomId == null ? 'users/names' : `users/names?roomId=${roomId}`)
    } catch {
      // the select falls back to the current user alone
      return []
    }
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

export const clearYoutube = createAsyncThunk<DownloadReport, void>(
  'youtube/clear',
  async () => {
    const res = await api.post<DownloadReport>('/downloads/clear')
    return res
  },
)

export const removeDownload = createAsyncThunk<DownloadReport, string>(
  'youtube/removeDownload',
  async (id) => {
    const res = await api.delete<DownloadReport>(`/downloads/${encodeURIComponent(id)}`)
    return res
  },
)

export interface YtdlUpdateResult {
  ok: boolean
  version: string | null
  output: string
  mode: YtdlMode
}

export type YtdlMode = 'managed' | 'system'

export type YtdlStatus = 'ready' | 'empty' | 'system'

export interface YtdlVersionResult {
  version: string | null
  mode: YtdlMode
  status: YtdlStatus
  updatedAt: number | null
  dir: string | null
}

export const fetchYtdlVersion = createAsyncThunk<YtdlVersionResult, void>(
  'youtube/fetchYtdlVersion',
  async () => {
    const res = await api.get<YtdlVersionResult>('/ytdlp/version')
    return res
  },
)

export const updateYtdl = createAsyncThunk<YtdlUpdateResult, void>(
  'youtube/updateYtdl',
  async () => {
    const res = await api.post<YtdlUpdateResult>('/ytdlp/update')
    return res
  },
)

// ------------------------------------
// Reducer
// ------------------------------------
interface YouTubeState {
  downloads: DownloadReport | null
  downloadUsers: Array<{ userId: number, username: string, name: string }>
  error: string | null
  hasSearched: boolean
  isSearching: boolean
  metadata: ConvertedMetadata | null
  preview: { streamUrl: string | null, item: YouTubeResult } | null
  query: string
  results: YouTubeResult[]
  selected: YouTubeResult | null
  ytdlpVersion: string | null
  ytdlpMode: YtdlMode | null
  ytdlpStatus: YtdlStatus | null
  ytdlpUpdatedAt: number | null
  ytdlpDir: string | null
  ytdlpUpdating: boolean
  ytdlpOutput: string | null
  ytdlpError: string | null
}

const initialState: YouTubeState = {
  downloads: null,
  downloadUsers: [],
  error: null,
  hasSearched: false,
  isSearching: false,
  metadata: null,
  preview: null,
  query: '',
  results: [],
  selected: null,
  ytdlpVersion: null,
  ytdlpMode: null,
  ytdlpStatus: null,
  ytdlpUpdatedAt: null,
  ytdlpDir: null,
  ytdlpUpdating: false,
  ytdlpOutput: null,
  ytdlpError: null,
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
    .addCase(clearYoutubeResults, state => ({
      ...state,
      error: null,
      hasSearched: false,
      metadata: null,
      preview: null,
      query: '',
      results: [],
      selected: null,
    }))
    .addCase(searchYoutubeVideos.pending, state => ({
      ...state,
      error: null,
      isSearching: true,
    }))
    .addCase(searchYoutubeVideos.fulfilled, (state, { payload }) => ({
      ...state,
      hasSearched: true,
      isSearching: false,
      results: payload,
    }))
    .addCase(searchYoutubeVideos.rejected, (state, action) => ({
      ...state,
      error: action.error.message ?? 'search failed',
      hasSearched: true,
      isSearching: false,
      results: [],
    }))
    .addCase(identifyVideo.fulfilled, (state, { payload }) => ({
      ...state,
      metadata: payload,
    }))
    .addCase(openPreview.pending, (state, { meta }) => ({
      ...state,
      error: null,
      preview: { item: meta.arg, streamUrl: null },
    }))
    .addCase(openPreview.fulfilled, (state, { payload }) => {
      // a newer preview (or none) may have taken over meanwhile
      if (state.preview?.item.id !== payload.item.id) return

      state.error = null
      state.preview = payload
    })
    .addCase(openPreview.rejected, (state, action) => {
      // ignore stale failures after close or a newer preview
      if (state.preview?.item.id !== action.meta.arg.id) return

      state.error = action.error.message ?? 'could not resolve stream'
      state.preview = null
    })
    .addCase(downloadVideo.fulfilled, state => ({
      ...state,
      metadata: null,
      selected: null,
    }))
    .addCase(fetchDownloads.fulfilled, (state, { payload }) => ({
      ...state,
      downloads: payload,
    }))
    .addCase(fetchDownloadUsers.fulfilled, (state, { payload }) => ({
      ...state,
      downloadUsers: payload,
    }))
    .addCase(clearYoutube.pending, state => ({
      ...state,
      error: null,
      hasSearched: false,
      isSearching: false,
      metadata: null,
      preview: null,
      query: '',
      results: [],
      selected: null,
    }))
    .addCase(clearYoutube.fulfilled, (state, { payload }) => ({
      ...state,
      downloads: payload,
    }))
    .addCase(clearYoutube.rejected, state => ({
      ...state,
      error: null,
      hasSearched: false,
      isSearching: false,
      metadata: null,
      preview: null,
      query: '',
      results: [],
      selected: null,
    }))
    .addCase(removeDownload.pending, (state, { meta }) => {
      if (!state.downloads) return state

      return {
        ...state,
        downloads: {
          ...state.downloads,
          history: state.downloads.history.filter(job => job.id !== meta.arg),
        },
      }
    })
    .addCase(removeDownload.fulfilled, (state, { payload }) => ({
      ...state,
      downloads: payload,
    }))
    .addCase(fetchYtdlVersion.fulfilled, (state, { payload }) => ({
      ...state,
      ytdlpVersion: payload.version,
      ytdlpMode: payload.mode,
      ytdlpStatus: payload.status,
      ytdlpUpdatedAt: payload.updatedAt,
      ytdlpDir: payload.dir,
    }))
    .addCase(updateYtdl.pending, state => ({
      ...state,
      ytdlpOutput: null,
      ytdlpError: null,
      ytdlpUpdating: true,
    }))
    .addCase(updateYtdl.fulfilled, (state, { payload }) => ({
      ...state,
      ytdlpUpdating: false,
      ytdlpVersion: payload.version,
      ytdlpMode: payload.mode,
      ytdlpOutput: payload.output,
      ytdlpError: payload.ok ? null : 'yt-dlp update failed',
    }))
    .addCase(updateYtdl.rejected, (state, action) => ({
      ...state,
      ytdlpUpdating: false,
      ytdlpError: action.error.message ?? 'yt-dlp update failed',
    }))
})

export default youtubeReducer
