import React, { useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import { formatDuration } from 'lib/dateTime'
import { closeSongInfo, setMediaGain, setPreferredSong } from 'store/modules/songInfo'
import MoveVersionDialog from 'components/MoveVersionDialog/MoveVersionDialog'
import styles from './SongInfo.css'

const SongInfo = () => {
  const { isLoading, isVisible, songId, media } = useAppSelector(state => state.songInfo)
  const isAdmin = useAppSelector(state => state.user.isAdmin)
  const [moveMediaId, setMoveMediaId] = useState<number | null>(null)
  const intl = useIntl()

  const dispatch = useAppDispatch()
  const handleCloseSongInfo = () => dispatch(closeSongInfo())
  const handlePrefer = (mediaId: number) => dispatch(setPreferredSong({ songId, mediaId, isPreferred: true }))
  const handleRemovePrefer = (mediaId: number) => dispatch(setPreferredSong({ songId, mediaId, isPreferred: false }))
  const handleGain = (mediaId: number, rgTrackGain: number | null) => {
    if (rgTrackGain === null) {
      if (!confirm(intl.formatMessage({
        id: 'songInfo.clearLevelConfirm',
        defaultMessage: 'Clear the level? It will be picked up again on the next scan.',
      }))) return
    } else {
      rgTrackGain = Math.min(24, Math.max(-24, Math.round(rgTrackGain * 2) / 2))
    }

    dispatch(setMediaGain({ songId, mediaId, rgTrackGain }))
  }

  const mediaDetails = media.result.map((mediaId) => {
    const item = media.entities[mediaId]
    const isPreferred = !!item.isPreferred
    const gain = typeof item.rgTrackGain === 'number' ? item.rgTrackGain : null
    // null glyph + numeric level: symbols and data, never prose
    const gainText = gain === null ? '—' : `${gain > 0 ? '+' : ''}${gain.toFixed(1)} dB`

    return (
      <div key={item.mediaId} className={styles.media}>
        {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx -- file path expression, not prose */}
        {item.path + (item.path.indexOf('/') === 0 ? '/' : '\\') + item.relPath}
        {isAdmin && (
          <span>
            &nbsp;
            <a onClick={() => setMoveMediaId(mediaId)}>
              <FormattedMessage id='songInfo.move' defaultMessage='(Move)' />
            </a>
          </span>
        )}
        <br />
        <span className={styles.label}>
          <FormattedMessage id='songInfo.duration' defaultMessage='Duration: ' />
        </span>
        {formatDuration(item.duration)}
        <br />
        <span className={styles.label}>
          <FormattedMessage id='songInfo.mediaId' defaultMessage='Media ID: ' />
        </span>
        {mediaId}
        <br />
        <span className={styles.label}>
          <FormattedMessage id='songInfo.level' defaultMessage='Level: ' />
        </span>
        {gainText}
        {isAdmin && (
          <>
            {/* eslint-disable formatjs/no-literal-string-in-jsx -- math symbols and spacing, not prose */}
            <span className={styles.stepper}>
              {' '}
              <a
                onClick={() => handleGain(mediaId, (gain ?? 0) - 0.5)}
                aria-label={intl.formatMessage({ id: 'songInfo.lowerLevel', defaultMessage: 'Lower level' })}
              >
                (−)
              </a>
              {' '}
              <a
                onClick={() => handleGain(mediaId, (gain ?? 0) + 0.5)}
                aria-label={intl.formatMessage({ id: 'songInfo.raiseLevel', defaultMessage: 'Raise level' })}
              >
                (+)
              </a>
              {/* eslint-enable formatjs/no-literal-string-in-jsx */}
              {gain !== null && (
                <>
                  {' '}
                  <a onClick={() => handleGain(mediaId, null)}>
                    <FormattedMessage id='songInfo.resetLevel' defaultMessage='(reset)' />
                  </a>
                </>
              )}
            </span>
          </>
        )}
        <br />
        <span className={styles.label}>
          <FormattedMessage id='songInfo.preferred' defaultMessage='Preferred: ' />
        </span>
        {isPreferred
          && (
            <span>
              <strong><FormattedMessage id='songInfo.yes' defaultMessage='Yes' /></strong>
&nbsp;
              <a onClick={() => handleRemovePrefer(mediaId)}>
                <FormattedMessage id='songInfo.unset' defaultMessage='(Unset)' />
              </a>
            </span>
          )}
        {!isPreferred
          && (
            <span>
              <FormattedMessage id='songInfo.no' defaultMessage='No' />
&nbsp;
              <a onClick={() => handlePrefer(mediaId)}>
                <FormattedMessage id='songInfo.set' defaultMessage='(Set)' />
              </a>
            </span>
          )}
      </div>
    )
  })

  return (
    <Modal
      visible={isVisible}
      onClose={handleCloseSongInfo}
      title={intl.formatMessage({ id: 'songInfo.title', defaultMessage: 'Song Info' })}
      // style={{
      //   width: '90%',
      //   height: '90%',
      // }}
    >
      <div className={styles.container}>
        <p>
          <span className={styles.label}>
            <FormattedMessage id='songInfo.songId' defaultMessage='Song ID: ' />
          </span>
          {songId}
          <br />
          <span className={styles.label}>
            <FormattedMessage id='songInfo.mediaFiles' defaultMessage='Media Files: ' />
          </span>
          {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx -- loading placeholder glyph, not prose */}
          {isLoading ? '?' : media.result.length}
        </p>

        <div className={styles.mediaContainer}>
          {isLoading
            ? (
                <p>
                  <FormattedMessage id='songInfo.loading' defaultMessage='Loading...' />
                </p>
              )
            : mediaDetails}
        </div>

        <div>
          <Button variant='primary' onClick={handleCloseSongInfo}>
            <FormattedMessage id='songInfo.done' defaultMessage='Done' />
          </Button>
        </div>
      </div>
      {moveMediaId !== null && songId !== null && (
        <MoveVersionDialog
          songId={songId}
          mediaId={moveMediaId}
          fileName={media.entities[moveMediaId]?.relPath ?? ''}
          onClose={() => setMoveMediaId(null)}
        />
      )}
    </Modal>
  )
}

export default SongInfo
