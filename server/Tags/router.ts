import KoaRouter from '@koa/router'
import type { Server } from 'socket.io'
import { mapDomainError, parseIdParam } from '../lib/http.js'
import Tags from './Tags.js'
import { TAGS_PUSH } from '../../shared/actionTypes.js'

const router = new KoaRouter({ prefix: '/api/tags' })

interface User {
  userId?: number | null
  isAdmin: boolean
  permissions?: Record<string, boolean>
}

function requireUser (ctx): User {
  if (ctx.user?.userId == null) ctx.throw(401)
  return ctx.user as User
}

function requireManager (ctx): User {
  const user = requireUser(ctx)
  if (!user.isAdmin && user.permissions?.manageTags !== true) ctx.throw(403)
  return user
}

export function pushTags (io: Server): void {
  for (const sock of io.of('/').sockets.values()) {
    const user = (sock as typeof sock & { user?: User }).user
    if (user?.userId == null) continue
    sock.emit('action', { type: TAGS_PUSH, payload: Tags.visible(user) })
  }
}

router.get('/', (ctx) => {
  ctx.body = Tags.visible(requireUser(ctx))
})

router.post('/', (ctx) => {
  const user = requireManager(ctx)
  try {
    ctx.body = Tags.save(user, null, (ctx.request as { body?: unknown }).body)
  } catch (error) {
    mapDomainError(ctx, error)
  }
  pushTags(ctx.io as Server)
})

router.put('/song/:songId', (ctx) => {
  const user = requireManager(ctx)
  const songId = parseIdParam(ctx, 'songId')
  try {
    Tags.assign(user, songId, ((ctx.request as { body?: { tagIds?: unknown } }).body)?.tagIds)
  } catch (error) {
    mapDomainError(ctx, error)
  }
  ctx.body = { songId }
  pushTags(ctx.io as Server)
})

router.put('/:tagId', (ctx) => {
  const user = requireManager(ctx)
  const tagId = parseIdParam(ctx, 'tagId')
  try {
    if (!Tags.canManage(user, Tags.get(tagId))) ctx.throw(403)
    ctx.body = Tags.save(user, tagId, (ctx.request as { body?: unknown }).body)
  } catch (error) {
    mapDomainError(ctx, error)
  }
  pushTags(ctx.io as Server)
})

router.delete('/:tagId', (ctx) => {
  const user = requireManager(ctx)
  const tagId = parseIdParam(ctx, 'tagId')
  try {
    if (!Tags.canManage(user, Tags.get(tagId))) ctx.throw(403)
    Tags.remove(user, tagId)
  } catch (error) {
    mapDomainError(ctx, error)
  }
  ctx.body = { tagId }
  pushTags(ctx.io as Server)
})

export default router
