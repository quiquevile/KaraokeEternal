import React, { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import MetadataFields from 'components/MetadataFields/MetadataFields'
import { useCaseField } from 'components/MetadataFields/useCaseField'
import { closeYoutubeDialog, downloadVideo, fetchDownloadUsers, identifyVideo } from 'store/modules/youtube'
import { hasPermission } from 'store/modules/user'
import type { ConvertedMetadata, YouTubeResult } from 'store/modules/youtube'
import styles from './YouTubeMetadataDialog.css'

const MetadataForm = ({ selected, metadata }: { selected: YouTubeResult, metadata: ConvertedMetadata | null }) => {
  const artist = useCaseField(metadata?.artist ?? selected.artist)
  const title = useCaseField(metadata?.title ?? selected.title)
  const [savedMetadata, setSavedMetadata] = useState<ConvertedMetadata | null>(metadata)
  const user = useAppSelector(state => state.user)
  const downloadUsers = useAppSelector(state => state.youtube.downloadUsers)
  const [queueChecked, setQueueChecked] = useState(false)
  const [queueUserId, setQueueUserId] = useState<number | null>(null)
  const dispatch = useAppDispatch()

  const canQueueForOthers = user.isAdmin || hasPermission(user, 'downloadForOthers')

  useEffect(() => {
    if (canQueueForOthers) dispatch(fetchDownloadUsers())
  }, [dispatch, canQueueForOthers])

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
      queueUserId: queueChecked ? (queueUserId ?? user.userId) : null,
    }))
  }

  return (
    <>
      <p className={styles.hint}>
        Check artist and title
      </p>

      <MetadataFields artist={artist} title={title} />

      <label className={styles.queueRow}>
        <input
          type='checkbox'
          checked={queueChecked}
          onChange={() => setQueueChecked(!queueChecked)}
        />
        Add to queue
      </label>

      {canQueueForOthers && (
        <label className={styles.queueRow}>
          <span className={styles.label}>User</span>
          <select
            value={queueUserId ?? user.userId ?? ''}
            onChange={e => setQueueUserId(Number(e.target.value))}
            disabled={!queueChecked}
          >
            {user.userId !== null && (
              <option value={user.userId}>
                {user.name}
                {' '}
                (you)
              </option>
            )}
            {downloadUsers
              .filter(u => u.userId !== user.userId)
              .map(u => (
                <option key={u.userId} value={u.userId}>
                  {u.name}
                  {' '}
                  (
                  {u.username}
                  )
                </option>
              ))}
          </select>
        </label>
      )}

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
    <Modal visible={!!selected} onClose={handleClose} title='Download song'>
      {selected
        && <MetadataForm key={selected.id} selected={selected} metadata={metadata} />}
    </Modal>
  )
}

export default YouTubeMetadataDialog
