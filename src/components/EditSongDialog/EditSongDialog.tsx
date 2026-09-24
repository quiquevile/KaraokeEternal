import React from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import MetadataFields from 'components/MetadataFields/MetadataFields'
import { useCaseField } from 'components/MetadataFields/useCaseField'
import { closeSongEditor, updateSong } from 'store/modules/songInfo'
import styles from './EditSongDialog.css'

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
          onClick={handleSave}
          disabled={!artist.value.trim() || !title.value.trim()}
        >
          Save
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

  return (
    <Modal visible={editorSongId !== null} onClose={handleClose} title='Edit song'>
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
