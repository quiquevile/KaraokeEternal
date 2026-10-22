import React, { useEffect, useCallback, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Player from '../Player/Player'
import PlayerTextOverlay from '../PlayerTextOverlay/PlayerTextOverlay'
import PitchToast from '../PlayerTextOverlay/PitchToast'
import VolumeToast from '../PlayerTextOverlay/VolumeToast/VolumeToast'
import SongProgress from '../PlayerTextOverlay/SongProgress/SongProgress'
import PlayerQR from '../PlayerQR/PlayerQR'
import getRoundRobinQueue from 'routes/Queue/selectors/getRoundRobinQueue'
import { playerLeave, playerError, playerLoad, playerPlay, playerStatus, type PlayerState } from '../../modules/player'
import getRoomPrefs from '../../selectors/getRoomPrefs'
import { getPlayerDisplayPrefs, isNextUpVisible, isProgressVisible } from '../../lib/playerDisplay'
import { areKeysCached, evictMedia, mediaCacheKey, prefetchMedia, pruneExcept } from '../../lib/mediaCache'
import { parseNumberArray } from 'lib/util'
import socket from 'lib/socket'
import type { QueueItem } from 'shared/types'

const mediaKeysFor = (item: QueueItem): string[] => (
  item.mediaType === 'cdg'
    ? [mediaCacheKey(item.mediaId, 'cdg'), mediaCacheKey(item.mediaId, 'audio')]
    : [mediaCacheKey(item.mediaId, 'video')]
)

// playback needs the server for commands and status relays: treat both
// OS-level network loss and a dead server connection as offline
const isOfflineNow = (): boolean => !socket.connected || !navigator.onLine

// socket.io may still believe it's connected right after the server died
// (pings run on an interval): settle it with a quick probe
const serverUnreachable = async (): Promise<boolean> => {
  try {
    await fetch(document.baseURI, {
      method: 'HEAD',
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    })
    return false
  } catch {
    return true
  }
}

// how long a frozen playback position is tolerated while offline before
// the song is treated as ended (a dead connection can stall playback
// without ever firing an error or ended event)
const STALL_WATCHDOG_MS = 10_000

interface PlayerControllerProps {
  width: number
  height: number
}

const PlayerController = (props: PlayerControllerProps) => {
  const queue = useAppSelector(getRoundRobinQueue)
  const player = useAppSelector(state => state.player)
  const songs = useAppSelector(state => state.songs.entities)
  const artists = useAppSelector(state => state.artists.entities)
  const playerVisualizer = useAppSelector(state => state.playerVisualizer)
  const roomPrefs = useAppSelector(getRoomPrefs)
  const displayPrefs = getPlayerDisplayPrefs(useAppSelector(state => state.prefs.playerDisplay))
  const roomQrPassword = useAppSelector(state =>
    (typeof state.user.roomId === 'number'
      ? state.rooms.entities[state.user.roomId]?.qrPassword
      : undefined) ?? null,
  )
  // QR invites joining: pointless (and misleading) while closed
  const isRoomOpen = useAppSelector(state =>
    typeof state.user.roomId === 'number'
      ? state.rooms.entities[state.user.roomId]?.status === 'open'
      : false,
  )
  const queueItem = queue.entities[player.queueId]
  // current item deleted (e.g. its song was removed from the library)?
  // fall back to the first unplayed item, as it is the next song to play
  const playedIds: number[] = parseNumberArray(player.historyJSON)
  const nextQueueItem = queueItem
    ? queue.entities[queue.result[queue.result.indexOf(player.queueId) + 1]]
    : queue.entities[queue.result.find(queueId => !playedIds.includes(queueId))]
  const showNextUp = isNextUpVisible(
    player.position,
    player.duration,
    displayPrefs.nextUpLeadMs,
    displayPrefs.upNowDurationMs,
    !!nextQueueItem,
  )

  const dispatch = useAppDispatch()
  // bumped on reconnect to restart the prefetch loop after a failure
  const [prefetchNonce, setPrefetchNonce] = useState(0)
  const handleStatus = useCallback((status?: Partial<PlayerState>) => dispatch(playerStatus(status)), [dispatch])
  const handleLoad = () => dispatch(playerLoad())
  const handlePlay = () => dispatch(playerPlay())

  const handleReplay = useCallback((queueId: number) => {
    const nextItem = queue.entities[queueId]
    if (!nextItem) return

    const history = parseNumberArray(player.historyJSON)

    if (queueId !== player.queueId) {
      // reset history up to and including the replaying queueId
      const idx = history.lastIndexOf(queueId)
      if (idx !== -1) history.splice(idx)
    }

    handleStatus({
      historyJSON: JSON.stringify(history),
      isAtQueueEnd: false,
      isPlaying: true,
      isVideoKeyingEnabled: nextItem.isVideoKeyingEnabled,
      mediaType: nextItem.mediaType,
      // pitch only applies to the current song: keep it on restart, reset on change
      pitchSemitones: queueId !== player.queueId ? 0 : player.pitchSemitones,
      position: 0,
      duration: 0,
      queueId: nextItem.queueId,
      nextUserId: null,
      _isReplayingQueueId: null,
    })
  }, [handleStatus, player.historyJSON, player.pitchSemitones, player.queueId, queue.entities])

  // restore the room's persisted equalizer once (fresh page load): later
  // prefs arrivals (e.g. QR tweaks) must not clobber live adjustments,
  // and the emit below re-syncs every controller's status mirror
  const persistedEqApplied = useRef(false)
  const persistedEq = roomPrefs?.eq

  useEffect(() => {
    if (!persistedEqApplied.current && persistedEq) {
      persistedEqApplied.current = true
      handleStatus({
        eqEnabled: persistedEq.eqEnabled,
        eqGains: persistedEq.eqGains,
        eqPreset: persistedEq.eqPreset,
      })
    }
  }, [handleStatus, persistedEq])

  // advance to a specific upcoming item (or stop at queue end, also the
  // offline stop when nothing ahead is playable): the current item and
  // any passed-over ones are marked played
  const advanceTo = useCallback((target: QueueItem | null, skipped: QueueItem[]) => {
    const history = parseNumberArray(player.historyJSON)
    const markPlayed = (item: QueueItem) => {
      if (history.lastIndexOf(item.queueId) !== -1) return
      history.push(item.queueId)
      // the song is done: free its cache slots for the upcoming ones
      void evictMedia(item.mediaId, item.mediaType)
    }

    if (queueItem) markPlayed(queueItem)
    for (const item of skipped) markPlayed(item)

    // queue exhausted (or nothing left playable offline)?
    if (!target) {
      // playback fully stops: transport shows Play, the progress readout
      // hides and later queueings wait for a manual start
      handleStatus({
        historyJSON: JSON.stringify(history),
        isAtQueueEnd: true,
        isPlaying: false,
        mediaType: null,
        pitchSemitones: 0,
        _isPlayingNext: false,
      })

      return
    }

    // play target
    handleStatus({
      historyJSON: JSON.stringify(history),
      isAtQueueEnd: false,
      isPlaying: true,
      isVideoKeyingEnabled: target.isVideoKeyingEnabled,
      mediaType: target.mediaType,
      pitchSemitones: 0,
      position: 0,
      duration: 0,
      queueId: target.queueId,
      nextUserId: null,
      _isPlayingNext: false,
    })
  }, [handleStatus, player.historyJSON, queueItem])

  // offline: the show only moves through fully cached songs; upcoming
  // ones that aren't cached are skipped (still marked played, so they
  // can be replayed later) instead of erroring on their direct URLs
  const advanceToNextCached = useCallback(async () => {
    const idx = queue.result.indexOf(player.queueId)
    let target: QueueItem | null = null
    const skipped: QueueItem[] = []

    for (let i = idx + 1; i < queue.result.length; i++) {
      const item = queue.entities[queue.result[i]]
      // skip optimistic items (still resolving their media)
      if (!item?.mediaId) continue

      if (target) break

      if (await areKeysCached(item.mediaId, item.mediaType)) {
        target = item
      } else {
        skipped.push(item)
      }
    }

    advanceTo(target, skipped)
  }, [advanceTo, player.queueId, queue.entities, queue.result])

  const handleLoadNext = useCallback(() => {
    // offline: only cached songs can start; everything else is skipped
    // (or playback stops at queue end when nothing ahead is playable)
    if (isOfflineNow()) {
      void advanceToNextCached()
      return
    }

    advanceTo(nextQueueItem, [])
  }, [advanceTo, advanceToNextCached, nextQueueItem])

  const handleError = (msg: string) => {
    void (async () => {
      // a media failure while the server is unreachable isn't fatal: the
      // show continues with the next cached song (skipping the uncached
      // ones) or stops at queue end — probe first, the socket may still
      // believe it's connected moments after the server died
      if (queueItem && (isOfflineNow() || await serverUnreachable())) {
        advanceToNextCached()
        return
      }

      dispatch(playerError(msg))
      handleStatus()
    })()
  }

  // keep upcoming songs cached so playback rides out connection hiccups:
  // download the rest of the queue in order (bounded by the cache cap)
  // and drop entries that left the queue or already played
  useEffect(() => {
    const controller = new AbortController()
    const upcoming: QueueItem[] = []
    const idx = queue.result.indexOf(player.queueId)

    for (let i = idx + 1; i < queue.result.length; i++) {
      const item = queue.entities[queue.result[i]]
      // skip optimistic items (still resolving their media)
      if (item?.mediaId) upcoming.push(item)
    }

    const protectKeys = queueItem ? mediaKeysFor(queueItem) : []

    void (async () => {
      await pruneExcept([...protectKeys, ...upcoming.flatMap(mediaKeysFor)])

      for (const item of upcoming) {
        if (controller.signal.aborted) return
        const ok = await prefetchMedia(item.mediaId, item.mediaType, {
          signal: controller.signal,
          protectKeys,
        })
        // a transient failure skips this item (playback would stream it
        // directly); keep going — later songs may still cache, and the
        // effect re-runs on queue changes and reconnects
        if (!ok && controller.signal.aborted) return
      }
    })()

    return () => controller.abort()
  }, [player.queueId, prefetchNonce, queue.entities, queue.result, queueItem])

  // offline stall watchdog: a dead connection can freeze playback
  // without ever firing an error or ended event (packets just vanish);
  // once the position has been frozen for a while, treat the song as
  // ended so the show moves on to the next cached one
  const stallRef = useRef({ position: 0, lastChange: 0 })

  // baseline when playback starts (impure call, effect only)
  useEffect(() => {
    stallRef.current = { position: player.position, lastChange: Date.now() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (player.position !== stallRef.current.position) {
      stallRef.current = { position: player.position, lastChange: Date.now() }
    }
  }, [player.position])

  useEffect(() => {
    const interval = setInterval(() => {
      const stalled = Date.now() - stallRef.current.lastChange >= STALL_WATCHDOG_MS

      if (isOfflineNow() && player.isPlaying && !player.isErrored && !player._isFetching && stalled) {
        stallRef.current.lastChange = Date.now()
        handleLoadNext()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [handleLoadNext, player._isFetching, player.isErrored, player.isPlaying])

  // connection lifecycle: status mirrors (in every window) only update
  // through the server, and an outage may only be noticed tens of
  // seconds after it started — resync on reconnect, and recover from
  // errors that were really caused by a late-detected outage
  useEffect(() => {
    const handleConnect = () => {
      // re-broadcast local truth: controllers may have gone stale offline
      handleStatus({})
      // a failed prefetch aborts its whole loop and the queue didn't
      // change: restart it now that the network is back
      setPrefetchNonce(n => n + 1)
      // an error raised during the outage would otherwise stick: retry
      // by remounting the player (the retry effect keeps it paused)
      if (player.isErrored) {
        handleStatus({ isErrored: false })
      }
    }

    const handleDisconnect = () => {
      // socket.io may only notice a dead server long after the media
      // error was shown "online": run the offline recovery now
      if (player.isErrored && queueItem) {
        void advanceToNextCached()
      }
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
    }
  }, [advanceToNextCached, handleStatus, player.isErrored, queueItem])

  // announce equalizer changes: options apply silently in the reducer,
  // so without this no controller mirror (preset highlight included)
  // would learn about them outside playback events
  useEffect(() => {
    handleStatus({})
  }, [handleStatus, player.eqEnabled, player.eqPreset])

  // "lock in" the next user that isn't the currently up user, if possible
  useEffect(() => {
    if (!player.nextUserId || queueItem?.userId === nextQueueItem?.userId) {
      for (let i = queue.result.indexOf(queueItem?.queueId) + 1; i < queue.result.length; i++) {
        if (queueItem?.userId !== queue.entities[queue.result[i]].userId) {
          handleStatus({ nextUserId: queue.entities[queue.result[i]].userId })
          return
        }
      }
    }
  }, [handleStatus, nextQueueItem, player.nextUserId, queue, queueItem])

  // always emit status when any of these change
  useEffect(() => handleStatus({ isVideoKeyingEnabled: queueItem?.isVideoKeyingEnabled }), [
    handleStatus,
    player.cdgAlpha,
    player.cdgSize,
    player.isPlaying,
    player.isReplayGainEnabled,
    player.mp4Alpha,
    player.pitchSemitones,
    player.volume,
    playerVisualizer,
    queueItem?.isVideoKeyingEnabled,
  ])

  // on unmount
  useEffect(() => () => dispatch(playerLeave()), [dispatch])

  // playing for first time or playing next?
  useEffect(() => {
    if ((player.isPlaying && player.queueId === -1) || player._isPlayingNext) {
      handleLoadNext()
    }
  }, [handleLoadNext, player.isPlaying, player.queueId, player._isPlayingNext])

  // replaying?
  useEffect(() => {
    if (player._isReplayingQueueId !== null) {
      handleReplay(player._isReplayingQueueId)
    }
  }, [handleReplay, player._isReplayingQueueId])

  // queue was exhausted, but is no longer?
  useEffect(() => {
    if (player.isAtQueueEnd && nextQueueItem && player.isPlaying) {
      handleLoadNext()
    }
  }, [handleLoadNext, player.isPlaying, player.isAtQueueEnd, nextQueueItem])

  // current item vanished while playing (e.g. its song was deleted)?
  useEffect(() => {
    if (player.isPlaying && !player.isAtQueueEnd && !player.isErrored && player.queueId !== -1 && !queueItem) {
      handleLoadNext()
    }
  }, [handleLoadNext, player.isPlaying, player.isAtQueueEnd, player.isErrored, player.queueId, queueItem])

  // retrying after error?
  useEffect(() => {
    if (player.isErrored && player.isPlaying) {
      handleStatus({ isErrored: false })
    }
  }, [handleStatus, player.isErrored, player.isPlaying])

  return (
    <>
      <Player
        cdgAlpha={player.cdgAlpha}
        cdgSize={player.cdgSize}
        isPlaying={player.isPlaying}
        isVisible={!!queueItem && !player.isErrored && !player.isAtQueueEnd}
        isReplayGainEnabled={player.isReplayGainEnabled}
        isVideoKeyingEnabled={!!queueItem?.isVideoKeyingEnabled}
        isWebGLSupported={player.isWebGLSupported}
        mediaId={queueItem ? queueItem.mediaId : null}
        mediaKey={queueItem ? queueItem.queueId : null}
        mediaReplayKey={player._lastReplayTime}
        mediaType={queueItem ? queueItem.mediaType : null}
        mp4Alpha={player.mp4Alpha}
        onEnd={handleLoadNext}
        onError={handleError}
        onLoad={handleLoad}
        onPlay={handlePlay}
        onStatus={handleStatus}
        pitchSemitones={player.pitchSemitones}
        eqEnabled={player.eqEnabled}
        eqGains={player.eqGains}
        rgTrackGain={queueItem ? queueItem.rgTrackGain : null}
        rgTrackPeak={queueItem ? queueItem.rgTrackPeak : null}
        visualizer={playerVisualizer}
        volume={player.volume}
        width={props.width}
        height={props.height}
      />
      <PlayerTextOverlay
        queueItem={queueItem as QueueItem}
        nextQueueItem={nextQueueItem as QueueItem}
        isAtQueueEnd={player.isAtQueueEnd}
        isQueueEmpty={!queue.result.length}
        isErrored={player.isErrored}
        width={props.width}
        height={props.height}
        upNowDurationMs={displayPrefs.upNowDurationMs}
        isNextUpVisible={showNextUp}
        nextUpBlinkMs={displayPrefs.nextUpBlinkMs}
      />
      <PitchToast
        pitchSemitones={player.pitchSemitones}
        displayMs={displayPrefs.pitchToastMs}
        replayKey={player._lastReplayTime}
        queueId={player.queueId}
        mediaId={queueItem ? queueItem.mediaId : null}
      />
      <VolumeToast
        volume={player.volume}
        displayMs={displayPrefs.pitchToastMs}
        replayKey={player._lastReplayTime}
        queueId={player.queueId}
        mediaId={queueItem ? queueItem.mediaId : null}
      />
      {isProgressVisible(
        player.isPlaying,
        player.isErrored,
        player.duration,
        roomPrefs?.progress,
        !!queueItem,
      ) && (() => {
        const song = queueItem ? songs[queueItem.songId] : undefined
        const artist = song ? artists[song.artistId] : undefined

        return (
          <SongProgress
            position={player.position}
            duration={player.duration}
            artist={artist?.name}
            title={song?.title}
            singer={queueItem?.userDisplayName}
            pitchSemitones={player.pitchSemitones}
            progress={roomPrefs.progress}
          />
        )
      })()}
      {roomPrefs?.qr?.isEnabled && isRoomOpen && (
        <PlayerQR
          height={props.height}
          prefs={roomPrefs.qr}
          qrPassword={roomQrPassword}
          queueItem={queueItem}
        />
      )}
    </>
  )
}

export default PlayerController
