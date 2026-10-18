import React, { useEffect, useRef, useState } from 'react'
import { FormattedMessage } from 'react-intl'
import { useAppSelector } from 'store/hooks'
import { Link } from 'react-router'
import ArtistList from '../components/ArtistList/ArtistList'
import SearchResults from '../components/SearchResults/SearchResults'
import TextOverlay from 'components/TextOverlay/TextOverlay'
import Spinner from 'components/Spinner/Spinner'
import styles from './LibraryView.css'
import { libraryMessages } from '../messages'

const LibraryView = () => {
  const { isAdmin } = useAppSelector(state => state.user)
  const { isLoading, filterStr, filterStarred, filterFlawed } = useAppSelector(state => state.library)
  const songsResult = useAppSelector(state => state.songs.result)
  const ui = useAppSelector(state => state.ui)

  const isSearching = !!filterStr.trim().length || filterStarred || filterFlawed

  // ArtistList virtualizes rows against ui.headerHeight (the header includes
  // LibraryHeader on this route, measured async via ResizeObserver). Mounting
  // before the height settles makes saved scroll positions land off by
  // (delta / rowHeight) rows. Wait for the first growth past the value at
  // mount before rendering ArtistList.
  const initialHeaderHeight = useRef(ui.headerHeight)
  const [isReady, setIsReady] = useState(false)
  useEffect(() => {
    if (!isReady && ui.headerHeight > initialHeaderHeight.current) {
      // one-shot gate: render ArtistList only once the header height settles
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsReady(true)
    }
  }, [ui.headerHeight, isReady])

  if (!isReady) return null

  return (
    <>
      {!isSearching && <ArtistList ui={ui} />}

      {isSearching && <SearchResults ui={ui} />}

      {isLoading && <Spinner />}

      {!isLoading && songsResult.length === 0 && (
        <TextOverlay className={styles.empty}>
          <h1><FormattedMessage {...libraryMessages.title} /></h1>
          {isAdmin && (
            <p>
              <FormattedMessage
                {...libraryMessages.admin}
                values={{ link: chunks => <Link to='/account'>{chunks}</Link> }}
              />
            </p>
          )}
        </TextOverlay>
      )}
    </>
  )
}

export default LibraryView
