import React, { useEffect, useMemo, useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import { fetchPrefs } from 'store/modules/prefs'
import { setFilterFolder } from '../../modules/library'
import styles from './FolderFilterDialog.css'
import { commonMessages } from '../../../../lib/messages'
import { sharedMessages } from 'components/messages'
import { libraryMessages } from '../../messages'

interface FolderGroup {
  pathId: number
  path: string
  folders: { value: string, label: string }[]
}

interface FolderFilterDialogProps {
  onClose: () => void
}

// Pick a library folder to filter by. The options are derived from the
// songs already loaded (only folders that actually hold a song), grouped
// by their source path like the move dialog.
const FolderFilterDialog = ({ onClose }: FolderFilterDialogProps) => {
  const dispatch = useAppDispatch()
  const intl = useIntl()
  const songs = useAppSelector(state => state.songs)
  const paths = useAppSelector(state => state.prefs.paths)
  const hasPaths = paths.result.length > 0
  const [selected, setSelected] = useState<string | null>(null)

  // group titles come from prefs, which may not be loaded yet
  useEffect(() => {
    if (!hasPaths) void dispatch(fetchPrefs())
  }, [dispatch, hasPaths])

  const groups = useMemo<FolderGroup[]>(() => {
    const dirsByPath = new Map<number, Set<string>>()

    for (const songId of songs.result) {
      for (const entry of songs.entities[songId]?.folders ?? []) {
        const sepIdx = entry.indexOf(':')
        const pathId = Number(entry.slice(0, sepIdx))
        const dir = entry.slice(sepIdx + 1)
        const dirs = dirsByPath.get(pathId) ?? new Set<string>()

        dirs.add(dir)
        dirsByPath.set(pathId, dirs)
      }
    }

    return [...dirsByPath.entries()]
      .map(([pathId, dirs]) => ({
        pathId,
        path: paths.entities[pathId]?.path ?? `#${pathId}`,
        folders: [...dirs]
          .map(dir => ({ value: `${pathId}:${dir}`, label: dir }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      }))
      .sort((a, b) => a.path.localeCompare(b.path))
  }, [songs, paths])

  const handleAccept = () => {
    if (selected === null) return

    dispatch(setFilterFolder(selected))
    onClose()
  }

  return (
    <Modal
      onClose={onClose}
      title={intl.formatMessage(libraryMessages.folderFilterTitle)}
      buttons={(
        <div className={styles.btnContainer}>
          <Button onClick={onClose} variant='default'>
            <FormattedMessage {...commonMessages.cancel} />
          </Button>
          <Button onClick={handleAccept} variant='primary' disabled={selected === null}>
            <FormattedMessage {...commonMessages.accept} />
          </Button>
        </div>
      )}
    >
      <div className={styles.container} translate='no'>
        {groups.map(group => (
          <div key={group.pathId} className={styles.group}>
            <div className={styles.groupTitle}>{group.path}</div>
            {group.folders.map(folder => (
              <label key={folder.value} className={styles.row}>
                <input
                  type='radio'
                  name='folder-filter'
                  checked={selected === folder.value}
                  onChange={() => setSelected(folder.value)}
                />
                <span>
                  {folder.label === ''
                    ? intl.formatMessage(sharedMessages.thisFolder)
                    : folder.label}
                </span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  )
}

export default FolderFilterDialog
