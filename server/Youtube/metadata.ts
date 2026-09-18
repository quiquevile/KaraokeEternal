import MetaParser from '../Scanner/MetaParser/MetaParser.js'

export interface ParsedMetadata {
  artist: string
  artistNorm: string
  title: string
  titleNorm: string
}

function stripKaraokePrefix (title: string) {
  return title.replace(/^karaoke\s*[:-]?\s*/i, '')
}

function stripKaraokeMarkers (title: string) {
  let out = title
  // remove (…karaoke…), [ …karaoke… ], { …karaoke… } blocks (incl. "vocal"/"with lyrics")
  out = out.replace(/\s*(\(|\[|\{)[^)\]}]*?(karaoke|vocal|with lyrics|instrumental)[^)\]}]*?(\)|\]|\})/gi, '')
  // remove backing-vocals annotation blocks like "(No BVs)", "(Without Backing Vocals)"
  out = out.replace(/\s*(\(|\[|\{)(no bvs?|without backing vocals|no backing vocals)(\)|\]|\})/gi, '')
  // trailing " - karaoke (version) from/by <channel>" attribution
  out = out.replace(/\s*[-:]\s*karaoke\s+(?:version\s+)?(?:from|by)\s+.+$/i, '')
  // trailing " - karaoke ..." / ": karaoke ..." suffix
  out = out.replace(/\s*[-:]\s*(karaoke|karaoke version|karaoke mix|karaoke instrumental|instrumental)\s*$/i, '')
  // trailing karaoke-brand attribution (e.g. "... KARAOKE KARAOKEMEDIA")
  out = out.replace(/\s+(karaoke\s+)?karaokemedia$/i, '')
  // trailing bare karaoke words
  out = out.replace(/\s+(karaoke|karaoke version)\s*$/i, '')
  // trailing lyric annotations
  out = out.replace(/\s+(with lyrics(?: on.?screen)?|with on.?screen lyrics|with vocal|with vocals|letra|con letra)$/i, '')
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
 * KaraFun-type channels name videos "Title - Artist | Karaoke Version | <channel>",
 * i.e. artist and song title are swapped relative to the "Artist - Title" convention
 * that MetaParser assumes. Detect the pattern and swap them back.
 */
function parseFlippedAttribution (title: string): { artist: string, songTitle: string } | null {
  const match = title.match(/^\s*(.+?)\s*-\s*(.+?)\s*\|\s*karaoke([^|]*)\s*\|\s*.+?\s*$/i)

  if (!match) return null

  return { artist: match[2].trim(), songTitle: match[1].trim() }
}

/**
 * Derives (cleaned) artist/title metadata from a YouTube video title,
 * falling back to the channel name when the title cannot be parsed.
 * Norms are recomputed against the exact string that will be used as the
 * resulting file name (`Artist - Title`) so that a later library rescan
 * through MetaParser yields identical normalized values.
 */
export function deriveMetadata (title: string, channel = ''): ParsedMetadata {
  const flipped = parseFlippedAttribution(title)

  if (flipped) {
    return {
      artist: flipped.artist,
      title: flipped.songTitle,
      ...deriveNorms(flipped.artist, flipped.songTitle),
    }
  }

  const cleaned = cleanKaraokeTitle(title)

  // "… (Made Popular By X)" / "… (Original by X)" re-attributes the artist.
  const attribution = cleaned.match(/^(.+?)\s*\((?:made popular by|origin(?:al|ally)? by)\s+(.+)\)$/i)
  const hasLeadingArtist = cleaned.includes(' - ')

  if (attribution && !hasLeadingArtist) {
    const artist = attribution[2].trim()
    const songTitle = attribution[1].trim()

    return {
      artist,
      title: songTitle,
      ...deriveNorms(artist, songTitle),
    }
  }

  const name = attribution
    ? cleaned.replace(/\s*\((?:made popular by|origin(?:al|ally)? by)[^)]*\)/gi, ' ')
    : cleaned

  let artist = ''
  let songTitle = name

  try {
    const parsed = parser({ name })
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
