import React, { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { ensureState } from 'redux-optimistic-ui'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import Icon from 'components/Icon/Icon'
import RecentSearches from 'components/RecentSearches/RecentSearches'
import { resetQueueFilterStr, setQueueFilterStr, setQueueFilterUser, toggleQueueFilterStarred } from 'store/modules/ui'
import { prepareLibrarySearch } from '../../lib/librarySearch'
import styles from './QueueHeader.css'
import { commonMessages } from 'lib/messages'
import { queueMessages } from '../../messages'
import { libraryMessages } from '../../../Library/messages'

const QueueHeader = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const intl = useIntl()
  const { filterStr, filterStarred, filterUserId } = useAppSelector(state => state.ui)
  const queueEntities = useAppSelector(state => ensureState(state.queue).entities)
  const userId = useAppSelector(state => state.user.userId)

  const searchInput = useRef<HTMLInputElement>(null)
  const searchWrap = useRef<HTMLDivElement>(null)
  const userWrap = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState(filterStr)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // users with queued songs, deduped in queue order (optimistic items
  // don't know their user yet); the current user comes first
  const users = useMemo(() => {
    const seen = new Map<number, string>()

    Object.values(queueEntities).forEach((item) => {
      if ('userDisplayName' in item && !seen.has(item.userId)) {
        seen.set(item.userId, item.userDisplayName)
      }
    })

    return [...seen.entries()]
      .map(([id, label]) => ({ value: String(id), label, isSelf: id === userId }))
      .sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || a.label.localeCompare(b.label))
      .map(({ value, label }) => ({ value, label }))
  }, [queueEntities, userId])

  // hide the dropdown when clicking or scrolling outside it (the input
  // and the toggle button count as inside; scrolls inside the dropdown
  // itself are left alone)
  useEffect(() => {
    if (!userMenuOpen) return

    const hide = (event: Event) => {
      const target = event.target as Node

      if (
        (searchWrap.current && searchWrap.current.contains(target))
        || (userWrap.current && userWrap.current.contains(target))
      ) return

      setUserMenuOpen(false)
    }

    document.addEventListener('mousedown', hide)
    document.addEventListener('scroll', hide, true)

    return () => {
      document.removeEventListener('mousedown', hide)
      document.removeEventListener('scroll', hide, true)
    }
  }, [userMenuOpen])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value)
    dispatch(setQueueFilterStr(event.target.value))
  }

  const clearSearch = () => {
    setValue('')
    dispatch(resetQueueFilterStr())
    searchInput.current?.focus()
  }

  // only text in the box searches: the magnifier (or Enter) then hands the
  // same text over to the library; without text it just refocuses the input
  const handleMagnifierClick = () => {
    const text = value.trim()

    if (!text) {
      searchInput.current?.focus()
      return
    }

    prepareLibrarySearch(dispatch, text)
    navigate('/library')
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleMagnifierClick()
      return
    }

    if (event.key !== 'Escape') return

    if (userMenuOpen) {
      setUserMenuOpen(false)
      return
    }

    if (value) {
      event.preventDefault()
      clearSearch()
    }
  }

  // an active user filter is cleared by tapping its icon again;
  // otherwise the icon opens the picker
  const handleUserClick = () => {
    if (filterUserId !== null) {
      setUserMenuOpen(false)
      dispatch(setQueueFilterUser(null))
      return
    }

    setUserMenuOpen(open => !open)
  }

  const handleUserSelect = (userId: string) => {
    dispatch(setQueueFilterUser(Number(userId)))
    setUserMenuOpen(false)
  }

  return (
    <div className={styles.container}>
      <Button
        className={clsx(styles.btnMagnifier, value.trim() && styles.active)}
        icon='MAGNIFIER'
        onClick={handleMagnifierClick}
        aria-label={intl.formatMessage(value.trim() ? libraryMessages.searchLibrary : queueMessages.search)}
      >
        {value.trim() && <Icon icon='NAV_LIBRARY' className={styles.libBadge} />}
      </Button>
      <div className={styles.searchWrap} ref={searchWrap}>
        <input
          type='search'
          className={styles.searchInput}
          placeholder={intl.formatMessage(queueMessages.search)}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          ref={searchInput}
        />
        {userMenuOpen && (
          <RecentSearches
            items={users}
            label={intl.formatMessage(queueMessages.userFilter)}
            icon='PERSON'
            highlight={userId !== null ? String(userId) : undefined}
            onSelect={handleUserSelect}
          />
        )}
      </div>
      {value && (
        <Button
          icon='CLEAR'
          onClick={clearSearch}
          className={clsx(styles.btnClear, styles.active)}
          aria-label={intl.formatMessage(commonMessages.clearSearch)}
        />
      )}
      <Button
        className={clsx(styles.btnFilter, filterStarred && styles.active)}
        icon='STAR_FULL'
        onClick={() => dispatch(toggleQueueFilterStarred())}
        aria-label={intl.formatMessage(queueMessages.starredOnly)}
        aria-pressed={filterStarred}
      />
      <div className={styles.userWrap} ref={userWrap}>
        <Button
          className={clsx(styles.btnFilter, filterUserId !== null && styles.active)}
          icon='PERSON'
          onClick={handleUserClick}
          aria-label={intl.formatMessage(queueMessages.userFilter)}
          aria-pressed={filterUserId !== null}
          aria-expanded={userMenuOpen}
          aria-haspopup='listbox'
        />
      </div>
    </div>
  )
}

export default QueueHeader
