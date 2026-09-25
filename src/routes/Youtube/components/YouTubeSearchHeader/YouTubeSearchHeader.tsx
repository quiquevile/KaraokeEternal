import React, { useRef, useState } from 'react'
import clsx from 'clsx'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import {
  clearYoutubeResults,
  searchYoutubeVideos,
  selectYoutubeResult,
  setYoutubeQuery,
} from 'store/modules/youtube'
import Button from 'components/Button/Button'
import styles from './YouTubeSearchHeader.css'

const parseVideoId = (value: string): string | null => {
  const match = value.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  )

  return match ? match[1] : null
}

const YouTubeSearchHeader = () => {
  const query = useAppSelector(state => state.youtube.query)
  const isSearching = useAppSelector(state => state.youtube.isSearching)
  const hasResults = useAppSelector(state => state.youtube.results.length > 0)
  const dispatch = useAppDispatch()

  const searchInput = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(query)
  const [searchedQuery, setSearchedQuery] = useState('')

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value)
    dispatch(setYoutubeQuery(event.target.value))
  }

  const clearSearch = () => {
    setValue('')
    setSearchedQuery('')
    dispatch(clearYoutubeResults())
  }

  const handleSearch = async () => {
    const q = value.trim()

    if (!q || isSearching) return

    dispatch(setYoutubeQuery(q))

    try {
      const results = await dispatch(searchYoutubeVideos(q)).unwrap()
      setSearchedQuery(q)

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

  const handleMagnifierClick = () => {
    if (isSearching) return

    // results for the current text: clear like the old X did
    if (hasResults && (!value.trim() || value.trim() === searchedQuery)) {
      clearSearch()
      searchInput.current?.focus()

      return
    }

    handleSearch()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleSearch()
  }

  // clearing applies when results belong to the current text (or it is empty)
  const canClear = hasResults && !isSearching && (!value.trim() || value.trim() === searchedQuery)

  return (
    <div className={styles.container}>
      <input
        type='search'
        className={styles.searchInput}
        placeholder='search / YouTube URL'
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        ref={searchInput}
      />
      <Button
        className={clsx(
          styles.btnMagnifier,
          canClear && styles.active,
          isSearching && styles.searching,
        )}
        icon='MAGNIFIER'
        onClick={handleMagnifierClick}
        disabled={isSearching || (!value.trim() && !canClear)}
        aria-label={canClear ? 'Clear search' : 'Search'}
      />
    </div>
  )
}

export default YouTubeSearchHeader
