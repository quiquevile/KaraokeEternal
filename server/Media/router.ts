import fs from 'fs'
import fsPromises from 'node:fs/promises'
import { Readable } from 'stream'
import path from 'path'
import { unzip } from 'unzipit'
import getLogger from '../lib/Log.js'
import getCdgName from '../lib/getCdgName.js'
import { getExt } from '../lib/util.js'
import KoaRouter from '@koa/router'
import Library from '../Library/Library.js'
import Media from './Media.js'
import Prefs from '../Prefs/Prefs.js'
import Queue from '../Queue/Queue.js'
import Rooms from '../Rooms/Rooms.js'
import { can } from '../lib/permissions.js'
import pushQueuesAndLibrary from '../lib/pushQueuesAndLibrary.js'
import fileTypes from './fileTypes.js'
import { NotFoundError, ValidationError } from '../lib/Errors.js'
import { LIBRARY_PUSH_SONG, QUEUE_PUSH } from '../../shared/actionTypes.js'
const log = getLogger('Media')
const router = new KoaRouter({ prefix: '/api/media' })

const audioExts = Object.keys(fileTypes).filter(ext => fileTypes[ext].mimeType.startsWith('audio/'))

// stream a media file
router.get('/:mediaId', async (ctx) => {
  const { type } = ctx.query

  if (!can(ctx.user, 'playerAccess')) {
    ctx.throw(401)
  }

  const mediaId = parseInt(ctx.params.mediaId, 10)

  if (Number.isNaN(mediaId) || !type) {
    ctx.throw(422, 'invalid mediaId or type')
  }

  // get media info
  const res = Media.search({ mediaId })

  if (!res.result.length) {
    ctx.throw(404, 'mediaId not found')
  }

  const { pathId, relPath } = res.entities[mediaId]

  // get base path
  const { paths } = Prefs.get()
  const basePath = paths.entities[pathId].path

  let file = path.join(basePath, relPath)
  let buffer

  if (getExt(file) === '.zip') {
    const { entries } = await unzip(new Uint8Array(await fsPromises.readFile(file)))
    let entry

    if (type === 'cdg') {
      entry = Object.keys(entries).find(f => !f.includes('/') && getExt(f) === '.cdg')
      if (!entry) ctx.throw(404, 'No .cdg file found in archive')
    } else {
      entry = Object.keys(entries).find(f => !f.includes('/') && audioExts.includes(getExt(f)))
      if (!entry) ctx.throw(404, 'No valid audio file found in archive')
    }

    ctx.length = entries[entry].size
    ctx.type = fileTypes[getExt(entry)]?.mimeType
    buffer = Buffer.from(await entries[entry].arrayBuffer())
  } else {
    if (type === 'cdg') {
      file = getCdgName(file)
      if (!file) ctx.throw(404, 'The .cdg file could not be found')
    }

    const stats = await fsPromises.stat(file)
    ctx.length = stats.size
    ctx.type = fileTypes[getExt(file)]?.mimeType
  }

  if (!ctx.type) ctx.throw(404, `Unknown MIME type: ${file}`)

  log.verbose('streaming %s (%sMB): %s', ctx.type, (ctx.length / 1000000).toFixed(2), file)
  ctx.body = buffer ? Readable.from(buffer) : fs.createReadStream(file)
})

// delete a single media version (admin only); purges the whole song
// when it was the last version left
export async function handleDeleteMedia (ctx) {
  if (!ctx.user.isAdmin) {
    ctx.throw(401)
  }

  const mediaId = parseInt(ctx.params.mediaId, 10)

  if (Number.isNaN(mediaId)) {
    ctx.throw(422, 'Invalid mediaId')
  }

  try {
    Library.deleteMedia(mediaId)
  } catch (err) {
    if (err instanceof NotFoundError) ctx.throw(404, err.message)
    if (err instanceof ValidationError) ctx.throw(422, err.message)
    throw err
  }

  ctx.status = 200
  ctx.body = { mediaId }

  // push the full library and queues so every client (and player) updates
  pushQueuesAndLibrary(ctx.io)
}

router.delete('/:mediaId', handleDeleteMedia)

// set isPreferred flag
router.all('/:mediaId/prefer', (ctx) => {
  if (!ctx.user.isAdmin) {
    ctx.throw(401)
  }

  const mediaId = parseInt(ctx.params.mediaId, 10)

  if (Number.isNaN(mediaId) || (ctx.request.method !== 'PUT' && ctx.request.method !== 'DELETE')) {
    ctx.throw(422)
  }

  let songId: number

  try {
    songId = Media.setPreferred(mediaId, ctx.request.method === 'PUT')
  } catch (err) {
    if (err instanceof NotFoundError) ctx.throw(404, err.message)
    if (err instanceof ValidationError) ctx.throw(422, err.message)
    throw err
  }

  ctx.status = 200

  // emit (potentially) updated queues to each room
  for (const { room, roomId } of Rooms.getActive(ctx.io)) {
    ctx.io.to(room).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(roomId),
    })
  }

  // emit (potentially) new duration
  ctx.io.emit('action', {
    type: LIBRARY_PUSH_SONG,
    payload: Library.getSong(songId),
  })
})

export default router
