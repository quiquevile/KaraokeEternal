import { promisify } from 'util'
import fs from 'fs'
import { db } from '../lib/Database.js'
import sql from 'sqlate'
import jsonWebToken from 'jsonwebtoken'
import crypto from '../lib/crypto.js'
import { can, parsePermissions } from '../lib/permissions.js'
import KoaRouter from '@koa/router'
import Prefs from '../Prefs/Prefs.js'
import Queue from '../Queue/Queue.js'
import Rooms from '../Rooms/Rooms.js'
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
  user: { isAdmin: boolean, userId?: number, username?: string, roomId?: number | null } | undefined
  params: Record<string, string>
  query: Record<string, string | undefined>
  request: { body: Record<string, unknown> }
  body: unknown
  status: number
  throw: (status: number, message?: string) => never
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

  try {
    user = await User.validate(body as { username: string, password: string })

    if (roomId) {
      await Rooms.validate(roomId, body.roomPassword, {
        isOpen: user.role !== 'admin', // admins can sign in to closed rooms
        // admins can also skip the room password with their own password
        validatePassword: user.role !== 'admin',
      })
    } else if (user.role !== 'admin') {
      ctx.throw(401, 'Please select a room')
    }
  } catch (err) {
    ctx.throw(401, err.message)
  }

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
  // @todo force socket room leave
  ctx.cookies.set('keToken', '')
  ctx.status = 200
  ctx.body = {}
})

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

// list all users (admin only)
router.get('/users', async (ctx) => {
  if (!ctx.user.isAdmin) {
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

  ctx.body = users
})

// slim user list for download targeting (admins and downloadForOthers holders),
// optionally filtered by live room presence like the user management
export async function handleUsersNames (ctx) {
  if (!ctx.user.isAdmin && !can(ctx.user, 'downloadForOthers')) {
    ctx.throw(401)
  }

  const roomId = ctx.query.roomId === undefined ? null : parseInt(ctx.query.roomId, 10)
  const onlineOnly = ctx.query.online !== undefined && ctx.query.online !== 'false' && ctx.query.online !== '0'

  if (ctx.query.roomId !== undefined && (roomId === null || Number.isNaN(roomId))) {
    ctx.throw(422, 'Invalid roomId')
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

  ctx.body = users.result
    .filter(userId => (
      (roomId === null || (userRooms[userId] ?? []).includes(roomId))
      && (!onlineOnly || (userRooms[userId] ?? []).length > 0)
    ))
    .map((userId) => {
      const { userId: id, username, name } = users.entities[userId]

      return { userId: id, username, name }
    })
}

router.get('/users/names', handleUsersNames)

// delete a user (admin only)
router.delete('/user/:userId', async (ctx) => {
  const targetId = parseIdParam(ctx, 'userId')

  if (!ctx.user.isAdmin || targetId === ctx.user.userId) {
    ctx.throw(403)
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

  // must be admin if updating another user
  if (!user) {
    ctx.throw(401)
    return
  }

  if (targetId !== user.userId && user.role !== 'admin') {
    ctx.throw(401)
    return
  }

  const req = ctx.request as unknown as RequestWithBody
  const body = req.body as UserBody
  let { name, username } = body
  const { password, newPassword, newPasswordConfirm } = body

  // validate current password if updating own account
  if (targetId === user.userId && !ctx.user.isGuest) {
    if (!password) {
      ctx.throw(422, 'Current password is required')
    }

    if (!(await crypto.compare(password, user.password))) {
      ctx.throw(401, 'Incorrect current password')
    }
  }

  // validated
  const fields = new Map()

  // changing username?
  if (username && !ctx.user.isGuest) {
    username = username.trim()

    if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
      ctx.throw(400, `Username or email must have ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters`)
    }

    // check for duplicate
    if (User.getByUsername(username)) {
      ctx.throw(409, 'Username or email is not available')
    }

    fields.set('username', username)
  }

  // changing display name?
  if (name) {
    name = name.trim()

    if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
      ctx.throw(400, `Display name must have ${NAME_MIN_LENGTH}-${NAME_MAX_LENGTH} characters`)
    }

    fields.set('name', name)
  }

  // changing password?
  if (newPassword && !ctx.user.isGuest) {
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      ctx.throw(400, `Password must have at least ${PASSWORD_MIN_LENGTH} characters`)
    }

    if (newPassword !== newPasswordConfirm) {
      ctx.throw(422, 'New passwords do not match')
    }

    fields.set('password', await crypto.hash(newPassword))
  }

  // changing user image?
  if (req.files && req.files.image) {
    const imageFile = Array.isArray(req.files.image) ? req.files.image[0] : req.files.image

    if (imageFile.size > IMG_MAX_LENGTH) {
      await deleteFile(imageFile.filepath)
      ctx.throw(413, `Image must not exceed ${Math.floor(IMG_MAX_LENGTH / 1024)}KB`)
    }

    fields.set('image', await readFile(imageFile.filepath))
    await deleteFile(imageFile.filepath)
  } else if (body.image === 'null') {
    fields.set('image', null)
  }

  // changing role?
  if (typeof body.role === 'string' && body.role) {
    // @todo since we're not ensuring there'd be at least one admin
    // remaining, changing one's own role is currently disallowed
    if (user.role !== 'admin' || targetId === user.userId) {
      ctx.throw(403)
    }

    fields.set('roleId', sql`(SELECT roleId FROM roles WHERE name = ${body.role})`)
  }

  // changing permissions? (admins only, and never one's own: admins
  // bypass permission checks anyway)
  if (body.permissions) {
    if (user.role !== 'admin' || targetId === user.userId) {
      ctx.throw(403)
    }

    const perms = parsePermissions(body.permissions)

    if (perms) {
      fields.set('permissions', JSON.stringify(perms))
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
    ctx.throw(404, `userId ${targetId} not found`)
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
      })
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
    // already signed in?
    if (ctx.user.userId !== null) {
      ctx.throw(401, 'You are already signed in')
    }

    // only possible roles; further validated per-room below
    if (typeof body.role !== 'string' || !['guest', 'standard'].includes(body.role)) {
      ctx.throw(401, 'Invalid role')
    }

    // new users must choose a room at the same time
    try {
      await Rooms.validate(
        parseInt(body.roomId ?? '', 10),
        body.roomPassword,
        { role: body.role },
      )
    } catch (err) {
      ctx.throw(401, err.message)
    }
  }

  if (req.files && req.files.image) {
    const imageFile = Array.isArray(req.files.image) ? req.files.image[0] : req.files.image

    if (imageFile.size > IMG_MAX_LENGTH) {
      await deleteFile(imageFile.filepath)
      ctx.throw(413, `Image must not exceed ${Math.floor(IMG_MAX_LENGTH / 1024)}KB`)
    }

    image = await readFile(imageFile.filepath)
    await deleteFile(imageFile.filepath)
  }

  // create user (only admins may preset permissions)
  try {
    const userId = await User.create({ ...body, permissions: ctx.user.isAdmin ? body.permissions : undefined, image }, body.role)

    // if admin creating another user, we're done
    if (ctx.user.isAdmin) {
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
    const userId = await User.create({ ...req.body as UserBody, image }, 'admin')
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
      ctx.throw(500, 'Invalid default room lastID')
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
    // ensure target user has been in the same room
    if (!Rooms.hasUserBeenInRoom(ctx.user.roomId, targetId)) {
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
