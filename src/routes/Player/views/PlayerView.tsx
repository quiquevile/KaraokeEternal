import React, { useEffect, useRef } from 'react'
import screenfull from 'screenfull'
import combinedReducer from 'store/reducers'
import { useAppSelector, useAppDispatch } from 'store/hooks'
import playerReducer, { sliceInjectNoOp } from '../modules/player'
import playerVisualizerReducer from '../modules/playerVisualizer'
import PlayerController from '../components/PlayerController/PlayerController'
import { fetchOwnRoom } from 'store/modules/rooms'
import usePlayerGestures from '../hooks/usePlayerGestures'
import styles from './PlayerView.css'

const PlayerView = () => {
  const { innerWidth, innerHeight, headerHeight, footerHeight } = useAppSelector(state => state.ui)
  const viewportHeight = innerHeight - headerHeight - footerHeight
  const dispatch = useAppDispatch()
  const containerRef = useRef<HTMLDivElement>(null)

  // touch and mouse gestures on the player screen (volume, pitch, next,
  // replay, double-tap play/pause)
  usePlayerGestures(containerRef)

  // @todo: find better place for this?
  if (!useAppSelector(state => state.player)) {
    combinedReducer.inject({ reducerPath: 'player', reducer: playerReducer })
    combinedReducer.inject({ reducerPath: 'playerVisualizer', reducer: playerVisualizerReducer })
    dispatch(sliceInjectNoOp()) // update store with new slices
  }

  // once per mount (own room even when closed, so persisted
  // options like the equalizer survive a closed room)
  useEffect(() => {
    dispatch(fetchOwnRoom())
  }, [dispatch])

  // set page title
  useEffect(() => {
    document.title = 'Karaoke Eternal | Player'
  }, [])

  return (
    <div style={{ overflow: 'hidden' }}>
      <div
        id='player-fs-container'
        ref={containerRef}
        className={styles.container}
        style={{
          top: screenfull.isFullscreen ? 0 : headerHeight,
          width: innerWidth,
          height: screenfull.isFullscreen ? innerHeight : viewportHeight,
          overflow: 'hidden',
        }}
      >
        <PlayerController
          width={innerWidth}
          height={screenfull.isFullscreen ? innerHeight : viewportHeight}
        />
      </div>
    </div>
  )
}

export default PlayerView
