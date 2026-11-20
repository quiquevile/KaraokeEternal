import React, { useState } from 'react'
import clsx from 'clsx'
import { useIntl } from 'react-intl'
import { useSwipeable } from 'react-swipeable'
import { useAppDispatch } from 'store/hooks'
import Button from 'components/Button/Button'
import Buttons from 'components/Buttons/Buttons'
import ProviderFetchStatusIndicator from 'components/ProviderFetchStatus/ProviderFetchStatus'
import { isInFlight } from 'components/ProviderFetchStatus/isInFlight'
import { useProviderInfo } from 'components/ProviderInfo/ProviderInfoContext'
import useToggleAnimation from 'lib/useToggleAnimation'
import { showErrorMessage } from 'store/modules/ui'
import { formatDuration } from 'lib/dateTime'
import { commonMessages } from 'lib/messages'
import Highlight from '../Highlight/Highlight'
import { providerFetchCancel, type ProviderFetchView } from '../../modules/library'
import styles from './ProviderResultItem.css'
import { libraryMessages } from '../../messages'

let ignoreMouseup = false

export interface ProviderFetchItem {
  providerId: number
  itemId: string
  title: string
  artist: string
  source: string
  iconUrl: string
  duration?: number
}

interface ProviderResultItemProps {
  providerId: number
  itemId: string
  title: string
  artist: string
  source: string
  iconUrl: string
  duration?: number
  highlight: RegExp | null
  isAdmin: boolean
  userId: number | null
  fetchView?: ProviderFetchView
  detailUrl?: string
  onFetch: (item: ProviderFetchItem) => void
}

const ProviderResultItem = ({
  providerId,
  itemId,
  title,
  artist,
  source,
  iconUrl,
  duration,
  highlight,
  isAdmin,
  userId,
  fetchView,
  detailUrl,
  onFetch,
}: ProviderResultItemProps) => {
  const intl = useIntl()
  const [expanded, setExpanded] = useState(false)
  const dispatch = useAppDispatch()
  const showProviderInfo = useProviderInfo()

  const disabled = isInFlight(fetchView?.status)
  const glow = useToggleAnimation(disabled, styles.animateGlow)
  const isRequester = fetchView?.requests.some(r => r.userId === userId) ?? false
  const isCancelable = disabled && (isAdmin || isRequester)
  const isErrored = fetchView?.status === 'error'
  const artistAndSource = [artist, source].map(value => value.trim()).filter(Boolean).join(' - ')

  const handleClick = () => {
    if (ignoreMouseup) {
      ignoreMouseup = false
      return
    }
    if (disabled) return
    onFetch({ providerId, itemId, title, artist, source, iconUrl, duration })
  }

  const handleDetailClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (ignoreMouseup) {
      ignoreMouseup = false
      e.preventDefault()
    }
  }

  // arrow keys are the keyboard equivalent of swiping, and stay live while
  // disabled so an in-flight fetch can still be canceled
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') setExpanded(isAdmin || isCancelable)
    else if (e.key === 'ArrowRight') setExpanded(false)
    else if ((e.key === 'Enter' || e.key === ' ') && !disabled) onFetch({ providerId, itemId, title, artist, source, iconUrl, duration })
    else return
    e.preventDefault()
  }

  const handleInfoClick = () => {
    showProviderInfo({
      providerId,
      itemId,
      title,
      artist,
      source,
      status: fetchView?.status,
      error: fetchView?.error,
    })
  }

  const handleErrorInfoClick = () => dispatch(showErrorMessage(fetchView?.error ?? 'Error'))

  const handleRemoveClick = () => {
    dispatch(providerFetchCancel({ providerId, itemId }))
    setExpanded(false)
  }

  const swipeHandlers = useSwipeable({
    onSwipedLeft: ({ event }) => {
      ignoreMouseup = event.type === 'mouseup'
      setExpanded(isAdmin || isCancelable)
    },
    onSwipedRight: ({ event }) => {
      ignoreMouseup = event.type === 'mouseup'
      setExpanded(false)
    },
    preventScrollOnSwipe: true,
    trackMouse: true,
  })

  const status = (
    <div className={styles.status}>
      <ProviderFetchStatusIndicator
        source={source}
        iconUrl={iconUrl}
        status={fetchView?.status}
        progress={fetchView?.progress}
        error={fetchView?.error}
      />
      {duration !== undefined && (
        <div className={styles.duration}>
          {formatDuration(duration)}
        </div>
      )}
    </div>
  )

  return (
    <div
      {...swipeHandlers}
      className={clsx(styles.container, styles.withArtist, disabled && styles.containerDisabled, disabled && styles.queued)}
    >
      <div className={styles.primary}>
        {detailUrl
          ? (
              <a
                className={clsx(styles.statusArea, styles.statusAction)}
                href={detailUrl}
                target='_blank'
                rel='noopener noreferrer'
                aria-label={intl.formatMessage(libraryMessages.providerOpenDetails)}
                onClick={handleDetailClick}
              >
                {status}
              </a>
            )
          : (
              <div className={styles.statusArea}>
                {status}
              </div>
            )}
        <div
          className={clsx(styles.title, glow.className)}
          role='button'
          tabIndex={0}
          aria-label={intl.formatMessage(libraryMessages.providerQueue, { title })}
          aria-disabled={disabled}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onAnimationEnd={glow.onAnimationEnd}
        >
          <div className={styles.songTitle}>
            <Highlight text={title} pattern={highlight} />
          </div>
          <div className={styles.artist}>
            <Highlight text={artistAndSource} pattern={highlight} />
          </div>
        </div>
      </div>

      <Buttons btnWidth={56} isExpanded={expanded}>
        {isErrored && (
          <Button
            className={styles.danger}
            icon='ALERT_OUTLINE'
            onClick={isAdmin ? handleInfoClick : handleErrorInfoClick}
            aria-label={intl.formatMessage(commonMessages.errorInfo)}
          />
        )}
        {!isErrored && isAdmin && (
          <Button
            className={clsx(styles.btn, styles.info)}
            data-hide
            icon='INFO_OUTLINE'
            onClick={handleInfoClick}
            aria-label={intl.formatMessage(commonMessages.info)}
          />
        )}
        {isCancelable && (
          <Button
            className={styles.danger}
            data-hide
            icon='CLEAR'
            onClick={handleRemoveClick}
            aria-label={intl.formatMessage(commonMessages.cancel)}
          />
        )}
      </Buttons>
    </div>
  )
}

export default ProviderResultItem
