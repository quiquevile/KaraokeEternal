import React from 'react'
import { useIntl } from 'react-intl'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import { useAppSelector } from 'store/hooks'
import { commonMessages } from 'lib/messages'
import type { ProviderInfoData } from './ProviderInfoContext'
import styles from './ProviderInfo.css'
import { sharedMessages } from '../messages'

interface ProviderInfoProps {
  info: ProviderInfoData | null
  isVisible: boolean
  onClose: () => void
}

const ProviderInfo = ({ info, isVisible, onClose }: ProviderInfoProps) => {
  const intl = useIntl()
  const providerName = useAppSelector(state => info ? state.prefs.providers.entities[info.providerId]?.name : undefined)
  if (!info) return null

  return (
    <Modal
      visible={isVisible}
      onClose={onClose}
      title={intl.formatMessage(sharedMessages.providerInfoModalTitle)}
      buttons={<Button variant='primary' onClick={onClose}>{intl.formatMessage(commonMessages.done)}</Button>}
    >
      <div className={styles.container}>
        <p>
          {providerName && (
            <>
              <span className={styles.label}>{intl.formatMessage(sharedMessages.providerInfoProvider)}</span>
              {providerName}
              <br />
            </>
          )}
          <span className={styles.label}>{intl.formatMessage(commonMessages.providerIdLabel)}</span>
          {info.providerId}
          {info.status && (
            <>
              <br />
              <span className={styles.label}>{intl.formatMessage(commonMessages.statusLabel)}</span>
              {info.status}
            </>
          )}
        </p>

        {info.error && (
          <p>
            <span className={styles.label}>{intl.formatMessage(sharedMessages.providerInfoError)}</span>
            {info.error}
          </p>
        )}

        <span className={styles.label}>{intl.formatMessage(sharedMessages.providerInfoTitle)}</span>
        {info.title}
        <br />
        <span className={styles.label}>{intl.formatMessage(sharedMessages.providerInfoArtist)}</span>
        {info.artist}
        <br />
        <span className={styles.label}>{intl.formatMessage(sharedMessages.providerInfoItemId)}</span>
        {info.itemId}
        <br />
        {info.source && (
          <>
            <span className={styles.label}>{intl.formatMessage(sharedMessages.providerInfoSource)}</span>
            {info.source}
            <br />
          </>
        )}
      </div>
    </Modal>
  )
}

export default ProviderInfo
