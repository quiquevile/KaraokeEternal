import KoaRouter from '@koa/router'
import Prefs from '../Prefs/Prefs.js'
import {
  searchYoutube,
  resolveVideo,
  resolveStreamUrl,
  parseVideoId,
  setYtdlDir,
  getYtdlStatus,
  getYtdlMode,
  updateYtdl,
} from './ytdlp.js'
import { deriveMetadata, deriveNorms, toFilename } from './metadata.js'
import { downloadManager } from './downloadManager.js'
import { findDownloadedFile } from './registerDownload.js'
import { getAlreadyDownloadedIds } from './library.js'
import Library from '../Library/Library.js'

export interface RouterContext {
  user: { isAdmin: boolean } | undefined
  params: Record<string, string>
  query: Record<string, string | undefined>
  request: { body: Record<string, unknown> }
  body: unknown
  status: number
  throw: (status: number, message?: string) => never
}

type YoutubePrefs = ReturnType<typeof Prefs.get> & {
  youtubeDownloadPathId?: number
  youtubeYtdlDir?: string
  youtubeDlExtraArgs?: string
}

function requireAdmin (ctx: RouterContext): void {
  if (!ctx.user?.isAdmin) ctx.throw(401)
}

function bodyOf (ctx: RouterContext): Record<string, unknown> {
  return ctx.request.body ?? {}
}

function str (value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function applyYoutubePrefs (): YoutubePrefs {
  const prefs = Prefs.get() as YoutubePrefs

  const dir = typeof prefs.youtubeYtdlDir === 'string' ? prefs.youtubeYtdlDir.trim() : ''
  setYtdlDir(dir || null)

  return prefs
}

export async function handleSearch (ctx: RouterContext): Promise<void> {
  requireAdmin(ctx)
  applyYoutubePrefs()

  const query = str(bodyOf(ctx).query)

  if (!query) ctx.throw(422, 'query is required')

  // a pasted YouTube URL resolves to a single video result
  const isDirectUrl = !!parseVideoId(query) && !/\s/.test(query)
  const results = isDirectUrl
    ? [await resolveVideo(query)]
    : await searchYoutube(query)

  const alreadyDownloaded = getAlreadyDownloadedIds(results.map(result => result.id))

  ctx.status = 200
  ctx.body = {
    results: results.map(result => ({
      ...result,
      alreadyDownloaded: alreadyDownloaded.has(result.id),
    })),
  }
}

export async function handleIdentify (ctx: RouterContext): Promise<void> {
  requireAdmin(ctx)

  const body = bodyOf(ctx)
  const title = str(body.title)

  if (!title) ctx.throw(422, 'title is required')

  const channel = typeof body.channel === 'string' ? body.channel.trim() : ''

  ctx.status = 200
  ctx.body = deriveMetadata(title, channel)
}

export async function handleStream (ctx: RouterContext): Promise<void> {
  requireAdmin(ctx)
  applyYoutubePrefs()

  const url = str(ctx.query.url)

  if (!parseVideoId(url)) ctx.throw(422, 'invalid YouTube URL')

  const streamUrl = await resolveStreamUrl(url)

  ctx.status = 200
  ctx.body = { url: streamUrl }
}

export function resolveDownloadPath (prefs: {
  paths?: { result?: number[], entities?: Record<number, { path?: string }> }
  youtubeDownloadPathId?: number
}): { pathId: number, destDir: string } | null {
  const paths = prefs.paths ?? { result: [], entities: {} }
  const selectedId = prefs.youtubeDownloadPathId
  const pathId = (selectedId != null && paths.entities?.[selectedId]?.path)
    ? selectedId
    : (paths.result?.length ? paths.result[0] : null)

  if (pathId == null || !paths.entities?.[pathId]?.path) return null

  return { pathId, destDir: paths.entities[pathId].path }
}

export async function handleDownload (ctx: RouterContext): Promise<void> {
  requireAdmin(ctx)

  const body = bodyOf(ctx)
  const url = str(body.url)
  const artist = str(body.artist)
  const title = str(body.title)

  if (!parseVideoId(url)) ctx.throw(422, 'invalid YouTube URL')
  if (!artist) ctx.throw(422, 'artist is required')
  if (!title) ctx.throw(422, 'title is required')

  const prefs = applyYoutubePrefs()
  const path = resolveDownloadPath(prefs)

  if (!path) ctx.throw(422, 'could not determine download folder')

  const norms = deriveNorms(artist, title)
  const baseName = toFilename(artist, title)

  // same duplicate rules as song retagging: refuse before downloading anything
  if (Library.findSong(norms.artistNorm, norms.titleNorm) !== null) {
    ctx.throw(409, 'Another song already has that artist and title')
  }

  const existingFile = await findDownloadedFile(path.destDir, baseName)

  if (existingFile) {
    ctx.throw(409, `File already exists: ${existingFile}`)
  }

  const extraArgs = typeof prefs.youtubeDlExtraArgs === 'string'
    ? prefs.youtubeDlExtraArgs.trim().split(/\s+/).filter(Boolean)
    : []

  const job = downloadManager.enqueue({
    url,
    artist,
    artistNorm: norms.artistNorm,
    title,
    titleNorm: norms.titleNorm,
    thumbnail: typeof body.thumbnail === 'string' ? body.thumbnail : null,
    destDir: path.destDir,
    pathRoot: path.destDir,
    pathId: path.pathId,
    baseName,
    extraArgs,
  })

  ctx.status = 200
  ctx.body = job
}

export async function handleDownloads (ctx: RouterContext): Promise<void> {
  requireAdmin(ctx)

  ctx.status = 200
  ctx.body = downloadManager.getStatus()
}

export async function handleDownloadsClear (ctx: RouterContext): Promise<void> {
  requireAdmin(ctx)

  downloadManager.clearHistory()

  ctx.status = 200
  ctx.body = downloadManager.getStatus()
}

export async function handleDownloadsDelete (ctx: RouterContext): Promise<void> {
  requireAdmin(ctx)

  downloadManager.removeHistory(ctx.params.id as string)

  ctx.status = 200
  ctx.body = downloadManager.getStatus()
}

export async function handleYtdlVersion (ctx: RouterContext): Promise<void> {
  requireAdmin(ctx)
  applyYoutubePrefs()

  ctx.status = 200
  ctx.body = await getYtdlStatus()
}

export async function handleYtdlUpdate (ctx: RouterContext): Promise<void> {
  requireAdmin(ctx)
  applyYoutubePrefs()

  ctx.status = 200
  ctx.body = { ...(await updateYtdl()), mode: getYtdlMode() }
}

const router = new KoaRouter({ prefix: '/api/youtube' })

router.post('/search', ctx => handleSearch(ctx as unknown as RouterContext))
router.post('/identify', ctx => handleIdentify(ctx as unknown as RouterContext))
router.get('/stream', ctx => handleStream(ctx as unknown as RouterContext))
router.post('/download', ctx => handleDownload(ctx as unknown as RouterContext))
router.get('/downloads', ctx => handleDownloads(ctx as unknown as RouterContext))
router.post('/downloads/clear', ctx => handleDownloadsClear(ctx as unknown as RouterContext))
router.delete('/downloads/:id', ctx => handleDownloadsDelete(ctx as unknown as RouterContext))
router.get('/ytdlp/version', ctx => handleYtdlVersion(ctx as unknown as RouterContext))
router.post('/ytdlp/update', ctx => handleYtdlUpdate(ctx as unknown as RouterContext))

export default router
