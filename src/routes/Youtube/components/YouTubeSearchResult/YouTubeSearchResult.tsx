import React from 'react'
import { useAppDispatch } from 'store/hooks'
import Button from 'components/Button/Button'
import Icon from 'components/Icon/Icon'
import { openPreview, selectYoutubeResult } from 'store/modules/youtube'
import type { YouTubeResult } from 'store/modules/youtube'
import styles from './YouTubeSearchResult.css'

const YouTubeSearchResult = ({ item }: { item: YouTubeResult }) => {
  const dispatch = useAppDispatch()

  return (
    <li className={styles.container}>
      <button
        type='button'
        className={styles.thumbnailButton}
        onClick={() => dispatch(openPreview(item))}
        aria-label='Preview'
      >
        <img className={styles.thumbnail} src={item.thumbnail} alt='' />
        <Icon icon='PLAY' size={40} className={styles.thumbnailPlay} />
      </button>

      <div className={styles.info}>
        <div className={styles.title}>{item.title}</div>
        <div className={styles.meta}>
          {item.artist}
          {' '}
          ·
          {' '}
          {item.durationLabel}
        </div>
      </div>

      <div className={styles.actions}>
        <Button
          icon='DOWNLOAD'
          size={24}
          variant='primary'
          className={styles.download}
          onClick={() => dispatch(selectYoutubeResult(item))}
          aria-label='Download'
        />
      </div>
    </li>
  )
}

export default YouTubeSearchResult
