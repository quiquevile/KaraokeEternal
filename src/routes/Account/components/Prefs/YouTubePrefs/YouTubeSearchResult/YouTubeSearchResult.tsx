import React from 'react'
import { useAppDispatch } from 'store/hooks'
import Button from 'components/Button/Button'
import { openPreview, selectYoutubeResult } from 'store/modules/youtube'
import type { YouTubeResult } from 'store/modules/youtube'
import styles from './YouTubeSearchResult.css'

const YouTubeSearchResult = ({ item }: { item: YouTubeResult }) => {
  const dispatch = useAppDispatch()

  return (
    <li className={styles.container}>
      <img className={styles.thumbnail} src={item.thumbnail} alt='' />

      <div className={styles.info}>
        <div className={styles.title}>{item.title}</div>
        <div className={styles.meta}>
          {item.artist}
          {' '}
          ·
          {' '}
          {item.durationLabel}
          {item.alreadyDownloaded
            && <span className={styles.downloaded}>Downloaded</span>}
        </div>
      </div>

      <Button icon='PLAY' onClick={() => dispatch(openPreview(item))} aria-label='Preview' />
      <Button
        icon='DOWNLOAD'
        variant='primary'
        onClick={() => dispatch(selectYoutubeResult(item))}
        disabled={item.alreadyDownloaded}
        aria-label='Download'
      />
    </li>
  )
}

export default YouTubeSearchResult
