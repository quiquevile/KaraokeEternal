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
  const hasSearched = useAppSelector(state => state.youtube.hasSearched)
  const dispatch = useAppDispatch()

  const searchInput = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(query)

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value)
    dispatch(setYoutubeQuery(event.target.value))
  }

  const clearSearch = () => {
    setValue('')
    dispatch(clearYoutubeResults())
    searchInput.current?.focus()
  }

  const handleSearch = async () => {
    const q = value.trim()

    if (!q || isSearching) return

    dispatch(setYoutubeQuery(q))

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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleSearch()
  }

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
      {value.trim()
        && (
          <Button
            icon='CLEAR'
            onClick={clearSearch}
            className={clsx(styles.btnClear, styles.active)}
            aria-label='Clear search'
          />
        )}
      <Button
        className={clsx(
          styles.btnMagnifier,
          hasSearched && !isSearching && styles.active,
          isSearching && styles.searching,
        )}
        icon='MAGNIFIER'
        onClick={handleSearch}
        disabled={isSearching || !value.trim()}
        aria-label='Search'
      />
    </div>
  )
}

export default YouTubeSearchHeader
