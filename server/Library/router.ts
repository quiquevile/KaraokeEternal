import KoaRouter from '@koa/router'
import Media from '../Media/Media.js'
import Library from './Library.js'
import pushQueuesAndLibrary from '../lib/pushQueuesAndLibrary.js'
import { ConflictError, NotFoundError, ValidationError } from '../lib/Errors.js'
import { deriveNorms } from '../Youtube/metadata.js'
const router = new KoaRouter({ prefix: '/api' })

// lists underlying media for a given song
router.get('/song/:songId', async (ctx) => {
  // must be admin
  if (!ctx.user.isAdmin) {
    ctx.throw(401)
  }

  const songId = parseInt(ctx.params.songId, 10)

  if (Number.isNaN(songId)) {
    ctx.throw(401, 'Invalid songId')
  }

  const res = Media.search({ songId })

  if (!res.result.length) {
    ctx.throw(404)
  }

  ctx.body = res
})

// retag a song's artist/title (admin only)
export async function handleUpdateSong (ctx) {
  if (!ctx.user.isAdmin) {
    ctx.throw(401)
  }

  const songId = parseInt(ctx.params.songId, 10)

  if (Number.isNaN(songId)) {
    ctx.throw(422, 'Invalid songId')
  }

  const artist = typeof ctx.request.body?.artist === 'string' ? ctx.request.body.artist : ''
  const title = typeof ctx.request.body?.title === 'string' ? ctx.request.body.title : ''

  try {
    Library.updateSong(songId, { artist, title, ...deriveNorms(artist, title) })
  } catch (err) {
    if (err instanceof ConflictError) ctx.throw(409, err.message)
    if (err instanceof ValidationError) ctx.throw(422, err.message)
    throw err
  }

  ctx.status = 200
  ctx.body = Library.getSong(songId)

  // push the full library (artists, ordering and songIds per artist may
  // all have changed) and queues to every client
  pushQueuesAndLibrary(ctx.io)
}

router.put('/song/:songId', handleUpdateSong)

// delete a song's files, queue items, and rows (admin only)
export async function handleDeleteSong (ctx) {
  if (!ctx.user.isAdmin) {
    ctx.throw(401)
  }

  const songId = parseInt(ctx.params.songId, 10)

  if (Number.isNaN(songId)) {
    ctx.throw(422, 'Invalid songId')
  }

  try {
    Library.deleteSong(songId)
  } catch (err) {
    if (err instanceof NotFoundError) ctx.throw(404, err.message)
    if (err instanceof ValidationError) ctx.throw(422, err.message)
    throw err
  }

  ctx.status = 200
  ctx.body = { songId }

  // push the full library and queues so every client (and player) updates
  pushQueuesAndLibrary(ctx.io)
}

router.delete('/song/:songId', handleDeleteSong)

export default router
