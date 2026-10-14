import React from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import MetadataFields from 'components/MetadataFields/MetadataFields'
import { useCaseField } from 'components/MetadataFields/useCaseField'
import { closeSongEditor, updateSong } from 'store/modules/songInfo'
import styles from './EditSongDialog.css'
import { commonMessages } from '../../lib/messages'
import { sharedMessages } from '../messages'

const EditSongForm = ({
  songId,
  initialArtist,
  initialTitle,
}: {
  songId: number
  initialArtist: string
  initialTitle: string
}) => {
  const artist = useCaseField(initialArtist)
  const title = useCaseField(initialTitle)
  const error = useAppSelector(state => state.songInfo.error)
  const dispatch = useAppDispatch()

  const handleClose = () => dispatch(closeSongEditor())

  const handleSave = () => {
    if (!artist.value.trim() || !title.value.trim()) return

    dispatch(updateSong({
      songId,
      artist: artist.value.trim(),
      title: title.value.trim(),
    }))
  }

  return (
    <>
      <p className={styles.hint}>
        <FormattedMessage {...commonMessages.checkArtistTitle} />
      </p>

      <MetadataFields artist={artist} title={title} />

      {error
        && <p className={styles.error}>{error}</p>}

      <div className={styles.buttons}>
        <Button
          variant='default'
          onClick={handleClose}
        >
          <FormattedMessage {...commonMessages.cancel} />
        </Button>
        <Button
          variant='primary'
          onClick={handleSave}
          disabled={!artist.value.trim() || !title.value.trim()}
        >
          <FormattedMessage {...sharedMessages.save} />
        </Button>
      </div>
    </>
  )
}

const EditSongDialog = () => {
  const editorSongId = useAppSelector(state => state.songInfo.editorSongId)
  const song = useAppSelector(state => (
    editorSongId !== null ? state.songs.entities[editorSongId] : undefined
  ))
  const artistName = useAppSelector(state => (
    song ? state.artists.entities[song.artistId]?.name : undefined
  ))
  const dispatch = useAppDispatch()

  const handleClose = () => dispatch(closeSongEditor())

  const intl = useIntl()

  return (
    <Modal
      visible={editorSongId !== null}
      onClose={handleClose}
      title={intl.formatMessage(commonMessages.editSong)}
    >
      {editorSongId !== null && song
        && (
          <EditSongForm
            key={editorSongId}
            songId={editorSongId}
            initialArtist={artistName ?? ''}
            initialTitle={song.title}
          />
        )}
    </Modal>
  )
}

export default EditSongDialog
