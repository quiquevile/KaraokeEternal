import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/Database.js', () => ({
  db: { all: vi.fn() },
}))

import { db } from '../lib/Database.js'
import { getAlreadyDownloadedIds } from './library.js'

describe('getAlreadyDownloadedIds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the video ids found in the media table', () => {
    vi.mocked(db.all).mockReturnValue([
      { youtubeVideoId: 'idA' },
      { youtubeVideoId: 'idB' },
    ])

    const result = getAlreadyDownloadedIds(['idA', 'idB', 'idC'])

    expect(result instanceof Set).toBe(true)
    expect([...result].sort()).toEqual(['idA', 'idB'])
  })

  it('short-circuits on an empty input list', () => {
    const result = getAlreadyDownloadedIds([])

    expect(result.size).toBe(0)
    expect(db.all).not.toHaveBeenCalled()
  })
})
