import { describe, it, expect } from 'vitest'
import {
  cleanKaraokeTitle,
  deriveMetadata,
  deriveNorms,
  toFilename,
} from './metadata.js'

describe('cleanKaraokeTitle', () => {
  it('removes trailing parenthesized karaoke markers', () => {
    expect(cleanKaraokeTitle('ABBA - Dancing Queen (Karaoke Version)')).toBe('ABBA - Dancing Queen')
    expect(cleanKaraokeTitle('Billie Eilish - bad guy (Official Karaoke)')).toBe('Billie Eilish - bad guy')
  })

  it('removes trailing bracketed and braced karaoke markers', () => {
    expect(cleanKaraokeTitle('Tyler, The Creator - See You Again [AZ Karaoke]')).toBe('Tyler, The Creator - See You Again')
    expect(cleanKaraokeTitle('ABBA - Dancing Queen {Karaoke}')).toBe('ABBA - Dancing Queen')
  })

  it('removes trailing dash karaoke suffix', () => {
    expect(cleanKaraokeTitle('Dancing Queen - Karaoke Version')).toBe('Dancing Queen')
    expect(cleanKaraokeTitle('Bad Guy - Karaoke')).toBe('Bad Guy')
  })

  it('removes leading karaoke prefix', () => {
    expect(cleanKaraokeTitle('Karaoke - Imagine Dragons - Believer')).toBe('Imagine Dragons - Believer')
    expect(cleanKaraokeTitle('Karaoke: Billie Eilish - bad guy')).toBe('Billie Eilish - bad guy')
  })

  it('removes trailing "with lyrics" markers', () => {
    expect(cleanKaraokeTitle('Dancing Queen (Karaoke Version) with lyrics')).toBe('Dancing Queen')
  })

  it('normalizes excessive whitespace', () => {
    expect(cleanKaraokeTitle('  ABBA    -   Dancing Queen  ')).toBe('ABBA - Dancing Queen')
  })

  it('leaves titles without karaoke markers untouched', () => {
    expect(cleanKaraokeTitle('The Weeknd - Blinding Lights')).toBe('The Weeknd - Blinding Lights')
  })
})

describe('deriveMetadata', () => {
  it('parses "Artist - Title (Karaoke)" via MetaParser', () => {
    const res = deriveMetadata('ABBA - Dancing Queen (Karaoke Version)')
    expect(res.artist).toBe('ABBA')
    expect(res.title).toBe('Dancing Queen')
    expect(res.artistNorm).toBe('ABBA')
    expect(res.titleNorm).toBe('Dancing Queen')
  })

  it('parses bracketed karaoke markers', () => {
    const res = deriveMetadata('Tyler, The Creator - See You Again [AZ Karaoke]')
    expect(res.artist).toBe('Tyler, The Creator')
    expect(res.title).toBe('See You Again')
  })

  it('parses plain titles without karaoke markers', () => {
    const res = deriveMetadata('The Weeknd - Blinding Lights')
    expect(res.artist).toBe('Weeknd, The')
    expect(res.title).toBe('Blinding Lights')
  })

  it('derives artist/title from "Title - Karaoke" using channel fallback', () => {
    const res = deriveMetadata('Dancing Queen - Karaoke Version', 'SingKing Karaoke')
    expect(res.artist).toBe('SingKing')
    expect(res.title).toBe('Dancing Queen')
    expect(res.artistNorm).toBe('SingKing')
    expect(res.titleNorm).toBe('Dancing Queen')
  })

  it('returns empty artist when neither title nor channel yields one', () => {
    const res = deriveMetadata('Bohemian Rhapsody')
    expect(res.artist).toBe('')
    expect(res.title).toBe('Bohemian Rhapsody')
  })

  it('passes unicode through untouched', () => {
    const res = deriveMetadata('ちゃんみな - 花火')
    expect(res.artist).toBe('ちゃんみな')
    expect(res.title).toBe('花火')
  })

  it('normalizes norms consistently with a MetaParser rescan of the file name', () => {
    const res = deriveMetadata('ABBA - Dancing Queen (Karaoke)')
    expect(res.artistNorm).toBe('ABBA')
    expect(res.titleNorm).toBe('Dancing Queen')
  })
})

describe('deriveNorms', () => {
  it('runs the artist/title through MetaParser norms', () => {
    const res = deriveNorms('ABBA', 'Dancing Queen')
    expect(res.artistNorm).toBe('ABBA')
    expect(res.titleNorm).toBe('Dancing Queen')
  })

  it('falls back to a plain lowercase normalization when artist is empty', () => {
    const res = deriveNorms('', 'Instrumental Piece')
    expect(res.artistNorm).toBe('')
    expect(res.titleNorm).toBe('instrumental piece')
  })
})

describe('toFilename', () => {
  it('joins artist and title with " - "', () => {
    expect(toFilename('ABBA', 'Dancing Queen')).toBe('ABBA - Dancing Queen')
  })

  it('sanitizes filesystem-hostile characters', () => {
    expect(toFilename('A/B:C*D', 'Title?"<>|')).toBe('A B C D - Title')
  })

  it('collapses consecutive whitespace', () => {
    expect(toFilename('Metal  Band', 'The   Song')).toBe('Metal Band - The Song')
  })

  it('falls back to the title alone when artist is empty', () => {
    expect(toFilename('', 'Instrumental Piece')).toBe('Instrumental Piece')
  })
})
