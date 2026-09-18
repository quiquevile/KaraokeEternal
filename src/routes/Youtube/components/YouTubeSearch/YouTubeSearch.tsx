import React from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import { clearYoutube, searchYoutubeVideos, setYoutubeQuery } from 'store/modules/youtube'
import YouTubeSearchResult from '../YouTubeSearchResult/YouTubeSearchResult'
import styles from './YouTubeSearch.css'

const YouTubeSearch = () => {
  const query = useAppSelector(state => state.youtube.query)
  const results = useAppSelector(state => state.youtube.results)
  const downloads = useAppSelector(state => state.youtube.downloads)
  const isSearching = useAppSelector(state => state.youtube.isSearching)
  const error = useAppSelector(state => state.youtube.error)
  const dispatch = useAppDispatch()

  const hasDownloads = !!downloads && (
    !!downloads.active
    || downloads.queue.length > 0
    || downloads.history.length > 0
  )

  const canClear = !!query.trim() || results.length > 0 || !!error || hasDownloads

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()

    if (!query.trim()) return

    dispatch(searchYoutubeVideos(query.trim()))
  }

  const handleClear = () => {
    dispatch(clearYoutube())
  }

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleSearch}>
        <input
          className={styles.input}
          type='text'
          placeholder='Search YouTube for a karaoke track...'
          value={query}
          onChange={e => dispatch(setYoutubeQuery(e.currentTarget.value))}
        />
        <Button variant='primary' type='submit' className={styles.button} disabled={isSearching || !query.trim()}>
          {isSearching ? 'Searching...' : 'Search'}
        </Button>
        <Button
          icon='CLEAR'
          type='button'
          className={styles.button}
          onClick={handleClear}
          disabled={!canClear}
          aria-label='Clear search and downloads'
        >
          Clear
        </Button>
      </form>

      {error
        && <p className={styles.error}>{error}</p>}

      {results.length > 0
        && (
          <ul className={styles.results}>
            {results.map(result => (
              <YouTubeSearchResult key={result.id} item={result} />
            ))}
          </ul>
        )}
    </div>
  )
}

export default YouTubeSearch
