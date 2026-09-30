import path from 'path'
import getLogger from '../lib/Log.js'
import KoaRouter from '@koa/router'
import getFolders from '../lib/getFolders.js'
import getEntries from '../lib/getEntries.js'
import getWindowsDrives from '../lib/getWindowsDrives.js'
import Prefs from './Prefs.js'
import Media from '../Media/Media.js'
import pushQueuesAndLibrary, { pushQueues } from '../lib/pushQueuesAndLibrary.js'
import { getGainStatus, isGainActive, startGainScan, stopGainScan } from '../Scanner/GainScan.js'
import { parseIdParam, requireAdmin } from '../lib/http.js'
import { canSaveEqPresets } from '../lib/permissions.js'
import { PREFS_PATHS_CHANGED } from '../../shared/actionTypes.js'
import type { Prefs as PrefsType } from '../../shared/types.js'

export interface RouterContext {
  user: { isAdmin: boolean, userId?: number, username?: string, roomId?: number | null } | undefined
  params: Record<string, string>
  query: Record<string, string | undefined>
  request: { body: Record<string, unknown> }
  body: unknown
  status: number
  throw: (status: number, message?: string) => never
  io: { emit: (...args: unknown[]) => void }
  startScanner: (pathIds: unknown) => void
  stopScanner: () => void
  isScannerActive: () => boolean
}

interface RequestWithBody {
  body: Record<string, unknown>
}

const log = getLogger('Prefs')
const router = new KoaRouter({ prefix: '/api/prefs' })

// get all prefs (including media paths)
router.get('/', (ctx) => {
  const prefs = Prefs.get() as unknown as PrefsType

  // must be admin or firstrun
  if (prefs.isFirstRun || ctx.user.isAdmin) {
    ctx.body = prefs
    return
  }

  // non-admins only get roles (+ global EQ presets, which any playback
  // controller may recall)
  const eqPresets = (prefs as unknown as Record<string, unknown>).eqPresets ?? null
  ctx.body = { roles: prefs.roles, eqPresets }
})

// number of equalizer bands (mirrors EQ_FREQUENCIES in
// src/routes/Player/lib/equalizer.ts, not importable here)
const EQ_BAND_COUNT = 10

const EQ_PRESET_SLOTS = ['P1', 'P2', 'P3']

// save a global EQ preset slot (admins or holders of the nested permission)
export async function handleSaveEqPreset (ctx: RouterContext): Promise<void> {
  if (!ctx.user || !canSaveEqPresets(ctx.user)) ctx.throw(401)

  const body = (ctx.request as unknown as RequestWithBody).body
  const { name, gains } = body

  if (name !== 'P1' && name !== 'P2' && name !== 'P3') {
    ctx.throw(422, 'Invalid preset slot')
  }

  if (!Array.isArray(gains)
    || gains.length !== EQ_BAND_COUNT
    || gains.some(g => typeof g !== 'number' || !Number.isFinite(g))
  ) {
    ctx.throw(422, 'Invalid preset gains')
  }

  const current = ((Prefs.get() as unknown as Record<string, unknown>).eqPresets ?? {}) as Record<string, number[]>
  const next = { ...current, [name as string]: gains as number[] }
  Prefs.set('eqPresets', next)

  ctx.body = next
}

router.put('/eq-presets', ctx => handleSaveEqPreset(ctx as unknown as RouterContext))

// add a media path
router.post('/path', (ctx) => {
  const dir = decodeURIComponent(ctx.query.dir as string)

  requireAdmin(ctx)

  // required
  if (!dir) {
    ctx.throw(422, 'Invalid path')
  }

  const pathId = Prefs.addPath(dir, {
    prefs: (ctx.request as unknown as RequestWithBody).body,
  })

  // respond with updated prefs
  const prefs = Prefs.get() as unknown as PrefsType
  ctx.body = prefs

  // (re)start watcher
  process.emit(PREFS_PATHS_CHANGED, prefs.paths)

  ctx.startScanner(pathId)
})

// set media path preferences
router.put('/path/:pathId', (ctx) => {
  requireAdmin(ctx)

  const pathId = parseIdParam(ctx, 'pathId')

  Prefs.setPathData(pathId, 'prefs.', (ctx.request as unknown as RequestWithBody).body)

  // respond with updated prefs
  const prefs = Prefs.get() as unknown as PrefsType
  ctx.body = prefs

  // (re)start watcher?
  if ('isWatchingEnabled' in (ctx.request as unknown as RequestWithBody).body) {
    process.emit(PREFS_PATHS_CHANGED, prefs.paths)
  }

  // need to push updated queue items?
  if ('isVideoKeyingEnabled' in (ctx.request as unknown as RequestWithBody).body) {
    pushQueues(ctx.io)
  }
})

// remove a media path
router.delete('/path/:pathId', (ctx) => {
  requireAdmin(ctx)

  const pathId = parseIdParam(ctx, 'pathId')

  ctx.stopScanner()

  Prefs.removePath(pathId)

  // respond with updated prefs
  const prefs = Prefs.get() as unknown as PrefsType
  ctx.body = prefs

  // (re)start watcher
  process.emit(PREFS_PATHS_CHANGED, prefs.paths)

  Media.cleanup()

  pushQueuesAndLibrary(ctx.io)
})

// scan a media path
export async function handleScanPath (ctx: RouterContext): Promise<void> {
  requireAdmin(ctx)

  if (isGainActive()) ctx.throw(409, 'Gain measurement in progress')

  const pathId = parseIdParam(ctx, 'pathId')

  ctx.status = 200
  ctx.startScanner(pathId)
}

router.get('/path/:pathId/scan', ctx => handleScanPath(ctx as unknown as RouterContext))

// scan all media paths
export async function handleScanAll (ctx: RouterContext): Promise<void> {
  requireAdmin(ctx)

  if (isGainActive()) ctx.throw(409, 'Gain measurement in progress')

  ctx.status = 200
  ctx.startScanner(true)
}

router.get('/paths/scan', ctx => handleScanAll(ctx as unknown as RouterContext))

// stop scanning (also cancels a running gain measurement)
export async function handleScanStop (ctx: RouterContext): Promise<void> {
  requireAdmin(ctx)

  ctx.status = 200
  ctx.stopScanner()
  stopGainScan()
}

router.get('/paths/scan/stop', ctx => handleScanStop(ctx as unknown as RouterContext))

// measure loudness of songs without a stored level (admin only);
// paused automatically while a library scan runs, resumed afterwards
export async function handleGainScan (ctx: RouterContext): Promise<void> {
  requireAdmin(ctx)

  if (ctx.isScannerActive()) ctx.throw(409, 'Library scan in progress')
  if (isGainActive()) ctx.throw(409, 'Gain measurement already running')

  ctx.status = 200
  startGainScan(ctx.io)
}

router.get('/gain/scan', ctx => handleGainScan(ctx as unknown as RouterContext))

// last known gain job status (admin only); lets (re)connecting clients
// show progress and offer cancel without waiting for file completion
export async function handleGainStatus (ctx: RouterContext): Promise<void> {
  requireAdmin(ctx)

  ctx.body = getGainStatus()
}

router.get('/gain/status', ctx => handleGainStatus(ctx as unknown as RouterContext))

// get folder listing for path browser
router.get('/path/ls', async (ctx) => {
  requireAdmin(ctx)

  const dir = decodeURIComponent(ctx.query.dir as string)

  // windows is a special snowflake and gets an
  // extra top level of available drive letters
  if (dir === '' && process.platform === 'win32') {
    const drives = getWindowsDrives()

    ctx.body = {
      current: '',
      parent: false,
      children: drives,
    }
  } else {
    const current = path.resolve(dir)
    const parent = path.resolve(dir, '../')

    const list = await getFolders(dir)
    log.verbose('%s listed path: %s', ctx.user.name, current)

    ctx.body = {
      current,
      // if at root, windows gets a special top level
      parent: parent === current ? (process.platform === 'win32' ? '' : false) : parent,
      children: list.map(p => ({
        path: p,
        label: p.replace(current + path.sep, ''),
      })).filter(c => !(c.label.startsWith('.') || c.label.startsWith('/.'))),
    }
  }
})

// get folder && file listing for the yt-dlp folder browser
router.get('/file/ls', async (ctx) => {
  requireAdmin(ctx)

  const dir = decodeURIComponent(ctx.query.dir as string)

  if (dir === '' && process.platform === 'win32') {
    const drives = getWindowsDrives()

    ctx.body = {
      current: '',
      parent: false,
      children: drives.map(drive => ({ ...drive, isDir: true })),
    }
  } else {
    const current = path.resolve(dir)
    const parent = path.resolve(dir, '../')

    const list = await getEntries(dir)
    log.verbose('%s listed files in path: %s', ctx.user.name, current)

    ctx.body = {
      current,
      parent: parent === current ? (process.platform === 'win32' ? '' : false) : parent,
      children: list.map(entry => ({
        path: entry.path,
        label: entry.name,
        isDir: entry.isDir,
      })),
    }
  }
})

export default router
