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

  it('removes trailing "karaoke version from <channel>" attribution', () => {
    expect(cleanKaraokeTitle('Martika - Toy Soldiers - Karaoke Version from Zoom Karaoke'))
      .toBe('Martika - Toy Soldiers')
    expect(cleanKaraokeTitle('ABBA - Dancing Queen - Karaoke from SingKing Karaoke'))
      .toBe('ABBA - Dancing Queen')
  })

  it('removes leading karaoke prefix', () => {
    expect(cleanKaraokeTitle('Karaoke - Imagine Dragons - Believer')).toBe('Imagine Dragons - Believer')
    expect(cleanKaraokeTitle('Karaoke: Billie Eilish - bad guy')).toBe('Billie Eilish - bad guy')
  })

  it('removes a leading bare karaoke prefix', () => {
    expect(cleanKaraokeTitle('KARAOKE Me Muero - La Quinta Estación')).toBe('Me Muero - La Quinta Estación')
  })

  it('removes trailing "with lyrics" markers', () => {
    expect(cleanKaraokeTitle('Dancing Queen (Karaoke Version) with lyrics')).toBe('Dancing Queen')
  })

  it('normalizes excessive whitespace', () => {
    expect(cleanKaraokeTitle('  ABBA    -   Dancing Queen  ')).toBe('ABBA - Dancing Queen')
  })

  it('strips "with lyrics on screen" annotations', () => {
    expect(cleanKaraokeTitle('Sam Cooke - Having A Party (Karaoke Version) with Lyrics On Screen'))
      .toBe('Sam Cooke - Having A Party')
  })

  it('strips backing-vocals annotation blocks', () => {
    expect(cleanKaraokeTitle('Elvis Presley - Don\'t Be Cruel (Joe\'s Version) (No BVs) (Karaoke Version)'))
      .toBe('Elvis Presley - Don\'t Be Cruel (Joe\'s Version)')
  })

  it('strips instrumental annotation blocks', () => {
    expect(cleanKaraokeTitle('Beyoncé - CAN I WATCH YOU (feat. Pharrell Williams) (Instrumental Visualizer)'))
      .toBe('Beyoncé - CAN I WATCH YOU (feat. Pharrell Williams)')
  })

  it('strips Spanish instrumental and letra markers', () => {
    expect(cleanKaraokeTitle('ABBA - Chiquitita LETRA (INSTRUMENTAL KARAOKE)')).toBe('ABBA - Chiquitita')
    expect(cleanKaraokeTitle('Ana Mena, Emilia - Carita triste (Karaoke) [Instrumental con coros]'))
      .toBe('Ana Mena, Emilia - Carita triste')
  })

  it('keeps a trailing "made popular by" attribution for later parsing', () => {
    expect(cleanKaraokeTitle('Dilemma (Made Popular By Nelly ft. Kelly Rowland) [Vocal Version]'))
      .toBe('Dilemma (Made Popular By Nelly ft. Kelly Rowland)')
  })

  it('strips a trailing karaoke-brand attribution', () => {
    expect(cleanKaraokeTitle('Jueves La Oreja de Van Gogh KARAOKE KARAOKEMEDIA')).toBe('Jueves La Oreja de Van Gogh')
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

  it('parses karaoke videos with channel attribution', () => {
    const res = deriveMetadata('Martika - Toy Soldiers - Karaoke Version from Zoom Karaoke', 'Zoom Karaoke')
    expect(res.artist).toBe('Martika')
    expect(res.title).toBe('Toy Soldiers')
    expect(res.artistNorm).toBe('Martika')
    expect(res.titleNorm).toBe('Toy Soldiers')
  })

  it('parses "with lyrics on screen" zoom titles', () => {
    const res = deriveMetadata('Sam Cooke - Having A Party (Karaoke Version) with Lyrics On Screen', 'Zoom Karaoke Official')
    expect(res.artist).toBe('Sam Cooke')
    expect(res.title).toBe('Having A Party')
    expect(res.artistNorm).toBe('Sam Cooke')
    expect(res.titleNorm).toBe('Having A Party')
  })

  it('extracts the artist from a "made popular by" attribution', () => {
    const res = deriveMetadata('Dilemma (Made Popular By Nelly ft. Kelly Rowland) [Vocal Version]', 'Party Tyme')
    expect(res.artist).toBe('Nelly ft. Kelly Rowland')
    expect(res.title).toBe('Dilemma')
  })

  it('drops a "made popular by" block when a real artist is present', () => {
    const res = deriveMetadata('Ariana Grande - One Last Time (Made Popular By Someone) [Karaoke Version]', 'Party Tyme')
    expect(res.artist).toBe('Ariana Grande')
    expect(res.title).toBe('One Last Time')
  })

  it('swaps artist/title on flipped KaraFun titles', () => {
    const res = deriveMetadata('Can\'t Take My Eyes Off You - Frankie Valli & The Four Seasons | Karaoke Version | KaraFun')
    expect(res.artist).toBe('Frankie Valli & The Four Seasons')
    expect(res.title).toBe('Can\'t Take My Eyes Off You')
    expect(res.artistNorm).toBe('Frankie Valli and The Four Seasons')
    expect(res.titleNorm).toBe('Cant Take My Eyes Off You')
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
