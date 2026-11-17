import React, { useEffect, useRef, useState } from 'react'
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
import HttpApi from 'lib/HttpApi'

const api = new HttpApi()

const EditArtistForm = ({
  artistId,
  busy,
  checking,
  initialName,
  onClose,
  saving,
  setChecking,
  setSaving,
}: {
  artistId: number
  busy: boolean
  checking: boolean
  initialName: string
  onClose: () => void
  saving: boolean
  setChecking: React.Dispatch<React.SetStateAction<boolean>>
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
}) => {
  const artist = useCaseField(initialName)
  const dispatch = useAppDispatch()
  const intl = useIntl()
  const [confirmName, setConfirmName] = useState<string | null>(null)
  const [existing, setExisting] = useState<{ name: string, artistId: number | null } | null>(null)
  const currentNameRef = useRef(artist.value)
  useEffect(() => {
    currentNameRef.current = artist.value
  }, [artist.value])

  const name = artist.value.trim()
  useEffect(() => {
    if (!name || name === initialName) return

    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await api.post<{ artistId: number | null }>('artist/find', {
            body: { artist: name, excludeArtistId: artistId },
          })
          if (!cancelled) setExisting({ name, artistId: result.artistId })
        } catch {
          // Saving performs its own lookup and reports any failure.
        }
      })()
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [name, initialName, artistId])

  const mergeKnown = confirmName === name || (existing?.name === name && existing.artistId !== null)
  const saveMessage = checking
    ? sharedMessages.artistChecking
    : saving
      ? (mergeKnown ? sharedMessages.artistMerging : sharedMessages.artistRenaming)
      : (mergeKnown ? sharedMessages.confirmArtistMerge : sharedMessages.save)

  const handleSave = async () => {
    if (!name || busy) return

    if (!mergeKnown) {
      setChecking(true)
      try {
        const found = await api.post<{ artistId: number | null }>('artist/find', {
          body: { artist: name, excludeArtistId: artistId },
        })
        if (currentNameRef.current.trim() !== name) return
        if (found.artistId !== null) {
          setConfirmName(name)
          setExisting({ name, artistId: found.artistId })
          return
        }
      } catch (err) {
        alert((err as Error).message)
        return
      } finally {
        setChecking(false)
      }
    }

    setSaving(true)
    try {
      const result = await dispatch(updateArtist({ artistId, artist: name })).unwrap()
      if (result.skipped.length) {
        const message = result.changed === 0
          ? intl.formatMessage(sharedMessages.artistNoneChanged)
          : `${intl.formatMessage(sharedMessages.artistSkipped)}\n\n${result.skipped.join('\n')}`
        requestAnimationFrame(() => requestAnimationFrame(() => alert(message)))
      }
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <p className={styles.hint}>
        <FormattedMessage {...commonMessages.checkArtist} />
      </p>

      <MetadataFields artist={artist} disabled={busy} />

      {mergeKnown && (
        <p className={styles.warning}><FormattedMessage {...sharedMessages.artistMergeWarning} /></p>
      )}

      <div className={styles.buttons}>
        <Button
          variant='default'
          onClick={onClose}
          disabled={busy}
        >
          <FormattedMessage {...commonMessages.cancel} />
        </Button>
        <Button
          variant='primary'
          onClick={handleSave}
          disabled={!artist.value.trim() || busy}
        >
          <FormattedMessage {...saveMessage} />
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
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const busy = checking || saving

  const handleClose = () => {
    if (!busy) dispatch(closeArtistEditor())
  }

  const intl = useIntl()

  return (
    <Modal
      visible={editorArtistId !== null}
      onClose={handleClose}
      closeDisabled={busy}
      title={intl.formatMessage(commonMessages.editArtist)}
    >
      {editorArtistId !== null && name !== undefined
        && (
          <EditArtistForm
            key={editorArtistId}
            artistId={editorArtistId}
            busy={busy}
            checking={checking}
            initialName={name}
            onClose={handleClose}
            saving={saving}
            setChecking={setChecking}
            setSaving={setSaving}
          />
        )}
    </Modal>
  )
}

export default EditArtistDialog
