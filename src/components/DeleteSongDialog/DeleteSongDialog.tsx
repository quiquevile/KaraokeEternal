import React, { useEffect, useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import { formatDuration } from 'lib/dateTime'
import {
  closeDeleteSong,
  deleteMedia,
  deleteSong,
  fetchSongMedia,
} from 'store/modules/songInfo'
import { Media } from 'shared/types'
import styles from './DeleteSongDialog.css'
import { commonMessages } from '../../lib/messages'
import { sharedMessages } from '../messages'

const VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.avi', '.flv', '.mkv', '.zip']
const AUDIO_EXTS = ['.mp3', '.m4a', '.opus', '.ogg', '.wav', '.flac', '.mpc']

const extOf = (relPath: string) => relPath.slice(relPath.lastIndexOf('.')).toLowerCase()

const VersionPreview = ({ mediaId, ext }: { mediaId: number, ext: string }) => {
  if (VIDEO_EXTS.includes(ext)) {
    return (
      <video
        className={styles.preview}
        src={`${document.baseURI}api/media/${mediaId}?type=video`}
        controls
        preload='metadata'
      />
    )
  }

  if (AUDIO_EXTS.includes(ext)) {
    return (
      <audio
        className={styles.previewAudio}
        src={`${document.baseURI}api/media/${mediaId}?type=audio`}
        controls
        preload='metadata'
      />
    )
  }

  return null
}

const VersionRow = ({
  media,
  checked,
  previewOpen,
  onToggle,
  onPreviewToggle,
}: {
  media: Media
  checked: boolean
  previewOpen: boolean
  onToggle: () => void
  onPreviewToggle: () => void
}) => {
  const ext = extOf(media.relPath)
  const previewable = VIDEO_EXTS.includes(ext) || AUDIO_EXTS.includes(ext)
  const intl = useIntl()

  return (
    <li className={styles.version}>
      <label className={styles.row}>
        <input type='checkbox' checked={checked} onChange={onToggle} />
        <span className={styles.path}>
          {media.path}
          {/* eslint-disable formatjs/no-literal-string-in-jsx -- file path separators, not prose */}
          /
          {media.relPath}
          {/* eslint-enable formatjs/no-literal-string-in-jsx */}
        </span>
        <span className={styles.duration}>{formatDuration(media.duration)}</span>
        {previewable && (
          <Button
            className={styles.previewBtn}
            onClick={onPreviewToggle}
            aria-label={previewOpen
              ? intl.formatMessage(sharedMessages.hidePreview)
              : intl.formatMessage(sharedMessages.preview)}
          >
            {previewOpen
              ? <FormattedMessage {...sharedMessages.hide} />
              : <FormattedMessage {...commonMessages.preview} />}
          </Button>
        )}
      </label>
      {previewOpen && previewable && (
        <VersionPreview mediaId={media.mediaId} ext={ext} />
      )}
    </li>
  )
}

const DeleteSongForm = ({ songId }: { songId: number }) => {
  const song = useAppSelector(state => state.songs.entities[songId])
  const artistName = useAppSelector(state => (
    song ? state.artists.entities[song.artistId]?.name : undefined
  ))
  const media = useAppSelector(state => state.songInfo.media)
  const error = useAppSelector(state => state.songInfo.error)
  const [selected, setSelected] = useState<number[]>([])
  const [previewId, setPreviewId] = useState<number | null>(null)
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(fetchSongMedia(songId))
  }, [dispatch, songId])

  if (!song) return null

  const toggle = (mediaId: number) => {
    setSelected(sel => (sel.includes(mediaId)
      ? sel.filter(id => id !== mediaId)
      : [...sel, mediaId]))
  }

  const handleDeleteSelected = () => {
    if (!selected.length) return

    dispatch(deleteMedia(selected))
    setSelected([])
    setPreviewId(null)
  }

  const handleDeleteAll = () => dispatch(deleteSong(songId))

  return (
    <>
      <p className={styles.text}>
        <FormattedMessage
          {...sharedMessages.intro}
          values={{ artist: artistName, title: song.title }}
        />
      </p>

      <ul className={styles.versions}>
        {media.result.map(mediaId => (
          <VersionRow
            key={mediaId}
            media={media.entities[mediaId]}
            checked={selected.includes(mediaId)}
            previewOpen={previewId === mediaId}
            onToggle={() => toggle(mediaId)}
            onPreviewToggle={() => setPreviewId(previewId === mediaId ? null : mediaId)}
          />
        ))}
      </ul>

      {error
        && <p className={styles.error}>{error}</p>}

      <div className={styles.buttons}>
        <Button
          variant='danger'
          onClick={handleDeleteSelected}
          disabled={!selected.length}
        >
          <FormattedMessage
            {...sharedMessages.deleteSelected}
            values={{ count: selected.length }}
          />
        </Button>
        <Button variant='danger' onClick={handleDeleteAll}>
          <FormattedMessage {...sharedMessages.deleteAll} />
        </Button>
      </div>
    </>
  )
}

const DeleteSongDialog = () => {
  const deleteSongId = useAppSelector(state => state.songInfo.deleteSongId)
  const dispatch = useAppDispatch()
  const intl = useIntl()

  const handleClose = () => dispatch(closeDeleteSong())

  return (
    <Modal
      visible={deleteSongId !== null}
      onClose={handleClose}
      title={intl.formatMessage(commonMessages.deleteSong)}
    >
      {deleteSongId !== null && <DeleteSongForm key={deleteSongId} songId={deleteSongId} />}
    </Modal>
  )
}

export default DeleteSongDialog
