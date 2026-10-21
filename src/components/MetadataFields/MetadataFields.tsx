import React, { useRef } from 'react'
import { useIntl } from 'react-intl'
import Button from 'components/Button/Button'
import styles from './MetadataFields.css'
import type { CaseField } from './useCaseField'
import { sharedMessages } from '../messages'

interface MetadataFieldsProps {
  artist: CaseField
  // optional: the artist editor only retags the artist
  title?: CaseField
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
    if (!title) return

    const prevArtist = artist.value
    artist.set(title.value)
    title.set(prevArtist)
  }

  const artistLabel = intl.formatMessage(sharedMessages.artist)
  const titleLabel = intl.formatMessage(sharedMessages.title)

  return (
    <div className={styles.fields}>
      <label className={styles.field}>
        <span className={styles.labelRow}>
          <span className={styles.label}>{artistLabel}</span>
          <Button
            className={styles.caseBtn}
            onClick={artist.cycleCase}
            aria-label={intl.formatMessage(sharedMessages.artistCase)}
          >
            {/* eslint-disable formatjs/no-literal-string-in-jsx -- case-cycling glyph, not prose */}
            Aa
            {/* eslint-enable formatjs/no-literal-string-in-jsx */}
          </Button>
        </span>
        <ClearableInput
          field={artist}
          label={artistLabel}
          clearLabel={intl.formatMessage(sharedMessages.clearArtist)}
        />
      </label>

      {title && (
        <>
          <Button
            icon='SWAP_HORIZONTAL'
            size={24}
            variant='default'
            className={styles.swap}
            onClick={handleSwap}
            aria-label={intl.formatMessage(sharedMessages.swap)}
          />

          <label className={styles.field}>
            <span className={styles.labelRow}>
              <span className={styles.label}>{titleLabel}</span>
              <Button
                className={styles.caseBtn}
                onClick={title.cycleCase}
                aria-label={intl.formatMessage(sharedMessages.titleCase)}
              >
                {/* eslint-disable formatjs/no-literal-string-in-jsx -- case-cycling glyph, not prose */}
                Aa
                {/* eslint-enable formatjs/no-literal-string-in-jsx */}
              </Button>
            </span>
            <ClearableInput
              field={title}
              label={titleLabel}
              clearLabel={intl.formatMessage(sharedMessages.clearTitle)}
            />
          </label>
        </>
      )}
    </div>
  )
}

export default MetadataFields
