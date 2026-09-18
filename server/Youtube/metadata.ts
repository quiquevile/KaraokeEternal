import MetaParser from '../Scanner/MetaParser/MetaParser.js'

export interface ParsedMetadata {
  artist: string
  artistNorm: string
  title: string
  titleNorm: string
}

function stripKaraokePrefix (title: string) {
  return title.replace(/^karaoke\s*[:-]\s*/i, '')
}

function stripKaraokeMarkers (title: string) {
  let out = title
  // remove (…karaoke…), [ …karaoke… ], { …karaoke… } blocks (incl. "vocal"/"with lyrics")
  out = out.replace(/\s*(\(|\[|\{)[^)\]}]*?(karaoke|vocal|with lyrics)[^)\]}]*?(\)|\]|\})/gi, '')
  // trailing " - karaoke (version) from/by <channel>" attribution
  out = out.replace(/\s*[-:]\s*karaoke\s+(?:version\s+)?(?:from|by)\s+.+$/i, '')
  // trailing " - karaoke ..." / ": karaoke ..." suffix
  out = out.replace(/\s*[-:]\s*(karaoke|karaoke version|karaoke mix|karaoke instrumental|instrumental)\s*$/i, '')
  // trailing bare karaoke words
  out = out.replace(/\s+(karaoke|karaoke version)\s*$/i, '')
  // trailing lyric annotations
  out = out.replace(/\s+(with lyrics|with vocal|with vocals|with on.?screen lyrics)$/i, '')
  return out.trim().replace(/\s{2,}/g, ' ')
}

/**
 * Removes common karaoke prefixes/suffixes and marker blocks from a
 * YouTube title so that the remaining text can be parsed by MetaParser.
 */
export function cleanKaraokeTitle (title: string) {
  return stripKaraokeMarkers(stripKaraokePrefix(title.trim()))
}

function cleanChannel (channel: string) {
  return channel.trim()
    .replace(/\s*(\(|\[|\{)[^)\]}]*karaoke[^)\]}]*?(\)|\]|\})$/i, '')
    .replace(/\s+karaoke$/i, '')
    .trim()
}

function fallbackNorm (str: string) {
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(' & ', ' and ')
}

const parser = MetaParser()

/**
 * Derives (cleaned) artist/title metadata from a YouTube video title,
 * falling back to the channel name when the title cannot be parsed.
 * Norms are recomputed against the exact string that will be used as the
 * resulting file name (`Artist - Title`) so that a later library rescan
 * through MetaParser yields identical normalized values.
 */
export function deriveMetadata (title: string, channel = ''): ParsedMetadata {
  const cleaned = cleanKaraokeTitle(title)

  let artist = ''
  let songTitle = cleaned

  try {
    const parsed = parser({ name: cleaned })
    artist = parsed.artist
    songTitle = parsed.title
  } catch {
    artist = cleanChannel(channel)
  }

  return {
    artist,
    title: songTitle,
    ...deriveNorms(artist, songTitle),
  }
}

/**
 * Computes the normalized artist/title MetaParser would produce for a file
 * named `Artist - Title`, so that downloaded entries match a future rescan.
 */
export function deriveNorms (artist: string, title: string): Pick<ParsedMetadata, 'artistNorm' | 'titleNorm'> {
  let artistNorm = fallbackNorm(artist)
  let titleNorm = fallbackNorm(title)

  if (artist) {
    try {
      const norm = parser({ name: `${artist} - ${title}` })
      artistNorm = norm.artistNorm
      titleNorm = norm.titleNorm
    } catch {
      // keep fallback norms
    }
  }

  return { artistNorm, titleNorm }
}

const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g

function stripControlChars (str: string): string {
  let out = ''

  for (const char of str) {
    const code = char.codePointAt(0) ?? 0

    if (code >= 0x20 && code !== 0x7f) out += char
  }

  return out
}

/**
 * Builds a filesystem-safe base name for the downloaded file.
 */
export function toFilename (artist: string, title: string): string {
  const name = stripControlChars([artist, title].filter(Boolean).join(' - '))
    .replace(INVALID_FILENAME_CHARS, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/[.\s]+$/g, '')

  return name || 'video'
}
