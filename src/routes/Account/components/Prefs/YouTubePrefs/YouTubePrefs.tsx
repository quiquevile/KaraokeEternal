import React, { useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Accordion from 'components/Accordion/Accordion'
import Button from 'components/Button/Button'
import Icon from 'components/Icon/Icon'
import { setPref } from 'store/modules/prefs'
import YtDlpChooser from './YtDlpChooser/YtDlpChooser'
import YtdlUpdater from './YtdlUpdater/YtdlUpdater'
import styles from './YouTubePrefs.css'
import { accountMessages } from '../../../messages'

const DirField = ({ value }: { value: string }) => {
  const [dir, setDir] = useState(value)
  const [isChoosing, setChoosing] = useState(false)
  const dispatch = useAppDispatch()
  const intl = useIntl()

  const handleSave = () => {
    dispatch(setPref({ key: 'youtubeYtdlDir', data: dir.trim() || '' }))
  }

  const handleChoose = (path: string | null) => {
    setChoosing(false)

    if (!path) return

    setDir(path)
    dispatch(setPref({ key: 'youtubeYtdlDir', data: path }))
  }

  return (
    <>
      <div className={styles.binRow}>
        <input
          type='text'
          value={dir}
          // eslint-disable-next-line formatjs/no-literal-string-in-jsx -- example path, not prose
          placeholder='/data/bin'
          onChange={e => setDir(e.currentTarget.value)}
          onBlur={handleSave}
        />
        <Button
          icon='MAGNIFIER'
          size={20}
          className={styles.browse}
          onClick={() => setChoosing(true)}
          aria-label={intl.formatMessage(accountMessages.browse)}
        />
      </div>

      {isChoosing && (
        <YtDlpChooser
          onCancel={() => setChoosing(false)}
          onChoose={handleChoose}
        />
      )}
    </>
  )
}

const YouTubePrefs = () => {
  const youtubeDownloadPathId = useAppSelector(state => state.prefs.youtubeDownloadPathId)
  const youtubeYtdlDir = useAppSelector(state => state.prefs.youtubeYtdlDir)
  const paths = useAppSelector(state => state.prefs.paths)
  const dispatch = useAppDispatch()
  const intl = useIntl()

  const selectedPathId = youtubeDownloadPathId != null && paths.result.includes(youtubeDownloadPathId)
    ? youtubeDownloadPathId
    : paths.result[0]

  const handlePathChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pathId = Number(e.currentTarget.value)

    if (Number.isInteger(pathId)) {
      dispatch(setPref({ key: 'youtubeDownloadPathId', data: pathId }))
    }
  }

  return (
    <Accordion
      className={styles.container}
      headingComponent={(
        <div className={styles.heading}>
          <Icon icon='NAV_YOUTUBE' size={32} className={styles.icon} />
          <div className={styles.title}>
            <FormattedMessage {...accountMessages.youtubePrefsTitle} />
          </div>
        </div>
      )}
    >
      <div className={styles.content}>
        <div className={styles.config}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              <FormattedMessage {...accountMessages.ytdlFolder} />
            </span>
            <DirField key={youtubeYtdlDir ?? ''} value={youtubeYtdlDir ?? ''} />
          </label>

          <YtdlUpdater />

          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              <FormattedMessage {...accountMessages.downloadFolder} />
            </span>
            <select
              value={selectedPathId != null ? String(selectedPathId) : ''}
              onChange={handlePathChange}
              disabled={!paths.result.length}
            >
              {!paths.result.length
                && <option value=''>{intl.formatMessage(accountMessages.noFolders)}</option>}
              {paths.result.map(pathId => (
                <option key={pathId} value={String(pathId)}>{paths.entities[pathId].path}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </Accordion>
  )
}

export default YouTubePrefs
