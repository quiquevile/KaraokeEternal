import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { useSwipeable } from 'react-swipeable'
import { useLongPress } from 'use-long-press'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { hasPermission } from 'store/modules/user'
import { fetchQueueUsers } from 'store/modules/youtube'
import Icon from 'components/Icon/Icon'
import Button from 'components/Button/Button'
import ButtonStar from 'components/ButtonStar/ButtonStar'
import Buttons from 'components/Buttons/Buttons'
import RecentSearches from 'components/RecentSearches/RecentSearches'
import UserImage from 'components/UserImage/UserImage'
import { requestPlayNext, requestReplay } from 'store/modules/status'
import { toggleSongStarred } from 'store/modules/userStars'
import { showErrorMessage } from 'store/modules/ui'
import { queueSong, removeItem } from '../../modules/queue'
import {
  resetFilterStr,
  setFilterStr,
  setLocateSongId,
  toggleArtistExpanded,
  setFilterFolder,
  toggleFilterFlawed,
  toggleFilterMultiVersion,
  toggleFilterStarred,
  setFilterPreferred,
} from 'routes/Library/modules/library'
import { buildQueueTargets } from '../../selectors/buildQueueTargets'
import styles from './QueueItem.css'
import { queueMessages } from '../../messages'
import { libraryMessages } from 'routes/Library/messages'

const LONG_PRESS_THRESHOLD_MS = 700
// right-drag distance that triggers locate-in-library
const LOCATE_THRESHOLD_PX = 120

// keep the requeue-for-user picker fully on screen: when there is no
// room below the row, anchor it above instead
const PICKER_FIT_MARGIN = 8
const PICKER_MIN_ABOVE_PX = 160

interface QueueItemProps {
  artist: string
  errorMessage: string
  isCurrent: boolean
  isErrored: boolean
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
  onRemoveUpcoming: (userId: number) => void
}

const QueueItem = ({
  artist,
  errorMessage,
  isCurrent,
  isErrored,
  isMovable,
  isOwner,
  isPlayed,
  isPlaying,
  isRemovable,
  isReplayable,
  isSkippable,
  isStarred,
  isUpcoming,
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
  const [queuePickerOpen, setQueuePickerOpen] = useState(false)
  const [pickerPos, setPickerPos] = useState<{ top: number, left: number, right: number, flip: boolean } | null>(null)
  const longPressActiveRef = useRef(false)
  const rowRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const dispatch = useAppDispatch()
  const intl = useIntl()
  const user = useAppSelector(state => state.user)
  const queueUsers = useAppSelector(state => state.youtube.queueUsers)

  const canQueueForOthers = hasPermission(user, 'queueForOthers')

  const handleErrorInfoClick = () => dispatch(showErrorMessage(errorMessage))
  const handleMoveClick = () => {
    onMoveClick(queueId)
    setExpanded(false)
  }
  const handleReplayClick = () => {
    dispatch(requestReplay(queueId))
    setExpanded(false)
  }
  const handleRequeueClick = () => {
    // without the capability the song simply comes back for the caller
    if (!canQueueForOthers) {
      dispatch(queueSong(songId))
      setExpanded(false)
      return
    }

    void (async () => {
      const targets = await dispatch(fetchQueueUsers(user.roomId)).unwrap()

      // nobody else to pick (just the caller; an empty list means the
      // fetch failed) — come back for the caller like before
      if (targets.length <= 1) {
        dispatch(queueSong(songId))
        setExpanded(false)
        return
      }

      // pick who gets the song instead: anchor the picker under the row
      // (it portals to document.body, the row's overflow:hidden would
      // clip an inline dropdown)
      const rect = rowRef.current?.getBoundingClientRect()

      if (rect) {
        const spaceBelow = window.innerHeight - rect.bottom - PICKER_FIT_MARGIN
        const flip = spaceBelow < PICKER_MIN_ABOVE_PX && rect.top - PICKER_FIT_MARGIN > spaceBelow

        setPickerPos({
          top: flip ? rect.top : rect.bottom,
          left: rect.left,
          right: window.innerWidth - rect.right,
          flip,
        })
      }

      setQueuePickerOpen(true)
    })()
  }
  const handleQueueTargetSelect = (targetUserId: string) => {
    dispatch(queueSong(songId, parseInt(targetUserId, 10)))
    setQueuePickerOpen(false)
    setExpanded(false)
  }
  const handleSkipClick = () => {
    dispatch(requestPlayNext())
    setExpanded(false)
  }
  const handleRemoveClick = () => dispatch(removeItem({ queueId }))
  const handleStarClick = () => dispatch(toggleSongStarred(songId))

  // tapping outside the picker (including on the row itself, so another
  // tap collapses it; or scrolling away, or Escape) closes the picker
  useEffect(() => {
    if (!queuePickerOpen) return

    const inside = (target: Node | null) => (
      pickerRef.current && pickerRef.current.contains(target)
    )

    const onPointerDown = (event: Event) => {
      if (!inside(event.target as Node)) setQueuePickerOpen(false)
    }

    const onScroll = (event: Event) => {
      if (!inside(event.target as Node)) setQueuePickerOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setQueuePickerOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('scroll', onScroll, true)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [queuePickerOpen])

  const songs = useAppSelector(state => state.songs.entities)
  const artistIds = useAppSelector(state => state.artists.result)
  const expandedArtists = useAppSelector(state => state.library.expandedArtists)
  const filterStarred = useAppSelector(state => state.library.filterStarred)
  const filterFlawed = useAppSelector(state => state.library.filterFlawed)
  const filterFolder = useAppSelector(state => state.library.filterFolder)
  const filterMultiVersion = useAppSelector(state => state.library.filterMultiVersion)
  const filterPreferred = useAppSelector(state => state.library.filterPreferred)
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

    if (filterFlawed) {
      dispatch(toggleFilterFlawed())
    }

    if (filterFolder !== null) {
      dispatch(setFilterFolder(null))
    }

    if (filterMultiVersion) {
      dispatch(toggleFilterMultiVersion())
    }

    if (filterPreferred !== null) {
      dispatch(setFilterPreferred(null))
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
      setExpanded(isErrored || isPlayed || isMovable || isRemovable || isSkippable || isReplayable)
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
    // NOTE: keep false — react-swipeable preventDefaults every touchmove
    // once onSwiping exists (all directions become cancelable), which
    // would block native vertical scrolling; touch-action: pan-y in the
    // CSS already locks the gesture direction instead
    preventScrollOnSwipe: false,
    trackMouse: true,
  })

  // react-swipeable passes its ref callback through the handlers object;
  // handing the row a plain ref={rowRef} would overwrite it and the
  // touch listeners would never attach (mouse swipes still work, which
  // makes this very hard to spot), so forward to both
  const setRowRef = useCallback(
    (el: HTMLDivElement | null) => {
      rowRef.current = el
      swipeHandlers.ref(el)
    },
    [swipeHandlers],
  )

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
      ref={setRowRef}
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
      {queuePickerOpen && pickerPos && createPortal(
        <div
          ref={pickerRef}
          className={clsx(styles.pickerPortal, pickerPos.flip && styles.pickerPortalFlip)}
          style={{ top: pickerPos.top, left: pickerPos.left, right: pickerPos.right }}
        >
          <RecentSearches
            items={buildQueueTargets(queueUsers, user.userId)}
            label={intl.formatMessage(libraryMessages.queueForUser)}
            icon='PERSON'
            highlight={user.userId !== null ? String(user.userId) : undefined}
            onSelect={handleQueueTargetSelect}
          />
        </div>,
        document.body,
      )}
    </div>
  )
}

export default QueueItem
