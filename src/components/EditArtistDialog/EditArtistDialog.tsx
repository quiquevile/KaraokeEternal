import React from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import MetadataFields from 'components/MetadataFields/MetadataFields'
import { useCaseField } from 'components/MetadataFields/useCaseField'
import { closeArtistEditor, updateArtist } from 'store/modules/artistInfo'
import styles from './EditArtistDialog.css'
import { commonMessages } from '../../lib/messages'
import { sharedMessages } from '../messages'

const EditArtistForm = ({
  artistId,
  initialName,
}: {
  artistId: number
  initialName: string
}) => {
  const artist = useCaseField(initialName)
  const error = useAppSelector(state => state.artistInfo.error)
  const dispatch = useAppDispatch()

  const handleClose = () => dispatch(closeArtistEditor())

  const handleSave = () => {
    if (!artist.value.trim()) return

    dispatch(updateArtist({ artistId, artist: artist.value.trim() }))
  }

  return (
    <>
      <p className={styles.hint}>
        <FormattedMessage {...commonMessages.checkArtist} />
      </p>

      <MetadataFields artist={artist} />

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
          disabled={!artist.value.trim()}
        >
          <FormattedMessage {...sharedMessages.save} />
        </Button>
      </div>
    </>
  )
}

const EditArtistDialog = () => {
  const editorArtistId = useAppSelector(state => state.artistInfo.editorArtistId)
  const name = useAppSelector(state => (
    editorArtistId !== null ? state.artists.entities[editorArtistId]?.name : undefined
  ))
  const dispatch = useAppDispatch()

  const handleClose = () => dispatch(closeArtistEditor())

  const intl = useIntl()

  return (
    <Modal
      visible={editorArtistId !== null}
      onClose={handleClose}
      title={intl.formatMessage(commonMessages.editArtist)}
    >
      {editorArtistId !== null && name !== undefined
        && (
          <EditArtistForm
            key={editorArtistId}
            artistId={editorArtistId}
            initialName={name}
          />
        )}
    </Modal>
  )
}

export default EditArtistDialog
