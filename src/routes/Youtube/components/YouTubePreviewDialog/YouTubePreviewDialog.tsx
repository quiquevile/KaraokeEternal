import React, { useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import clsx from 'clsx'
import { closeYoutubePreview, selectYoutubeResult } from 'store/modules/youtube'
import styles from './YouTubePreviewDialog.css'
import { commonMessages } from '../../../../lib/messages'
import { youtubeMessages } from '../../messages'

const PreviewBody = ({ preview }: { preview: { streamUrl: string | null } }) => {
  const [aspectRatio, setAspectRatio] = useState('16 / 9')
  const [isReady, setIsReady] = useState(false)
  const intl = useIntl()

  const handleLoadedMetadata = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget

    if (video.videoWidth && video.videoHeight) {
      setAspectRatio(`${video.videoWidth} / ${video.videoHeight}`)
    }
  }

  return (
    <div className={styles.container} style={{ aspectRatio }}>
      {!isReady && (
        <div
          className={styles.loading}
          aria-label={intl.formatMessage(youtubeMessages.loading)}
        />
      )}
      {preview.streamUrl
        && (
          <video
            className={clsx(styles.video, !isReady && styles.hidden)}
            src={preview.streamUrl}
            controls
            autoPlay
            onLoadedMetadata={handleLoadedMetadata}
            onCanPlay={() => setIsReady(true)}
          />
        )}
    </div>
  )
}

const YouTubePreviewDialog = () => {
  const preview = useAppSelector(state => state.youtube.preview)
  const dispatch = useAppDispatch()
  const intl = useIntl()

  const handleClose = () => dispatch(closeYoutubePreview())

  const handleDownload = () => {
    if (!preview) return

    dispatch(selectYoutubeResult(preview.item))
    dispatch(closeYoutubePreview())
  }

  return (
    <Modal
      visible={!!preview}
      onClose={handleClose}
      title={intl.formatMessage(commonMessages.preview)}
      buttons={(
        <div className={styles.btnContainer}>
          <Button
            variant='default'
            onClick={handleClose}
          >
            <FormattedMessage {...commonMessages.cancel} />
          </Button>
          <Button
            variant='primary'
            onClick={handleDownload}
          >
            <FormattedMessage {...commonMessages.download} />
          </Button>
        </div>
      )}
    >
      {preview
        && <PreviewBody key={preview.item.id} preview={preview} />}
    </Modal>
  )
}

export default YouTubePreviewDialog
