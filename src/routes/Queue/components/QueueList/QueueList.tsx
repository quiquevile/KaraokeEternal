import React from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { ensureState } from 'redux-optimistic-ui'
import QueueItem from '../QueueItem/QueueItem'
import QueueListAnimator from '../QueueListAnimator/QueueListAnimator'
import { formatSeconds } from 'lib/dateTime'
import { moveItem, removeUpcomingItems } from '../../modules/queue'
import { hasPermission } from 'store/modules/user'
import { showSongEditor } from 'store/modules/songInfo'
import getPlayerHistory from '../../selectors/getPlayerHistory'
import getRoundRobinQueue from '../../selectors/getRoundRobinQueue'
import getWaits from '../../selectors/getWaits'

const QueueList = () => {
  const artists = useAppSelector(state => state.artists)
  const { errorMessage, isAtQueueEnd, isErrored, isPlaying, position, queueId } = useAppSelector(state => state.status)

  const playerHistory = useAppSelector(getPlayerHistory)
  const queue = useAppSelector(getRoundRobinQueue)
  const songs = useAppSelector(state => state.songs)
  const starredSongs = useAppSelector(state => ensureState(state.userStars).starredSongs)
  const starCounts = useAppSelector(state => state.starCounts)
  const user = useAppSelector(state => state.user)
  const waits = useAppSelector(getWaits)

  // actions
  const dispatch = useAppDispatch()
  const handleMoveClick = (qId: number) => {
    // reference user's last-played item as the new prevQueueId
    const userId = queue.entities[qId].userId
    let lastPlayed = queueId // default in case user has no played items

    for (let i = queue.result.indexOf(queueId); i >= 0; i--) {
      if (queue.entities[queue.result[i]].userId === userId) {
        lastPlayed = queue.result[i]
        break
      }
    }

    dispatch(moveItem({ queueId: qId, prevQueueId: lastPlayed }))
  }

  const handleRemoveUpcoming = (userId: number) => {
    dispatch(removeUpcomingItems(userId))
  }

  const handleEditClick = (songId: number) => {
    dispatch(showSongEditor(songId))
  }

  // build children array
  const items = queue.result.map((qId) => {
    const item = queue.entities[qId]
    const duration = songs.entities[item.songId].duration
    const isCurrent = (qId === queueId) && !isAtQueueEnd
    const isUpcoming = qId !== queueId && !playerHistory.includes(qId)
    const isPlayed = !isUpcoming && !isCurrent
    const isOwner = item.userId === user.userId

    const isInfoable = user.isAdmin

    return (
      <QueueItem
        {...item}
        artist={artists.entities[songs.entities[item.songId].artistId].name}
        errorMessage={isCurrent && errorMessage ? errorMessage : ''}
        isCurrent={isCurrent}
        key={qId}
        isErrored={isCurrent && isErrored}
        isInfoable={isInfoable}
        isEditable={user.isAdmin}
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
        title={songs.entities[item.songId].title}
        wait={formatSeconds(waits[qId], true)} // fuzzy
        // actions
        onMoveClick={handleMoveClick}
        onEditClick={handleEditClick}
        onRemoveUpcoming={handleRemoveUpcoming}
      />
    )
  })

  return <QueueListAnimator queueItems={items} />
}

export default QueueList
