import React, { useRef } from 'react'
import { useIntl } from 'react-intl'
import Button from 'components/Button/Button'
import styles from './MetadataFields.css'
import type { CaseField } from './useCaseField'

interface MetadataFieldsProps {
  artist: CaseField
  title: CaseField
}

const ClearableInput = ({ field, label, clearLabel }: {
  field: CaseField
  label: string
  clearLabel: string
}) => {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClear = () => {
    field.set('')
    inputRef.current?.focus()
  }

  return (
    <div className={styles.inputRow}>
      <input
        ref={inputRef}
        type='text'
        value={field.value}
        onChange={e => field.set(e.currentTarget.value)}
        aria-label={label}
      />
      {field.value
        ? (
            <Button
              icon='CLEAR'
              className={styles.clearBtn}
              onClick={handleClear}
              aria-label={clearLabel}
            />
          )
        : (
            <span className={styles.clearBtn} aria-hidden='true' />
          )}
    </div>
  )
}

const MetadataFields = ({ artist, title }: MetadataFieldsProps) => {
  const intl = useIntl()

  const handleSwap = () => {
    const prevArtist = artist.value
    artist.set(title.value)
    title.set(prevArtist)
  }

  const artistLabel = intl.formatMessage({ id: 'metaFields.artist', defaultMessage: 'Artist' })
  const titleLabel = intl.formatMessage({ id: 'metaFields.title', defaultMessage: 'Title' })

  return (
    <div className={styles.fields}>
      <label className={styles.field}>
        <span className={styles.labelRow}>
          <span className={styles.label}>{artistLabel}</span>
          <Button
            className={styles.caseBtn}
            onClick={artist.cycleCase}
            aria-label={intl.formatMessage({ id: 'metaFields.artistCase', defaultMessage: 'Change artist case' })}
          >
            Aa
          </Button>
        </span>
        <ClearableInput
          field={artist}
          label={artistLabel}
          clearLabel={intl.formatMessage({
            id: 'metaFields.clearArtist',
            defaultMessage: 'Clear artist',
          })}
        />
      </label>

      <Button
        icon='SWAP_HORIZONTAL'
        size={24}
        variant='default'
        className={styles.swap}
        onClick={handleSwap}
        aria-label={intl.formatMessage({ id: 'metaFields.swap', defaultMessage: 'Swap artist and title' })}
      />

      <label className={styles.field}>
        <span className={styles.labelRow}>
          <span className={styles.label}>{titleLabel}</span>
          <Button
            className={styles.caseBtn}
            onClick={title.cycleCase}
            aria-label={intl.formatMessage({ id: 'metaFields.titleCase', defaultMessage: 'Change title case' })}
          >
            Aa
          </Button>
        </span>
        <ClearableInput
          field={title}
          label={titleLabel}
          clearLabel={intl.formatMessage({
            id: 'metaFields.clearTitle',
            defaultMessage: 'Clear title',
          })}
        />
      </label>
    </div>
  )
}

export default MetadataFields
