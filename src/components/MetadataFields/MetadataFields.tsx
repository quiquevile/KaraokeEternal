import React, { useRef } from 'react'
import Button from 'components/Button/Button'
import styles from './MetadataFields.css'
import type { CaseField } from './useCaseField'

interface MetadataFieldsProps {
  artist: CaseField
  title: CaseField
}

const ClearableInput = ({ field, label }: { field: CaseField, label: string }) => {
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
      {field.value ? (
        <Button
          icon='CLEAR'
          className={styles.clearBtn}
          onClick={handleClear}
          aria-label={`Clear ${label.toLowerCase()}`}
        />
      ) : (
        <span className={styles.clearBtn} aria-hidden='true' />
      )}
    </div>
  )
}

const MetadataFields = ({ artist, title }: MetadataFieldsProps) => {
  const handleSwap = () => {
    const prevArtist = artist.value
    artist.set(title.value)
    title.set(prevArtist)
  }

  return (
    <div className={styles.fields}>
      <label className={styles.field}>
        <span className={styles.labelRow}>
          <span className={styles.label}>Artist</span>
          <Button
            className={styles.caseBtn}
            onClick={artist.cycleCase}
            aria-label='Change artist case'
          >
            Aa
          </Button>
        </span>
        <ClearableInput field={artist} label='Artist' />
      </label>

      <Button
        icon='SWAP_HORIZONTAL'
        size={24}
        variant='default'
        className={styles.swap}
        onClick={handleSwap}
        aria-label='Swap artist and title'
      />

      <label className={styles.field}>
        <span className={styles.labelRow}>
          <span className={styles.label}>Title</span>
          <Button
            className={styles.caseBtn}
            onClick={title.cycleCase}
            aria-label='Change title case'
          >
            Aa
          </Button>
        </span>
        <ClearableInput field={title} label='Title' />
      </label>
    </div>
  )
}

export default MetadataFields
