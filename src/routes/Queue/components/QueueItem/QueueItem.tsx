import React, { useRef, useState } from 'react'
import clsx from 'clsx'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { useSwipeable } from 'react-swipeable'
import { useLongPress } from 'use-long-press'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Icon from 'components/Icon/Icon'
import Button from 'components/Button/Button'
import ButtonStar from 'components/ButtonStar/ButtonStar'
import Buttons from 'components/Buttons/Buttons'
import UserImage from 'components/UserImage/UserImage'
import { requestPlayNext, requestReplay } from 'store/modules/status'
import { showSongInfo } from 'store/modules/songInfo'
import { toggleSongStarred } from 'store/modules/userStars'
import { showErrorMessage } from 'store/modules/ui'
import { queueSong, removeItem } from '../../modules/queue'
import {
  resetFilterStr,
  setFilterStr,
  setLocateSongId,
  toggleArtistExpanded,
  toggleFilterDownloaded,
  toggleFilterStarred,
} from 'routes/Library/modules/library'
import styles from './QueueItem.css'
import { commonMessages } from '../../../../lib/messages'
import { queueMessages } from '../../messages'

const LONG_PRESS_THRESHOLD_MS = 700
// right-drag distance that triggers locate-in-library
const LOCATE_THRESHOLD_PX = 120

interface QueueItemProps {
  artist: string
  errorMessage: string
  isCurrent: boolean
  isErrored: boolean
  isEditable: boolean
  isInfoable: boolean
  isMovable: boolean
  isOwner: boolean
  isPlayed: boolean
  isPlaying: boolean
  isRemovable: boolean
  isReplayable: boolean
  isSkippable: boolean
  isStarred: boolean
  isUpcoming: boolean
  pctPlayed: number
  queueId: number
  songId: number
  starCount: number
  title: string
  userDateUpdated: number
  userDisplayName: string
  userId: number
  wait?: string
  // actions
  onMoveClick(queueId: number): void
  onEditClick(songId: number): void
  onRemoveUpcoming: (userId: number) => void
}

const QueueItem = ({
  artist,
  errorMessage,
  isCurrent,
  isErrored,
  isEditable,
  isInfoable,
  isMovable,
  isOwner,
  isPlayed,
  isPlaying,
  isRemovable,
  isReplayable,
  isSkippable,
  isStarred,
  isUpcoming,
  onEditClick,
  onMoveClick,
  onRemoveUpcoming,
  pctPlayed,
  queueId,
  songId,
  starCount,
  title,
  userDateUpdated,
  userDisplayName,
  userId,
  wait,
}: QueueItemProps) => {
  const [isExpanded, setExpanded] = useState(false)
  const longPressActiveRef = useRef(false)
  const dispatch = useAppDispatch()
  const intl = useIntl()

  const handleErrorInfoClick = () => dispatch(showErrorMessage(errorMessage))
  const handleInfoClick = () => dispatch(showSongInfo(songId))
  const handleEditClick = () => {
    onEditClick(songId)
    setExpanded(false)
  }
  const handleMoveClick = () => {
    onMoveClick(queueId)
    setExpanded(false)
  }
  const handleReplayClick = () => {
    dispatch(requestReplay(queueId))
    setExpanded(false)
  }
  const handleRequeueClick = () => {
    dispatch(queueSong(songId))
    setExpanded(false)
  }
  const handleSkipClick = () => {
    dispatch(requestPlayNext())
    setExpanded(false)
  }
  const handleRemoveClick = () => dispatch(removeItem({ queueId }))
  const handleStarClick = () => dispatch(toggleSongStarred(songId))

  const songs = useAppSelector(state => state.songs.entities)
  const artistIds = useAppSelector(state => state.artists.result)
  const expandedArtists = useAppSelector(state => state.library.expandedArtists)
  const filterStarred = useAppSelector(state => state.library.filterStarred)
  const filterDownloaded = useAppSelector(state => state.library.filterDownloaded)
  const navigate = useNavigate()
  const locateXRef = useRef(0)
  const [locateX, setLocateX] = useState(0)

  const handleLocate = () => {
    const song = songs[songId]
    const artistId = song?.artistId
    const artistRow = typeof artistId === 'number' ? artistIds.indexOf(artistId) : -1

    if (typeof artistId !== 'number' || artistRow === -1) {
      // song gone from the library: fall back to a title search
      dispatch(setFilterStr(title))
      navigate('/library')
      return
    }

    dispatch(resetFilterStr())

    if (filterStarred) {
      dispatch(toggleFilterStarred())
    }

    if (filterDownloaded) {
      dispatch(toggleFilterDownloaded())
    }

    if (!expandedArtists.includes(artistId)) {
      dispatch(toggleArtistExpanded(artistId))
    }

    // the row scroll happens in ArtistList once mounted with data
    dispatch(setLocateSongId(songId))
    navigate('/library')
  }

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      setExpanded(isErrored || isEditable || isInfoable || isMovable || isRemovable || isSkippable || isReplayable)
    },
    onSwipedRight: () => {
      if (!isExpanded && locateXRef.current >= LOCATE_THRESHOLD_PX) {
        handleLocate()
      } else {
        setExpanded(false)
      }

      locateXRef.current = 0
      setLocateX(0)
    },
    onSwiping: (e) => {
      if (isExpanded || e.dir !== 'Right' || e.deltaX <= 0) {
        if (locateXRef.current !== 0) {
          locateXRef.current = 0
          setLocateX(0)
        }

        return
      }

      locateXRef.current = e.deltaX
      setLocateX(Math.min(e.deltaX, LOCATE_THRESHOLD_PX))
    },
    preventScrollOnSwipe: true,
    trackMouse: true,
  })

  const bindRemovePressHandlers = useLongPress(() => {
    const confirmText = isOwner ? 'Remove all your upcoming songs?' : `Remove all upcoming songs for "${userDisplayName}"?`
    longPressActiveRef.current = true

    if (confirm(confirmText)) {
      onRemoveUpcoming(userId)
    }
  }, { threshold: LONG_PRESS_THRESHOLD_MS, cancelOnMovement: true })

  const bindSkipPressHandlers = useLongPress(() => {
    const confirmText = isOwner ? 'Skip and remove all your upcoming songs?' : `Skip and remove all upcoming songs for "${userDisplayName}"?`
    longPressActiveRef.current = true

    if (confirm(confirmText)) {
      onRemoveUpcoming(userId)
      handleSkipClick()
    }
  }, { threshold: LONG_PRESS_THRESHOLD_MS, cancelOnMovement: true })

  const locateRatio = locateX / LOCATE_THRESHOLD_PX

  return (
    <div
      {...swipeHandlers}
      className={clsx(
        styles.container,
        isCurrent && styles.current,
        isCurrent && !isPlaying && styles.paused,
      )}
      style={{ '--progress': (isCurrent && pctPlayed < 2 ? 2 : pctPlayed) + '%' } as React.CSSProperties}
    >
      {locateX > 0 && (
        <div
          className={styles.locateGhost}
          style={{
            transform: `translateX(${locateX}px) scale(${1 + locateRatio * 0.3})`,
            opacity: 0.4 + locateRatio * 0.6,
            filter: `drop-shadow(0 0 ${Math.round(locateRatio * 10)}px var(--btn-active-bg-color))`,
          }}
          aria-hidden
        >
          <Icon icon='MAGNIFIER' size={32} />
        </div>
      )}
      <div className={styles.content}>
        <div className={clsx(styles.imageContainer, isPlayed && styles.greyed)}>
          <UserImage userId={userId} dateUpdated={userDateUpdated} />
          <div className={styles.waitContainer}>
            {isUpcoming && (
              <div className={clsx(styles.wait, isOwner && styles.isOwner)}>
                {wait}
              </div>
            )}
          </div>
        </div>

        <div className={clsx(styles.primary, isPlayed && styles.greyed)} translate='no'>
          <div className={styles.innerPrimary}>
            <div className={styles.title}>{title}</div>
            <div className={styles.artist}>{artist}</div>
          </div>
          <div className={clsx(styles.user, isOwner && styles.isOwner)}>
            {userDisplayName}
          </div>
        </div>

        <Buttons btnWidth={56} isExpanded={isExpanded} className={styles.btnContainer}>
          {isErrored && (
            <Button
              className={styles.danger}
              icon='INFO_OUTLINE'
              onClick={handleErrorInfoClick}
            />
          )}
          <ButtonStar
            className={styles.btnStar}
            isStarred={isStarred}
            onClick={handleStarClick}
            count={starCount}
          />
          {isInfoable && (
            <Button
              className={styles.active}
              data-hide
              icon='INFO_OUTLINE'
              onClick={handleInfoClick}
              aria-label={intl.formatMessage(commonMessages.songInfo)}
            />
          )}
          {isEditable && (
            <Button
              className={styles.active}
              data-hide
              icon='EDIT'
              onClick={handleEditClick}
              aria-label={intl.formatMessage(commonMessages.editSong)}
            />
          )}
          {isMovable && (
            <Button
              className={clsx(styles.btnMove, styles.active)}
              data-hide
              icon='MOVE_TOP'
              onClick={handleMoveClick}
              aria-label={intl.formatMessage(queueMessages.moveTop)}
            />
          )}
          {isPlayed && (
            <Button
              className={clsx(styles.btnAdd, styles.active)}
              data-hide
              icon='PLUS'
              onClick={handleRequeueClick}
              aria-label={intl.formatMessage(queueMessages.requeue)}
            />
          )}
          {isReplayable && (
            <Button
              className={clsx(styles.active, styles.danger)}
              data-hide
              icon='REPLAY'
              onClick={handleReplayClick}
              aria-label={intl.formatMessage(queueMessages.replay)}
            />
          )}
          {isRemovable && (
            <Button
              className={clsx(styles.btnRemove, styles.danger)}
              data-hide
              icon='DELETE'
              aria-label={intl.formatMessage(queueMessages.remove)}
              onTouchEnd={(e: React.TouchEvent<HTMLButtonElement>) => {
                if (longPressActiveRef.current) {
                  e.preventDefault()
                  e.stopPropagation()
                  longPressActiveRef.current = false
                  return
                }
              }}
              onClick={() => {
                if (longPressActiveRef.current) {
                  longPressActiveRef.current = false
                  return
                }
                handleRemoveClick()
              }}
              {...bindRemovePressHandlers()}
            />
          )}
          {isSkippable && (
            <Button
              className={clsx(styles.btnPlayNext, styles.danger)}
              data-hide
              icon='PLAY_NEXT'
              aria-label={intl.formatMessage(queueMessages.skip)}
              onTouchEnd={(e: React.TouchEvent<HTMLButtonElement>) => {
                if (longPressActiveRef.current) {
                  e.preventDefault()
                  e.stopPropagation()
                  longPressActiveRef.current = false
                  return
                }
              }}
              onClick={() => {
                if (longPressActiveRef.current) {
                  longPressActiveRef.current = false
                  return
                }
                handleSkipClick()
              }}
              {...bindSkipPressHandlers()}
            />
          )}
        </Buttons>
      </div>
    </div>
  )
}

export default QueueItem
