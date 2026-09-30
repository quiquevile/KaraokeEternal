import { createAction, createAsyncThunk, createReducer } from '@reduxjs/toolkit'
import { AppThunk, RootState } from 'store/store'
import type { IRoomPrefs, Room } from 'shared/types'
import {
  ROOMS_RECEIVE,
  ROOMS_REQUEST,
  ROOM_EDITOR_OPEN,
  ROOM_EDITOR_CLOSE,
  ROOM_FILTER_STATUS,
  ROOM_UPDATE,
  ROOM_CREATE,
  ROOM_REMOVE,
  ROOM_PREFS_PUSH,
  ROOM_PREFS_PUSH_REQUEST,
  LOGOUT,
} from 'shared/actionTypes'

import HttpApi from 'lib/HttpApi'
const api = new HttpApi('rooms')

// ------------------------------------
// Actions
// ------------------------------------
export const receiveRooms = createAction<object>(ROOMS_RECEIVE)

export const fetchRooms = createAsyncThunk(
  ROOMS_REQUEST,
  async () => await api.get(''),
)

export const fetchCurrentRoomStatus = createAsyncThunk(
  'rooms/fetchCurrentRoomStatus',
  async () => await api.get('/current/status') as { roomId: number, status: string },
)

// own room regardless of status (closed rooms are hidden from the list,
// but members keep their prefs, key flag and persisted options)
export const fetchOwnRoom = createAsyncThunk(
  'rooms/fetchOwnRoom',
  async (_, thunkAPI) => {
    const roomId = (thunkAPI.getState() as RootState).user.roomId

    if (typeof roomId !== 'number') {
      return Promise.reject('Please sign into a room')
    }

    return await api.get('/current') as { room: Room }
  },
)

export const createRoom = createAsyncThunk(
  ROOM_CREATE,
  async (data: object, thunkAPI) => {
    const response = await api.post('', {
      body: data,
    })

    thunkAPI.dispatch(receiveRooms(response))
    thunkAPI.dispatch(closeRoomEditor())
  },
)

export const updateRoom = createAsyncThunk(
  ROOM_UPDATE,
  async ({
    roomId,
    data,
  }: {
    roomId: number
    data: object
  }, thunkAPI) => {
    const response = await api.put(`/${roomId}`, {
      body: data,
    })

    thunkAPI.dispatch(receiveRooms(response))
    thunkAPI.dispatch(closeRoomEditor())
  },
)

export const removeRoom = createAsyncThunk(
  ROOM_REMOVE,
  async (roomId: number, thunkAPI) => {
    const response = await api.delete(`/${roomId}`)

    thunkAPI.dispatch(receiveRooms(response))
    thunkAPI.dispatch(closeRoomEditor())
  },
)

export interface RoomOptionsUpdate {
  roomId: number
  prefs: IRoomPrefs
  hasPassword: boolean
  qrPassword: string | null
}

// update the current room's display options (QR prefs); scoped to the
// user's own room so playback controllers can use it without admin rights
export const updateCurrentRoomOptions = createAsyncThunk(
  'rooms/updateCurrentRoomOptions',
  async (data: { prefs: Partial<IRoomPrefs> }) => await api.put('/current', {
    body: data,
  }) as { room: RoomOptionsUpdate },
)

export const openRoomEditor = createAction(ROOM_EDITOR_OPEN)
export const closeRoomEditor = createAction(ROOM_EDITOR_CLOSE)
export const filterByStatus = createAction<boolean | string>(ROOM_FILTER_STATUS)
export const roomPrefsPush = createAction<{ roomId: number, prefs: IRoomPrefs, hasPassword?: boolean, qrPassword?: string | null }>(ROOM_PREFS_PUSH)

export function requestPrefsPush (roomId: number, prefs: IRoomPrefs): AppThunk {
  return (dispatch) => {
    dispatch({
      type: ROOM_PREFS_PUSH_REQUEST,
      payload: {
        roomId,
        prefs,
      },
      meta: {
        throttle: {
          wait: 200,
          leading: true,
        },
      },
    })
  }
}

// ------------------------------------
// Reducer
// ------------------------------------
export interface RoomsState {
  result: number[]
  entities: Record<number, Room>
  currentStatus: string | null
  filterStatus: boolean | string
  isEditorOpen: boolean
  error: string | null
}

const initialState: RoomsState = {
  result: [],
  entities: {},
  currentStatus: null,
  filterStatus: 'open',
  isEditorOpen: false,
  error: null,
}

const roomsReducer = createReducer(initialState, (builder) => {
  builder
    // handles fetchRooms (full replace)
    .addCase(fetchRooms.fulfilled, (state, { payload }) => ({
      ...state,
      ...payload,
    }))
    .addCase(fetchRooms.rejected, (state, action) => {
      state.error = action.error.message ?? 'could not load rooms'
    })
    .addCase(createRoom.rejected, (state, action) => {
      state.error = action.error.message ?? 'could not create room'
    })
    .addCase(updateRoom.rejected, (state, action) => {
      state.error = action.error.message ?? 'could not update room'
    })
    .addCase(removeRoom.rejected, (state, action) => {
      state.error = action.error.message ?? 'could not remove room'
    })
    .addCase(updateCurrentRoomOptions.rejected, (state, action) => {
      state.error = action.error.message ?? 'could not update room options'
    })
    .addCase(receiveRooms, (state, { payload }) => ({
      ...state,
      ...payload,
    }))
    .addCase(fetchCurrentRoomStatus.fulfilled, (state, { payload }) => {
      state.currentStatus = (payload as { status?: string })?.status ?? null
    })
    .addCase(fetchCurrentRoomStatus.rejected, (state) => {
      state.currentStatus = null
    })
    .addCase(fetchOwnRoom.fulfilled, (state, { payload }) => {
      // seed/refresh the own entity (works for closed rooms too, unlike
      // the filtered list); never clears other rooms
      const room = payload?.room

      if (room) {
        state.entities[room.roomId] = {
          ...state.entities[room.roomId],
          ...room,
        }

        if (!state.result.includes(room.roomId)) {
          state.result.push(room.roomId)
        }
      }
    })
    .addCase(fetchOwnRoom.rejected, (state, action) => {
      state.error = action.error.message ?? 'could not load room'
    })
    .addCase(openRoomEditor, (state) => {
      state.isEditorOpen = true
    })
    .addCase(closeRoomEditor, (state) => {
      state.isEditorOpen = false
    })
    .addCase(filterByStatus, (state, { payload }) => {
      state.filterStatus = payload
    })
    .addCase(roomPrefsPush, (state, { payload }) => {
      const roomId = payload.roomId

      if (state.entities[roomId]) {
        state.entities[roomId].prefs = payload.prefs
        // key metadata may ride along (admin room update): keep the
        // entity's key in sync without refetch, ignore when absent
        // (live preview pushes from the editor carry prefs only)
        if (typeof payload.hasPassword === 'boolean') {
          state.entities[roomId].hasPassword = payload.hasPassword
        }
        if ('qrPassword' in payload) {
          state.entities[roomId].qrPassword = payload.qrPassword ?? null
        }
      }
    })
    .addCase(updateCurrentRoomOptions.fulfilled, (state, { payload }) => {
      // merge into the known entity (never refetch: a closed own room
      // would vanish from the filtered list)
      const room = payload?.room

      if (room && state.entities[room.roomId]) {
        state.entities[room.roomId].prefs = room.prefs as IRoomPrefs
        state.entities[room.roomId].hasPassword = room.hasPassword
        state.entities[room.roomId].qrPassword = room.qrPassword ?? null
      }
    })
    .addCase(LOGOUT, () => ({
      ...initialState,
    }))
})

export default roomsReducer
