import React, { useEffect, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import QRPrefs from 'routes/Account/components/Rooms/EditRoom/QRPrefs/QRPrefs'
import { updateCurrentRoomOptions } from 'store/modules/rooms'
import type { IRoomPrefs } from 'shared/types'

// Room QR options for the current room (Display dialog). Reuses QRPrefs
// as-is for an identical look; no password box here, so non-admins can
// never touch keys. Changes persist debounced (and flushed on unmount).
const RoomOptions = () => {
  const roomId = useAppSelector(state => state.user.roomId)
  const roomPrefs = useAppSelector(state =>
    (typeof roomId === 'number' ? state.rooms.entities[roomId]?.prefs : undefined) as IRoomPrefs | undefined,
  )
  const roomHasPassword = useAppSelector(state =>
    (typeof roomId === 'number' ? state.rooms.entities[roomId]?.hasPassword : false) ?? false,
  )
  const dispatch = useAppDispatch()

  const [prefs, setPrefs] = useState<IRoomPrefs>(roomPrefs ?? {} as IRoomPrefs)
  const [prevRoomId, setPrevRoomId] = useState(roomId)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<Partial<IRoomPrefs> | null>(null)

  if (roomId !== prevRoomId) {
    setPrevRoomId(roomId)
    setPrefs(roomPrefs ?? {} as IRoomPrefs)
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
    if (pending.current) dispatch(updateCurrentRoomOptions({ prefs: pending.current }))
  }, [dispatch])

  if (typeof roomId !== 'number') return null

  const handleChange = (next: Partial<IRoomPrefs>) => {
    setPrefs(next as IRoomPrefs)
    pending.current = next

    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      pending.current = null
      dispatch(updateCurrentRoomOptions({ prefs: next }))
    }, 400)
  }

  return (
    <QRPrefs
      prefs={prefs}
      onChange={handleChange}
      roomPassword=''
      roomPasswordDirty={false}
      showPasswordBox={false}
      hideIncludeUnlessValued
      roomHasPassword={roomHasPassword}
    />
  )
}

export default RoomOptions
