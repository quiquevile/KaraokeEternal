import { describe, it, expect, vi, beforeEach } from 'vitest'
import jsonWebToken from 'jsonwebtoken'

const { validateMock, roomsValidateMock, getByIdMock, countAdminsMock } = vi.hoisted(() => ({
  validateMock: vi.fn(),
  roomsValidateMock: vi.fn(),
  getByIdMock: vi.fn(),
  countAdminsMock: vi.fn(),
}))

vi.mock('./User.js', async importOriginal => ({
  ...(await importOriginal<typeof import('./User.js')>()),
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
    getGuestAndGhostIds: vi.fn(() => []),
    create: vi.fn(),
    remove: vi.fn(),
    removeGhostsByCreator: vi.fn(() => []),
  },
}))

vi.mock('../Rooms/Rooms.js', () => ({
  default: {
    validate: roomsValidateMock,
    get: vi.fn((roomId: number | null | undefined) => ({
      result: roomId === 9 ? [] : [roomId ?? 1],
      entities: roomId === 9 ? {} : { [roomId ?? 1]: { roomId: roomId ?? 1, status: 'closed' } },
    })),
    getActive: vi.fn(() => []),
    hasUserBeenInRoom: vi.fn(() => false),
  },
  STATUSES: ['open', 'closed'],
}))

vi.mock('../lib/crypto.js', () => ({
  default: { isLegacy: () => false, hash: vi.fn() },
}))

vi.mock('../lib/Database.js', () => ({
  db: { run: vi.fn(() => ({ changes: 1 })), get: vi.fn(), all: vi.fn(() => []) },
}))

import { handleLogin, handleSwitchRoom, handleUsersCleanup, handleUsersNames } from './router.js'
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

  it('for=queue rejects downloadForOthers-only requesters with 401', async () => {
    const ctx = makeCtx({ isAdmin: false, permissions: { downloadForOthers: true } }, { for: 'queue' })

    await expect(handleUsersNames(ctx)).rejects.toMatchObject({ status: 401 })
    expect(User.get).not.toHaveBeenCalled()
  })

  it('for=download rejects queueForOthers-only requesters with 401', async () => {
    const ctx = makeCtx({ isAdmin: false, permissions: { queueForOthers: true } }, { for: 'download' })

    await expect(handleUsersNames(ctx)).rejects.toMatchObject({ status: 401 })
    expect(User.get).not.toHaveBeenCalled()
  })

  it('for=queue returns room users for queueForOthers holders', async () => {
    const sockets = [
      { userId: 1, roomId: 1 },
      { userId: 2, roomId: 1 },
    ]
    const ctx = makeCtx({ userId: 2, isAdmin: false, permissions: { queueForOthers: true } }, { for: 'queue', roomId: '1' }, sockets)

    await handleUsersNames(ctx)

    expect(ctx.body).toEqual([
      { userId: 1, username: 'admin', name: 'Admin' },
      { userId: 2, username: 'pepe', name: 'Pepe' },
    ])
  })

  it('rejects unknown for values with 422', async () => {
    const ctx = makeCtx({ isAdmin: true }, { for: 'both' })

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

describe('handleSwitchRoom', () => {
  const switchCtx = (body: Record<string, unknown> = {}, user: object = { ...rootAdmin, isAdmin: true }) => ({
    params: {},
    query: {},
    request: { body, headers: {} },
    body: undefined,
    status: 200,
    user,
    jwtKey: 'test-key',
    cookies: { set: vi.fn() },
    throw: (status: number, message?: string): never => {
      const err = new Error(message || String(status)) as Error & { status: number }
      err.status = status
      throw err
    },
  })

  it('switches an admin to another room, closed ones included', async () => {
    getByIdMock.mockReturnValue(rootAdmin)
    const ctx = switchCtx({ roomId: 2 })

    await handleSwitchRoom(ctx as never)

    expect(ctx.cookies.set).toHaveBeenCalledWith(
      'keToken', expect.any(String), { httpOnly: true, sameSite: 'lax' },
    )
    expect(ctx.body).toMatchObject({ userId: 1, roomId: 2 })
  })

  it('rejects non-admins without touching the cookie', async () => {
    const ctx = switchCtx({ roomId: 2 }, { userId: 2, isAdmin: false })

    await expect(handleSwitchRoom(ctx as never)).rejects.toMatchObject({ status: 401 })
    expect(ctx.cookies.set).not.toHaveBeenCalled()
  })

  it('rejects signed-out users, bad ids and unknown rooms', async () => {
    await expect(handleSwitchRoom(switchCtx({ roomId: 2 }, {}) as never))
      .rejects.toMatchObject({ status: 401 })
    await expect(handleSwitchRoom(switchCtx({ roomId: 'abc' }) as never))
      .rejects.toMatchObject({ status: 422 })

    getByIdMock.mockReturnValue(rootAdmin)
    await expect(handleSwitchRoom(switchCtx({ roomId: 9 }) as never))
      .rejects.toMatchObject({ status: 404 })
  })
})

const ghostEntities = {
  result: [1, 2, 3, 4],
  entities: {
    1: { userId: 1, username: 'admin', name: 'Admin', permissions: {}, role: 'admin' },
    2: { userId: 2, username: 'mgr', name: 'Manager', permissions: { ghostUsers: true }, role: 'standard' },
    3: { userId: 3, username: 'ghost-aaa11', name: 'Ana', permissions: {}, role: 'ghost', createdBy: 2 },
    4: { userId: 4, username: 'ghost-bbb22', name: 'Beto', permissions: {}, role: 'ghost', createdBy: 1 },
  },
}

describe('handleUsersNames ghosts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('appends the requester\'s own ghosts with ?ghosts=1', async () => {
    vi.mocked(User.get).mockReturnValueOnce(ghostEntities as never)
    const ctx = makeCtx({ userId: 2, isAdmin: false, permissions: { ghostUsers: true } }, { ghosts: '1' })

    await handleUsersNames(ctx)

    expect(ctx.body).toEqual([
      { userId: 3, username: 'ghost-aaa11', name: 'Ana', isGhost: true },
    ])
  })

  it('does not leak ghosts to downloadForOthers-only users', async () => {
    vi.mocked(User.get).mockReturnValueOnce(ghostEntities as never)
    const ctx = makeCtx({ userId: 1, isAdmin: false, permissions: { downloadForOthers: true } }, { ghosts: '1' })

    await handleUsersNames(ctx)

    expect(ctx.body).toEqual([
      { userId: 1, username: 'admin', name: 'Admin' },
      { userId: 2, username: 'mgr', name: 'Manager' },
    ])
  })

  it('lets admins append their own ghosts, never others\'', async () => {
    vi.mocked(User.get).mockReturnValueOnce(ghostEntities as never)
    const ctx = makeCtx({ userId: 1, isAdmin: true }, { ghosts: '1' })

    await handleUsersNames(ctx)

    expect(ctx.body).toEqual([
      { userId: 1, username: 'admin', name: 'Admin' },
      { userId: 2, username: 'mgr', name: 'Manager' },
      { userId: 4, username: 'ghost-bbb22', name: 'Beto', isGhost: true },
    ])
  })

  it('returns nothing for ghost managers without the ghosts param', async () => {
    vi.mocked(User.get).mockReturnValueOnce(ghostEntities as never)
    const ctx = makeCtx({ userId: 2, isAdmin: false, permissions: { ghostUsers: true } }, {})

    await handleUsersNames(ctx)

    expect(ctx.body).toEqual([])
  })

  it('hides room users from ghost managers with downloadForOthers using ?for=queue', async () => {
    vi.mocked(User.get).mockReturnValueOnce(ghostEntities as never)
    const sockets = [
      { userId: 1, roomId: 1 },
      { userId: 2, roomId: 1 },
    ]
    const ctx = makeCtx(
      { userId: 2, isAdmin: false, permissions: { ghostUsers: true, downloadForOthers: true } },
      { for: 'queue', roomId: '1', ghosts: '1' },
      sockets,
    )

    await handleUsersNames(ctx)

    expect(ctx.body).toEqual([
      { userId: 3, username: 'ghost-aaa11', name: 'Ana', isGhost: true },
    ])
  })

  it('ignores ?ghosts=1 for the download intent', async () => {
    vi.mocked(User.get).mockReturnValueOnce(ghostEntities as never)
    const sockets = [{ userId: 1, roomId: 1 }]
    const ctx = makeCtx(
      { userId: 2, isAdmin: false, permissions: { ghostUsers: true, downloadForOthers: true } },
      { for: 'download', roomId: '1', ghosts: '1' },
      sockets,
    )

    await handleUsersNames(ctx)

    expect(ctx.body).toEqual([
      { userId: 1, username: 'admin', name: 'Admin' },
    ])
  })
})

describe('GET /users (ghost managers)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows managers only their own ghosts', async () => {
    vi.mocked(User.get).mockReturnValueOnce(ghostEntities as never)
    const ctx = routeCtx('GET', '/api/users', {}, { userId: 2, isAdmin: false, permissions: { ghostUsers: true } })

    await dispatch(ctx, () => {})

    expect(ctx.body).toMatchObject({
      result: [3],
      entities: {
        3: { userId: 3, username: 'ghost-aaa11', name: 'Ana', role: 'ghost', createdBy: 2 },
      },
    })
  })

  it('rejects users without ghostUsers or admin', async () => {
    const ctx = routeCtx('GET', '/api/users', {}, { userId: 2, isAdmin: false, permissions: {} })

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 401 })
  })

  it('shows admins everyone', async () => {
    const ctx = routeCtx('GET', '/api/users', {}, { ...rootAdmin, isAdmin: true })

    await dispatch(ctx, () => {})

    expect(ctx.body).toMatchObject({ result: [1, 2] })
  })
})

describe('PUT ghost rules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lets a manager rename their own ghost, ignoring username and password', async () => {
    getByIdMock.mockImplementation((id: number) => {
      if (id === 2) return { userId: 2, username: 'mgr', name: 'Mgr', role: 'standard', password: 'x', permissions: { ghostUsers: true } }
      if (id === 3) return { userId: 3, username: 'ghost-aaa11', name: 'Ana', role: 'ghost', createdBy: 2, permissions: {} }
      return false
    })
    const db = (await import('../lib/Database.js')).db
    const crypto = (await import('../lib/crypto.js')).default
    const ctx = routeCtx('PUT', '/api/user/3', { name: 'Nuevo', username: 'hacked', newPassword: 'abcdef12' }, { userId: 2, isAdmin: false, permissions: { ghostUsers: true } })

    await dispatch(ctx, () => {})

    expect(ctx.status).toBe(200)
    expect(ctx.body).toEqual({})
    expect(vi.mocked(crypto.hash)).not.toHaveBeenCalled()
    const [queryString] = vi.mocked(db.run).mock.calls.at(-1)!
    expect(queryString).toContain('"name"')
    expect(queryString).not.toContain('username')
  })

  it('refuses turning a user into a ghost', async () => {
    getByIdMock.mockImplementation((id: number) => (
      id === 1 ? rootAdmin : { ...rootAdmin, userId: 2, username: 'pepe', role: 'standard' }
    ))
    const ctx = routeCtx('PUT', '/api/user/2', { role: 'ghost' })

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 403 })
  })

  it('unlinks the creator when a ghost leaves the role', async () => {
    getByIdMock.mockImplementation((id: number) => (
      id === 1 ? rootAdmin : { userId: 3, username: 'ghost-aaa11', name: 'Ana', role: 'ghost', createdBy: 1, permissions: {} }
    ))
    const db = (await import('../lib/Database.js')).db
    const ctx = routeCtx('PUT', '/api/user/3', { role: 'standard' })

    await dispatch(ctx, () => {})

    const [queryString] = vi.mocked(db.run).mock.calls.at(-1)!
    expect(queryString).toContain('createdBy')
  })

  it('removes a manager\'s ghosts when ghostUsers is revoked', async () => {
    getByIdMock.mockImplementation((id: number) => {
      if (id === 1) return rootAdmin
      return { userId: 2, username: 'pepe', name: 'Pepe', role: 'standard', permissions: {} }
    })
    const User = (await import('./User.js')).default
    const ctx = routeCtx('PUT', '/api/user/2', { permissions: {} })

    await dispatch(ctx, () => {})

    expect(vi.mocked(User.removeGhostsByCreator)).toHaveBeenCalledWith(2)
  })

  it('keeps ghosts when the manager still has ghostUsers', async () => {
    getByIdMock.mockImplementation((id: number) => {
      if (id === 1) return rootAdmin
      return { userId: 2, username: 'pepe', name: 'Pepe', role: 'standard', permissions: { ghostUsers: true } }
    })
    const User = (await import('./User.js')).default
    const ctx = routeCtx('PUT', '/api/user/2', { permissions: { ghostUsers: true } })

    await dispatch(ctx, () => {})

    expect(vi.mocked(User.removeGhostsByCreator)).not.toHaveBeenCalled()
  })
})

describe('DELETE ghost rules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lets a manager delete their own ghost', async () => {
    getByIdMock.mockImplementation((id: number) => {
      if (id === 2) return { userId: 2, username: 'mgr', name: 'Mgr', role: 'standard', permissions: { ghostUsers: true } }
      if (id === 3) return { userId: 3, username: 'ghost-aaa11', name: 'Ana', role: 'ghost', createdBy: 2, permissions: {} }
      return false
    })
    const User = (await import('./User.js')).default
    const ctx = routeCtx('DELETE', '/api/user/3', {}, { userId: 2, isAdmin: false, permissions: { ghostUsers: true } })

    await dispatch(ctx, () => {})

    expect(vi.mocked(User.remove)).toHaveBeenCalledWith(3)
    expect(ctx.status).toBe(200)
  })

  it('rejects a manager deleting a ghost they do not own', async () => {
    getByIdMock.mockImplementation((id: number) => {
      if (id === 2) return { userId: 2, username: 'mgr', role: 'standard', permissions: { ghostUsers: true } }
      if (id === 3) return { userId: 3, username: 'ghost-aaa11', role: 'ghost', createdBy: 99, permissions: {} }
      return false
    })
    const ctx = routeCtx('DELETE', '/api/user/3', {}, { userId: 2, isAdmin: false, permissions: { ghostUsers: true } })

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 403 })
  })

  it('lets an admin delete another user (cascading their ghosts)', async () => {
    getByIdMock.mockImplementation((id: number) => (
      id === 1 ? rootAdmin : { ...rootAdmin, userId: 2, username: 'pepe', role: 'standard', permissions: {} }
    ))
    const User = (await import('./User.js')).default
    const ctx = routeCtx('DELETE', '/api/user/2', {}, { ...rootAdmin, isAdmin: true })

    await dispatch(ctx, () => {})

    expect(vi.mocked(User.remove)).toHaveBeenCalledWith(2)
    expect(ctx.status).toBe(200)
  })
})

describe('POST ghost creation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lets a signed-in manager create their own ghost', async () => {
    const User = (await import('./User.js')).default
    vi.mocked(User.create).mockResolvedValueOnce(99)
    const ctx = routeCtx('POST', '/api/user', { role: 'ghost', name: 'Ana' }, { userId: 2, isAdmin: false, permissions: { ghostUsers: true } })

    await dispatch(ctx, () => {})

    expect(vi.mocked(User.create)).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: 2, permissions: undefined, name: 'Ana' }),
      'ghost',
      'en',
    )
    expect(ctx.status).toBe(200)
    expect(ctx.body).toEqual({})
  })

  it('ties admin-created ghosts to the admin', async () => {
    const User = (await import('./User.js')).default
    vi.mocked(User.create).mockResolvedValueOnce(99)
    const ctx = routeCtx('POST', '/api/user', { role: 'ghost', name: 'Ana' }, { ...rootAdmin, isAdmin: true })

    await dispatch(ctx, () => {})

    expect(vi.mocked(User.create)).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: 1 }),
      'ghost',
      'en',
    )
    expect(ctx.status).toBe(200)
  })

  it('rejects ghost creation without ghostUsers', async () => {
    const ctx = routeCtx('POST', '/api/user', { role: 'ghost', name: 'Ana' }, { userId: 2, isAdmin: false, permissions: {} })

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 401 })
  })

  it('rejects signed-out ghost creation', async () => {
    const ctx = routeCtx('POST', '/api/user', { role: 'ghost', name: 'Ana' }, { userId: null, isAdmin: false, permissions: {} })

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 401 })
  })
})

describe('ghost image access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lets the creator fetch their ghost\'s image', async () => {
    getByIdMock.mockImplementation((id: number) => {
      if (id === 3) return { userId: 3, image: Buffer.from('jpeg'), role: 'ghost', createdBy: 2 }
      return false
    })
    const ctx = routeCtx('GET', '/api/user/3/image', {}, { userId: 2, isAdmin: false, permissions: {} })
    ctx.params = { userId: '3' }

    await dispatch(ctx, () => {})

    expect(ctx.status).toBe(200)
  })

  it('rejects strangers even with the ghostUsers permission', async () => {
    getByIdMock.mockImplementation((id: number) => {
      if (id === 3) return { userId: 3, image: Buffer.from('jpeg'), role: 'ghost', createdBy: 99 }
      return false
    })
    const ctx = routeCtx('GET', '/api/user/3/image', {}, { userId: 2, isAdmin: false, permissions: { ghostUsers: true } })
    ctx.params = { userId: '3' }

    await expect(dispatch(ctx, () => {})).rejects.toMatchObject({ status: 403 })
  })
})

describe('handleUsersCleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects non-admins with 401', async () => {
    const ctx = makeCtx({ isAdmin: false, userId: 5, username: 'tester' })

    await expect(handleUsersCleanup(ctx as never)).rejects.toMatchObject({ status: 401 })
  })

  it('removes every guest and ghost, disconnects their sockets and answers with an empty object', async () => {
    vi.mocked(User.getGuestAndGhostIds).mockReturnValue([10, 11, 12])

    const disconnect = vi.fn()
    const sockets = [
      { user: { userId: 11, roomId: 1 }, disconnect },
      { user: { userId: 99, roomId: 1 }, disconnect },
    ]
    const ctx = {
      ...makeCtx({ isAdmin: true, userId: 1, username: 'admin', name: 'Admin' }),
      io: { fetchSockets: async () => sockets },
    }

    await handleUsersCleanup(ctx as never)

    expect(vi.mocked(User.getGuestAndGhostIds)).toHaveBeenCalledTimes(1)
    expect(User.remove).toHaveBeenCalledTimes(3)
    expect(User.remove).toHaveBeenNthCalledWith(1, 10)
    expect(User.remove).toHaveBeenNthCalledWith(2, 11)
    expect(User.remove).toHaveBeenNthCalledWith(3, 12)
    // only the removed user's socket is dropped
    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(disconnect).toHaveBeenCalledWith()
    expect(ctx.body).toEqual({})
    expect(ctx.status).toBe(200)
  })
})
