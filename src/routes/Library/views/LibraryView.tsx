import React, { useEffect, useRef, useState } from 'react'
import { FormattedMessage } from 'react-intl'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { Link } from 'react-router'
import { hasPermission } from 'store/modules/user'
import ArtistList from '../components/ArtistList/ArtistList'
import SearchResults from '../components/SearchResults/SearchResults'
import TextOverlay from 'components/TextOverlay/TextOverlay'
import Spinner from 'components/Spinner/Spinner'
import getSearchTree from '../selectors/getSearchResults'
import { openYoutubeSearch } from '../lib/youtubeSearch'
import styles from './LibraryView.css'
import { libraryMessages } from '../messages'

const LibraryView = () => {
  const user = useAppSelector(state => state.user)
  const { isAdmin } = user
  const { isLoading, filterStr, filterStarred, filterFlawed, filterFolder, filterMultiVersion, filterPreferred } = useAppSelector(state => state.library)
  const songsResult = useAppSelector(state => state.songs.result)
  const ui = useAppSelector(state => state.ui)
  const dispatch = useAppDispatch()

  const isSearching = !!filterStr.trim().length || filterStarred || filterFlawed || filterFolder !== null || filterMultiVersion || filterPreferred !== null
  const canDownload = hasPermission(user, 'youtubeDownload')
  // shared memoized selector: SearchResults already computes this tree while
  // searching, and the plain -1 keeps the cost at zero when not searching
  const searchTreeLength = useAppSelector(state => isSearching ? getSearchTree(state).length : -1)

  // ArtistList virtualizes rows against ui.headerHeight (the header includes
  // LibraryHeader on this route, measured async via ResizeObserver). Mounting
  // before the height settles makes saved scroll positions land off by
  // (delta / rowHeight) rows. A height that differs from the value captured
  // at mount means this route's header has measured and settled. When the
  // swap leaves the height untouched (the queue and library headers are the
  // same size, so no measurement is coming) waiting for growth would hang
  // forever: settle after two frames instead, giving a pending
  // ResizeObserver dispatch its rendering opportunity first (a change
  // re-runs this effect, cancels the frame and settles immediately). The
  // pristine initial 0 keeps waiting for its first dispatch.
  const initialHeaderHeight = useRef(ui.headerHeight)
  const [isReady, setIsReady] = useState(false)
  useEffect(() => {
    if (isReady) return

    if (ui.headerHeight !== initialHeaderHeight.current) {
      setIsReady(true)
      return
    }

    if (initialHeaderHeight.current === 0) return

    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        setIsReady(true)
      })
    })

    return () => cancelAnimationFrame(frame)
  }, [ui.headerHeight, isReady])

  if (!isReady) return null

  return (
    <>
      {/* overlays go before the virtualized list: they are in-flow elements
          with height 100%, and the full-height list would push them off
          screen (same order as the queue view) */}
      {!isLoading && isSearching && songsResult.length > 0 && searchTreeLength === 0 && (
        <TextOverlay className={styles.empty}>
          <h1><FormattedMessage {...libraryMessages.noMatches} /></h1>
          {/* only text can be handed over to the YouTube search; the other
              filters leave nothing to search for */}
          {filterStr.trim() !== '' && canDownload && (
            <p>
              <Link to='/youtube' onClick={() => openYoutubeSearch(dispatch, filterStr)}>
                <FormattedMessage {...libraryMessages.searchYoutube} />
              </Link>
            </p>
          )}
        </TextOverlay>
      )}

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
