import React from 'react'
import clsx from 'clsx'
import Button from 'components/Button/Button'
import Icon from 'components/Icon/Icon'
import useToggleAnimation from 'lib/useToggleAnimation'
import styles from './ButtonFlawed.css'

interface ButtonFlawedProps {
  'className'?: string
  'onClick': (e: React.MouseEvent) => void
  'isFlawed': boolean
  'aria-label'?: string
  'data-hide'?: boolean
}

const ButtonFlawed = ({
  className,
  onClick,
  isFlawed,
  'aria-label': ariaLabel,
  ...rest
}: ButtonFlawedProps) => {
  const flawAnimation = useToggleAnimation(isFlawed, styles.animateFlaw)

  return (
    <Button
      onClick={onClick}
      className={clsx(styles.container, isFlawed && styles.flawed, className)}
      aria-pressed={isFlawed}
      aria-label={ariaLabel}
      {...rest}
    >
      <Icon
        icon='STAR_BROKEN'
        className={flawAnimation.className}
        onAnimationEnd={flawAnimation.onAnimationEnd}
      />
    </Button>
  )
}

export default ButtonFlawed
