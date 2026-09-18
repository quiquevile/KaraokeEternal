import React from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Button from 'components/Button/Button'
import { searchYoutubeVideos, setYoutubeQuery } from 'store/modules/youtube'
import YouTubeSearchResult from '../YouTubeSearchResult/YouTubeSearchResult'
import styles from './YouTubeSearch.css'

const YouTubeSearch = () => {
  const query = useAppSelector(state => state.youtube.query)
  const results = useAppSelector(state => state.youtube.results)
  const isSearching = useAppSelector(state => state.youtube.isSearching)
  const error = useAppSelector(state => state.youtube.error)
  const dispatch = useAppDispatch()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()

    if (!query.trim()) return

    dispatch(searchYoutubeVideos(query.trim()))
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
