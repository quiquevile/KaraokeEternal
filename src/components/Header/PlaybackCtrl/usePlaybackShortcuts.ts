import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import {
  requestPause,
  requestPlay,
  requestPlayNext,
  requestReplay,
  requestVolume,
} from 'store/modules/status'
import { hasPermission } from 'store/modules/user'

const VOLUME_STEP = 0.05

const clampVolume = (vol: number): number => (
  Math.min(1, Math.max(0, Math.round(vol * 100) / 100))
)

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false

  return target.isContentEditable
    || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

// global playback shortcuts for hosts (same actions as the header
// buttons): space toggles play/pause, +/- adjust volume, right arrow
// skips to next, left arrow replays. Inert while typing, with modifiers,
// or without playback-control permission.
const usePlaybackShortcuts = () => {
  const dispatch = useAppDispatch()
  const user = useAppSelector(state => state.user)
  const status = useAppSelector(state => state.status)

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
          dispatch(requestVolume(clampVolume(status.volume + VOLUME_STEP)))
          break
        case '-':
        case '_':
        case 'Subtract':
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
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dispatch, user, status])
}

export default usePlaybackShortcuts
