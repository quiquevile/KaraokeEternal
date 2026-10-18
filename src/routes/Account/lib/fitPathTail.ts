// fits a path into maxWidth by keeping its tail: the end is what
// distinguishes folders, and a select on a narrow screen can only show
// so much; measure() reports the rendered width of a string so the
// component can inject canvas text metrics (unit tests inject fakes)
export const fitPathTail = (
  path: string,
  maxWidth: number,
  measure: (s: string) => number,
): string => {
  if (measure(path) <= maxWidth) return path

  // shortest prefix to drop so that '...' + tail fits
  let lo = 0
  let hi = path.length

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)

    if (measure('...' + path.slice(mid)) <= maxWidth) hi = mid
    else lo = mid + 1
  }

  // prefer starting at a path-segment boundary (shorter, still fits)
  const slash = path.indexOf('/', lo)
  return `...${slash === -1 ? path.slice(lo) : path.slice(slash)}`
}
