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

const VersionRow = ({
  media,
  checked,
  onToggle,
}: {
  media: Media
  checked: boolean
  onToggle: () => void
}) => {
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
      </label>
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
  const dispatch = useAppDispatch()
  const intl = useIntl()

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

    if (!confirm(intl.formatMessage(sharedMessages.deleteSelectedConfirm, {
      count: selected.length,
      artist: artistName,
      title: song.title,
    }))) return

    dispatch(deleteMedia(selected))
    setSelected([])
  }

  const handleDeleteAll = () => {
    if (!confirm(intl.formatMessage(sharedMessages.deleteAllConfirm, {
      artist: artistName,
      title: song.title,
    }))) return

    dispatch(deleteSong(songId))
  }

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
            onToggle={() => toggle(mediaId)}
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
