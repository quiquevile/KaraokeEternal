import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { ensureState } from 'redux-optimistic-ui'
import { RootState } from 'store/store'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { toggleArtistResultExpanded } from '../../modules/library'
import { showArtistEditor } from 'store/modules/artistInfo'
import {
  providerFetchKey,
  providerFetchRequest,
  providerSearchCancel,
  providerSearchRequest,
  scrollSearchResults,
  type ProviderFetchView,
} from '../../modules/library'
import getSearchTree, { SearchTreeNode } from '../../selectors/getSearchResults'
import getSongsStatus from '../../selectors/getSongsStatus'
import { ROW_HEIGHT_HEADING } from '../../lib/locate'
import buildHighlightPattern from '../Highlight/buildHighlightPattern'
import Button from 'components/Button/Button'
import Icon from 'components/Icon/Icon'
import PaddedList from 'components/PaddedList/PaddedList'
import ArtistItem from '../ArtistItem/ArtistItem'
import CountsHeading from '../CountsHeading/CountsHeading'
import ProviderResultItem, { type ProviderFetchItem } from '../ProviderResultItem/ProviderResultItem'
import Spinner from 'components/Spinner/Spinner'
import type { ProviderSearchError, ProviderSearchResult } from 'shared/types'
import type { ListImperativeAPI, RowComponentProps } from 'react-window'
import styles from './SearchResults.css'
import { commonMessages } from '../../../../lib/messages'
import { libraryMessages } from '../../messages'

const ROW_HEIGHT_ARTIST = 48
const ROW_HEIGHT_SONG = 56 // 52px + 4px margin
const ROW_HEIGHT_RESULT_HEADING = 24
const ROW_HEIGHT_SONG_WITH_ARTIST = 68 // 64px + 4px margin
const ROW_HEIGHT_PROVIDER_SPINNER = 52
const ROW_HEIGHT_PROVIDER_SEARCH_BUTTON = 64

interface SearchResultsProps {
  ui: RootState['ui']
}

interface CustomRowProps {
  artists: RootState['artists']
  dispatch: ReturnType<typeof useAppDispatch>
  highlight: RegExp | null
  tree: SearchTreeNode[]
  expandedArtistResults: number[]
  collapsedArtistResults: number[]
  providerResults: ProviderSearchResult[]
  providerErrors: ProviderSearchError[]
  providerNames: Record<number, string | undefined>
  providerFetches: Record<string, ProviderFetchView>
  isProviderSearchActive: boolean
  isProviderSearchDone: boolean
  showOnlineSection: boolean
  showProviderSearchButton: boolean
  providerSearchBtnIdx: number
  providerHeadingIdx: number
  onFetch: (item: ProviderFetchItem) => void
  onProviderSearch: () => void
  onProviderSearchCancel: () => void
}

// explicit user collapse wins over auto-expansion and vice versa
const isNodeExpanded = (
  node: SearchTreeNode,
  expandedArtistResults: number[],
  collapsedArtistResults: number[],
): boolean => (
  (node.autoExpanded || expandedArtistResults.includes(node.artistId))
  && !collapsedArtistResults.includes(node.artistId)
)

// this is outside the SearchResults component to keep the reference as stable as possible,
// as react-window will re-render the list (breaking animations) when RowComponent changes
const RowComponent = ({
  index,
  style,
  // below are also used in SearchResults and passed via rowProps to avoid duplicate effort
  dispatch,
  artists,
  highlight,
  tree,
  expandedArtistResults,
  collapsedArtistResults,
  providerResults,
  providerErrors,
  providerNames,
  providerFetches,
  isProviderSearchActive,
  isProviderSearchDone,
  showOnlineSection,
  showProviderSearchButton,
  providerSearchBtnIdx,
  providerHeadingIdx,
  onFetch,
  onProviderSearch,
  onProviderSearchCancel,
}: RowComponentProps<CustomRowProps>) => {
  const intl = useIntl()
  const { starredSongs } = useAppSelector(state => ensureState(state.userStars))
  const { upcoming, current } = useAppSelector(getSongsStatus)
  const isAdmin = useAppSelector(state => state.user.isAdmin)
  const userId = useAppSelector(state => state.user.userId)

  // tree heading
  if (index === 0) {
    const songCount = tree.reduce((sum, node) => sum + node.songIds.length, 0)

    return (
      <CountsHeading
        key='treeHeading'
        style={style}
        artists={tree.length}
        songs={songCount}
      />
    )
  }

  // artist results
  if (index <= tree.length) {
    const node = tree[index - 1]
    const artistId = node.artistId
    const artist = artists.entities[artistId]
    const isExpanded = isNodeExpanded(node, expandedArtistResults, collapsedArtistResults)

    return (
      <ArtistItem
        artistSongIds={node.songIds}
        highlight={highlight}
        isExpanded={isExpanded}
        isAdmin={isAdmin}
        key={artistId}
        name={artist.name}
        numStars={0}
        onArtistClick={() => dispatch(toggleArtistResultExpanded({ artistId, isExpanded }))}
        onEditArtist={() => dispatch(showArtistEditor(artistId))}
        upcomingSongs={upcoming}
        starredSongs={starredSongs}
        currentSongId={current}
        style={style}
      />
    )
  }

  // online provider section (rows follow the artist tree)
  if (showProviderSearchButton && index === providerSearchBtnIdx) {
    return (
      <div style={style} className={styles.providerSearchButton}>
        <Button variant='primary' onClick={onProviderSearch}>
          {isProviderSearchDone
            ? intl.formatMessage(libraryMessages.providerSearchAgain)
            : intl.formatMessage(libraryMessages.providerFindMore)}
        </Button>
      </div>
    )
  }

  if (!showOnlineSection) return null

  if (index === providerHeadingIdx) {
    return (
      <div key='providerHeading' style={style} className={styles.providerHeading}>
        <span>
          {providerResults.length === 0
            ? intl.formatMessage(libraryMessages.providerNoMore)
            : intl.formatMessage(libraryMessages.providerMore, { count: providerResults.length })}
        </span>
        {isProviderSearchActive && (
          <button type='button' className={styles.providerHeadingCancel} onClick={onProviderSearchCancel}>
            <FormattedMessage {...commonMessages.cancel} />
          </button>
        )}
      </div>
    )
  }

  const providerResultsStart = providerHeadingIdx + 1
  const providerErrorsStart = providerResultsStart + providerResults.length
  const providerErrorsEnd = providerErrorsStart + providerErrors.length

  if (index >= providerResultsStart && index < providerErrorsStart) {
    const result = providerResults[index - providerResultsStart]
    const fetchView = providerFetches[providerFetchKey(result.providerId, result.id)]
    return (
      <div style={style} key={`${result.providerId}:${result.id}`}>
        <ProviderResultItem
          providerId={result.providerId}
          itemId={result.id}
          title={result.title}
          artist={result.artist}
          source={result.source}
          iconUrl={result.iconUrl}
          duration={result.duration}
          highlight={highlight}
          isAdmin={isAdmin}
          userId={userId}
          fetchView={fetchView}
          onFetch={onFetch}
        />
      </div>
    )
  }

  if (index >= providerErrorsStart && index < providerErrorsEnd) {
    const err = providerErrors[index - providerErrorsStart]
    return (
      <div style={style} key={`err:${err.providerId}`}>
        <div className={styles.providerError} role='alert'>
          <div className={styles.providerErrorIcon}>
            <Icon icon='ALERT_OUTLINE' size={24} />
          </div>
          <div className={styles.providerErrorText}>
            {providerNames[err.providerId] ?? intl.formatMessage(libraryMessages.providerName)}
            <div className={styles.providerErrorMessage} title={err.message}>
              {err.message}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isProviderSearchActive && index === providerErrorsEnd) {
    return (
      <div key='providerSpinner' style={style}>
        <Spinner />
      </div>
    )
  }

  return null
}

const SearchResults = ({ ui }: SearchResultsProps) => {
  const dispatch = useAppDispatch()
  const artists = useAppSelector(state => state.artists)
  const expandedArtistResults = useAppSelector(state => state.library.expandedArtistResults)
  const collapsedArtistResults = useAppSelector(state => state.library.collapsedArtistResults)
  const {
    filterStr,
    filterStarred,
    isProviderSearchActive,
    providerSearchQuery,
    providerResults,
    providerErrors,
    providerFetches,
  } = useAppSelector(state => state.library)
  const tree = useAppSelector(getSearchTree)
  const scrollOffset = useAppSelector(state => state.library.searchScrollOffset)
  const user = useAppSelector(state => state.user)
  const providers = useAppSelector(state => state.prefs.providers)

  const lastScrollOffsetRef = useRef(scrollOffset)
  const listRef = useRef<ListImperativeAPI | null>(null)
  const isProviderSearchActiveRef = useRef(isProviderSearchActive)
  useEffect(() => {
    isProviderSearchActiveRef.current = isProviderSearchActive
  }, [isProviderSearchActive])

  const highlight = useMemo(() => buildHighlightPattern(filterStr), [filterStr])
  const trimmedFilter = filterStr.trim()

  // number of local matches (the tree lists every passing song), used to decide
  // whether a provider still has room to offer more results
  const localMatchCount = useMemo(
    () => tree.reduce((sum, node) => sum + node.songIds.length, 0),
    [tree],
  )

  // Hide already-completed entries: the song is in the local library now, so
  // the local row above takes priority and we avoid re-triggering provider work.
  const filteredProviderResults = useMemo(
    () => providerResults.filter(
      r => providerFetches[providerFetchKey(r.providerId, r.id)]?.status !== 'complete',
    ),
    [providerResults, providerFetches],
  )

  // enabled song providers offered for this query: those whose maxLibraryResults is null
  // (always) or at least the number of local matches (none while filtering by starred
  // songs, which are local by definition)
  const eligibleProviderIds = useMemo(
    () => filterStarred
      ? []
      : providers.result.filter((id) => {
          const provider = providers.entities[id]
          const song = provider?.prefs.types.song
          if (!provider?.prefs.enabled || !song?.enabled) return false
          return song.maxLibraryResults === null || localMatchCount <= song.maxLibraryResults
        }),
    [providers, localMatchCount, filterStarred],
  )

  const providerNames = useMemo(
    () => Object.fromEntries(providers.result.map(id => [id, providers.entities[id]?.name])),
    [providers],
  )

  const onFetch = useCallback(
    (item: ProviderFetchItem) => {
      if (user.userId === null || user.name === null) return
      dispatch(providerFetchRequest({
        ...item,
        userId: user.userId,
        userDisplayName: user.name,
        userDateUpdated: user.dateUpdated,
      }))
    },
    [dispatch, user.userId, user.name, user.dateUpdated],
  )

  const onProviderSearch = useCallback(() => {
    if (trimmedFilter.length === 0 || eligibleProviderIds.length === 0) return
    dispatch(providerSearchRequest({ query: trimmedFilter, providerIds: eligibleProviderIds }))
  }, [dispatch, trimmedFilter, eligibleProviderIds])

  const onProviderSearchCancel = useCallback(() => dispatch(providerSearchCancel()), [dispatch])

  // cancel any in-flight provider search when SearchResults unmounts
  useEffect(() => {
    return () => {
      if (isProviderSearchActiveRef.current) dispatch(providerSearchCancel())
    }
  }, [dispatch])

  // a search for exactly what's in the box has run to completion (or was canceled),
  // so an empty online section means "nothing found" rather than "not searched yet"
  const isProviderSearchDone = trimmedFilter.length > 0
    && providerSearchQuery === trimmedFilter
    && !isProviderSearchActive

  // hidden (not cleared) while filtering by starred songs, so it returns when toggled off
  const showOnlineSection = !filterStarred && (isProviderSearchActive || isProviderSearchDone
    || filteredProviderResults.length > 0 || providerErrors.length > 0)
  // once a search turns up results there's nothing to prompt for; the row only
  // persists to offer a retry when it came back empty
  const showProviderSearchButton = eligibleProviderIds.length > 0 && trimmedFilter.length > 0 && !isProviderSearchActive
    && !(isProviderSearchDone && filteredProviderResults.length > 0)
  const providerHeadingIdx = 1 + tree.length
  const onlineRowCount = showOnlineSection
    ? 1 + (isProviderSearchActive ? 1 : 0) + filteredProviderResults.length + providerErrors.length
    : 0
  const buttonRowCount = showProviderSearchButton ? 1 : 0
  const numRows = 1 + tree.length + onlineRowCount + buttonRowCount
  const providerSearchBtnIdx = showProviderSearchButton ? numRows - 1 : -1

  const rowHeight = useCallback((index: number) => {
    // tree heading
    if (index === 0) return ROW_HEIGHT_HEADING

    // artist results (expanded songs count toward the row's height)
    if (index <= tree.length) {
      const node = tree[index - 1]
      let height = ROW_HEIGHT_ARTIST

      if (isNodeExpanded(node, expandedArtistResults, collapsedArtistResults)) {
        height += node.songIds.length * ROW_HEIGHT_SONG
      }

      return height
    }

    if (showProviderSearchButton && index === providerSearchBtnIdx) return ROW_HEIGHT_PROVIDER_SEARCH_BUTTON

    if (!showOnlineSection) return 0
    if (index === providerHeadingIdx) return ROW_HEIGHT_RESULT_HEADING

    const providerResultsStart = providerHeadingIdx + 1
    const providerErrorsStart = providerResultsStart + filteredProviderResults.length
    const providerErrorsEnd = providerErrorsStart + providerErrors.length

    if (index >= providerResultsStart && index < providerErrorsEnd) return ROW_HEIGHT_SONG_WITH_ARTIST
    if (isProviderSearchActive && index === providerErrorsEnd) return ROW_HEIGHT_PROVIDER_SPINNER

    return 0
  }, [
    tree,
    expandedArtistResults,
    collapsedArtistResults,
    showProviderSearchButton,
    providerSearchBtnIdx,
    showOnlineSection,
    providerHeadingIdx,
    filteredProviderResults.length,
    providerErrors.length,
    isProviderSearchActive,
  ])

  useEffect(() => {
    return () => {
      dispatch(scrollSearchResults(lastScrollOffsetRef.current))
    }
  }, [dispatch])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    lastScrollOffsetRef.current = e.currentTarget.scrollTop
  }

  const handleRef = (ref: ListImperativeAPI | null) => {
    if (ref) listRef.current = ref
  }

  return (
    <PaddedList
      rowComponent={RowComponent}
      rowProps={{
        artists,
        dispatch,
        highlight,
        tree,
        expandedArtistResults,
        collapsedArtistResults,
        providerResults: filteredProviderResults,
        providerErrors,
        providerNames,
        providerFetches,
        isProviderSearchActive,
        isProviderSearchDone,
        showOnlineSection,
        showProviderSearchButton,
        providerSearchBtnIdx,
        providerHeadingIdx,
        onFetch,
        onProviderSearch,
        onProviderSearchCancel,
      }}
      rowHeight={rowHeight}
      numRows={numRows}
      defaultScrollOffset={scrollOffset}
      onScroll={handleScroll}
      paddingTop={ui.headerHeight}
      paddingRight={4}
      paddingBottom={ui.footerHeight}
      height={ui.innerHeight}
      onRef={handleRef}
    />
  )
}

export default SearchResults
