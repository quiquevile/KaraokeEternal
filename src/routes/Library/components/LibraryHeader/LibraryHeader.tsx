import React, { useCallback, useEffect, useState, useRef } from 'react'
import clsx from 'clsx'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { useSwipeable } from 'react-swipeable'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { setFilterStr, resetFilterStr, setFilterFolder, toggleFilterStarred } from '../../modules/library'
import { openYoutubeSearch } from '../../lib/youtubeSearch'
import { hasPermission } from 'store/modules/user'
import { fetchTags } from 'store/modules/tags'
import Button from 'components/Button/Button'
import Buttons from 'components/Buttons/Buttons'
import Icon from 'components/Icon/Icon'
import RecentSearches from 'components/RecentSearches/RecentSearches'
import FolderFilterDialog from '../FolderFilterDialog/FolderFilterDialog'
import TagFilterDialog from '../TagFilterDialog/TagFilterDialog'
import { filterRecentSearches, getHistoryLimit, getRecentSearches, pushRecentSearch } from 'lib/recentSearches'
import styles from './LibraryHeader.css'
import { commonMessages } from '../../../../lib/messages'
import { libraryMessages } from '../../messages'

const LibraryHeader = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const intl = useIntl()
  const { filterStr, filterStarred, filterTags, filterFolder } = useAppSelector(state => state.library)
  const user = useAppSelector(state => state.user)
  const visibleTags = useAppSelector(state => state.tags.tags)
  // Admins can still use the special tag filters when there are no real tags.
  const hasMoreFilters = user.isAdmin || visibleTags.some(tag => tag.visibility !== 'admin')
  const canDownload = hasPermission(user, 'youtubeDownload')
  useEffect(() => {
    void dispatch(fetchTags())
  }, [dispatch])

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
  const [tagDialogOpen, setTagDialogOpen] = useState(false)

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

  const searchInput = useRef<HTMLInputElement>(null)
  const searchWrap = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState(filterStr)
  const [historyLimit] = useState(() => getHistoryLimit('library'))
  const [historyOpen, setHistoryOpen] = useState(false)

  // only the star filter shows by default: swipe the filter group left
  // (like the song row actions) to reveal the extra filters
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [previousHasMoreFilters, setPreviousHasMoreFilters] = useState(hasMoreFilters)
  if (hasMoreFilters !== previousHasMoreFilters) {
    setPreviousHasMoreFilters(hasMoreFilters)
    if (!hasMoreFilters) {
      setFiltersExpanded(false)
      setTagDialogOpen(false)
    }
  }
  const filterSwipeHandlers = useSwipeable({
    onSwipedLeft: ({ event }) => {
      if (!hasMoreFilters) return
      ignoreMouseupRef.current = event.type === 'mouseup'
      setFiltersExpanded(true)
    },
    onSwipedRight: ({ event }) => {
      if (!hasMoreFilters) return
      ignoreMouseupRef.current = event.type === 'mouseup'
      setFiltersExpanded(false)
    },
    preventScrollOnSwipe: hasMoreFilters,
    trackMouse: hasMoreFilters,
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

    openYoutubeSearch(dispatch, text)
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
          hasMoreFilters && !filtersExpanded && (filterTags.length > 0 || filterFolder !== null) && styles.filtersHint,
        )}
        {...(hasMoreFilters ? filterSwipeHandlers : {})}
        onMouseDown={hasMoreFilters ? handleFilterMousedown : undefined}
        ref={hasMoreFilters ? setFiltersRef : undefined}
      >
        <Buttons btnWidth={56} isExpanded={hasMoreFilters && filtersExpanded}>
          <Button
            className={clsx(styles.btnFilter, filterStarred && styles.active)}
            icon='STAR_FULL'
            onClick={() => handleFilterClick(toggleFilterStarred())}
            aria-label={intl.formatMessage(libraryMessages.starredOnly)}
            aria-pressed={filterStarred}
          />
          {hasMoreFilters && (
            <Button
              data-hide
              className={clsx(styles.btnFilter, filterTags.length > 0 && styles.active)}
              icon='LABEL'
              onClick={() => {
                if (ignoreMouseupRef.current) {
                  ignoreMouseupRef.current = false
                  return
                }
                setTagDialogOpen(true)
              }}
              aria-label={intl.formatMessage(libraryMessages.tagFilterTitle)}
              aria-pressed={filterTags.length > 0}
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
        </Buttons>
      </div>
      {folderDialogOpen && (
        <FolderFilterDialog onClose={() => setFolderDialogOpen(false)} />
      )}
      {tagDialogOpen && <TagFilterDialog onClose={() => setTagDialogOpen(false)} />}
    </div>
  )
}

export default LibraryHeader
