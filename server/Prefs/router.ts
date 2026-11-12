import path from 'path'
import getLogger from '../lib/Log.js'
import KoaRouter from '@koa/router'
import getFolders from '../lib/getFolders.js'
import getEntries from '../lib/getEntries.js'
import getWindowsDrives from '../lib/getWindowsDrives.js'
import Prefs from './Prefs.js'
import pushPrefs from './pushPrefs.js'
import ProviderFetch from '../Providers/ProviderFetch.js'
import { normalizeProviderUrl } from '../Providers/Providers.js'
import validateProviderFields from './validateProviderFields.js'
import Media from '../Media/Media.js'
import pushQueuesAndLibrary, { pushQueues } from '../lib/pushQueuesAndLibrary.js'
import { getGainStatus, isGainActive, startGainScan, stopGainScan } from '../Scanner/GainScan.js'
import { mapDomainError, parseIdParam, requireAdmin, requireSameOrigin } from '../lib/http.js'
import { ctxLocale, t } from '../lib/locale.js'
import { can } from '../lib/permissions.js'
import User from '../User/User.js'
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
  startScanner: (pathIds: unknown, full?: boolean) => void
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

  // non-admins get roles, the player display settings (overlay timings
  // the player screen needs) and the sanitized provider subset
  ctx.body = {
    roles: prefs.roles,
    playerDisplay: prefs.playerDisplay,
    providers: Prefs.getSanitizedProviders(prefs.providers),
  }
})

// logged-in user's own EQ preset slots (per-user storage, never shared)
export async function handleGetEqPresets (ctx: RouterContext): Promise<void> {
  if (ctx.user?.userId == null) ctx.throw(401)

  ctx.body = User.getEqPresets(ctx.user.userId)
}

router.get('/eq-presets', ctx => handleGetEqPresets(ctx as unknown as RouterContext))

// save one of the caller's own EQ preset slots (admins or playback
// controllers); slots are private, so nothing is broadcast
export async function handleSaveEqPreset (ctx: RouterContext): Promise<void> {
  if (ctx.user?.userId == null) ctx.throw(401)
  if (!ctx.user.isAdmin && !can(ctx.user, 'playerControls')) ctx.throw(401)

  const body = (ctx.request as unknown as RequestWithBody).body
  const { name, gains } = body

  try {
    ctx.body = User.setEqPreset(
      ctx.user.userId,
      name as string,
      gains as number[],
      ctxLocale(ctx),
    )
  } catch (err) {
    mapDomainError(ctx, err)
  }
}

router.put('/eq-presets', ctx => handleSaveEqPreset(ctx as unknown as RouterContext))

// add a media path
router.post('/path', (ctx) => {
  const dir = decodeURIComponent(ctx.query.dir as string)

  requireAdmin(ctx)

  // required
  if (!dir) {
    ctx.throw(422, t(ctxLocale(ctx), 'server.prefs.invalidPath', 'Invalid path'))
  }

  const pathId = Prefs.addPath(dir, {
    prefs: (ctx.request as unknown as RequestWithBody).body,
  })

  // respond with updated prefs
  const prefs = Prefs.get() as unknown as PrefsType
  ctx.body = prefs

  // (re)start watcher
  ;(process as NodeJS.EventEmitter).emit(PREFS_PATHS_CHANGED, prefs.paths)

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
    ;(process as NodeJS.EventEmitter).emit(PREFS_PATHS_CHANGED, prefs.paths)
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
  ;(process as NodeJS.EventEmitter).emit(PREFS_PATHS_CHANGED, prefs.paths)

  Media.cleanup()

  pushQueuesAndLibrary(ctx.io)
})

// scan a media path
export async function handleScanPath (ctx: RouterContext): Promise<void> {
  requireSameOrigin(ctx)
  requireAdmin(ctx)

  if (isGainActive()) ctx.throw(409, t(ctxLocale(ctx), 'server.prefs.gainInProgress', 'Gain measurement in progress'))

  const pathId = parseIdParam(ctx, 'pathId')

  ctx.status = 200
  ctx.startScanner(pathId, ctx.query.full === 'true')
}

router.post('/path/:pathId/scan', ctx => handleScanPath(ctx as unknown as RouterContext))

// scan all media paths
export async function handleScanAll (ctx: RouterContext): Promise<void> {
  requireSameOrigin(ctx)
  requireAdmin(ctx)

  if (isGainActive()) ctx.throw(409, t(ctxLocale(ctx), 'server.prefs.gainInProgress', 'Gain measurement in progress'))

  ctx.status = 200
  ctx.startScanner(true, ctx.query.full === 'true')
}

router.post('/paths/scan', ctx => handleScanAll(ctx as unknown as RouterContext))

// stop scanning (also cancels a running gain measurement)
export async function handleScanStop (ctx: RouterContext): Promise<void> {
  requireSameOrigin(ctx)
  requireAdmin(ctx)

  ctx.status = 200
  ctx.stopScanner()
  stopGainScan()
}

router.post('/paths/scan/stop', ctx => handleScanStop(ctx as unknown as RouterContext))

// measure loudness of songs without a stored level (admin only);
// paused automatically while a library scan runs, resumed afterwards
export async function handleGainScan (ctx: RouterContext): Promise<void> {
  requireSameOrigin(ctx)
  requireAdmin(ctx)

  if (ctx.isScannerActive()) ctx.throw(409, t(ctxLocale(ctx), 'server.prefs.scanInProgress', 'Library scan in progress'))
  if (isGainActive()) ctx.throw(409, t(ctxLocale(ctx), 'server.prefs.gainAlreadyRunning', 'Gain measurement already running'))

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

// add a provider
router.post('/provider', (ctx) => {
  if (!ctx.user.isAdmin) {
    ctx.throw(401)
  }

  const fields = (ctx.request as unknown as RequestWithBody).body
  if (typeof fields.url === 'string') fields.url = normalizeProviderUrl(fields.url)
  const { name, url, ...data } = fields

  if (!name || typeof name !== 'string') {
    ctx.throw(422, 'Invalid name')
    return
  }

  if (!url || typeof url !== 'string') {
    ctx.throw(422, 'Invalid url')
    return
  }

  const err = validateProviderFields(fields)

  if (err) {
    ctx.throw(422, err)
    return
  }

  Prefs.addProvider(name, url, data)
  ProviderFetch.syncProviders()

  ctx.body = Prefs.get() as unknown as PrefsType

  pushPrefs(ctx.io)
})

// update provider data
router.put('/provider/:providerId', (ctx) => {
  if (!ctx.user.isAdmin) {
    ctx.throw(401)
  }

  const providerId = parseInt(ctx.params.providerId, 10)

  if (isNaN(providerId)) {
    ctx.throw(422, 'Invalid providerId')
  }

  const { body } = ctx.request as unknown as RequestWithBody

  const provider = Prefs.get().providers.entities[providerId]

  if (!provider) {
    ctx.throw(404, 'Provider not found')
    return
  }

  if (typeof body.url === 'string') body.url = normalizeProviderUrl(body.url)
  const err = validateProviderFields(body)

  if (err) {
    ctx.throw(422, err)
    return
  }

  Prefs.updateProvider(providerId, body)
  ProviderFetch.syncProviders()

  ctx.body = Prefs.get() as unknown as PrefsType

  pushPrefs(ctx.io)
})

// remove a provider
router.delete('/provider/:providerId', (ctx) => {
  if (!ctx.user.isAdmin) {
    ctx.throw(401)
  }

  const providerId = parseInt(ctx.params.providerId, 10)

  if (isNaN(providerId)) {
    ctx.throw(422, 'Invalid providerId')
  }

  const provider = Prefs.get().providers.entities[providerId]

  if (!provider) {
    ctx.throw(404, 'Provider not found')
    return
  }

  // before removal, while the provider's url/apiKey are still available
  ProviderFetch.cancelInFlight(provider)
  Prefs.removeProvider(providerId)
  ProviderFetch.syncProviders()

  ctx.body = Prefs.get() as unknown as PrefsType

  pushPrefs(ctx.io)
})

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
