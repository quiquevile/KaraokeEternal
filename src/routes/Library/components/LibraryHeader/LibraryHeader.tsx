import React, { useCallback, useEffect, useState, useRef } from 'react'
import clsx from 'clsx'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { useSwipeable } from 'react-swipeable'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { setFilterStr, resetFilterStr, toggleFilterDownloaded, toggleFilterFlawed, toggleFilterStarred } from '../../modules/library'
import { fetchPrefs } from 'store/modules/prefs'
import { setYoutubeQuery, searchYoutubeVideos } from 'store/modules/youtube'
import { hasPermission } from 'store/modules/user'
import Button from 'components/Button/Button'
import Buttons from 'components/Buttons/Buttons'
import Icon from 'components/Icon/Icon'
import RecentSearches from 'components/RecentSearches/RecentSearches'
import { filterRecentSearches, getHistoryLimit, getRecentSearches, pushRecentSearch } from 'lib/recentSearches'
import styles from './LibraryHeader.css'
import { commonMessages } from '../../../../lib/messages'
import { libraryMessages } from '../../messages'

const LibraryHeader = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const intl = useIntl()
  const { filterStr, filterStarred, filterFlawed, filterDownloaded } = useAppSelector(state => state.library)
  const user = useAppSelector(state => state.user)
  const canDownload = hasPermission(user, 'youtubeDownload')
  const canMarkFlaws = user.isAdmin || hasPermission(user, 'songFlaws')
  const hasDownloadPath = useAppSelector(state => state.prefs.youtubeDownloadPathId != null)
  const showDownloadFilter = useAppSelector(state =>
    state.user.isAdmin && state.prefs.youtubeDownloadPathId != null,
  )

  // the download-folder filter needs global prefs, which are only fetched
  // at login: re-fetch on mount when missing so the button self-heals
  useEffect(() => {
    if (user.userId !== null && !hasDownloadPath) {
      dispatch(fetchPrefs())
    }
  }, [dispatch, user.userId, hasDownloadPath])

  const searchInput = useRef<HTMLInputElement>(null)
  const searchWrap = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState(filterStr)
  const [historyLimit] = useState(() => getHistoryLimit('library'))
  const [historyOpen, setHistoryOpen] = useState(false)

  // only the star filter shows by default: swipe the filter group left
  // (like the song row actions) to reveal the extra filters
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const filterSwipeHandlers = useSwipeable({
    onSwipedLeft: () => setFiltersExpanded(true),
    onSwipedRight: () => setFiltersExpanded(false),
    preventScrollOnSwipe: true,
    trackMouse: true,
  })
  // react-swipeable passes its ref callback through the handlers object;
  // forward to it without reading it during render
  const setFiltersRef = useCallback((el: HTMLDivElement | null) => {
    filterSwipeHandlers.ref(el)
  }, [filterSwipeHandlers])

  const openHistory = () => {
    if (historyLimit > 0 && getRecentSearches('library').length > 0) {
      setHistoryOpen(true)
    }
  }

  // hide the dropdown when scrolling the results underneath it
  // (scrolls inside the dropdown itself are left alone)
  useEffect(() => {
    if (!historyOpen) return

    const hide = (event: Event) => {
      if (searchWrap.current && !searchWrap.current.contains(event.target as Node)) {
        setHistoryOpen(false)
      }
    }

    document.addEventListener('scroll', hide, true)

    return () => document.removeEventListener('scroll', hide, true)
  }, [historyOpen])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value)
    dispatch(setFilterStr(event.target.value))
  }

  const handleFocus = () => openHistory()

  const handleBlur = () => {
    // leaving the field settles the search: remember it, then hide
    if (value.trim() !== '') pushRecentSearch('library', value)

    setHistoryOpen(false)
  }

  const handleSelect = (term: string) => {
    setValue(term)
    dispatch(setFilterStr(term))
    setHistoryOpen(false)
  }

  const clearSearch = () => {
    setValue('')
    dispatch(resetFilterStr())
    openHistory()
  }

  const handleMagnifierClick = () => {
    const text = value.trim()

    if (!text) {
      searchInput.current?.focus()
      return
    }

    if (!canDownload) {
      clearSearch()
      return
    }

    // an explicit search counts for both histories: it filters the library
    // now and searches YouTube right after (each push honors its own limit)
    pushRecentSearch('library', text)
    pushRecentSearch('youtube', text)

    // jump to the YouTube tab searching for the same text
    dispatch(setYoutubeQuery(text))
    void dispatch(searchYoutubeVideos(text))
    navigate('/youtube')
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleMagnifierClick()
    if (event.key === 'Escape') setHistoryOpen(false)
  }

  return (
    <div className={styles.container}>
      <Button
        className={clsx(styles.btnMagnifier, filterStr && styles.active)}
        icon='MAGNIFIER'
        onClick={handleMagnifierClick}
        aria-label={filterStr
          ? intl.formatMessage(libraryMessages.searchYoutube)
          : intl.formatMessage(libraryMessages.searchLibrary)}
      >
        {filterStr && <Icon icon='NAV_YOUTUBE' className={styles.ytBadge} />}
      </Button>
      <div className={styles.searchWrap} ref={searchWrap}>
        <input
          type='search'
          className={styles.searchInput}
          placeholder={intl.formatMessage(libraryMessages.search)}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          ref={searchInput}
        />
        {historyOpen && (
          <RecentSearches
            items={filterRecentSearches(getRecentSearches('library'), value).map(term => ({ value: term, label: term }))}
            label={intl.formatMessage(libraryMessages.recentSearches)}
            onSelect={handleSelect}
          />
        )}
      </div>
      {filterStr && (
        <Button
          icon='CLEAR'
          onClick={clearSearch}
          className={clsx(styles.btnClear, styles.active)}
          aria-label={intl.formatMessage(commonMessages.clearSearch)}
        />
      )}
      <div
        className={styles.filters}
        {...filterSwipeHandlers}
        ref={setFiltersRef}
      >
        <Buttons btnWidth={56} isExpanded={filtersExpanded}>
          <Button
            className={clsx(styles.btnFilter, filterStarred && styles.active)}
            icon='STAR_FULL'
            onClick={() => dispatch(toggleFilterStarred())}
            aria-label={intl.formatMessage(libraryMessages.starredOnly)}
            aria-pressed={filterStarred}
          />
          {canMarkFlaws && (
            <Button
              data-hide
              className={clsx(styles.btnFilter, filterFlawed && styles.active)}
              icon='STAR_BROKEN'
              onClick={() => dispatch(toggleFilterFlawed())}
              aria-label={intl.formatMessage(libraryMessages.flawedOnly)}
              aria-pressed={filterFlawed}
            />
          )}
          {showDownloadFilter && (
            <Button
              data-hide
              className={clsx(styles.btnFilter, filterDownloaded && styles.active)}
              icon='DOWNLOAD'
              onClick={() => dispatch(toggleFilterDownloaded())}
              aria-label={intl.formatMessage(libraryMessages.downloadedOnly)}
              aria-pressed={filterDownloaded}
            />
          )}
        </Buttons>
      </div>
    </div>
  )
}

export default LibraryHeader
