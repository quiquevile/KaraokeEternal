import MetaParser from '../Scanner/MetaParser/MetaParser.js'

const parser = MetaParser()

function fallbackNorm (str: string) {
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(' & ', ' and ')
}

export function deriveNorms (artist: string, title: string): { artistNorm: string, titleNorm: string } {
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

export function toFilename (artist: string, title: string): string {
  const name = stripControlChars([artist, title].filter(Boolean).join(' - '))
    .replace(INVALID_FILENAME_CHARS, ' ')
    .replace(/\.{2,}/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '')

  return name || 'video'
}
