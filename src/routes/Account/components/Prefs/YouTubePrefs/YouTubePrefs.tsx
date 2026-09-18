import React from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Accordion from 'components/Accordion/Accordion'
import Icon from 'components/Icon/Icon'
import { setPref } from 'store/modules/prefs'
import YouTubeSearch from './YouTubeSearch/YouTubeSearch'
import YouTubeDownloads from './YouTubeDownloads/YouTubeDownloads'
import styles from './YouTubePrefs.css'

const YouTubePrefs = () => {
  const isYouTubeEnabled = useAppSelector(state => state.prefs.isYouTubeEnabled)
  const dispatch = useAppDispatch()

  const toggleCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setPref({ key: e.currentTarget.name, data: e.currentTarget.checked }))
  }

  return (
    <Accordion
      className={styles.container}
      headingComponent={(
        <div className={styles.heading}>
          <Icon icon='TELEVISION_PLAY' size={32} className={styles.icon} />
          <div className={styles.title}>YouTube</div>
        </div>
      )}
    >
      <div className={styles.content}>
        <label>
          <input
            type='checkbox'
            checked={isYouTubeEnabled}
            onChange={toggleCheckbox}
            name='isYouTubeEnabled'
          />
          {' '}
          Enable YouTube downloads
        </label>

        {isYouTubeEnabled
          && (
            <>
              <YouTubeSearch />
              <YouTubeDownloads />
            </>
          )}
      </div>
    </Accordion>
  )
}

export default YouTubePrefs
