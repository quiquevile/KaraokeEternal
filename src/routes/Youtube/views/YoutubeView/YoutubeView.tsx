import React from 'react'
import { useAppSelector } from 'store/hooks'
import YouTubeDownloads from '../../components/YouTubeDownloads/YouTubeDownloads'
import YouTubeMetadataDialog from '../../components/YouTubeMetadataDialog/YouTubeMetadataDialog'
import YouTubePreviewDialog from '../../components/YouTubePreviewDialog/YouTubePreviewDialog'
import YouTubeSearch from '../../components/YouTubeSearch/YouTubeSearch'
import styles from './YoutubeView.css'

const YoutubeView = () => {
  const { innerWidth, innerHeight, headerHeight, footerHeight } = useAppSelector(state => state.ui)

  return (
    <div
      className={styles.container}
      style={{
        width: innerWidth,
        height: innerHeight,
        paddingTop: headerHeight,
        paddingBottom: footerHeight,
      }}
    >
      <div className={styles.downloads}>
        <YouTubeDownloads />
      </div>
      <div className={styles.scroll}>
        <div className={styles.content}>
          <YouTubeSearch />
        </div>
      </div>

      <YouTubeMetadataDialog />
      <YouTubePreviewDialog />
    </div>
  )
}

export default YoutubeView
