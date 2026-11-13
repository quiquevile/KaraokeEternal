import React from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { ensureState } from 'redux-optimistic-ui'
import QueueItem from '../QueueItem/QueueItem'
import ProviderQueueItem from '../ProviderQueueItem/ProviderQueueItem'
import QueueListAnimator from '../QueueListAnimator/QueueListAnimator'
import { formatSeconds } from 'lib/dateTime'
import { moveItem, removeUpcomingItems } from '../../modules/queue'
import { hasPermission } from 'store/modules/user'
import { providerFetchCancel, providerFetchRequest } from '../../../Library/modules/library'
import getPlayerHistory from '../../selectors/getPlayerHistory'
import getMoveAnchor from '../../selectors/getMoveAnchor'
import getRoundRobinQueue from '../../selectors/getRoundRobinQueue'
import getVisibleDisplayQueue from '../../selectors/getVisibleDisplayQueue'
import getWaits from '../../selectors/getWaits'
import type { PendingQueueItem } from '../../selectors/getPendingQueue'

const QueueList = () => {
  const artists = useAppSelector(state => state.artists)
  const { errorMessage, isAtQueueEnd, isErrored, isPlaying, position, queueId } = useAppSelector(state => state.status)

  const playerHistory = useAppSelector(getPlayerHistory)
  // movement is computed on the raw chain (not the round-robin view) so
  // the anchor is the user's first upcoming item; only what's on screen
  // renders
  const chain = useAppSelector(state => ensureState(state.queue))
  const queue = useAppSelector(getRoundRobinQueue)
  const rows = useAppSelector(getVisibleDisplayQueue)
  const songs = useAppSelector(state => state.songs)
  const starredSongs = useAppSelector(state => ensureState(state.userStars).starredSongs)
  const starCounts = useAppSelector(state => state.starCounts)
  const user = useAppSelector(state => state.user)
  const waits = useAppSelector(getWaits)

  // actions
  const dispatch = useAppDispatch()
  const handleMoveClick = (qId: number) => {
    // link right before the user's first upcoming item so the song takes
    // their next turn; already-first yields its own predecessor and the
    // server no-ops
    const prevQueueId = getMoveAnchor(chain, playerHistory, queueId, qId)

    dispatch(moveItem({ queueId: qId, prevQueueId }))
  }

  const handleRemoveUpcoming = (userId: number) => {
    dispatch(removeUpcomingItems(userId))
  }

  const handleProviderCancel = (providerId: number, itemId: string, userId: number) => {
    dispatch(providerFetchCancel({ providerId, itemId, userId }))
  }

  // retries as the row's singer (only an admin may name someone else)
  const handleProviderRetry = (p: PendingQueueItem) => {
    dispatch(providerFetchRequest({
      providerId: p.providerId,
      itemId: p.itemId,
      title: p.title,
      artist: p.artist,
      source: p.source,
      iconUrl: p.iconUrl,
      duration: p.duration,
      userId: p.userId,
      userDisplayName: p.userDisplayName,
      userDateUpdated: p.userDateUpdated,
    }))
  }

  const formatWait = (key: string) => waits[key] === undefined ? undefined : formatSeconds(waits[key], true) // fuzzy

  // build children array
  const items: React.ReactElement[] = []
  for (const row of rows) {
    if (row.kind === 'pending') {
      const p = row.item
      const isOwner = p.userId === user.userId

      items.push(
        <ProviderQueueItem
          key={row.key}
          providerId={p.providerId}
          itemId={p.itemId}
          title={p.title}
          artist={p.artist}
          source={p.source}
          iconUrl={p.iconUrl}
          status={p.status}
          progress={p.progress}
          error={p.error}
          userId={p.userId}
          userDisplayName={p.userDisplayName}
          userDateUpdated={p.userDateUpdated}
          wait={p.duration === undefined ? undefined : formatWait(row.key)}
          isAdmin={user.isAdmin}
          isOwner={isOwner}
          isCancelable={isOwner || user.isAdmin}
          isRetryable={(isOwner || user.isAdmin) && p.status === 'error'}
          onCancel={handleProviderCancel}
          onRetry={() => handleProviderRetry(p)}
        />,
      )
      continue
    }

    const qId = row.queueId
    const item = queue.entities[qId]
    const song = songs.entities[item.songId]
    const artist = song && artists.entities[song.artistId]

    // the queue and the library arrive in separate pushes: the song may
    // not be known yet (e.g. a download just queued by someone else), and
    // library state may briefly lag the queue (a provider ingest pushes
    // QUEUE_PUSH before LIBRARY_PUSH lands a tick later) — skip the row
    // until both are available rather than crashing
    if (!song || !artist) {
      console.warn('skipping queue item with unknown song', qId, item.songId)

      continue
    }

    const duration = song.duration
    const isCurrent = (qId === queueId) && !isAtQueueEnd
    const isUpcoming = qId !== queueId && !playerHistory.includes(qId)
    const isPlayed = !isUpcoming && !isCurrent
    const isOwner = item.userId === user.userId

    items.push(
      <QueueItem
        key={row.key}
        {...item}
        artist={artist.name}
        errorMessage={isCurrent && errorMessage ? errorMessage : ''}
        isCurrent={isCurrent}
        isErrored={isCurrent && isErrored}
        isInfoable={user.isAdmin}
        isMovable={isUpcoming && (isOwner || hasPermission(user, 'queueMove'))}
        isOwner={isOwner}
        isPlayed={isPlayed}
        isPlaying={isCurrent && isPlaying}
        isRemovable={(isOwner || hasPermission(user, 'queueDelete'))}
        isReplayable={(!isUpcoming || isCurrent) && hasPermission(user, 'queueReplay')}
        isSkippable={isCurrent && (isOwner || hasPermission(user, 'playerControls'))}
        isStarred={starredSongs.includes(item.songId)}
        isUpcoming={isUpcoming}
        pctPlayed={isCurrent ? position / duration * 100 : 0}
        starCount={starCounts.songs[item.songId] || 0}
        title={song.title}
        wait={formatWait(row.key)}
        // actions
        onMoveClick={handleMoveClick}
        onRemoveUpcoming={handleRemoveUpcoming}
      />,
    )
  }

  return <QueueListAnimator queueItems={items.filter((item): item is React.ReactElement => item !== null)} />
}

export default QueueList
