import React, { useCallback, useEffect, useState, useRef } from 'react'
import clsx from 'clsx'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { useSwipeable } from 'react-swipeable'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { setFilterStr, resetFilterStr, setFilterFolder, toggleFilterFlawed, toggleFilterStarred, toggleFilterMultiVersion, setFilterPreferred, nextPreferred } from '../../modules/library'
import { setYoutubeQuery, searchYoutubeVideos } from 'store/modules/youtube'
import { hasPermission } from 'store/modules/user'
import Button from 'components/Button/Button'
import Buttons from 'components/Buttons/Buttons'
import Icon from 'components/Icon/Icon'
import RecentSearches from 'components/RecentSearches/RecentSearches'
import FolderFilterDialog from '../FolderFilterDialog/FolderFilterDialog'
import { filterRecentSearches, getHistoryLimit, getRecentSearches, pushRecentSearch } from 'lib/recentSearches'
import styles from './LibraryHeader.css'
import { commonMessages } from '../../../../lib/messages'
import { libraryMessages } from '../../messages'

const LibraryHeader = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const intl = useIntl()
  const { filterStr, filterStarred, filterFlawed, filterFolder, filterMultiVersion, filterPreferred } = useAppSelector(state => state.library)
  const user = useAppSelector(state => state.user)
  const canDownload = hasPermission(user, 'youtubeDownload')
  const canMarkFlaws = user.isAdmin || hasPermission(user, 'songFlaws')

  // a mouse swipe across the filter group also fires a click on whatever
  // button it ends over: swallow it (same dance as the song rows); if the
  // compat click lands outside the buttons, the next mousedown disarms
  const ignoreMouseupRef = useRef(false)

  const handleFilterMousedown = (event: React.MouseEvent<HTMLDivElement>) => {
    ignoreMouseupRef.current = false
    filterSwipeHandlers.onMouseDown?.(event)
  }

  const handleFilterClick = (action: ReturnType<typeof toggleFilterStarred>) => {
    if (ignoreMouseupRef.current) {
      ignoreMouseupRef.current = false
      return
    }

    dispatch(action)
  }

  const [folderDialogOpen, setFolderDialogOpen] = useState(false)

  // same guard as handleFilterClick, for the folder button: it either
  // opens the dialog or clears an active filter instead of dispatching
  const handleFolderClick = () => {
    if (ignoreMouseupRef.current) {
      ignoreMouseupRef.current = false
      return
    }

    if (filterFolder === null) setFolderDialogOpen(true)
    else dispatch(setFilterFolder(null))
  }

  // the preferred filter cycles off → without → with → off instead of
  // toggling: same guard as the other filters
  const handlePreferredClick = () => {
    if (ignoreMouseupRef.current) {
      ignoreMouseupRef.current = false
      return
    }

    dispatch(setFilterPreferred(nextPreferred(filterPreferred)))
  }

  const searchInput = useRef<HTMLInputElement>(null)
  const searchWrap = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState(filterStr)
  const [historyLimit] = useState(() => getHistoryLimit('library'))
  const [historyOpen, setHistoryOpen] = useState(false)

  // only the star filter shows by default: swipe the filter group left
  // (like the song row actions) to reveal the extra filters
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const filterSwipeHandlers = useSwipeable({
    onSwipedLeft: ({ event }) => {
      ignoreMouseupRef.current = event.type === 'mouseup'
      setFiltersExpanded(true)
    },
    onSwipedRight: ({ event }) => {
      ignoreMouseupRef.current = event.type === 'mouseup'
      setFiltersExpanded(false)
    },
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
            highlight={value.trim()}
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
        className={clsx(
          styles.filters,
          !filtersExpanded && (filterFlawed || filterFolder !== null || filterMultiVersion || filterPreferred !== null) && styles.filtersHint,
        )}
        {...filterSwipeHandlers}
        onMouseDown={handleFilterMousedown}
        ref={setFiltersRef}
      >
        <Buttons btnWidth={56} isExpanded={filtersExpanded}>
          <Button
            className={clsx(styles.btnFilter, filterStarred && styles.active)}
            icon='STAR_FULL'
            onClick={() => handleFilterClick(toggleFilterStarred())}
            aria-label={intl.formatMessage(libraryMessages.starredOnly)}
            aria-pressed={filterStarred}
          />
          {canMarkFlaws && (
            <Button
              data-hide
              className={clsx(styles.btnFilter, styles.btnFilterFlawed, filterFlawed && styles.active)}
              icon='STAR_BROKEN'
              onClick={() => handleFilterClick(toggleFilterFlawed())}
              aria-label={intl.formatMessage(libraryMessages.flawedOnly)}
              aria-pressed={filterFlawed}
            />
          )}
          {user.isAdmin && (
            <Button
              data-hide
              className={clsx(styles.btnFilter, filterFolder !== null && styles.active)}
              icon='FOLDER'
              onClick={handleFolderClick}
              aria-label={intl.formatMessage(libraryMessages.filterFolder)}
              aria-pressed={filterFolder !== null}
            />
          )}
          <Button
            data-hide
            className={clsx(styles.btnFilter, filterMultiVersion && styles.active)}
            icon='NOTE_DUO'
            onClick={() => handleFilterClick(toggleFilterMultiVersion())}
            aria-label={intl.formatMessage(libraryMessages.multiVersionOnly)}
            aria-pressed={filterMultiVersion}
          />
          <Button
            data-hide
            className={clsx(styles.btnFilter, filterPreferred !== null && styles.active)}
            icon={filterPreferred === 'without' ? 'HEART_X' : filterPreferred === 'with' ? 'HEART_CHECK' : 'HEART'}
            onClick={handlePreferredClick}
            aria-label={intl.formatMessage(
              filterPreferred === 'without'
                ? libraryMessages.preferredWithout
                : filterPreferred === 'with'
                  ? libraryMessages.preferredWith
                  : libraryMessages.preferredAny,
            )}
            aria-pressed={filterPreferred !== null}
          />
        </Buttons>
      </div>
      {folderDialogOpen && (
        <FolderFilterDialog onClose={() => setFolderDialogOpen(false)} />
      )}
    </div>
  )
}

export default LibraryHeader
