import React from 'react'
import { FormattedMessage } from 'react-intl'
import { libraryMessages } from '../../messages'
import styles from './CountsHeading.css'

interface CountsHeadingProps {
  artists: number
  songs: number
  style?: React.CSSProperties
}

const CountsHeading = ({ artists, songs, style }: CountsHeadingProps) => (
  <div style={style} className={styles.heading}>
    <FormattedMessage
      {...libraryMessages.counts}
      values={{ artists, songs }}
    />
  </div>
)

export default CountsHeading
