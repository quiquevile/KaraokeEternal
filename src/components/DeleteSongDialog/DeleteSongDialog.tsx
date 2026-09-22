import React from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import { closeDeleteSong, deleteSong } from 'store/modules/songInfo'
import styles from './DeleteSongDialog.css'

const DeleteSongDialog = () => {
  const deleteSongId = useAppSelector(state => state.songInfo.deleteSongId)
  const song = useAppSelector(state => (
    deleteSongId !== null ? state.songs.entities[deleteSongId] : undefined
  ))
  const artistName = useAppSelector(state => (
    song ? state.artists.entities[song.artistId]?.name : undefined
  ))
  const dispatch = useAppDispatch()

  const handleClose = () => dispatch(closeDeleteSong())
  const handleDelete = () => {
    if (deleteSongId !== null) dispatch(deleteSong(deleteSongId))
  }

  return (
    <Modal visible={deleteSongId !== null} onClose={handleClose} title='Delete song?'>
      {deleteSongId !== null && song
        && (
          <>
            <p className={styles.text}>
              Delete &ldquo;
              {artistName}
              {' '}
              &ndash;
              {' '}
              {song.title}
              &rdquo; and its files?
              It will also be removed from every queue.
            </p>

            <div className={styles.buttons}>
              <Button variant='default' onClick={handleClose}>
                Cancel
              </Button>
              <Button variant='danger' onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </>
        )}
    </Modal>
  )
}

export default DeleteSongDialog
