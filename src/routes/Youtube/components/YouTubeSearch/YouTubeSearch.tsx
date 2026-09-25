import React from 'react'
import { useAppSelector } from 'store/hooks'
import YouTubeSearchResult from '../YouTubeSearchResult/YouTubeSearchResult'
import styles from './YouTubeSearch.css'

const YouTubeSearch = () => {
  const results = useAppSelector(state => state.youtube.results)
  const error = useAppSelector(state => state.youtube.error)
  const isSearching = useAppSelector(state => state.youtube.isSearching)
  const hasSearched = useAppSelector(state => state.youtube.hasSearched)

  return (
    <>
      {error
        && <p className={styles.error}>{error}</p>}

      {!isSearching && !error && hasSearched && results.length === 0
        && <p className={styles.noResults}>No results found</p>}

      {results.length > 0
        && (
          <ul className={styles.results}>
            {results.map(result => (
              <YouTubeSearchResult key={result.id} item={result} />
            ))}
          </ul>
        )}
    </>
  )
}

export default YouTubeSearch
