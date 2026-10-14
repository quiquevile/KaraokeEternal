import React, { useState } from 'react'
import clsx from 'clsx'
import Highlighter from 'react-highlight-words'
import { useIntl } from 'react-intl'
import { useSwipeable } from 'react-swipeable'
import Button from 'components/Button/Button'
import ButtonStar from 'components/ButtonStar/ButtonStar'
import Buttons from 'components/Buttons/Buttons'
import Icon from 'components/Icon/Icon'
import ToggleAnimation from 'components/ToggleAnimation/ToggleAnimation'
import { formatDuration } from 'lib/dateTime'
import styles from './SongItem.css'
import { commonMessages } from '../../../../lib/messages'

let ignoreMouseup = false

interface SongItemProps {
  songId: number
  artist?: string
  title: string
  duration: number
  onSongQueue(songId: number): void
  onSongStarClick(songId: number): void
  onSongInfo(songId: number): void
  onSongEdit(songId: number): void
  onSongDelete(songId: number): void
  isPlayed: boolean
  isStarred: boolean
  isUpcoming: boolean
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
  onSongInfo,
  onSongEdit,
  onSongDelete,
  isPlayed,
  isStarred,
  isUpcoming,
  isAdmin,
  numStars,
  numMedia,
  filterKeywords,
}: SongItemProps) => {
  const [isExpanded, setExpanded] = useState(false)
  const intl = useIntl()

  const handleClick = () => {
    if (ignoreMouseup) ignoreMouseup = false
    else if (!isUpcoming) onSongQueue(songId)
  }
  const handleInfoClick = () => onSongInfo(songId)
  const handleEditClick = () => onSongEdit(songId)
  const handleDeleteClick = () => onSongDelete(songId)
  const handleStarClick = () => onSongStarClick(songId)

  const swipeHandlers = useSwipeable({
    onSwipedLeft: ({ event }) => {
      ignoreMouseup = event.type === 'mouseup'
      setExpanded(isAdmin)
    },
    onSwipedRight: ({ event }) => {
      ignoreMouseup = event.type === 'mouseup'
      setExpanded(false)
    },
    preventScrollOnSwipe: true,
    trackMouse: true,
  })

  return (
    <div
      {...swipeHandlers}
      className={clsx(
        styles.container,
        isPlayed && styles.played,
        isUpcoming && styles.upcoming,
        isStarred && styles.starred,
        isExpanded && styles.expanded,
        artist && styles.withArtist,
      )}
    >
      <ToggleAnimation toggle={isUpcoming} className={styles.animateGlow}>
        <div className={styles.duration}>
          {formatDuration(duration)}
        </div>
        <div onClick={handleClick} className={styles.primary}>
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
    </div>
  )
}

export default SongItem
