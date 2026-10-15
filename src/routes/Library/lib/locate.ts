export const ROW_HEIGHT_ARTIST = 48
export const ROW_HEIGHT_SONG = 56

/**
 * Scroll offset (px) that places a song inside an expanded artist at
 * `viewportRatio` from the top of the list viewport. Pure and unit
 * tested: the virtualized list lays out rows exactly this way
 * (top spacer of headerHeight, then artist blocks of 48px plus 56px
 * per song when expanded).
 */
export function locateSongOffset (
  headerHeight: number,
  artistHeights: number[],
  artistIdx: number,
  songPos: number,
  viewportHeight: number,
  viewportRatio = 0.25,
): number {
  let offset = headerHeight

  for (let i = 0; i < artistIdx; i++) {
    offset += artistHeights[i]
  }

  offset += ROW_HEIGHT_ARTIST + songPos * ROW_HEIGHT_SONG

  return Math.max(0, offset - viewportHeight * viewportRatio)
}
