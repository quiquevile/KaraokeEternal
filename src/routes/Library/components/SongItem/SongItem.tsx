import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import Highlighter from 'react-highlight-words'
import { useIntl } from 'react-intl'
import { useSwipeable } from 'react-swipeable'
import { useLongPress } from 'use-long-press'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { hasPermission } from 'store/modules/user'
import { fetchQueueUsers } from 'store/modules/youtube'
import { queueSong } from 'routes/Queue/modules/queue'
import { markLocateBlinked } from '../../modules/library'
import Button from 'components/Button/Button'
import ButtonFlawed from 'components/ButtonFlawed/ButtonFlawed'
import ButtonStar from 'components/ButtonStar/ButtonStar'
import Buttons from 'components/Buttons/Buttons'
import Icon from 'components/Icon/Icon'
import RecentSearches from 'components/RecentSearches/RecentSearches'
import ToggleAnimation from 'components/ToggleAnimation/ToggleAnimation'
import { formatDuration } from 'lib/dateTime'
import styles from './SongItem.css'
import { commonMessages } from '../../../../lib/messages'
import { libraryMessages } from '../../messages'

let ignoreMouseup = false

const LONG_PRESS_THRESHOLD_MS = 700

// keep the queue-for-others picker fully on screen: when there is no
// room below the song row, anchor it above instead
const PICKER_FIT_MARGIN = 8
const PICKER_MIN_ABOVE_PX = 160

interface SongItemProps {
  songId: number
  artist?: string
  title: string
  duration: number
  onSongQueue(songId: number): void
  onSongStarClick(songId: number): void
  onSongFlawClick(songId: number): void
  onSongInfo(songId: number): void
  onSongEdit(songId: number): void
  onSongDelete(songId: number): void
  isPlayed: boolean
  isStarred: boolean
  isFlawed: boolean
  isUpcoming: boolean
  isHighlighted?: boolean
  isAdmin: boolean
  numStars: number
  numMedia: number
  filterKeywords: string[]
}

const SongItem = ({
  songId,
  artist,
  title,
  duration,
  onSongQueue,
  onSongStarClick,
  onSongFlawClick,
  onSongInfo,
  onSongEdit,
  onSongDelete,
  isPlayed,
  isStarred,
  isFlawed,
  isUpcoming,
  isHighlighted,
  isAdmin,
  numStars,
  numMedia,
  filterKeywords,
}: SongItemProps) => {
  const [isExpanded, setExpanded] = useState(false)
  const [queuePickerOpen, setQueuePickerOpen] = useState(false)
  const [pickerPos, setPickerPos] = useState<{ top: number, left: number, right: number, flip: boolean } | null>(null)
  const longPressActiveRef = useRef(false)
  const songRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const dispatch = useAppDispatch()
  const intl = useIntl()
  const user = useAppSelector(state => state.user)
  const queueUsers = useAppSelector(state => state.youtube.queueUsers)

  const canQueueForOthers = user.isAdmin || hasPermission(user, 'queueForOthers') || hasPermission(user, 'ghostUsers')
  const canMarkFlaws = user.isAdmin || hasPermission(user, 'songFlaws')

  // tapping outside the picker (including on the song row itself, so a
  // tap that queues for you also dismisses the list; or scrolling away,
  // or Escape) closes the picker
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

  const handleClick = () => {
    if (longPressActiveRef.current) {
      longPressActiveRef.current = false
      return
    }

    if (ignoreMouseup) ignoreMouseup = false
    else if (!isUpcoming) onSongQueue(songId)
  }
  const handleInfoClick = () => onSongInfo(songId)
  const handleEditClick = () => onSongEdit(songId)
  const handleDeleteClick = () => onSongDelete(songId)
  const handleStarClick = () => onSongStarClick(songId)
  const handleFlawClick = () => onSongFlawClick(songId)

  // the blink plays once: after it, drop the highlight so remounts
  // (e.g. scrolling the song out and back in) don't replay it
  const handleAnimationEnd = () => {
    if (isHighlighted) dispatch(markLocateBlinked())
  }

  const swipeHandlers = useSwipeable({
    onSwipedLeft: ({ event }) => {
      ignoreMouseup = event.type === 'mouseup'
      // the flaw action lives in the expanded menu now, so anyone
      // holding the capability needs to be able to expand the row
      setExpanded(isAdmin || canMarkFlaws)
    },
    onSwipedRight: ({ event }) => {
      ignoreMouseup = event.type === 'mouseup'
      setExpanded(false)
    },
    preventScrollOnSwipe: true,
    trackMouse: true,
  })

  // react-swipeable passes its ref callback through the handlers object;
  // handing the row a plain ref={songRef} would overwrite it and the
  // touch listeners would never attach (mouse swipes still work, which
  // makes this very hard to spot), so forward to both
  const setRowRef = useCallback(
    (el: HTMLDivElement | null) => {
      songRef.current = el
      swipeHandlers.ref(el)
    },
    [swipeHandlers],
  )

  // long-press a song to queue it for someone else in the room (or for
  // one of your own ghosts);
  // a plain tap still queues it for yourself
  const bindQueueForOthers = useLongPress(() => {
    if (!canQueueForOthers) return

    longPressActiveRef.current = true
    setExpanded(false)
    void dispatch(fetchQueueUsers(user.roomId))

    // anchor the picker under the song (it portals to document.body,
    // virtualized rows would paint over an inline dropdown)
    const rect = songRef.current?.getBoundingClientRect()

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
  }, { threshold: LONG_PRESS_THRESHOLD_MS, cancelOnMovement: true })

  const handleQueueForUser = (targetUserId: string) => {
    dispatch(queueSong(songId, parseInt(targetUserId, 10)))
    setQueuePickerOpen(false)
  }

  const queueTargets = queueUsers
    .filter(u => u.userId !== user.userId)
    // ghosts show their visible name only (their username is auto-generated)
    .map(u => ({ value: String(u.userId), label: u.isGhost ? u.name : `${u.name} (${u.username})` }))

  return (
    <div
      {...swipeHandlers}
      ref={setRowRef}
      onAnimationEnd={handleAnimationEnd}
      className={clsx(
        styles.container,
        isPlayed && styles.played,
        isUpcoming && styles.upcoming,
        isStarred && styles.starred,
        isExpanded && styles.expanded,
        isHighlighted && styles.located,
        artist && styles.withArtist,
      )}
    >
      <ToggleAnimation toggle={isUpcoming} className={styles.animateGlow}>
        <div className={styles.duration}>
          {formatDuration(duration)}
        </div>
        <div onClick={handleClick} className={styles.primary} {...bindQueueForOthers()}>
          <div className={styles.title}>
            {filterKeywords?.length ? <Highlighter autoEscape textToHighlight={title} searchWords={filterKeywords} /> : title}
            {isAdmin && numMedia > 1 && (
              <i>
                {/* eslint-disable formatjs/no-literal-string-in-jsx -- punctuation around a count, not prose */}
                {' '}
                (
                {numMedia}
                )
                {/* eslint-enable formatjs/no-literal-string-in-jsx */}
              </i>
            )}
            {artist && <div className={styles.artist}>{artist}</div>}
          </div>
        </div>
      </ToggleAnimation>

      <Buttons btnWidth={56} isExpanded={isExpanded}>
        <ButtonStar
          className={styles.btn}
          onClick={handleStarClick}
          isStarred={isStarred}
          count={numStars}
        />
        {canMarkFlaws && (
          <ButtonFlawed
            data-hide
            className={styles.btn}
            onClick={handleFlawClick}
            isFlawed={isFlawed}
            aria-label={intl.formatMessage(isFlawed ? libraryMessages.flawUnmark : libraryMessages.flawMark)}
          />
        )}
        <Button onClick={handleInfoClick} className={clsx(styles.btn, styles.info)} data-hide aria-label={intl.formatMessage(commonMessages.songInfo)}>
          <Icon icon='INFO_OUTLINE' />
        </Button>
        {isAdmin && (
          <Button onClick={handleEditClick} className={clsx(styles.btn, styles.info)} data-hide aria-label={intl.formatMessage(commonMessages.editSong)}>
            <Icon icon='EDIT' />
          </Button>
        )}
        {isAdmin && (
          <Button onClick={handleDeleteClick} className={clsx(styles.btn, styles.danger)} data-hide aria-label={intl.formatMessage(commonMessages.deleteSong)}>
            <Icon icon='DELETE' />
          </Button>
        )}
      </Buttons>
      {queuePickerOpen && pickerPos && createPortal(
        <div
          ref={pickerRef}
          className={clsx(styles.pickerPortal, pickerPos.flip && styles.pickerPortalFlip)}
          style={{ top: pickerPos.top, left: pickerPos.left, right: pickerPos.right }}
        >
          <RecentSearches
            items={queueTargets}
            label={intl.formatMessage(libraryMessages.queueForUser)}
            icon='PERSON'
            onSelect={handleQueueForUser}
          />
        </div>,
        document.body,
      )}
    </div>
  )
}

export default SongItem
