import { promisify } from 'util'
import fs from 'fs'
import { db } from '../lib/Database.js'
import sql from 'sqlate'
import jsonWebToken from 'jsonwebtoken'
import crypto from '../lib/crypto.js'
import { can, parsePermissions } from '../lib/permissions.js'
import { checkLoginRateLimit, clearLoginAttempts, getClientIp, recordLoginFailure } from '../lib/loginRateLimit.js'
import KoaRouter from '@koa/router'
import Prefs from '../Prefs/Prefs.js'
import Queue from '../Queue/Queue.js'
import Rooms from '../Rooms/Rooms.js'
import { STATUSES } from '../Rooms/Rooms.js'
import User from '../User/User.js'
import { QUEUE_PUSH } from '../../shared/actionTypes.js'
import {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
  IMG_MAX_LENGTH,
} from './User.js'
import { parseIdParam } from '../lib/http.js'
import { ctxLocale, t } from '../lib/locale.js'
import { requireSameOrigin } from '../lib/http.js'
import type { HttpContext } from '../lib/http.js'

interface File {
  filepath: string
  size: number
}

interface RequestWithBody {
  body: Record<string, unknown>
  files?: Record<string, File | File[]>
}

// JSON body shape sent by the client (koa-body); unknown fields ignored
interface UserBody {
  username?: string
  password?: string
  newPassword?: string
  newPasswordConfirm?: string
  name?: string
  image?: string | null
  role?: string
  roomId?: string
  roomPassword?: string
  permissions?: Record<string, boolean>
}

const router = new KoaRouter({ prefix: '/api' })
const readFile = promisify(fs.readFile)
const deleteFile = promisify(fs.unlink)
const { sign: jwtSign } = jsonWebToken

// session lifetime: long enough for multi-day parties, short enough that
// a stolen cookie eventually dies (the client drops its session on 401)
const JWT_EXPIRES_IN = '30d'

const signToken = (userCtx: object, jwtKey: string): string => (
  jwtSign(userCtx, jwtKey, { expiresIn: JWT_EXPIRES_IN })
)

export interface RouterContext {
  user: { isAdmin: boolean, userId?: number, username?: string, name?: string, roomId?: number | null, permissions?: Record<string, boolean> } | undefined
  params: Record<string, string>
  query: Record<string, string | undefined>
  request: { body: Record<string, unknown>, headers?: Record<string, string | string[] | undefined> }
  body: unknown
  status: number
  throw: (status: number, message?: string) => never
  set: (field: string, value: string) => void
  ip?: string
  jwtKey: string
  cookies: { set: (name: string, value: string, opts?: Record<string, unknown>) => void }
}

// Takes the "raw" object returned by the User class and massages it
// into the shape used by the client (state.user) and in server-side
// routers. Should be used to generate the JWT.
const createUserCtx = (user, roomId) => {
  return {
    dateCreated: user.dateCreated,
    dateUpdated: user.dateUpdated,
    isAdmin: user.role === 'admin',
    isGuest: user.role === 'guest',
    name: user.name,
    permissions: parsePermissions(user.permissions) ?? {},
    roomId: parseInt(roomId, 10) || null,
    userId: user.userId,
    username: user.username,
  }
}

// login
export async function handleLogin (ctx: RouterContext): Promise<void> {
  const req = ctx.request as unknown as RequestWithBody
  const body = req.body as UserBody
  const roomId = parseInt(body.roomId ?? '', 10) || null
  let user

  // brute-force protection counts credential failures only (room typos
  // must not lock anyone out)
  const ip = getClientIp(ctx.request.headers?.['x-forwarded-for'], ctx.ip)
  const limit = checkLoginRateLimit(ip)

  if (limit.limited) {
    ctx.set('Retry-After', String(limit.retryAfterSec))
    ctx.throw(429, t(ctxLocale(ctx), 'server.auth.tooManyAttempts', 'Too many login attempts'))
  }

  try {
    user = await User.validate(body as { username: string, password: string }, ctxLocale(ctx))
  } catch (err) {
    recordLoginFailure(ip)
    ctx.throw(401, err.message)
  }

  try {
    if (roomId) {
      await Rooms.validate(roomId, body.roomPassword, {
        isOpen: user.role !== 'admin', // admins can sign in to closed rooms
        // admins can also skip the room password with their own password
        validatePassword: user.role !== 'admin',
        locale: ctxLocale(ctx),
      })
    } else if (user.role !== 'admin') {
      ctx.throw(401, t(ctxLocale(ctx), 'server.auth.selectRoom', 'Please select a room'))
    }
  } catch (err) {
    ctx.throw(401, err.message)
  }

  clearLoginAttempts(ip)

  if (crypto.isLegacy(user.password)) {
    const newHash = await crypto.hash(body.password as string)
    const query = sql`
      UPDATE users
      SET password = ${newHash}, dateUpdated = ${Math.floor(Date.now() / 1000)}
      WHERE userId = ${user.userId}
    `
    db.run(String(query), query.parameters)
  }

  const userCtx = createUserCtx(user, roomId)

  // create JWT
  const token = signToken(userCtx, ctx.jwtKey)

  // set JWT as an httpOnly cookie
  ctx.cookies.set('keToken', token, {
    httpOnly: true,
    sameSite: 'lax',
  })

  ctx.body = userCtx
}

router.post('/login', ctx => handleLogin(ctx as unknown as RouterContext))

// logout
router.get('/logout', (ctx) => {
  requireSameOrigin(ctx as unknown as HttpContext)
  // @todo force socket room leave
  ctx.cookies.set('keToken', '')
  ctx.status = 200
  ctx.body = {}
})

// switch rooms without logging out (admin only): closed rooms and room
// passwords are bypassed, exactly like an admin login
export async function handleSwitchRoom (ctx: RouterContext): Promise<void> {
  if (ctx.user?.userId == null) ctx.throw(401)
  if (!ctx.user.isAdmin) {
    ctx.throw(401, t(ctxLocale(ctx), 'server.common.unauthorized', 'Unauthorized'))
  }

  const req = ctx.request as unknown as RequestWithBody
  const roomId = parseInt(String(req.body?.roomId ?? ''), 10) || null

  if (roomId === null) {
    ctx.throw(422, t(ctxLocale(ctx), 'server.users.invalidRoomId', 'Invalid roomId'))
  }

  const rooms = Rooms.get(roomId, { status: STATUSES })

  if (!rooms.entities[roomId]) {
    ctx.throw(404, t(ctxLocale(ctx), 'server.rooms.notFound', 'Room not found'))
  }

  const user = User.getById(ctx.user.userId)

  if (!user) ctx.throw(401)

  const userCtx = createUserCtx(user, roomId)

  ctx.cookies.set('keToken', signToken(userCtx, ctx.jwtKey), {
    httpOnly: true,
    sameSite: 'lax',
  })
  ctx.body = userCtx
}

router.post('/room', ctx => handleSwitchRoom(ctx as unknown as RouterContext))

router.post('/room', ctx => handleSwitchRoom(ctx as unknown as RouterContext))

// get own account (helps sync account changes across devices)
router.get('/user', (ctx) => {
  if (typeof ctx.user.userId !== 'number') {
    ctx.throw(401)
  }

  // include credentials since their username may have changed
  const user = User.getById(ctx.user.userId, true)

  if (!user) {
    ctx.throw(404)
  }

  ctx.body = createUserCtx(user, ctx.user.roomId)
})

// list users (admins see everyone; ghost managers only their own ghosts)
router.get('/users', async (ctx) => {
  if (!ctx.user.isAdmin && !can(ctx.user, 'ghostUsers')) {
    ctx.throw(401)
  }

  const userRooms = {} // { userId: [roomId, roomId, ...]}
  const sockets = await ctx.io.fetchSockets()

  for (const s of sockets) {
    if (s.user && typeof s.user.roomId === 'number') {
      if (userRooms[s.user.userId]) {
        userRooms[s.user.userId].push(s.user.roomId)
      } else {
        userRooms[s.user.userId] = [s.user.roomId]
      }
    }
  }

  // get all users
  const users = User.get()

  users.result.forEach((userId) => {
    users.entities[userId].rooms = userRooms[userId] || []
  })

  // non-admin ghost managers only see their own ghosts (not even
  // themselves)
  if (!ctx.user.isAdmin) {
    const own = users.result.filter(userId => (
      users.entities[userId].role === 'ghost'
      && users.entities[userId].createdBy === ctx.user.userId
    ))
    const entities = Object.fromEntries(own.map(userId => [userId, users.entities[userId]]))

    ctx.body = { result: own, entities }
    return
  }

  ctx.body = users
})

// slim user list for download/queue targeting (admins, downloadForOthers,
// queueForOthers or ghostUsers holders); optionally filtered by live room
// presence like the user management. ?for=queue|download tells which action
// feeds the list, so room users require exactly that capability (this
// endpoint backs both pickers); without it either capability passes.
// ?ghosts=1 appends the requester's own ghost users (never in a room) and
// is ignored for the download intent.
export async function handleUsersNames (ctx) {
  const intent = ctx.query.for === undefined ? null : String(ctx.query.for)

  if (intent !== null && intent !== 'queue' && intent !== 'download') {
    ctx.throw(422)
  }

  let canTargetRoom: boolean

  if (intent === 'queue') {
    canTargetRoom = can(ctx.user, 'queueForOthers')
  } else if (intent === 'download') {
    canTargetRoom = can(ctx.user, 'downloadForOthers')
  } else {
    canTargetRoom = can(ctx.user, 'downloadForOthers') || can(ctx.user, 'queueForOthers')
  }

  const isRoomTargeter = ctx.user.isAdmin || canTargetRoom
  const isGhostManager = can(ctx.user, 'ghostUsers')

  if (!isRoomTargeter && !isGhostManager) {
    ctx.throw(401)
  }

  const roomId = ctx.query.roomId === undefined ? null : parseInt(ctx.query.roomId, 10)
  const onlineOnly = ctx.query.online !== undefined && ctx.query.online !== 'false' && ctx.query.online !== '0'
  const withGhosts = ctx.query.ghosts !== undefined && ctx.query.ghosts !== 'false' && ctx.query.ghosts !== '0' && intent !== 'download'

  if (ctx.query.roomId !== undefined && (roomId === null || Number.isNaN(roomId))) {
    ctx.throw(422, t(ctxLocale(ctx), 'server.users.invalidRoomId', 'Invalid roomId'))
  }

  const userRooms: Record<number, number[]> = {}
  const sockets = await ctx.io.fetchSockets()

  for (const s of sockets) {
    if (s.user && typeof s.user.roomId === 'number') {
      if (userRooms[s.user.userId]) {
        userRooms[s.user.userId].push(s.user.roomId)
      } else {
        userRooms[s.user.userId] = [s.user.roomId]
      }
    }
  }

  const users = User.get()
  const result: Array<{ userId: number, username: string, name: string, isGhost?: boolean }> = []

  if (isRoomTargeter) {
    for (const userId of users.result) {
      const entity = users.entities[userId]

      // ghosts are handled below, they are never in a room
      if (entity.role === 'ghost') continue
      if (roomId !== null && !(userRooms[userId] ?? []).includes(roomId)) continue
      if (onlineOnly && !(userRooms[userId] ?? []).length) continue

      result.push({ userId: entity.userId, username: entity.username, name: entity.name })
    }
  }

  // own ghosts always apply to the creator (even admins only ever queue
  // for their own ghosts) and are never room-filtered
  if (isGhostManager && withGhosts) {
    for (const userId of users.result) {
      const entity = users.entities[userId]

      if (entity.role !== 'ghost' || entity.createdBy !== ctx.user.userId) continue

      result.push({ userId: entity.userId, username: entity.username, name: entity.name, isGhost: true })
    }
  }

  ctx.body = result
}

router.get('/users/names', handleUsersNames)

// delete a user (admins anyone but themselves; ghost managers their own
// ghosts)
router.delete('/user/:userId', async (ctx) => {
  const targetId = parseIdParam(ctx, 'userId')

  if (targetId === ctx.user.userId) {
    ctx.throw(403)
  }

  const target = User.getById(targetId)

  // admin, or the creator removing one of their own ghosts
  const isOwnGhost = target && target.role === 'ghost' && target.createdBy === ctx.user.userId

  if (!ctx.user.isAdmin && !isOwnGhost) {
    ctx.throw(403)
  }

  if (target && target.role === 'admin' && User.countAdmins() <= 1) {
    ctx.throw(403, t(ctxLocale(ctx), 'server.users.lastAdminDelete', 'Cannot delete the last admin'))
  }

  User.remove(targetId)

  // disconnect their socket session(s)
  const sockets = await ctx.io.fetchSockets()

  for (const s of sockets) {
    if (s?.user?.userId === targetId) {
      s.disconnect()
    }
  }

  // emit (potentially) updated queues to each room
  for (const { room, roomId } of Rooms.getActive(ctx.io)) {
    ctx.io.to(room).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(roomId),
    })
  }

  // success
  ctx.status = 200
  ctx.body = {}
})

// update a user account
router.put('/user/:userId', async (ctx) => {
  const targetId = parseIdParam(ctx, 'userId')
  const user = User.getById(ctx.user.userId, true)

  if (!user) {
    ctx.throw(401)
    return
  }

  // must be admin if updating another user, unless it's one of the
  // requester's own ghosts (managers only touch name and image there)
  let isOwnGhostEdit = false

  if (targetId !== user.userId && user.role !== 'admin') {
    const target = User.getById(targetId)

    if (!target || target.role !== 'ghost' || target.createdBy !== user.userId) {
      ctx.throw(401)
      return
    }

    isOwnGhostEdit = true
  }

  const req = ctx.request as unknown as RequestWithBody
  const body = req.body as UserBody
  let { name, username } = body
  const { password, newPassword, newPasswordConfirm } = body

  // validate current password if updating own account
  if (targetId === user.userId && !ctx.user.isGuest) {
    if (!password) {
      ctx.throw(422, t(ctxLocale(ctx), 'server.users.currentPasswordRequired', 'Current password is required'))
    }

    if (!(await crypto.compare(password, user.password))) {
      ctx.throw(401, t(ctxLocale(ctx), 'server.users.incorrectCurrentPassword', 'Incorrect current password'))
    }
  }

  // validated
  const fields = new Map()

  // changing username? (managers can't touch their ghosts' usernames)
  if (username && !ctx.user.isGuest && !isOwnGhostEdit) {
    username = username.trim()

    if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
      ctx.throw(400, t(
        ctxLocale(ctx), 'server.users.usernameLength',
        'Username must have {min}-{max} characters',
        { min: USERNAME_MIN_LENGTH, max: USERNAME_MAX_LENGTH },
      ))
    }

    // check for duplicate
    if (User.getByUsername(username)) {
      ctx.throw(409, t(ctxLocale(ctx), 'server.users.usernameTaken', 'Username is not available'))
    }

    fields.set('username', username)
  }

  // changing display name?
  if (name) {
    name = name.trim()

    if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
      ctx.throw(400, t(
        ctxLocale(ctx), 'server.users.displayNameLength',
        'Display name must have {min}-{max} characters',
        { min: NAME_MIN_LENGTH, max: NAME_MAX_LENGTH },
      ))
    }

    fields.set('name', name)
  }

  // changing password? (managers can't set their ghosts' passwords)
  if (newPassword && !ctx.user.isGuest && !isOwnGhostEdit) {
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      ctx.throw(400, t(
        ctxLocale(ctx), 'server.users.passwordLength',
        'Password must have at least {min} characters',
        { min: PASSWORD_MIN_LENGTH },
      ))
    }

    if (newPassword !== newPasswordConfirm) {
      ctx.throw(422, t(ctxLocale(ctx), 'server.users.passwordMismatch', 'New passwords do not match'))
    }

    fields.set('password', await crypto.hash(newPassword))
  }

  // changing user image?
  if (req.files && req.files.image) {
    const imageFile = Array.isArray(req.files.image) ? req.files.image[0] : req.files.image

    if (imageFile.size > IMG_MAX_LENGTH) {
      await deleteFile(imageFile.filepath)
      ctx.throw(413, t(
        ctxLocale(ctx), 'server.users.imageTooLarge',
        'Image must not exceed {kb}KB',
        { kb: Math.floor(IMG_MAX_LENGTH / 1024) },
      ))
    }

    fields.set('image', await readFile(imageFile.filepath))
    await deleteFile(imageFile.filepath)
  } else if (body.image === 'null') {
    fields.set('image', null)
  }

  // changing role?
  if (typeof body.role === 'string' && body.role) {
    // never strand the system without admins (one's own role is
    // already disallowed above)
    if (user.role !== 'admin' || targetId === user.userId) {
      ctx.throw(403)
    }

    const target = User.getById(targetId)

    // a user cannot be turned into a ghost (like a guest)
    if (body.role === 'ghost' && target?.role !== 'ghost') {
      ctx.throw(403, t(ctxLocale(ctx), 'server.users.becomeGhost', 'A user cannot become a ghost'))
    }

    // leaving the ghost role unlinks the creator
    if (target?.role === 'ghost' && body.role !== 'ghost') {
      fields.set('createdBy', null)
    }

    if (body.role !== 'admin') {
      if (target && target.role === 'admin' && User.countAdmins() <= 1) {
        ctx.throw(403, t(ctxLocale(ctx), 'server.users.lastAdminDemote', 'Cannot demote the last admin'))
      }
    }

    fields.set('roleId', sql`(SELECT roleId FROM roles WHERE name = ${body.role})`)
  }

  // changing permissions? (admins only, and never one's own: admins
  // bypass permission checks anyway)
  if (body.permissions) {
    if (user.role !== 'admin' || targetId === user.userId) {
      ctx.throw(403)
    }

    // ghosts never have permissions
    if (body.role !== 'ghost') {
      const perms = parsePermissions(body.permissions)

      if (perms) {
        fields.set('permissions', JSON.stringify(perms))
      }
    }
  }

  fields.set('dateUpdated', Math.floor(Date.now() / 1000))

  const query = sql`
    UPDATE users
    SET ${sql.tuple(Array.from(fields.keys()).map(sql.column))} = ${sql.tuple(Array.from(fields.values()))}
    WHERE userId = ${targetId}
  `
  const res = db.run(String(query), query.parameters)

  if (!res.changes) {
    ctx.throw(404, t(ctxLocale(ctx), 'server.users.userNotFound', 'userId {userId} not found', { userId: targetId }))
  }

  // lost the ghostUsers capability (role/permission change)? their
  // ghosts cannot outlive it
  const updated = User.getById(targetId)

  if (updated) {
    const stillAllowed = updated.role === 'admin'
      || (parsePermissions(updated.permissions)?.ghostUsers ?? false)

    if (!stillAllowed) {
      User.removeGhostsByCreator(targetId)
    }
  }

  // emit (potentially) updated queues to each room
  // @todo: only update rooms the user is in
  for (const { room, roomId } of Rooms.getActive(ctx.io)) {
    ctx.io.to(room).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(roomId),
    })
  }

  // updating another account? we're done
  if (targetId !== user.userId) {
    ctx.status = 200
    ctx.body = {}
    return
  }

  // updating own account: send updated token
  let updatedUser

  if (user.role !== 'guest') {
    try {
      updatedUser = await User.validate({
        username: username || user.username,
        password: newPassword || password,
      }, ctxLocale(ctx))
    } catch (err) {
      ctx.throw(401, err.message)
    }
  } else {
    updatedUser = {
      ...user,
      name: name || user.name,
    }
  }

  const userCtx = createUserCtx(updatedUser, ctx.user.roomId || null)

  // create JWT (fresh expiry on profile change: activity renews the session)
  const token = signToken(userCtx, ctx.jwtKey)

  // set JWT as an httpOnly cookie
  ctx.cookies.set('keToken', token, {
    sameSite: 'lax',
    httpOnly: true,
  })

  ctx.body = userCtx
})

// create account
router.post('/user', async (ctx) => {
  const req = ctx.request as unknown as RequestWithBody
  const body = req.body as UserBody
  let image

  if (!ctx.user.isAdmin) {
    if (body.role === 'ghost') {
      // signed-in ghost managers create their own ghosts (no room needed)
      if (ctx.user.userId == null || !can(ctx.user, 'ghostUsers')) {
        ctx.throw(401)
      }
    } else {
      // already signed in?
      if (ctx.user.userId !== null && ctx.user.userId !== undefined) {
        ctx.throw(401, t(ctxLocale(ctx), 'server.users.alreadySignedIn', 'You are already signed in'))
      }

      // only possible roles; further validated per-room below
      if (typeof body.role !== 'string' || !['guest', 'standard'].includes(body.role)) {
        ctx.throw(401, t(ctxLocale(ctx), 'server.users.invalidRole', 'Invalid role'))
      }

      // new users must choose a room at the same time
      try {
        await Rooms.validate(
          parseInt(body.roomId ?? '', 10),
          body.roomPassword,
          { role: body.role, locale: ctxLocale(ctx) },
        )
      } catch (err) {
        ctx.throw(401, err.message)
      }
    }
  }

  if (req.files && req.files.image) {
    const imageFile = Array.isArray(req.files.image) ? req.files.image[0] : req.files.image

    if (imageFile.size > IMG_MAX_LENGTH) {
      await deleteFile(imageFile.filepath)
      ctx.throw(413, t(
        ctxLocale(ctx), 'server.users.imageTooLarge',
        'Image must not exceed {kb}KB',
        { kb: Math.floor(IMG_MAX_LENGTH / 1024) },
      ))
    }

    image = await readFile(imageFile.filepath)
    await deleteFile(imageFile.filepath)
  }

  // create user (only admins may preset permissions; ghosts are always
  // tied to their creator)
  try {
    const userId = await User.create({
      ...body,
      permissions: ctx.user.isAdmin ? body.permissions : undefined,
      image,
      createdBy: body.role === 'ghost' ? ctx.user.userId : undefined,
    }, body.role, ctxLocale(ctx))

    // if creating another user (admin or ghost manager), we're done
    if (ctx.user.isAdmin || body.role === 'ghost') {
      ctx.status = 200
      ctx.body = {}
      return
    }

    const user = User.getById(userId, true)

    if (!user) {
      throw new Error('User not found')
    }

    const userCtx = createUserCtx(user, body.roomId || null)

    // create JWT
    const token = signToken(userCtx, ctx.jwtKey)

    // set JWT as an httpOnly cookie
    ctx.cookies.set('keToken', token, {
      sameSite: 'lax',
      httpOnly: true,
    })

    ctx.body = userCtx
  } catch (err) {
    ctx.throw(403, err.message)
  }
})

// first-time setup
router.post('/setup', async (ctx) => {
  const prefs = Prefs.get() as Record<string, unknown>
  let image

  // must be first run
  if (prefs.isFirstRun !== true) {
    ctx.throw(403)
  }

  try {
    // create admin user
    const req = ctx.request as unknown as RequestWithBody
    const userId = await User.create({ ...req.body as UserBody, image }, 'admin', ctxLocale(ctx))
    const user = User.getById(userId, true)

    if (!user) {
      throw new Error('User not found')
    }

    // create default room
    const fields = new Map()
    fields.set('name', 'Room 1')
    fields.set('status', 'open')
    fields.set('dateCreated', Math.floor(Date.now() / 1000))

    const roomQuery = sql`
      INSERT INTO rooms ${sql.tuple(Array.from(fields.keys()).map(sql.column))}
      VALUES ${sql.tuple(Array.from(fields.values()))}
    `
    const roomRes = db.run(String(roomQuery), roomQuery.parameters)

    if (typeof roomRes.lastID !== 'number') {
      ctx.throw(500, t(ctxLocale(ctx), 'server.users.defaultRoomFailed', 'Invalid default room lastID'))
    }

    // create JWT
    const userCtx = createUserCtx(user, roomRes.lastID)
    const token = signToken(userCtx, ctx.jwtKey)

    // set JWT as an httpOnly cookie
    ctx.cookies.set('keToken', token, {
      sameSite: 'lax',
      httpOnly: true,
    })

    // unset isFirstRun
    const query = sql`
      UPDATE prefs
      SET data = 'false'
      WHERE key = 'isFirstRun'
    `
    db.run(String(query))

    // success
    ctx.body = userCtx
  } catch (err) {
    ctx.throw(403, err.message)
  }
})

// get a user's image
router.get('/user/:userId/image', (ctx) => {
  const targetId = parseInt(ctx.params.userId, 10)

  if (ctx.user.userId !== targetId && !ctx.user.isAdmin) {
    // the creator of a ghost can always see its image
    const target = User.getById(targetId)
    const isCreator = target && target.createdBy === ctx.user.userId

    // ensure target user has been in the same room
    if (!isCreator && !Rooms.hasUserBeenInRoom(ctx.user.roomId, targetId)) {
      ctx.throw(403)
    }
  }

  const user = User.getById(targetId)

  if (!user || !user.image) {
    ctx.throw(404)
    return
  }

  if (typeof ctx.query.v !== 'undefined') {
    // client can cache a versioned image forever
    ctx.set('Cache-Control', 'max-age=31536000') // 1 year
  }

  ctx.type = 'image/jpeg'
  ctx.body = Buffer.from(user.image)
})

export default router
