import { createAction, createAsyncThunk, createReducer } from '@reduxjs/toolkit'
import type { Tag } from 'shared/types'
import { LOGOUT, TAGS_PUSH } from 'shared/actionTypes'
import HttpApi from 'lib/HttpApi'

const api = new HttpApi('tags')

export interface TagsState {
  tags: Tag[]
  songTags: Record<number, number[]>
}

const initialState: TagsState = { tags: [], songTags: {} }
const tagsPush = createAction<TagsState>(TAGS_PUSH)
const logout = createAction(LOGOUT)

export const fetchTags = createAsyncThunk('tags/fetch', async (_, thunkAPI) => {
  const snapshot = await api.get<TagsState>('/')
  thunkAPI.dispatch(tagsPush(snapshot))
})

export const saveTag = createAsyncThunk('tags/save', async (data: { tagId?: number, name: string, visibility: Tag['visibility'] }, thunkAPI) => {
  if (data.tagId) await api.put(`/${data.tagId}`, { body: data })
  else await api.post('/', { body: data })
  await thunkAPI.dispatch(fetchTags()).unwrap()
})

export const deleteTag = createAsyncThunk('tags/delete', async (tagId: number, thunkAPI) => {
  await api.delete(`/${tagId}`)
  await thunkAPI.dispatch(fetchTags()).unwrap()
})

export const assignSongTags = createAsyncThunk('tags/assignSong', async (data: { songId: number, tagIds: number[] }, thunkAPI) => {
  await api.put(`/song/${data.songId}`, { body: { tagIds: data.tagIds } })
  await thunkAPI.dispatch(fetchTags()).unwrap()
})

export default createReducer(initialState, builder => builder
  .addCase(tagsPush, (_, { payload }) => payload)
  .addCase(logout, () => initialState))
