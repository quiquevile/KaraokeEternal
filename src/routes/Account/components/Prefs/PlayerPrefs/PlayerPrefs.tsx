import React from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Accordion from 'components/Accordion/Accordion'
import Button from 'components/Button/Button'
import Icon from 'components/Icon/Icon'
import { requestGainScan } from 'store/modules/prefs'
import styles from './PlayerPrefs.css'

const PlayerPrefs = () => {
  const isAdmin = useAppSelector(state => state.user.isAdmin)
  const isScanning = useAppSelector(state => state.prefs.isScanning)
  const dispatch = useAppDispatch()

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
