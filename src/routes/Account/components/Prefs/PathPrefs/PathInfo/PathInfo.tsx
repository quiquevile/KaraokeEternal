import React from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import Modal from 'components/Modal/Modal'
import InputCheckbox from 'components/InputCheckbox/InputCheckbox'
import Button from 'components/Button/Button'
import styles from './PathInfo.css'
import type { Path } from 'shared/types'
import { accountMessages } from '../../../../messages'
import { commonMessages } from '../../../../../../lib/messages'

interface PathInfoProps {
  onClose: () => void
  onRemove: (pathId: number) => void
  onUpdate: (pathId: number, data: object) => void
  path: Path
}

const PathInfo = ({ onClose, onRemove, onUpdate, path }: PathInfoProps) => {
  const intl = useIntl()

  const handleChange = (data: Record<string, boolean>) => {
    onUpdate(path.pathId, data)
  }

  const handleRemove = () => onRemove(path.pathId)

  return (
    <Modal
      onClose={onClose}
      title={intl.formatMessage(accountMessages.pathInfoTitle)}
      buttons={(
        <>
          <Button onClick={handleRemove} variant='danger'>
            <FormattedMessage {...accountMessages.pathInfoRemove} />
          </Button>
          <Button onClick={onClose} variant='primary'>
            <FormattedMessage {...commonMessages.done} />
          </Button>
        </>
      )}
    >
      <div>
        <p className={styles.path}>
          {path?.path}
          <br />
          {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx -- technical field name, not prose */}
          <span className={styles.label}>pathId: </span>
          {path?.pathId}
        </p>

        <form className={styles.form}>
          <div>
            <InputCheckbox
              label={intl.formatMessage(accountMessages.watch)}
              defaultChecked={path?.prefs?.isWatchingEnabled}
              onChange={event => handleChange({ isWatchingEnabled: event.currentTarget.checked })}
              aria-describedby='isWatchingEnabled-desc'
            />
            <p id='isWatchingEnabled-desc' className={styles.description}>
              <FormattedMessage {...accountMessages.watchDesc} />
            </p>
          </div>
          <div>
            <InputCheckbox
              label={intl.formatMessage(accountMessages.scanFull)}
              defaultChecked={path?.prefs?.scanFull}
              onChange={event => handleChange({ scanFull: event.currentTarget.checked })}
              aria-describedby='scanFull-desc'
            />
            <p id='scanFull-desc' className={styles.description}>
              <FormattedMessage {...accountMessages.scanFullDesc} />
            </p>
          </div>
          <div>
            <InputCheckbox
              label={intl.formatMessage(accountMessages.keying)}
              defaultChecked={path?.prefs?.isVideoKeyingEnabled}
              onChange={event => handleChange({ isVideoKeyingEnabled: event.currentTarget.checked })}
              aria-describedby='isVideoKeyingEnabled-desc'
            />
            <p id='isVideoKeyingEnabled-desc' className={styles.description}>
              <FormattedMessage {...accountMessages.keyingDesc} />
            </p>
          </div>
        </form>
      </div>
    </Modal>
  )
}

export default PathInfo
