import React from 'react'
import { useIntl } from 'react-intl'
import Slider from 'components/Slider/Slider'
import Icon from 'components/Icon/Icon'
import styles from './VolumeSlider.css'

interface VolumeSliderProps {
  volume: number
  onVolumeChange: (value: number) => void
}

interface HandleProps {
  'className'?: string
  'aria-label'?: string
}

// volume slider handle/grabber
const makeHandle = (label: string) => (node: React.ReactElement<HandleProps>, { value }: { value: number }) => {
  const icon = (() => {
    if (value === 0) return 'VOLUME_OFF'
    if (value < 0.4) return 'VOLUME_MUTE'
    if (value < 0.7) return 'VOLUME_DOWN'
    return 'VOLUME_UP'
  })()

  // rc-slider passes a node (div) to which we add style and children
  return React.cloneElement(node, {
    'aria-label': label,
    'className': styles.handle,
  }, (
    <Icon icon={icon} />
  ))
}

const VolumeSlider = ({ volume, onVolumeChange }: VolumeSliderProps) => {
  const intl = useIntl()

  return (
    <Slider
      className={styles.slider}
      handle={makeHandle(intl.formatMessage({ id: 'player.volume', defaultMessage: 'Volume' }))}
      min={0}
      max={1}
      onChange={onVolumeChange}
      step={0.01}
      value={volume}
    />
  )
}

export default VolumeSlider
