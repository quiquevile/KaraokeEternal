import React, { useEffect, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import QRPrefs from './QRPrefs/QRPrefs'
import { qrUpdateOf, updateCurrentRoomOptions } from 'store/modules/rooms'
import type { IRoomPrefs } from 'shared/types'

// Room QR options for the current room (Display dialog). The sole editor
// of QR prefs: no password box here, so non-admins can never touch keys.
// Changes persist debounced (and flushed on unmount). Only the qr key is
// ever sent: the local copy of the remaining prefs may be stale and must
// not clobber them (e.g. a newer room EQ save).
const RoomOptions = () => {
  const roomId = useAppSelector(state => state.user.roomId)
  const roomPrefs = useAppSelector(state =>
    (typeof roomId === 'number' ? state.rooms.entities[roomId]?.prefs : undefined) as IRoomPrefs | undefined,
  )
  const roomHasPassword = useAppSelector(state =>
    (typeof roomId === 'number' ? state.rooms.entities[roomId]?.hasPassword : false) ?? false,
  )
  // QR invites joining: the whole section hides while closed, for
  // everyone (admins included)
  const isRoomOpen = useAppSelector(state =>
    (typeof roomId === 'number' ? state.rooms.entities[roomId]?.status : undefined) === 'open',
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
  if (!isRoomOpen) return null

  const handleChange = (next: Partial<IRoomPrefs>) => {
    setPrefs(next as IRoomPrefs)

    const queued = qrUpdateOf(next)
    if (!queued) return

    pending.current = queued

    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const toSend = pending.current
      pending.current = null
      if (toSend) dispatch(updateCurrentRoomOptions({ prefs: toSend }))
    }, 400)
  }

  return (
    <QRPrefs
      prefs={prefs}
      onChange={handleChange}
      passwordPresent={roomHasPassword}
    />
  )
}

export default RoomOptions
