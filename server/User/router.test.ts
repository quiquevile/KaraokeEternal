import { describe, it, expect, vi, beforeEach } from 'vitest'
import jsonWebToken from 'jsonwebtoken'

const { validateMock, roomsValidateMock, getByIdMock, countAdminsMock } = vi.hoisted(() => ({
  validateMock: vi.fn(),
  roomsValidateMock: vi.fn(),
  getByIdMock: vi.fn(),
  countAdminsMock: vi.fn(),
}))

vi.mock('./User.js', () => ({
  default: {
    get: vi.fn(() => ({
      result: [1, 2],
      entities: {
        1: { userId: 1, username: 'admin', name: 'Admin', permissions: {}, role: 'admin' },
        2: { userId: 2, username: 'pepe', name: 'Pepe', permissions: { youtubeDownload: true }, role: 'standard' },
      },
    })),
    validate: validateMock,
    getById: getByIdMock,
    countAdmins: countAdminsMock,
  },
}))

vi.mock('../Rooms/Rooms.js', () => ({
  default: { validate: roomsValidateMock },
}))

vi.mock('../lib/crypto.js', () => ({
  default: { isLegacy: () => false, hash: vi.fn() },
}))

import { handleLogin, handleUsersNames } from './router.js'
import router from './router.js'
import { resetLoginRateLimits } from '../lib/loginRateLimit.js'
import User from './User.js'

const dispatch = router.routes() as (ctx: object, next: () => void) => Promise<void>

const rootAdmin = { userId: 1, username: 'admin', name: 'Admin', role: 'admin', password: 'x', permissions: {} }

const routeCtx = (method: string, path: string, body: object = {}, user: object = rootAdmin) => ({
  method,
  path,
  params: {},
  query: {},
  request: { body },
  body: undefined,
  status: 200,
  user,
  jwtKey: 'test-key',
  cookies: { set: vi.fn() },
  io: { fetchSockets: async () => [], to: () => ({ emit: vi.fn() }) },
  throw: (status: number, message?: string): never => {
    const err = new Error(message || String(status)) as Error & { status: number }
    err.status = status
    throw err
  },
})

const makeSockets = (users: Array<{ userId: number, roomId: number | null }>) => (
  users.map(({ userId, roomId }) => ({ user: { userId, roomId } }))
)

const makeCtx = (user: object, query: object = {}, sockets: Array<{ userId: number, roomId: number | null }> = []) => ({
  user,
  query,
  body: undefined,
  status: 200,
  io: { fetchSockets: async () => makeSockets(sockets) },
  throw: (status: number, message?: string) => {
    const err = new Error(message || String(status))
    Object.assign(err, { status })
    throw err
  },
})

describe('last-admin guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('refuses demoting the last admin with 403', async () => {
    getByIdMock.mockImplementation((id: number) => (
      id === 1 ? rootAdmin : { ...rootAdmin, userId: 2, username: 'root2' }
    ))
    countAdminsMock.mockReturnValue(1)
    const ctx = routeCtx('PUT', '/api/user/2', { role: 'standard' })

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 403 })
  })

  it('refuses deleting the last admin with 403', async () => {
    getByIdMock.mockReturnValue({ ...rootAdmin, userId: 2, username: 'root2' })
    countAdminsMock.mockReturnValue(1)
    const ctx = routeCtx('DELETE', '/api/user/2')

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 403 })
  })
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

  it('filters by room presence', async () => {
    const sockets = [
      { userId: 1, roomId: 1 },
      { userId: 2, roomId: 2 },
    ]
    const ctx = makeCtx({ isAdmin: true }, { roomId: '1' }, sockets)

    await handleUsersNames(ctx)

    expect(ctx.body).toEqual([
      { userId: 1, username: 'admin', name: 'Admin' },
    ])
  })

  it('filters by online presence', async () => {
    const sockets = [{ userId: 2, roomId: 2 }]
    const ctx = makeCtx({ isAdmin: true }, { online: '1' }, sockets)

    await handleUsersNames(ctx)

    expect(ctx.body).toEqual([
      { userId: 2, username: 'pepe', name: 'Pepe' },
    ])
  })

  it('rejects invalid roomIds with 422', async () => {
    const ctx = makeCtx({ isAdmin: true }, { roomId: 'abc' }, [])

    await expect(handleUsersNames(ctx)).rejects.toMatchObject({ status: 422 })
    expect(User.get).not.toHaveBeenCalled()
  })
})

describe('handleLogin', () => {
  const adminUser = {
    userId: 1, username: 'admin', name: 'Admin', role: 'admin',
    password: 'hashed', permissions: {},
  }
  const standardUser = {
    userId: 2, username: 'pepe', name: 'Pepe', role: 'standard',
    password: 'hashed', permissions: {},
  }

  const makeLoginCtx = (body: Record<string, unknown> = {}, ip = '127.0.0.1') => ({
    params: {},
    query: {},
    request: { body, headers: {} },
    body: undefined,
    status: 200,
    ip,
    jwtKey: 'test-key',
    cookies: { set: vi.fn() },
    set: vi.fn(),
    throw: (status: number, message?: string): never => {
      const err = new Error(message || String(status)) as Error & { status: number }
      err.status = status
      throw err
    },
  })

  beforeEach(() => {
    vi.clearAllMocks()
    roomsValidateMock.mockResolvedValue(true)
  })

  it('lets admins skip the room password', async () => {
    validateMock.mockResolvedValue(adminUser)
    const ctx = makeLoginCtx({ username: 'admin', password: 'secret', roomId: '1', roomPassword: 'wrong' })

    await handleLogin(ctx as never)

    expect(roomsValidateMock).toHaveBeenCalledWith(1, 'wrong', {
      isOpen: false,
      validatePassword: false,
      locale: 'en',
    })
    expect(ctx.body).toMatchObject({ username: 'admin', roomId: 1, isAdmin: true })
    expect(ctx.cookies.set).toHaveBeenCalledWith('keToken', expect.any(String), expect.anything())
  })

  it('still requires the room password for standard users', async () => {
    validateMock.mockResolvedValue(standardUser)
    roomsValidateMock.mockRejectedValueOnce(new Error('Incorrect room password'))
    const ctx = makeLoginCtx({ username: 'pepe', password: 'secret', roomId: '1', roomPassword: 'wrong' })

    await expect(handleLogin(ctx as never)).rejects.toMatchObject({ status: 401 })
    expect(roomsValidateMock).toHaveBeenCalledWith(1, 'wrong', {
      isOpen: true,
      validatePassword: true,
      locale: 'en',
    })
  })

  it('answers room selection errors in the request language', async () => {
    validateMock.mockResolvedValue(standardUser)
    const ctx = makeLoginCtx({ username: 'pepe', password: 'secret' })
    ctx.request.headers = { 'accept-language': 'es-ES,es;q=0.9' }

    await expect(handleLogin(ctx as never)).rejects.toMatchObject({
      status: 401,
      message: 'Elige una sala',
    })
  })

  it('lets admins sign in without a room', async () => {
    validateMock.mockResolvedValue(adminUser)
    const ctx = makeLoginCtx({ username: 'admin', password: 'secret' })

    await handleLogin(ctx as never)

    expect(roomsValidateMock).not.toHaveBeenCalled()
    expect(ctx.body).toMatchObject({ username: 'admin', roomId: null })
  })

  it('issues expiring session tokens', async () => {
    validateMock.mockResolvedValue(adminUser)
    const ctx = makeLoginCtx({ username: 'admin', password: 'secret' })

    await handleLogin(ctx as never)

    const token = vi.mocked(ctx.cookies.set).mock.calls[0][1] as string
    const payload = jsonWebToken.decode(token) as { iat: number, exp: number } | null

    expect(payload).not.toBeNull()
    // ~30 days, with a minute of slack for slow CI
    expect(payload!.exp - payload!.iat).toBeGreaterThan(30 * 24 * 3600 - 60)
    expect(payload!.exp - payload!.iat).toBeLessThanOrEqual(30 * 24 * 3600)
  })

  it('still requires standard users to select a room', async () => {
    validateMock.mockResolvedValue(standardUser)
    const ctx = makeLoginCtx({ username: 'pepe', password: 'secret' })

    await expect(handleLogin(ctx as never)).rejects.toMatchObject({ status: 401, message: 'Please select a room' })
    expect(roomsValidateMock).not.toHaveBeenCalled()
  })

  it('rate-limits credential failures with Retry-After', async () => {
    process.env.KES_LOGIN_MAX_FAILS = '2'
    validateMock.mockRejectedValue(new Error('Incorrect username/email or password'))
    const body = { username: 'pepe', password: 'wrong' }
    const ip = '10.9.9.9'

    try {
      for (let i = 0; i < 2; i++) {
        await expect(handleLogin(makeLoginCtx(body, ip) as never)).rejects.toMatchObject({ status: 401 })
      }

      const ctx = makeLoginCtx(body, ip)
      await expect(handleLogin(ctx as never)).rejects.toMatchObject({ status: 429 })
      expect(ctx.set).toHaveBeenCalledWith('Retry-After', expect.any(String))
      expect(validateMock).toHaveBeenCalledTimes(2)
    } finally {
      delete process.env.KES_LOGIN_MAX_FAILS
      resetLoginRateLimits()
    }
  })

  it('does not count room failures and clears the counter on success', async () => {
    process.env.KES_LOGIN_MAX_FAILS = '2'
    const ip = '10.9.9.10'

    try {
      // credential failures: 1 counted
      validateMock.mockRejectedValueOnce(new Error('Incorrect username/email or password'))
      await expect(handleLogin(makeLoginCtx({ username: 'pepe', password: 'wrong' }, ip) as never))
        .rejects.toMatchObject({ status: 401 })

      // room failure with valid credentials: not counted
      validateMock.mockResolvedValue(standardUser)
      roomsValidateMock.mockRejectedValueOnce(new Error('Incorrect room password'))
      await expect(handleLogin(makeLoginCtx({ username: 'pepe', password: 'secret', roomId: '1' }, ip) as never))
        .rejects.toMatchObject({ status: 401 })

      // success clears the counter: two more failures still below the limit
      roomsValidateMock.mockResolvedValue(true)
      validateMock.mockResolvedValue(adminUser)
      await handleLogin(makeLoginCtx({ username: 'admin', password: 'secret' }, ip) as never)

      validateMock.mockRejectedValue(new Error('Incorrect username/email or password'))
      await expect(handleLogin(makeLoginCtx({ username: 'pepe', password: 'wrong' }, ip) as never))
        .rejects.toMatchObject({ status: 401 })
      await expect(handleLogin(makeLoginCtx({ username: 'pepe', password: 'wrong' }, ip) as never))
        .rejects.toMatchObject({ status: 401 })
    } finally {
      delete process.env.KES_LOGIN_MAX_FAILS
      resetLoginRateLimits()
    }
  })
})
