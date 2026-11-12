import React from 'react'
import clsx from 'clsx'
import { NavLink } from 'react-router'
import { useIntl } from 'react-intl'
import Button from 'components/Button/Button'
import { useAppSelector } from 'store/hooks'
import styles from './Navigation.css'
import { navMessages } from './messages'

const Navigation = ({ ref }: { ref?: React.Ref<HTMLDivElement> }) => {
  const intl = useIntl()
  const { isAdmin, permissions } = useAppSelector(state => state.user)

  return (
    <div className={clsx(styles.container, 'bg-blur')} ref={ref}>
      <NavLink
        to='/library'
        replace
        className={({ isActive }) => clsx(isActive && styles.active)}
        aria-label={intl.formatMessage(navMessages.library)}
      >
        {({ isActive }) => (
          <Button
            icon='NAV_LIBRARY'
            as='span'
            animateClassName={styles.btnAnimate}
            cancelAnimation={!isActive}
          />
        )}
      </NavLink>
      <NavLink
        to='/queue'
        replace
        className={({ isActive }) => clsx(isActive && styles.active)}
        aria-label={intl.formatMessage(navMessages.queue)}
      >
        {({ isActive }) => (
          <Button
            icon='NAV_SUBSCRIPTIONS'
            as='span'
            animateClassName={styles.btnAnimate}
            cancelAnimation={!isActive}
          />
        )}
      </NavLink>
      {(isAdmin || permissions?.youtubeDownload)
        && (
          <NavLink
            to='/youtube'
            replace
            className={({ isActive }) => clsx(isActive && styles.active)}
            aria-label={intl.formatMessage(navMessages.youtube)}
          >
            {({ isActive }) => (
              <Button
                icon='NAV_YOUTUBE'
                as='span'
                animateClassName={styles.btnAnimate}
                cancelAnimation={!isActive}
              />
            )}
          </NavLink>
        )}
      <NavLink
        to='/account'
        replace
        className={({ isActive }) => clsx(isActive && styles.active)}
        aria-label={intl.formatMessage(navMessages.account)}
      >
        {({ isActive }) => (
          <Button
            icon={isActive ? 'NAV_ACCOUNT_ACTIVE' : 'NAV_ACCOUNT'}
            as='span'
            animateClassName={styles.btnAnimate}
            cancelAnimation={!isActive}
          />
        )}
      </NavLink>
    </div>
  )
}

export default Navigation
