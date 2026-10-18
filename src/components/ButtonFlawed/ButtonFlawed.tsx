import React from 'react'
import clsx from 'clsx'
import Button from 'components/Button/Button'
import Icon from 'components/Icon/Icon'
import ToggleAnimation from 'components/ToggleAnimation/ToggleAnimation'
import styles from './ButtonFlawed.css'

interface ButtonFlawedProps {
  'className'?: string
  'onClick': (e: React.MouseEvent) => void
  'isFlawed': boolean
  'aria-label'?: string
}

const ButtonFlawed = ({
  className,
  onClick,
  isFlawed,
  'aria-label': ariaLabel,
}: ButtonFlawedProps) => {
  return (
    <Button
      onClick={onClick}
      className={clsx(styles.container, isFlawed && styles.flawed, className)}
      aria-pressed={isFlawed}
      aria-label={ariaLabel}
    >
      <ToggleAnimation toggle={isFlawed} className={styles.animateFlaw}>
        <Icon icon='STAR_BROKEN' />
      </ToggleAnimation>
    </Button>
  )
}

export default ButtonFlawed
