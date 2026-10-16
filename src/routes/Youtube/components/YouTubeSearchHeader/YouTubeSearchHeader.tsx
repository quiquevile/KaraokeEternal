import React, { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useIntl } from 'react-intl'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import {
  clearYoutubeResults,
  searchYoutubeVideos,
  selectYoutubeResult,
  setYoutubeQuery,
} from 'store/modules/youtube'
import Button from 'components/Button/Button'
import Icon from 'components/Icon/Icon'
import RecentSearches from 'components/RecentSearches/RecentSearches'
import { filterRecentSearches, getHistoryLimit, getRecentSearches, pushRecentSearch } from 'lib/recentSearches'
import styles from './YouTubeSearchHeader.css'
import { commonMessages } from '../../../../lib/messages'
import { youtubeMessages } from '../../messages'

const parseVideoId = (value: string): string | null => {
  const match = value.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  )

  return match ? match[1] : null
}

const YouTubeSearchHeader = () => {
  const query = useAppSelector(state => state.youtube.query)
  const isSearching = useAppSelector(state => state.youtube.isSearching)
  const hasSearched = useAppSelector(state => state.youtube.hasSearched)
  const dispatch = useAppDispatch()

  const searchInput = useRef<HTMLInputElement>(null)
  const searchWrap = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState(query)
  const [historyLimit] = useState(() => getHistoryLimit('youtube'))
  const [historyOpen, setHistoryOpen] = useState(false)
  const intl = useIntl()

  const openHistory = () => {
    if (historyLimit > 0 && getRecentSearches('youtube').length > 0) {
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
    dispatch(setYoutubeQuery(event.target.value))
  }

  const handleFocus = () => openHistory()

  const handleBlur = () => setHistoryOpen(false)

  const clearSearch = () => {
    setValue('')
    dispatch(clearYoutubeResults())
    searchInput.current?.focus()
    openHistory()
  }

  const runSearch = async (text: string) => {
    const q = text.trim()

    if (!q || isSearching) return

    dispatch(setYoutubeQuery(q))
    pushRecentSearch('youtube', q)
    setHistoryOpen(false)

    try {
      const results = await dispatch(searchYoutubeVideos(q)).unwrap()

      // a pasted YouTube URL opens the artist <-> title dialog directly
      if (parseVideoId(q) && !/\s/.test(q)) {
        const result = results[0]

        if (result) {
          dispatch(selectYoutubeResult(result))
        }
      }
    } catch {
      // error is surfaced via state.youtube.error
    }
  }

  const handleSearch = () => {
    void runSearch(value)
  }

  const handleSelect = (term: string) => {
    setValue(term)
    void runSearch(term)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleSearch()

    if (event.key === 'Escape') setHistoryOpen(false)

    // native ESC only clears the textbox: clear the results too, like the X
    if (event.key === 'Escape' && event.currentTarget.value.trim()) clearSearch()
  }

  return (
    <div className={styles.container}>
      <Button
        className={clsx(
          styles.btnMagnifier,
          hasSearched && !isSearching && styles.active,
          isSearching && styles.searching,
        )}
        icon='MAGNIFIER'
        onClick={handleSearch}
        disabled={isSearching || !value.trim()}
        aria-label={intl.formatMessage(youtubeMessages.submit)}
      >
        <Icon icon='NAV_YOUTUBE' className={styles.ytBadge} />
      </Button>
      <div className={styles.searchWrap} ref={searchWrap}>
        <input
          type='search'
          className={styles.searchInput}
          placeholder={intl.formatMessage(youtubeMessages.placeholder)}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          ref={searchInput}
        />
        {historyOpen && (
          <RecentSearches
            items={filterRecentSearches(getRecentSearches('youtube'), value).map(term => ({ value: term, label: term }))}
            label={intl.formatMessage(youtubeMessages.recentSearches)}
            onSelect={handleSelect}
          />
        )}
      </div>
      {value.trim()
        && (
          <Button
            icon='CLEAR'
            onClick={clearSearch}
            className={clsx(styles.btnClear, styles.active)}
            aria-label={intl.formatMessage(commonMessages.clearSearch)}
          />
        )}
    </div>
  )
}

export default YouTubeSearchHeader
