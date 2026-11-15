import React, { useEffect, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import QRPrefs from './QRPrefs/QRPrefs'
import ProgressPrefs from './ProgressPrefs/ProgressPrefs'
import { roomDisplayUpdateOf, updateCurrentRoomOptions } from 'store/modules/rooms'
import type { IRoomPrefs } from 'shared/types'

// Room options for the current room (Player options), one section each:
// the QR tab and the progress readout at the bottom of Display. The sole
// editor of these prefs: no password box, so non-admins can never touch
// keys. Changes persist debounced (and flushed on unmount). Only the
// section's own key is ever sent: the local copy of the remaining prefs
// may be stale and must not clobber them (e.g. a newer room EQ save).
interface RoomOptionsProps {
  section: 'qr' | 'progress'
}

const RoomOptions = ({ section }: RoomOptionsProps) => {
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

    // each section instance holds a full copy of the prefs, but only its
    // own key is fresh: sending the other section's copy would clobber
    // edits made through its own editor
    const own = section === 'qr' ? { qr: next.qr } : { progress: next.progress }
    const queued = roomDisplayUpdateOf(own)
    if (!queued) return

    pending.current = queued

    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const toSend = pending.current
      pending.current = null
      if (toSend) dispatch(updateCurrentRoomOptions({ prefs: toSend }))
    }, 400)
  }

  if (section === 'qr') {
    return (
      <QRPrefs
        prefs={prefs}
        onChange={handleChange}
        passwordPresent={roomHasPassword}
      />
    )
  }

  return <ProgressPrefs prefs={prefs} onChange={handleChange} />
}

export default RoomOptions
