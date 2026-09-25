import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./User.js', () => ({
  default: {
    get: vi.fn(() => ({
      result: [1, 2],
      entities: {
        1: { userId: 1, username: 'admin', name: 'Admin', permissions: {}, role: 'admin' },
        2: { userId: 2, username: 'pepe', name: 'Pepe', permissions: { youtubeDownload: true }, role: 'standard' },
      },
    })),
  },
}))

import { handleUsersNames } from './router.js'
import User from './User.js'

const makeCtx = (user: object) => ({
  user,
  body: undefined,
  status: 200,
  throw: (status: number, message?: string) => {
    const err = new Error(message || String(status))
    Object.assign(err, { status })
    throw err
  },
})

describe('handleUsersNames', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns slim user entries for admins', async () => {
    const ctx = makeCtx({ isAdmin: true })

    await handleUsersNames(ctx)

    expect(User.get).toHaveBeenCalled()
    expect(ctx.body).toEqual([
      { userId: 1, username: 'admin', name: 'Admin' },
      { userId: 2, username: 'pepe', name: 'Pepe' },
    ])
  })

  it('returns slim user entries for downloadForOthers holders', async () => {
    const ctx = makeCtx({ isAdmin: false, permissions: { downloadForOthers: true } })

    await handleUsersNames(ctx)

    expect(ctx.body).toHaveLength(2)
  })

  it('rejects standard users with 401', async () => {
    const ctx = makeCtx({ isAdmin: false, permissions: { youtubeDownload: true } })

    await expect(handleUsersNames(ctx)).rejects.toMatchObject({ status: 401 })
    expect(User.get).not.toHaveBeenCalled()
  })
})
