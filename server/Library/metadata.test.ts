import { describe, expect, it } from 'vitest'
import { deriveNorms, toFilename } from './metadata.js'

describe('library metadata helpers', () => {
  it('normalizes artist and title for a later library scan', () => {
    expect(deriveNorms('ABBA', 'Dancing Queen')).toEqual({
      artistNorm: 'ABBA',
      titleNorm: 'Dancing Queen',
    })
    expect(deriveNorms('', 'Instrumental Piece')).toEqual({
      artistNorm: '',
      titleNorm: 'instrumental piece',
    })
  })

  it('makes a safe filename when renaming a song', () => {
    expect(toFilename('ABBA', 'Dancing Queen')).toBe('ABBA - Dancing Queen')
    expect(toFilename('A/B:C*D', 'Title?"<>|')).toBe('A B C D - Title')
    expect(toFilename('..', '')).toBe('video')
  })
})
