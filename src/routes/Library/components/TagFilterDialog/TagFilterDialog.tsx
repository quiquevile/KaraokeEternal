import React, { useState } from 'react'
import { useIntl } from 'react-intl'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import { commonMessages } from 'lib/messages'
import { setFilterTags, type TagFilter } from '../../modules/library'
import { libraryMessages } from '../../messages'
import styles from './TagFilterDialog.css'

const special = [
  { key: 'multi', label: libraryMessages.tagMulti },
  { key: 'preferred', label: libraryMessages.tagPreferred },
  { key: 'noPreferred', label: libraryMessages.tagNoPreferred },
  { key: 'pitch', label: libraryMessages.tagPitch },
] as const

const TagFilterDialog = ({ onClose }: { onClose: () => void }) => {
  const dispatch = useAppDispatch()
  const intl = useIntl()
  const isAdmin = useAppSelector(state => state.user.isAdmin)
  const tags = useAppSelector(state => state.tags.tags)
  const selectableTags = tags.filter(tag => isAdmin || tag.visibility !== 'admin')
  const selected = useAppSelector(state => state.library.filterTags)
  const [draft, setDraft] = useState<TagFilter[]>(selected)
  const toggle = (key: TagFilter) => setDraft(current => current.includes(key)
    ? current.filter(item => item !== key)
    : [...current, key])
  const save = () => {
    const visibleIds = new Set(selectableTags.map(tag => tag.tagId))
    dispatch(setFilterTags(draft.filter(filter => filter.startsWith('tag:')
      ? visibleIds.has(Number(filter.slice(4)))
      : isAdmin)))
    onClose()
  }
  const clear = () => {
    dispatch(setFilterTags([]))
    onClose()
  }

  return (
    <Modal
      onClose={onClose}
      title={intl.formatMessage(libraryMessages.tagFilterTitle)}
      buttons={(
        <div className={styles.actions}>
          <div className={styles.buttons}>
            <Button variant='default' onClick={onClose}>{intl.formatMessage(commonMessages.cancel)}</Button>
            <Button variant='primary' onClick={save}>{intl.formatMessage(commonMessages.accept)}</Button>
          </div>
          <Button variant='danger' className={styles.clear} onClick={clear}>
            {intl.formatMessage(libraryMessages.tagClear)}
          </Button>
        </div>
      )}
    >
      <div className={styles.list}>
        {isAdmin && special.map(item => (
          <label key={item.key} className={styles.special}>
            <input type='checkbox' checked={draft.includes(item.key)} onChange={() => toggle(item.key)} />
            {intl.formatMessage(item.label)}
          </label>
        ))}
        {selectableTags.map(tag => (
          <label key={tag.tagId}>
            <input type='checkbox' checked={draft.includes(`tag:${tag.tagId}`)} onChange={() => toggle(`tag:${tag.tagId}`)} />
            <span translate='no'>{tag.name}</span>
          </label>
        ))}
      </div>
    </Modal>
  )
}

export default TagFilterDialog
