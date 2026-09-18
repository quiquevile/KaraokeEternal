import React, { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import { closeYoutubeDialog, downloadVideo, identifyVideo } from 'store/modules/youtube'
import type { ConvertedMetadata, YouTubeResult } from 'store/modules/youtube'
import styles from './YouTubeMetadataDialog.css'

const MetadataForm = ({ selected, metadata }: { selected: YouTubeResult, metadata: ConvertedMetadata | null }) => {
  const [artist, setArtist] = useState(metadata?.artist ?? selected.artist)
  const [title, setTitle] = useState(metadata?.title ?? selected.title)
  const [savedMetadata, setSavedMetadata] = useState<ConvertedMetadata | null>(metadata)
  const dispatch = useAppDispatch()

  if (metadata !== savedMetadata) {
    setSavedMetadata(metadata)

    if (metadata) {
      setArtist(metadata.artist)
      setTitle(metadata.title)
    }
  }

  const handleDownload = () => {
    if (!artist.trim() || !title.trim()) return

    dispatch(downloadVideo({
      url: selected.url,
      artist: artist.trim(),
      title: title.trim(),
      thumbnail: selected.thumbnail,
    }))
  }

  return (
    <>
      <p className={styles.hint}>
        The track is downloaded into your media folder and appears in the library after a rescan.
      </p>

      <label className={styles.field}>
        Artist
        <input type='text' value={artist} onChange={e => setArtist(e.currentTarget.value)} />
      </label>

      <label className={styles.field}>
        Title
        <input type='text' value={title} onChange={e => setTitle(e.currentTarget.value)} />
      </label>

      <div className={styles.buttons}>
        <Button onClick={() => dispatch(closeYoutubeDialog())}>Cancel</Button>
        <Button
          variant='primary'
          onClick={handleDownload}
          disabled={!artist.trim() || !title.trim()}
        >
          Download
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
    <Modal visible={!!selected} onClose={handleClose} title='Download from YouTube'>
      {selected
        && <MetadataForm key={selected.id} selected={selected} metadata={metadata} />}
    </Modal>
  )
}

export default YouTubeMetadataDialog
