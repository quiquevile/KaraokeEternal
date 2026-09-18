import React, { useEffect, useRef, useState } from 'react'
import Button from 'components/Button/Button'
import Icon from 'components/Icon/Icon'
import Modal from 'components/Modal/Modal'
import HttpApi from 'lib/HttpApi'
import styles from './YtDlpChooser.css'

const api = new HttpApi('prefs')

interface EntryItemType {
  label: string
  path: string
  isDir: boolean
}

interface ListInfoType {
  current: string | null
  parent: string | null | false
  children: EntryItemType[]
}

interface YtDlpChooserProps {
  onChoose(path: string | null): void
  onCancel(): void
}

const YtDlpChooser = ({ onChoose, onCancel }: YtDlpChooserProps) => {
  const listRef = useRef<HTMLDivElement>(null)
  const [pathInfo, setPathInfo] = useState<ListInfoType>({
    current: null,
    parent: null,
    children: [],
  })
  const [selected, setSelected] = useState<EntryItemType | null>(null)

  const ls = async (dir: string) => {
    try {
      const result = await api.get<ListInfoType>(`/file/ls?dir=${encodeURIComponent(dir)}`)
      setPathInfo(result)
      setSelected(null)
    } catch (err) {
      alert(err)
    }
  }

  // get initial list on first mount
  useEffect(() => {
    ls(pathInfo.current ?? '.')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // scroll to top when changing dirs
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
  }, [])

  const handleSelect = (item: EntryItemType) => {
    if (item.isDir) {
      ls(item.path)
    } else {
      setSelected(item)
    }
  }

  const handleDoubleClick = (item: EntryItemType) => {
    if (!item.isDir) onChoose(item.path)
  }

  const handleChoose = () => {
    onChoose(selected?.path ?? null)
  }

  return (
    <Modal
      title='Select yt-dlp executable'
      className={styles.modal}
      onClose={onCancel}
      scrollable
      buttons={(
        <div className={styles.btnContainer}>
          <Button onClick={onCancel} variant='default'>Cancel</Button>
          <Button onClick={handleChoose} variant='primary' disabled={!selected}>
            Select
          </Button>
        </div>
      )}
    >
      <div className={styles.container} translate='no'>
        <div className={styles.folderCurrent}>
          {pathInfo.current || '\u00a0'}
        </div>

        <div className={styles.folderList} ref={listRef}>
          {pathInfo.parent !== false
            && <PathButton label='..' isDir onSelect={() => ls(pathInfo.parent as string)} />}

          {pathInfo.children.map(item => (
            <PathButton
              key={item.path}
              label={item.label}
              isDir={item.isDir}
              isSelected={!!selected && selected.path === item.path}
              onSelect={() => handleSelect(item)}
              onDoubleClick={() => handleDoubleClick(item)}
            />
          ))}
        </div>
      </div>
    </Modal>
  )
}

const PathButton = ({ label, isDir, isSelected, onSelect, onDoubleClick }: {
  label: string
  isDir: boolean
  isSelected?: boolean
  onSelect(): void
  onDoubleClick?(): void
}) => (
  <div
    className={isSelected ? styles.pathSelected : styles.path}
    onDoubleClick={onDoubleClick}
    onClick={onSelect}
  >
    <div>
      <Icon icon={isDir ? 'FOLDER' : 'NAV_LIBRARY'} size={28} />
    </div>
    <div className={styles.pathLabel}>
      {label}
    </div>
  </div>
)

export default YtDlpChooser
