import { createAsyncThunk, createReducer } from '@reduxjs/toolkit'
import HttpApi from 'lib/HttpApi'

export interface QueueTarget {
  userId: number
  username: string
  name: string
  isGhost?: boolean
}

const api = new HttpApi()

export const fetchQueueUsers = createAsyncThunk<QueueTarget[], number | null | undefined>(
  'queueTargets/fetchUsers',
  async (roomId) => {
    try {
      return await api.get(roomId == null ? 'users/names?for=queue&ghosts=1' : `users/names?roomId=${roomId}&for=queue&ghosts=1`)
    } catch {
      return []
    }
  },
)

const queueTargets = createReducer({ queueUsers: [] as QueueTarget[] }, (builder) => {
  builder.addCase(fetchQueueUsers.fulfilled, (state, { payload }) => {
    state.queueUsers = payload
  })
})

export default queueTargets
