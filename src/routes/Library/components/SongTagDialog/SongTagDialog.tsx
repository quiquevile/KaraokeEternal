import React, { useState } from 'react'
import { useIntl } from 'react-intl'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { assignSongTags } from 'store/modules/tags'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import { commonMessages } from 'lib/messages'
import { libraryMessages } from '../../messages'
import styles from '../TagFilterDialog/TagFilterDialog.css'

const SongTagDialog = ({ songId, onClose }: { songId: number, onClose: () => void }) => {
  const dispatch = useAppDispatch()
  const intl = useIntl()
  const isAdmin = useAppSelector(state => state.user.isAdmin)
  const visibleTags = useAppSelector(state => state.tags.tags)
  const songTags = useAppSelector(state => state.tags.songTags)
  const tags = visibleTags.filter(tag => isAdmin || tag.visibility === 'manager')
  const assigned = songTags[songId] ?? []
  const [draft, setDraft] = useState<number[]>(assigned.filter(id => tags.some(tag => tag.tagId === id)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const toggle = (id: number) => setDraft(current => current.includes(id)
    ? current.filter(item => item !== id)
    : [...current, id])
  const save = async () => {
    setBusy(true)
    setError('')
    try {
      await dispatch(assignSongTags({ songId, tagIds: draft })).unwrap()
      onClose()
    } catch (err) {
      setError((err as { message?: string })?.message ?? String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      onClose={onClose}
      title={intl.formatMessage(libraryMessages.tagAssignTitle)}
      buttons={(
        <div className={styles.buttons}>
          <Button variant='default' disabled={busy} onClick={onClose}>{intl.formatMessage(commonMessages.cancel)}</Button>
          <Button variant='primary' disabled={busy} onClick={save}>{intl.formatMessage(libraryMessages.tagSave)}</Button>
        </div>
      )}
    >
      <div className={styles.list}>
        {tags.map(tag => (
          <label key={tag.tagId}>
            <input type='checkbox' checked={draft.includes(tag.tagId)} onChange={() => toggle(tag.tagId)} />
            <span translate='no'>{tag.name}</span>
          </label>
        ))}
        {error && <p role='alert'>{error}</p>}
      </div>
    </Modal>
  )
}

export default SongTagDialog
