import React, { useRef } from 'react'
import { ensureState } from 'redux-optimistic-ui'
import { RootState } from 'store/store'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { toggleArtistResultExpanded } from '../../modules/library'
import getSearchTree, { SearchTreeNode } from '../../selectors/getSearchResults'
import getSongsStatus from '../../selectors/getSongsStatus'
import PaddedList from 'components/PaddedList/PaddedList'
import ArtistItem from '../ArtistItem/ArtistItem'
import type { ListImperativeAPI, RowComponentProps } from 'react-window'
import styles from './SearchResults.css'

const ROW_HEIGHT_RESULT_HEADING = 24
const ROW_HEIGHT_ARTIST = 48
const ROW_HEIGHT_SONG = 56 // 52px + 4px margin

interface SearchResultsProps {
  ui: RootState['ui']
}

interface CustomRowProps {
  artists: RootState['artists']
  dispatch: ReturnType<typeof useAppDispatch>
  filterKeywords: string[]
  tree: SearchTreeNode[]
  expandedArtistResults: number[]
  collapsedArtistResults: number[]
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
  filterKeywords,
  tree,
  expandedArtistResults,
  collapsedArtistResults,
}: RowComponentProps<CustomRowProps>) => {
  const { starredSongs } = useAppSelector(state => ensureState(state.userStars))
  const { upcoming } = useAppSelector(getSongsStatus)

  // tree heading
  if (index === 0) {
    const songCount = tree.reduce((sum, node) => sum + node.songIds.length, 0)

    return (
      <div key='treeHeading' style={style} className={styles.artistsHeading}>
        {tree.length}
        {' artists, '}
        {songCount}
        {' songs'}
      </div>
    )
  }

  // artist results
  const node = tree[index - 1]
  const artistId = node.artistId
  const artist = artists.entities[artistId]
  const isExpanded = isNodeExpanded(node, expandedArtistResults, collapsedArtistResults)

  return (
    <ArtistItem
      artistSongIds={node.songIds}
      filterKeywords={filterKeywords}
      isExpanded={isExpanded}
      key={artistId}
      name={artist.name}
      numStars={0}
      onArtistClick={() => dispatch(toggleArtistResultExpanded({ artistId, isExpanded }))}
      upcomingSongs={upcoming}
      starredSongs={starredSongs}
      style={style}
    />
  )
}

const SearchResults = ({ ui }: SearchResultsProps) => {
  const dispatch = useAppDispatch()
  const artists = useAppSelector(state => state.artists)
  const expandedArtistResults = useAppSelector(state => state.library.expandedArtistResults)
  const collapsedArtistResults = useAppSelector(state => state.library.collapsedArtistResults)
  const { filterStr } = useAppSelector(state => state.library)
  const tree = useAppSelector(getSearchTree)

  const listRef = useRef<ListImperativeAPI | null>(null)
  const filterKeywords = filterStr.trim() ? filterStr.trim().toLowerCase().split(' ') : []

  const rowHeight = (index: number) => {
    // tree heading
    if (index === 0) return ROW_HEIGHT_RESULT_HEADING

    // artist results
    const node = tree[index - 1]
    let height = ROW_HEIGHT_ARTIST

    if (isNodeExpanded(node, expandedArtistResults, collapsedArtistResults)) {
      height += node.songIds.length * ROW_HEIGHT_SONG
    }

    return height
  }

  const handleRef = (ref: ListImperativeAPI | null) => {
    if (ref) {
      listRef.current = ref
      // listRef.current.scrollToRow({ index: props.scrollRow, align: 'start' })
    }
  }

  return (
    <PaddedList
      rowComponent={RowComponent}
      rowProps={{
        dispatch,
        artists,
        filterKeywords,
        tree,
        expandedArtistResults,
        collapsedArtistResults,
      }}
      rowHeight={rowHeight}
      numRows={tree.length + 1}
      paddingTop={ui.headerHeight}
      paddingRight={4}
      paddingBottom={ui.footerHeight}
      height={ui.innerHeight}
      onRef={handleRef}
    />
  )
}

export default SearchResults
