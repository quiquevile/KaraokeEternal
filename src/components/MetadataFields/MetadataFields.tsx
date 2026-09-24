import React from 'react'
import Button from 'components/Button/Button'
import styles from './MetadataFields.css'
import type { CaseField } from './useCaseField'

interface MetadataFieldsProps {
  artist: CaseField
  title: CaseField
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
        <input type='text' value={artist.value} onChange={e => artist.set(e.currentTarget.value)} />
      </label>

      <Button
        icon='SWAP_VERT'
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
        <input type='text' value={title.value} onChange={e => title.set(e.currentTarget.value)} />
      </label>
    </div>
  )
}

export default MetadataFields
