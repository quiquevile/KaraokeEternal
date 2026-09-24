import React from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import { formatDuration } from 'lib/dateTime'
import { closeSongInfo, setMediaGain, setPreferredSong } from 'store/modules/songInfo'
import styles from './SongInfo.css'

const SongInfo = () => {
  const { isLoading, isVisible, songId, media } = useAppSelector(state => state.songInfo)
  const isAdmin = useAppSelector(state => state.user.isAdmin)

  const dispatch = useAppDispatch()
  const handleCloseSongInfo = () => dispatch(closeSongInfo())
  const handlePrefer = (mediaId: number) => dispatch(setPreferredSong({ songId, mediaId, isPreferred: true }))
  const handleRemovePrefer = (mediaId: number) => dispatch(setPreferredSong({ songId, mediaId, isPreferred: false }))
  const handleGain = (mediaId: number, rgTrackGain: number) => {
    const clamped = Math.min(24, Math.max(-24, Math.round(rgTrackGain * 2) / 2))
    dispatch(setMediaGain({ songId, mediaId, rgTrackGain: clamped }))
  }

  const mediaDetails = media.result.map((mediaId) => {
    const item = media.entities[mediaId]
    const isPreferred = !!item.isPreferred
    const gain = typeof item.rgTrackGain === 'number' ? item.rgTrackGain : null

    return (
      <div key={item.mediaId} className={styles.media}>
        {item.path + (item.path.indexOf('/') === 0 ? '/' : '\\') + item.relPath}
        <br />
        <span className={styles.label}>Duration: </span>
        {formatDuration(item.duration)}
        <br />
        <span className={styles.label}>Media ID: </span>
        {mediaId}
        <br />
        <span className={styles.label}>Level: </span>
        {gain === null ? '—' : `${gain > 0 ? '+' : ''}${gain.toFixed(1)} dB`}
        {isAdmin && (
          <span>
            {' '}
            <a onClick={() => handleGain(mediaId, (gain ?? 0) - 0.5)}>(−)</a>
            {' '}
            <a onClick={() => handleGain(mediaId, (gain ?? 0) + 0.5)}>(+)</a>
          </span>
        )}
        <br />
        <span className={styles.label}>Preferred: </span>
        {isPreferred
          && (
            <span>
              <strong>Yes</strong>
&nbsp;
              <a onClick={() => handleRemovePrefer(mediaId)}>(Unset)</a>
            </span>
          )}
        {!isPreferred
          && (
            <span>
              No&nbsp;
              <a onClick={() => handlePrefer(mediaId)}>(Set)</a>
            </span>
          )}
      </div>
    )
  })

  return (
    <Modal
      visible={isVisible}
      onClose={handleCloseSongInfo}
      title='Song Info'
      // style={{
      //   width: '90%',
      //   height: '90%',
      // }}
    >
      <div className={styles.container}>
        <p>
          <span className={styles.label}>Song ID: </span>
          {songId}
          <br />
          <span className={styles.label}>Media Files: </span>
          {isLoading ? '?' : media.result.length}
        </p>

        <div className={styles.mediaContainer}>
          {isLoading ? <p>Loading...</p> : mediaDetails}
        </div>

        <div>
          <Button variant='primary' onClick={handleCloseSongInfo}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default SongInfo
