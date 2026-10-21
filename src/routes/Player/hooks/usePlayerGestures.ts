import { useCallback, useEffect, useRef } from 'react'
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
import {
  beginGesture,
  endGesture,
  isInteractiveTarget,
  moveGesture,
  tapPoint,
  type GesturePoint,
  type GestureState,
} from '../lib/gestures'

const toPoint = (e: PointerEvent): GesturePoint => ({
  x: e.clientX,
  y: e.clientY,
  time: e.timeStamp,
})

/**
 * Touch and mouse gestures on the player screen: vertical drags on the side
 * zones control volume (right) and pitch (left), horizontal drags skip to
 * the next song (left) or replay (right), and a double-tap toggles
 * play/pause. Inert without playback-control permission and on interactive
 * elements (buttons, links, dialogs).
 */
const usePlayerGestures = (containerRef: React.RefObject<HTMLDivElement | null>) => {
  const dispatch = useAppDispatch()
  const user = useAppSelector(state => state.user)
  const status = useAppSelector(state => state.status)

  const gestureRef = useRef<GestureState | null>(null)
  const lastTapRef = useRef<GesturePoint | null>(null)

  const isEnabled = hasPermission(user, 'playerControls') && user.roomId !== null

  const onPointerDown = useCallback((e: PointerEvent) => {
    if (!isEnabled || isInteractiveTarget(e.target)) return

    const el = containerRef.current
    if (!el) return

    gestureRef.current = beginGesture(
      toPoint(e),
      el.clientWidth,
      status.volume,
      status.pitchSemitones,
    )
  }, [containerRef, isEnabled, status.volume, status.pitchSemitones])

  const onPointerMove = useCallback((e: PointerEvent) => {
    const state = gestureRef.current
    if (!state) return

    const intent = moveGesture(state, toPoint(e))
    if (!intent) return

    if (intent.type === 'volume') {
      dispatch(requestVolume(intent.value))
    } else if (intent.type === 'pitch' && status.pitchSupported !== false) {
      dispatch(requestOptions({ pitchSemitones: intent.semitones }))
    }
  }, [dispatch, status.pitchSupported])

  const onPointerUp = useCallback((e: PointerEvent) => {
    const state = gestureRef.current
    gestureRef.current = null
    if (!state) return

    const point = toPoint(e)
    const intent = endGesture(state, point, lastTapRef.current)
    lastTapRef.current = tapPoint(state, point)

    if (!intent) return

    if (intent.type === 'next') {
      dispatch(requestPlayNext())
    } else if (intent.type === 'replay') {
      if (status.queueId !== -1) {
        dispatch(requestReplay(status.queueId))
      } else {
        dispatch(requestPlay())
      }
    } else if (intent.type === 'playPause') {
      dispatch(status.isPlaying ? requestPause() : requestPlay())
    }
  }, [dispatch, status.isPlaying, status.queueId])

  const onPointerCancel = useCallback(() => {
    gestureRef.current = null
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !isEnabled) return

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerCancel)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [containerRef, isEnabled, onPointerDown, onPointerMove, onPointerUp, onPointerCancel])
}

export default usePlayerGestures
