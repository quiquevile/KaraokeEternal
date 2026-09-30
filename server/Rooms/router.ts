import KoaRouter from '@koa/router'
import sql from 'sqlate'
import { db } from '../lib/Database.js'
import getLogger from '../lib/Log.js'
import Rooms, { STATUSES } from '../Rooms/Rooms.js'
import { can } from '../lib/permissions.js'
import { mapDomainError, parseIdParam, requireAdmin } from '../lib/http.js'

interface RequestWithBody {
  body: Record<string, unknown>
}

const log = getLogger('Rooms')
const router = new KoaRouter({ prefix: '/api/rooms' })

import { ROOM_PREFS_PUSH } from '../../shared/actionTypes.js'

export interface RouterContext {
  user: { isAdmin: boolean, userId?: number, username?: string, name?: string, roomId?: number | null, permissions?: Record<string, boolean> } | undefined
  params: Record<string, string>
  query: Record<string, string | undefined>
  request: { body: Record<string, unknown> }
  body: unknown
  status: number
  throw: (status: number, message?: string) => never
  io: {
    to: (room: string) => { emit: (event: string, data: unknown) => void }
    sockets: { adapter: { rooms: { get: (name: string) => { size: number } | undefined } } }
  }
}

// status of the requesting user's current room; any logged-in user may query
// their own room (including closed ones, which are hidden from GET /api/rooms)
export function handleCurrentRoomStatus (ctx: RouterContext): void {
  if (ctx.user?.userId == null) ctx.throw(401)

  const roomId = ctx.user?.roomId
  if (roomId == null) ctx.throw(404, 'Not in a room')

  const res = Rooms.get(roomId, { status: STATUSES })
  const room = res.entities[roomId]
  if (!room) ctx.throw(404, 'Room not found')

  ctx.body = { roomId, status: room.status }
}

// current room status (registered before '/:roomId' for clarity)
router.get('/current/status', ctx => handleCurrentRoomStatus(ctx as unknown as RouterContext))

// list rooms
export function handleListRooms (ctx: RouterContext): void {
  const roomId = ctx.params.roomId ? parseInt(ctx.params.roomId, 10) : undefined
  const isAdmin = !!ctx.user?.isAdmin
  const ownRoomId = ctx.user?.roomId
  const status = isAdmin ? STATUSES : undefined
  const res = Rooms.get(roomId, { status })

  res.result.forEach((roomId) => {
    if (isAdmin) {
      const room = ctx.io.sockets.adapter.rooms.get(Rooms.prefix(roomId))
      res.entities[roomId].numUsers = room ? room.size : 0
    } else {
      // only pass the 'roles' prefs key — plus 'qr', 'eq' and the reversible
      // key for the user's own room (members already know it: they typed it
      // and it travels in the QR; the player needs its persisted eq back)
      // non-admin entities carry partial prefs by design (qr/eq only for
      // the own room); the cast reflects the view boundary, not the table
      const prefs = res.entities[roomId].prefs
      res.entities[roomId].prefs = {
        ...(prefs?.roles ? { roles: prefs.roles } : {}),
        ...(roomId === ownRoomId && prefs?.qr ? { qr: prefs.qr } : {}),
        ...(roomId === ownRoomId && prefs?.eq ? { eq: prefs.eq } : {}),
      } as typeof prefs

      if (roomId !== ownRoomId) delete res.entities[roomId].qrPassword
    }
  })

  ctx.body = res
}

router.get(['/', '/:roomId'], ctx => handleListRooms(ctx as unknown as RouterContext))

// create room
router.post('/', async (ctx) => {
  requireAdmin(ctx)

  try {
    const res = await Rooms.set(undefined, (ctx.request as unknown as RequestWithBody).body)
    log.verbose('%s created a room (roomId: %s)', ctx.user.name, res.lastID)
  } catch (err) {
    mapDomainError(ctx, err)
  }

  // send updated room list
  ctx.body = Rooms.get(null, { status: STATUSES })
})

// update own room's display options (QR prefs only — never name, status,
// password or roles). Allowed for admins and playback controllers.
export async function handleCurrentRoomUpdate (ctx: RouterContext): Promise<void> {
  const roomId = ctx.user?.roomId

  if (ctx.user?.userId == null) ctx.throw(401)
  if (roomId == null) ctx.throw(404, 'Not in a room')
  if (!ctx.user.isAdmin && !can(ctx.user, 'playerControls')) ctx.throw(401)

  const prefs = ctx.request.body?.prefs as Record<string, unknown> | undefined

  if (!prefs || typeof prefs !== 'object') ctx.throw(422, 'Nothing to update')

  try {
    const merged = Rooms.setRoomOptions(roomId, { prefs })

    log.verbose('%s updated room %s options', ctx.user.username, roomId)

    const room = Rooms.get(roomId, { status: STATUSES }).entities[roomId]
    // the reversible key travels with the options: members joining before
    // a password existed (or changing it afterwards) would otherwise keep
    // a stale null and never embed it despite the flag being set
    ctx.body = { room: { roomId, prefs: merged, hasPassword: room.hasPassword, qrPassword: room.qrPassword ?? null } }

    // live update for every member of the room
    ctx.io.to(Rooms.prefix(roomId)).emit('action', {
      type: ROOM_PREFS_PUSH,
      payload: { roomId, prefs: merged },
    })
  } catch (err) {
    mapDomainError(ctx, err)
  }
}

router.put('/current', ctx => handleCurrentRoomUpdate(ctx as unknown as RouterContext))

// update room
export async function handleUpdateRoom (ctx: RouterContext): Promise<void> {
  requireAdmin(ctx)

  const roomId = parseIdParam(ctx, 'roomId')

  try {
    await Rooms.set(roomId, (ctx.request as unknown as RequestWithBody).body)
  } catch (err) {
    mapDomainError(ctx, err)
  }

  log.verbose('%s updated a room (roomId: %s)', ctx.user.name, roomId)

  // live update for every member of the room (same shape as the prefs push,
  // plus key metadata so members learn about password changes without refetch)
  const updated = Rooms.get(roomId, { status: STATUSES }).entities[roomId]
  ctx.io.to(Rooms.prefix(roomId)).emit('action', {
    type: ROOM_PREFS_PUSH,
    payload: { roomId, prefs: updated.prefs, hasPassword: updated.hasPassword, qrPassword: updated.qrPassword ?? null },
  })

  // send updated room list
  ctx.body = Rooms.get(null, { status: STATUSES })
}

router.put('/:roomId', ctx => handleUpdateRoom(ctx as unknown as RouterContext))

// remove room
router.delete('/:roomId', (ctx) => {
  requireAdmin(ctx)

  const roomId = parseIdParam(ctx, 'roomId')

  // remove room's queue first
  const queueQuery = sql`
    DELETE FROM queue
    WHERE roomId = ${roomId}
  `
  db.run(String(queueQuery), queueQuery.parameters)

  // remove room
  const roomQuery = sql`
    DELETE FROM rooms
    WHERE roomId = ${roomId}
  `
  db.run(String(roomQuery), roomQuery.parameters)

  log.verbose('%s deleted roomId %s', ctx.user.name, roomId)

  // send updated room list
  ctx.body = Rooms.get(null, { status: STATUSES })
})

export default router
