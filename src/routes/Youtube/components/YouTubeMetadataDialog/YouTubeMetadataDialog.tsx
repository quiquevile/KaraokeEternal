import React, { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import MetadataFields from 'components/MetadataFields/MetadataFields'
import { useCaseField } from 'components/MetadataFields/useCaseField'
import { closeYoutubeDialog, downloadVideo, identifyVideo } from 'store/modules/youtube'
import type { ConvertedMetadata, YouTubeResult } from 'store/modules/youtube'
import styles from './YouTubeMetadataDialog.css'

const MetadataForm = ({ selected, metadata }: { selected: YouTubeResult, metadata: ConvertedMetadata | null }) => {
  const artist = useCaseField(metadata?.artist ?? selected.artist)
  const title = useCaseField(metadata?.title ?? selected.title)
  const [savedMetadata, setSavedMetadata] = useState<ConvertedMetadata | null>(metadata)
  const dispatch = useAppDispatch()

  if (metadata !== savedMetadata) {
    setSavedMetadata(metadata)

    if (metadata) {
      artist.set(metadata.artist)
      title.set(metadata.title)
    }
  }

  const handleClose = () => dispatch(closeYoutubeDialog())

  const handleDownload = () => {
    if (!artist.value.trim() || !title.value.trim()) return

    dispatch(downloadVideo({
      url: selected.url,
      artist: artist.value.trim(),
      title: title.value.trim(),
      thumbnail: selected.thumbnail,
    }))
  }

  return (
    <>
      <p className={styles.hint}>
        Check artist and title
      </p>

      <MetadataFields artist={artist} title={title} />

      <div className={styles.buttons}>
        <Button
          variant='default'
          onClick={handleClose}
        >
          Cancel
        </Button>
        <Button
          variant='primary'
          onClick={handleDownload}
          disabled={!artist.value.trim() || !title.value.trim()}
        >
          Save
        </Button>
      </div>
    </>
  )
}

const YouTubeMetadataDialog = () => {
  const selected = useAppSelector(state => state.youtube.selected)
  const metadata = useAppSelector(state => state.youtube.metadata)
  const dispatch = useAppDispatch()

  useEffect(() => {
    if (!selected) return

    dispatch(identifyVideo({ title: selected.title, channel: selected.artist }))
  }, [selected, dispatch])

  const handleClose = () => dispatch(closeYoutubeDialog())

  return (
    <Modal visible={!!selected} onClose={handleClose} title='Download song'>
      {selected
        && <MetadataForm key={selected.id} selected={selected} metadata={metadata} />}
    </Modal>
  )
}

export default YouTubeMetadataDialog
