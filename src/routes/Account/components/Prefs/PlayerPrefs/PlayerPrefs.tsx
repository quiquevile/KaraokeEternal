import React from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Accordion from 'components/Accordion/Accordion'
import Button from 'components/Button/Button'
import Icon from 'components/Icon/Icon'
import { requestGainScan, setPref } from 'store/modules/prefs'
import styles from './PlayerPrefs.css'

const PlayerPrefs = () => {
  const isAdmin = useAppSelector(state => state.user.isAdmin)
  const isReplayGainEnabled = useAppSelector(state => state.prefs.isReplayGainEnabled)
  const isScanning = useAppSelector(state => state.prefs.isScanning)
  const dispatch = useAppDispatch()

  const toggleCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setPref({ key: e.currentTarget.name, data: e.currentTarget.checked }))
  }

  const handleGainScan = () => {
    dispatch(requestGainScan())
  }

  return (
    <Accordion
      className={styles.container}
      headingComponent={(
        <div className={styles.heading}>
          <Icon icon='TELEVISION_PLAY' size={32} className={styles.icon} />
          <div className={styles.title}>Player</div>
        </div>
      )}
    >
      <div className={styles.content}>
        <label>
          <input
            type='checkbox'
            checked={isReplayGainEnabled}
            onChange={toggleCheckbox}
            name='isReplayGainEnabled'
          />
          {' '}
          ReplayGain (clip-safe)
        </label>
        {isAdmin && (
          <div>
            <Button onClick={handleGainScan} variant='default' disabled={isScanning}>
              Measure missing loudness
            </Button>
          </div>
        )}
      </div>
    </Accordion>
  )
}

export default PlayerPrefs
