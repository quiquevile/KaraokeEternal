import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ensureState } from 'redux-optimistic-ui'
import { RootState } from 'store/store'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { scrollArtists, toggleArtistExpanded } from '../../modules/library'
import getAlphaPickerMap from '../../selectors/getAlphaPickerMap'
import getSongsStatus from '../../selectors/getSongsStatus'
import PaddedList from 'components/PaddedList/PaddedList'
import AlphaPicker from '../AlphaPicker/AlphaPicker'
import ArtistItem from '../ArtistItem/ArtistItem'
import { ROW_HEIGHT_ARTIST, ROW_HEIGHT_SONG, locateSongOffset } from '../../lib/locate'
import type { ListImperativeAPI, RowComponentProps } from 'react-window'

interface ArtistListProps {
  ui: RootState['ui']
}

interface CustomRowProps {
  dispatch: ReturnType<typeof useAppDispatch>
  artists: RootState['artists']
  expandedArtists: number[]
}

// this is outside the ArtistList component to keep the reference as stable as possible,
// as react-window will re-render the list (breaking animations) when RowComponent changes
const RowComponent = ({
  index,
  style,
  // below are also used in ArtistList and passed via rowProps to avoid duplicate effort
  dispatch,
  artists,
  expandedArtists,
}: RowComponentProps<CustomRowProps>) => {
  const starredArtistCounts = useAppSelector(state => state.starCounts.artists)
  const { starredSongs } = useAppSelector(state => ensureState(state.userStars))
  const { upcoming, current } = useAppSelector(getSongsStatus)

  const artist = artists.entities[artists.result[index]]
  if (current) upcoming.push(current)

  return (
    <ArtistItem
      artistSongIds={artist.songIds} // "children"
      isExpanded={expandedArtists.includes(artist.artistId)}
      key={artist.artistId}
      name={artist.name}
      numStars={starredArtistCounts[artist.artistId] || 0}
      onArtistClick={() => dispatch(toggleArtistExpanded(artist.artistId))}
      upcomingSongs={upcoming}
      starredSongs={starredSongs}
      style={style}
    />
  )
}

const ArtistList = ({
  ui,
}: ArtistListProps) => {
  const dispatch = useAppDispatch()
  const { expandedArtists } = useAppSelector(state => state.library)
  const scrollRow = useAppSelector(state => state.library.scrollRow)
  const locateSongId = useAppSelector(state => state.library.locateSongId)
  const songs = useAppSelector(state => state.songs.entities)
  const alphaPickerMap = useAppSelector(getAlphaPickerMap)
  const artists = useAppSelector(state => state.artists)

  const initialScrollRow = useRef(scrollRow) // frozen target for restoration
  const lastScrollRow = useRef(scrollRow) // current visible row
  const list = useRef<ListImperativeAPI | null>(null)
  const hasRestoredScroll = useRef(false)
  // bumped when the virtualized list attaches: refs are not reactive,
  // so without this the locate effect below would never retry a late
  // attach (its other deps may never change again)
  const [listTick, setListTick] = useState(0)
  // bumped when new rows render while a locate is active: react-window
  // estimates the total size from rendered rows only, so scrollHeight
  // grows as the bottom rows materialize and the locate scroll must be
  // redone with the real geometry (converges: scrollHeight stops growing)
  const [renderTick, setRenderTick] = useState(0)
  const locateRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      dispatch(scrollArtists(lastScrollRow.current))
    }
  }, [dispatch])

  const rowHeight = (index: number) => {
    const artistId = artists.result[index]
    let height = ROW_HEIGHT_ARTIST

    if (expandedArtists.includes(artistId)) {
      height += artists.entities[artistId].songIds.length * ROW_HEIGHT_SONG
    }

    return height
  }

  const handledLocate = useRef<{ songId: number, headerHeight: number, footerHeight: number, scrollHeight: number, expandedArtists: number[] } | null>(null)
  // the locate scroll runs once per song: after it, user-driven expansion
  // changes must never re-scroll (see below)
  const settledLocate = useRef<number | null>(null)

  // locate-in-library: scroll the located song fully into view, redoing
  // the math whenever the geometry it was computed with goes stale:
  // async-measured header/footer heights, late list attach, or
  // react-window's estimated total size growing as rows materialize
  // (row restores stay untouched)
  useEffect(() => {
    locateRef.current = locateSongId

    if (!locateSongId) {
      handledLocate.current = null
      settledLocate.current = null
      return
    }

    // already scrolled for this song (or the user took over): run once
    if (settledLocate.current === locateSongId) return

    const artistId = songs[locateSongId]?.artistId

    if (typeof artistId !== 'number') return

    const artistIdx = artists.result.indexOf(artistId)
    const el = list.current?.element

    if (artistIdx === -1 || !el) return

    const isExpanded = expandedArtists.includes(artistId)
    const handled = handledLocate.current

    if (handled?.songId === locateSongId && handled.headerHeight === ui.headerHeight
      && handled.footerHeight === ui.footerHeight) {
      if (handled.expandedArtists !== expandedArtists) {
        // expansion changed after our scroll: ours (which also expands)
        // runs with handled still null, so this is the user expanding or
        // collapsing something — settle without scrolling, once means once
        settledLocate.current = locateSongId
        handledLocate.current = { ...handled, scrollHeight: el.scrollHeight, expandedArtists }
        return
      }

      // geometry unchanged since the last scroll: nothing to redo
      if (handled.scrollHeight === el.scrollHeight) return
    }

    if (!isExpanded) {
      // not yet expanded: our own expansion (first run) or the user
      // collapsed the located artist after our scroll — only the former
      // may proceed, the latter settles
      if (handled) {
        settledLocate.current = locateSongId
        return
      }

      dispatch(toggleArtistExpanded(artistId))
      return
    }

    const songIds = artists.entities[artistId]?.songIds ?? []
    const songPos = songIds.indexOf(locateSongId)

    if (songPos === -1) return

    // geometry unchanged since the last scroll: nothing to redo
    if (handledLocate.current?.songId === locateSongId
      && handledLocate.current.headerHeight === ui.headerHeight
      && handledLocate.current.footerHeight === ui.footerHeight
      && handledLocate.current.scrollHeight === el.scrollHeight) return

    const artistHeights = artists.result.map((id) => {
      const songsCount = expandedArtists.includes(id)
        ? (artists.entities[id]?.songIds.length ?? 0)
        : 0

      return ROW_HEIGHT_ARTIST + songsCount * ROW_HEIGHT_SONG
    })
    const target = locateSongOffset(
      ui.headerHeight,
      artistHeights,
      artistIdx,
      songPos,
      el.clientHeight,
    )
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight)

    el.scrollTo({ top: Math.min(target, maxScroll) })

    if (Math.abs(el.scrollTop - Math.min(target, maxScroll)) > 2) {
      // pixel scroll missed (unlaid-out list): center the artist row
      list.current?.scrollToRow({ index: artistIdx + 1, align: 'center' })
    }

    handledLocate.current = { songId: locateSongId, headerHeight: ui.headerHeight, footerHeight: ui.footerHeight, scrollHeight: el.scrollHeight, expandedArtists }
  }, [locateSongId, songs, artists, expandedArtists, dispatch, ui.headerHeight, ui.footerHeight, listTick, renderTick])

  const handleRowsRendered = ({ startIndex }: { startIndex: number }) => {
    // while locating, newly rendered rows can grow react-window's
    // estimated total size: retry the locate scroll with real geometry
    if (locateRef.current) {
      const scrollHeight = list.current?.element?.scrollHeight
      const handled = handledLocate.current

      if (!handled || handled.songId !== locateRef.current
        || (typeof scrollHeight === 'number' && scrollHeight !== handled.scrollHeight)) {
        setRenderTick(t => t + 1)
      }
    }

    // before restoration runs, ignore the initial startIndex=0 that fires
    // because the list defaults to scrollTop=0; otherwise it would falsely
    // overwrite our saved row when the user navigates away before scrolling.
    if (!hasRestoredScroll.current && startIndex === 0 && initialScrollRow.current) {
      return
    }
    lastScrollRow.current = startIndex
  }

  const handleAlphaPick = (char: string) => {
    const row = alphaPickerMap[char]

    if (typeof row !== 'undefined' && list.current) {
      list.current.scrollToRow({ index: row > 0 ? row - 1 : row, align: 'start' })
    }
  }

  const handleRef = useCallback((ref: ListImperativeAPI | null) => {
    list.current = ref

    if (ref) setListTick(t => t + 1)

    // a pending locate owns the scroll: restoring a stale saved row here
    // would clobber it (the ref can attach after the locate effect ran)
    if (locateRef.current) return

    if (ref?.element && !hasRestoredScroll.current && initialScrollRow.current) {
      ref.scrollToRow({ index: initialScrollRow.current, align: 'start', behavior: 'instant' })
      hasRestoredScroll.current = true
    }
  }, [])

  if (artists.result.length === 0) return null

  return (
    <div>
      <PaddedList
        rowComponent={RowComponent}
        rowProps={{ dispatch, artists, expandedArtists }}
        rowHeight={rowHeight}
        numRows={artists.result.length}
        onRowsRendered={handleRowsRendered}
        onRef={handleRef}
        paddingTop={ui.headerHeight}
        paddingRight={30} // width of AlphaPicker
        paddingBottom={ui.footerHeight}
        width={ui.innerWidth}
        height={ui.innerHeight}
      />
      <AlphaPicker
        onPick={handleAlphaPick}
        height={ui.innerHeight - ui.headerHeight - ui.footerHeight}
        top={ui.headerHeight}
      />
    </div>
  )
}

export default ArtistList
