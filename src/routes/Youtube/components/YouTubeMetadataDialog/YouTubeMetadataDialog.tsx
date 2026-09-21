import React, { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import { closeYoutubeDialog, downloadVideo, identifyVideo } from 'store/modules/youtube'
import type { ConvertedMetadata, YouTubeResult } from 'store/modules/youtube'
import { applyCaseStep, CASE_STEP_COUNT } from './caseCycle'
import styles from './YouTubeMetadataDialog.css'

const useCaseField = (initial: string) => {
  const [value, setValue] = useState(initial)
  const [cycle, setCycle] = useState({ base: initial, step: 0 })

  // manual edits (and swaps) reset the cycle with the new text as base
  const set = (nextValue: string) => {
    setValue(nextValue)
    setCycle({ base: nextValue, step: 0 })
  }

  const cycleCase = () => {
    const step = (cycle.step + 1) % CASE_STEP_COUNT
    setCycle({ base: cycle.base, step })
    setValue(applyCaseStep(cycle.base, step))
  }

  return { value, set, cycleCase }
}

const MetadataForm = ({ selected, metadata }: { selected: YouTubeResult, metadata: ConvertedMetadata | null }) => {
  const artist = useCaseField(metadata?.artist ?? selected.artist)
  const title = useCaseField(metadata?.title ?? selected.title)
  const [savedMetadata, setSavedMetadata] = useState<ConvertedMetadata | null>(metadata)
  const dispatch = useAppDispatch()

  if (metadata !== savedMetadata) {
    setSavedMetadata(metadata)

    if (metadata) {
      artist.set(metadata.artist)
      title.set(metadata.title)
    }
  }

  const handleDownload = () => {
    if (!artist.value.trim() || !title.value.trim()) return

    dispatch(downloadVideo({
      url: selected.url,
      artist: artist.value.trim(),
      title: title.value.trim(),
      thumbnail: selected.thumbnail,
    }))
  }

  const handleSwap = () => {
    const prevArtist = artist.value
    artist.set(title.value)
    title.set(prevArtist)
  }

  return (
    <>
      <p className={styles.hint}>
        The track is downloaded into your media folder and added to the library automatically.
      </p>

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
          <input type='text' value={title.value} onChange={e => title.set(e.currentTarget.value)} />
        </label>
      </div>

      <div className={styles.buttons}>
        <Button
          variant='primary'
          onClick={handleDownload}
          disabled={!artist.value.trim() || !title.value.trim()}
        >
          Download
        </Button>
      </div>
    </>
  )
}

const YouTubeMetadataDialog = () => {
  const selected = useAppSelector(state => state.youtube.selected)
  const metadata = useAppSelector(state => state.youtube.metadata)
  const dispatch = useAppDispatch()

  useEffect(() => {
    if (!selected) return

    dispatch(identifyVideo({ title: selected.title, channel: selected.artist }))
  }, [selected, dispatch])

  const handleClose = () => dispatch(closeYoutubeDialog())

  return (
    <Modal visible={!!selected} onClose={handleClose} title='Download from YouTube'>
      {selected
        && <MetadataForm key={selected.id} selected={selected} metadata={metadata} />}
    </Modal>
  )
}

export default YouTubeMetadataDialog
