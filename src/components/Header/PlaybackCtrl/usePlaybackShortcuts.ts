import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import {
  requestOptions,
  requestPause,
  requestPlay,
  requestPlayNext,
  requestReplay,
  requestVolume,
} from 'store/modules/status'
import { hasPermission } from 'store/modules/user'
import { updateCurrentRoomOptions } from 'store/modules/rooms'
import { clampPitchSemitones } from 'routes/Player/lib/pitchShift'
import screenfull from 'screenfull'

const VOLUME_STEP = 0.05

const clampVolume = (vol: number): number => (
  Math.min(1, Math.max(0, Math.round(vol * 100) / 100))
)

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false

  return target.isContentEditable
    || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

// global shortcuts for playback controllers (same actions as the header
// buttons and Player Options): space toggles play/pause, +/- adjust pitch,
// up/down adjust volume, arrows skip next / replay, Q toggles the room QR,
// B toggles the song progress readout, F enters player fullscreen.
// Inert while typing, with modifiers, or without playback-control
// permission.
const usePlaybackShortcuts = () => {
  const dispatch = useAppDispatch()
  const user = useAppSelector(state => state.user)
  const status = useAppSelector(state => state.status)
  const roomPrefs = useAppSelector(state =>
    (typeof state.user.roomId === 'number'
      ? state.rooms.entities[state.user.roomId]?.prefs
      : undefined),
  )

  useEffect(() => {
    if (!hasPermission(user, 'playerControls') || user.roomId === null) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return

      const target = e.target instanceof HTMLElement ? e.target : null
      const onControl = target !== null
        && (target.tagName === 'BUTTON' || target.tagName === 'A')

      switch (e.key) {
        case ' ':
        case 'Spacebar':
          if (onControl) return // let focused buttons work normally
          e.preventDefault()
          dispatch(status.isPlaying ? requestPause() : requestPlay())
          break
        case '+':
        case '=':
        case 'Add':
          e.preventDefault()
          if (status.pitchSupported !== false) {
            dispatch(requestOptions({
              pitchSemitones: clampPitchSemitones(status.pitchSemitones + 1),
            }))
          }
          break
        case '-':
        case '_':
        case 'Subtract':
          e.preventDefault()
          if (status.pitchSupported !== false) {
            dispatch(requestOptions({
              pitchSemitones: clampPitchSemitones(status.pitchSemitones - 1),
            }))
          }
          break
        case '0':
          e.preventDefault()
          if (status.pitchSupported !== false) {
            dispatch(requestOptions({ pitchSemitones: 0 }))
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          dispatch(requestVolume(clampVolume(status.volume + VOLUME_STEP)))
          break
        case 'ArrowDown':
          e.preventDefault()
          dispatch(requestVolume(clampVolume(status.volume - VOLUME_STEP)))
          break
        case 'ArrowRight':
          e.preventDefault()
          dispatch(requestPlayNext())
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (status.queueId !== -1) {
            dispatch(requestReplay(status.queueId))
          } else {
            dispatch(requestPlay())
          }
          break
        case 'q':
        case 'Q':
          e.preventDefault()
          dispatch(updateCurrentRoomOptions({
            prefs: {
              qr: { ...roomPrefs?.qr, isEnabled: !(roomPrefs?.qr?.isEnabled ?? false) },
            },
          }))
          break
        case 'b':
        case 'B':
          e.preventDefault()
          dispatch(updateCurrentRoomOptions({
            prefs: {
              progress: { ...roomPrefs?.progress, isEnabled: roomPrefs?.progress?.isEnabled === false },
            },
          }))
          break
        case 'f':
        case 'F': {
          if (onControl) return

          const fsContainer = document.getElementById('player-fs-container')

          if (fsContainer) {
            e.preventDefault()
            if (screenfull.isEnabled) screenfull.request(fsContainer)
          }
          break
        }
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dispatch, user, status, roomPrefs])
}

export default usePlaybackShortcuts
