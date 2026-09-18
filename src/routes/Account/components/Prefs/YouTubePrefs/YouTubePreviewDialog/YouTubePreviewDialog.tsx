import React from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import { closeYoutubePreview, selectYoutubeResult } from 'store/modules/youtube'
import styles from './YouTubePreviewDialog.css'

const YouTubePreviewDialog = () => {
  const preview = useAppSelector(state => state.youtube.preview)
  const dispatch = useAppDispatch()

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
      title='Preview'
      buttons={(
        <Button variant='primary' onClick={handleDownload} disabled={preview?.item.alreadyDownloaded}>
          Download
        </Button>
      )}
    >
      {preview
        && (
          <div className={styles.container}>
            <video className={styles.video} src={preview.streamUrl} controls autoPlay />
          </div>
        )}
    </Modal>
  )
}

export default YouTubePreviewDialog
