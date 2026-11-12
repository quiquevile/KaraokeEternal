import React, { useState } from 'react'
import clsx from 'clsx'
import { useIntl } from 'react-intl'
import { useSwipeable } from 'react-swipeable'
import SongList from '../SongList/SongList'
import Button from 'components/Button/Button'
import Buttons from 'components/Buttons/Buttons'
import Icon from 'components/Icon/Icon'
import useToggleAnimation from 'lib/useToggleAnimation'
import Highlight from '../Highlight/Highlight'
import styles from './ArtistItem.css'
import { commonMessages } from '../../../../lib/messages'

// set after a mouse swipe so the trailing click doesn't toggle the row
let ignoreMouseup = false

interface ArtistItemProps {
  artistSongIds: number[]
  highlight?: RegExp | null
  isExpanded: boolean
  isAdmin: boolean
  name: string
  numStars: number
  onArtistClick: () => void
  onEditArtist: () => void
  starredSongs: number[]
  style?: object
  upcomingSongs: Set<number>
  currentSongId: number | undefined
}

const ArtistItem = ({
  artistSongIds,
  highlight,
  isExpanded,
  isAdmin,
  name,
  onArtistClick,
  onEditArtist,
  starredSongs,
  style,
  upcomingSongs,
  currentSongId,
}: ArtistItemProps): React.ReactElement => {
  const [menuOpen, setMenuOpen] = useState(false)
  const intl = useIntl()
  const isChildUpcoming = artistSongIds.some(songId =>
    upcomingSongs.has(songId) || currentSongId === songId,
  )
  const isChildStarred = artistSongIds.some(songId => starredSongs.includes(songId))
  const glow = useToggleAnimation(isChildUpcoming, styles.animateGlow)

  const handleClick = () => {
    if (ignoreMouseup) {
      ignoreMouseup = false
      return
    }

    onArtistClick()
  }
  const handleEditClick = () => onEditArtist()

  const swipeHandlers = useSwipeable({
    onSwipedLeft: ({ event }) => {
      ignoreMouseup = event.type === 'mouseup'
      if (!isAdmin) return
      setMenuOpen(true)
    },
    onSwipedRight: ({ event }) => {
      ignoreMouseup = event.type === 'mouseup'
      if (!isAdmin) return
      setMenuOpen(false)
    },
    preventScrollOnSwipe: true,
    trackMouse: true,
  })

  return (
    <div style={style} translate='no'>
      <div
        {...swipeHandlers}
        className={clsx(styles.container, isChildStarred && styles.hasStarred)}
      >
        <div onClick={handleClick} className={styles.primary}>
          <div className={styles.folderContainer}>
            <Icon icon='FOLDER' />
            {isExpanded && (
              <div className={styles.iconChevronContainer}>
                <Icon icon='CHEVRON_DOWN' />
              </div>
            )}
            {!isExpanded && <div className={styles.count}>{artistSongIds.length}</div>}
          </div>
          <div
            className={clsx(styles.name, isChildUpcoming && styles.isChildUpcoming, glow.className)}
            onAnimationEnd={glow.onAnimationEnd}
          >
            <Highlight text={name} pattern={highlight ?? null} />
          </div>
        </div>

        <Buttons btnWidth={56} isExpanded={menuOpen}>
          {isAdmin && (
            <Button
              onClick={handleEditClick}
              className={clsx(styles.btn, styles.edit)}
              data-hide
              aria-label={intl.formatMessage(commonMessages.editArtist)}
            >
              <Icon icon='EDIT' />
            </Button>
          )}
        </Buttons>
      </div>

      {isExpanded && (
        <SongList
          songIds={artistSongIds}
          showArtist={false}
          highlight={highlight}
        />
      )}
    </div>
  )
}

export default ArtistItem
