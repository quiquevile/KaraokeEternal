import React, { useEffect, useState } from 'react'
import { useIntl } from 'react-intl'
import type { Tag, TagVisibility } from 'shared/types'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { deleteTag, fetchTags, saveTag } from 'store/modules/tags'
import Accordion from 'components/Accordion/Accordion'
import Button from 'components/Button/Button'
import Icon from 'components/Icon/Icon'
import Modal from 'components/Modal/Modal'
import { commonMessages } from 'lib/messages'
import { accountMessages } from '../../../messages'
import styles from './TagPrefs.css'

const visibilityMessage = {
  public: accountMessages.tagPublic,
  admin: accountMessages.tagAdmin,
  manager: accountMessages.tagManager,
}

const EditTag = ({ tag, isAdmin, onClose }: { tag?: Tag, isAdmin: boolean, onClose: () => void }) => {
  const intl = useIntl()
  const dispatch = useAppDispatch()
  const [name, setName] = useState(tag?.name ?? '')
  const [visibility, setVisibility] = useState<TagVisibility>(tag?.visibility ?? 'manager')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await dispatch(saveTag({ tagId: tag?.tagId, name: name.trim(), visibility })).unwrap()
      onClose()
    } catch (err) {
      setError((err as { message?: string })?.message ?? String(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!tag || !window.confirm(intl.formatMessage(accountMessages.tagDeleteConfirm, { name: tag.name }))) return
    setBusy(true)
    setError('')
    try {
      await dispatch(deleteTag(tag.tagId)).unwrap()
      onClose()
    } catch (err) {
      setError((err as { message?: string })?.message ?? String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose} title={intl.formatMessage(tag ? accountMessages.tagEdit : accountMessages.tagAdd)}>
      <form onSubmit={save} className={styles.form}>
        <label>
          {intl.formatMessage(accountMessages.tagName)}
          <input autoFocus maxLength={50} required value={name} onChange={e => setName(e.currentTarget.value)} />
        </label>
        <label>
          {intl.formatMessage(accountMessages.tagVisibility)}
          <select value={visibility} disabled={!isAdmin} onChange={e => setVisibility(e.currentTarget.value as TagVisibility)}>
            {isAdmin && <option value='public'>{intl.formatMessage(accountMessages.tagPublic)}</option>}
            {isAdmin && <option value='admin'>{intl.formatMessage(accountMessages.tagAdmin)}</option>}
            <option value='manager'>{intl.formatMessage(accountMessages.tagManager)}</option>
          </select>
        </label>
        {error && <p className={styles.error} role='alert'>{error}</p>}
        <div className={styles.buttons}>
          <Button type='submit' variant='primary' disabled={busy || !name.trim()}>{intl.formatMessage(accountMessages.tagSave)}</Button>
          {tag && <Button variant='danger' disabled={busy} onClick={remove}>{intl.formatMessage(accountMessages.tagDelete)}</Button>}
          <Button variant='default' disabled={busy} onClick={onClose}>{intl.formatMessage(commonMessages.cancel)}</Button>
        </div>
      </form>
    </Modal>
  )
}

const TagPrefs = () => {
  const intl = useIntl()
  const dispatch = useAppDispatch()
  const isAdmin = useAppSelector(state => state.user.isAdmin)
  const tags = useAppSelector(state => state.tags.tags)
  const [editing, setEditing] = useState<Tag | null | undefined>(undefined)
  useEffect(() => {
    void dispatch(fetchTags())
  }, [dispatch])
  const manageable = tags.filter(tag => isAdmin || tag.visibility === 'manager')

  return (
    <Accordion
      renderHeading={button => <div className={styles.heading}>{button}</div>}
      heading={(
        <>
          <Icon icon='LABEL' />
          <span>{intl.formatMessage(accountMessages.tagsTitle)}</span>
        </>
      )}
    >
      <div className={styles.content}>
        {manageable.length === 0 && <p>{intl.formatMessage(accountMessages.tagEmpty)}</p>}
        {manageable.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{intl.formatMessage(accountMessages.tagName)}</th>
                <th>{intl.formatMessage(accountMessages.tagVisibility)}</th>
              </tr>
            </thead>
            <tbody>
              {manageable.map(tag => (
                <tr key={tag.tagId}>
                  <td><a onClick={() => setEditing(tag)}>{tag.name}</a></td>
                  <td>{intl.formatMessage(visibilityMessage[tag.visibility])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Button variant='primary' onClick={() => setEditing(null)}>{intl.formatMessage(accountMessages.tagAdd)}</Button>
      </div>
      {editing !== undefined && <EditTag key={editing?.tagId ?? 'new'} tag={editing ?? undefined} isAdmin={isAdmin} onClose={() => setEditing(undefined)} />}
    </Accordion>
  )
}

export default TagPrefs
