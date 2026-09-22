import { spawn } from 'child_process'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'path'
import getLogger from '../lib/Log.js'

const log = getLogger('YoutubeYtDlp')

const SEARCH_COUNT = 15
const PREVIEW_FORMAT = 'worst[ext=mp4][protocol=https][vcodec!=none][acodec!=none]/worst[protocol=https][vcodec!=none][acodec!=none]'
const DOWNLOAD_FORMAT = 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best'
const DOWNLOAD_PROGRESS_TEMPLATE = 'download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(info.id)s'
const POSTPROCESS_PROGRESS_TEMPLATE = 'postprocess:%(progress.postprocessor_name)s'

export interface YouTubeResult {
  id: string
  url: string
  title: string
  artist: string
  duration: number
  durationLabel: string
  thumbnail: string
}

export type ParsedSearchLine = YouTubeResult

export interface ParsedProgressLine {
  status?: 'download'
  percent?: number
  speed?: string
  eta?: string
  postprocessor?: string
}

export async function searchYoutube (query: string, options: { count?: number } = {}): Promise<YouTubeResult[]> {
  const { stdout } = await runYtdl(buildSearchArgs(query, options))

  return parseSearchOutput(stdout)
}

export async function resolveVideo (url: string): Promise<YouTubeResult> {
  const { stdout } = await runYtdl(buildVideoMetadataArgs(url))
  const results = parseSearchOutput(stdout)

  if (results.length === 0) throw new Error('yt-dlp did not return video metadata')

  return results[0]
}

export async function resolveStreamUrl (url: string): Promise<string> {
  const { stdout } = await runYtdl(buildStreamArgs(url))
  const streamUrl = stdout.split('\n').map(line => line.trim()).find(line => line)

  if (!streamUrl) throw new Error('yt-dlp did not return a stream URL')

  return streamUrl
}

let ytdlDirOverride: string | null = null
let ytdlBinOverride: string | null = null
let ensurePromise: Promise<void> | null = null

export function setYtdlDir (dir: string | null): void {
  const normalized = dir ? dir.trim() : null

  if (normalized !== ytdlDirOverride) ensurePromise = null

  ytdlDirOverride = normalized
}

export function setYtdlBin (bin: string | null): void {
  ytdlBinOverride = bin
}

/** Folder holding the self-contained yt-dlp binary, if configured. */
export function getYtdlDir (): string | null {
  return ytdlDirOverride ?? (process.env.KES_YTDL_DIR || null)
}

/**
 * Resolves the yt-dlp executable:
 * an explicit binary (prefs/override or KES_YTDL_BIN) wins; otherwise the
 * self-contained binary in the managed folder. Throws when neither is
 * configured instead of falling back to the system PATH.
 */
export function getYtdlBin (): string {
  if (ytdlBinOverride) return ytdlBinOverride

  if (process.env.KES_YTDL_BIN) return process.env.KES_YTDL_BIN

  const dir = getYtdlDir()

  if (!dir) throw new Error('yt-dlp folder is not configured: select a folder in prefs')

  return path.join(dir, 'yt-dlp')
}

/** 'managed' when the self-contained folder owns the binary; 'system' otherwise. */
export function getYtdlMode (): 'managed' | 'system' {
  return !ytdlBinOverride && !process.env.KES_YTDL_BIN && getYtdlDir() ? 'managed' : 'system'
}

const YTDL_RELEASE_BASE = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/'

function musl (): boolean {
  const loader = process.arch === 'arm64'
    ? '/lib/ld-musl-aarch64.so.1'
    : '/lib/ld-musl-x86_64.so.1'

  try {
    return fs.existsSync(loader)
  } catch {
    return false
  }
}

interface YtdlVariant {
  asset: string
  /** runtime prerequisite besides the download itself */
  needs: 'python' | 'musl-loader' | null
}

/**
 * Self-contained yt-dlp flavours, preferred first for this environment:
 * the musl build needs no interpreter (ideal for containers) but only
 * runs where its loader exists; the plain build is a Python script.
 */
function ytdlAssetVariants (): YtdlVariant[] {
  let muslAsset: string

  switch (process.arch) {
    case 'x64':
      muslAsset = 'yt-dlp_musllinux'
      break
    case 'arm64':
      muslAsset = 'yt-dlp_musllinux_aarch64'
      break
    default:
      throw new Error(`No self-contained yt-dlp for architecture ${process.arch}`)
  }

  if (musl()) {
    return [
      { asset: muslAsset, needs: null },
      { asset: 'yt-dlp', needs: 'python' },
    ]
  }

  return [
    { asset: 'yt-dlp', needs: 'python' },
    { asset: muslAsset, needs: 'musl-loader' },
  ]
}

function ytdlAsset (): string {
  return ytdlAssetVariants()[0].asset
}

export function ytdlReleaseUrl (): string {
  return `${YTDL_RELEASE_BASE}${ytdlAsset()}`
}

async function isExecutable (file: string): Promise<boolean> {
  try {
    await fsPromises.access(file, fsPromises.constants.X_OK)

    return true
  } catch {
    return false
  }
}

/**
 * Checks that a binary actually runs (an executable bit is not enough: a
 * binary built for another libc fails at spawn with ENOENT).
 */
function isRunnable (bin: string): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (ok: boolean) => resolve(ok)
    let child: ReturnType<typeof spawn>

    try {
      child = spawn(bin, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] })
    } catch {
      done(false)

      return
    }

    const timer = setTimeout(() => done(false), 15000)

    if (typeof (timer as unknown as { unref?: () => void }).unref === 'function') {
      (timer as unknown as { unref: () => void }).unref()
    }

    let out = ''

    try {
      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (chunk) => {
        out += String(chunk)
      })
      child.stderr.on('data', () => {})
      child.on('error', () => {
        clearTimeout(timer)
        done(false)
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        done(code === 0 && out.trim().length > 0)
      })
    } catch {
      clearTimeout(timer)
      done(false)
    }
  })
}

/**
 * Guarantees the managed yt-dlp binary exists, downloading it the first time
 * (arch-aware, atomically) — identical behaviour inside and outside the
 * container. No-op when the system yt-dlp is in use.
 */
export function ensureYtdlBinary (): Promise<void> {
  if (getYtdlMode() !== 'managed') return Promise.resolve()

  ensurePromise = ensurePromise ?? doEnsure().finally(() => {
    ensurePromise = null
  })

  return ensurePromise
}

/**
 * Checks a flavour's runtime prerequisite (the musl loader is known from
 * the filesystem; a Python interpreter has to run).
 */
async function variantReady (variant: YtdlVariant): Promise<boolean> {
  if (variant.needs === 'python') return isRunnable('python3')
  if (variant.needs === 'musl-loader') return musl()

  return true
}

async function downloadAsset (url: string, target: string): Promise<void> {
  const res = await fetch(url)

  if (!res.ok) throw new Error(`Failed to download yt-dlp: HTTP ${res.status}`)

  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`
  await fsPromises.writeFile(tmp, Buffer.from(await res.arrayBuffer()), { mode: 0o755 })
  await fsPromises.rename(tmp, target)
  await fsPromises.chmod(target, 0o755)
}

async function doEnsure (): Promise<void> {
  const dir = getYtdlDir()

  if (!dir) return

  const target = path.join(dir, 'yt-dlp')

  // whatever flavour is there, keep it when it runs (a folder shared
  // across environments self-heals in both directions this way)
  if (await isExecutable(target)) {
    if (await isRunnable(target)) return

    log.warn('managed yt-dlp binary does not run, replacing it: %s', target)

    try {
      await fsPromises.rm(target, { force: true })
    } catch {
      // the download below will fail loudly if the file cannot go
    }
  }

  await fsPromises.mkdir(dir, { recursive: true })

  const failures: string[] = []

  for (const variant of ytdlAssetVariants()) {
    if (!(await variantReady(variant))) {
      failures.push(`${variant.asset} needs ${variant.needs}`)
      log.warn('Skipping yt-dlp flavour %s: missing %s', variant.asset, variant.needs)

      continue
    }

    const url = `${YTDL_RELEASE_BASE}${variant.asset}`
    log.info('Downloading %s to %s', variant.asset, target)

    try {
      await downloadAsset(url, target)
    } catch (err) {
      failures.push(`${variant.asset}: ${err instanceof Error ? err.message : String(err)}`)

      continue
    }

    if (await isRunnable(target)) {
      await writeYtdlUpdatedAt(dir)

      return
    }

    failures.push(`${variant.asset} does not run here`)

    try {
      await fsPromises.rm(target, { force: true })
    } catch {
      // the next flavour (or the final error) will tell
    }
  }

  throw new Error(`Could not provision yt-dlp (${failures.join('; ')})`)
}

export async function getYtdlVersion (): Promise<string | null> {
  try {
    const { stdout } = await runYtdl(['--version'])

    return stdout.trim() || null
  } catch {
    return null
  }
}

const YTDL_UPDATED_MARKER = '.youtubeYtdlUpdatedAt'

async function writeYtdlUpdatedAt (dir: string | null): Promise<void> {
  if (!dir) return

  try {
    await fsPromises.writeFile(path.join(dir, YTDL_UPDATED_MARKER), String(Date.now()))
  } catch {
    // best-effort metadata; a read-only folder must not break the binary lifecycle
  }
}

async function readYtdlUpdatedAt (dir: string, fallbackMtime: number | null): Promise<number | null> {
  try {
    const raw = (await fsPromises.readFile(path.join(dir, YTDL_UPDATED_MARKER), 'utf8')).trim()
    const value = Number(raw)

    if (Number.isFinite(value) && value > 0) return value
  } catch {
    // no marker (e.g. binary installed before this feature) — fall back
  }

  return fallbackMtime
}

export type YtdlMode = 'managed' | 'system'

export type YtdlStatus = 'ready' | 'empty' | 'system'

export interface YtdlStatusReport {
  version: string | null
  mode: YtdlMode
  status: YtdlStatus
  updatedAt: number | null
  dir: string | null
}

/**
 * Reports the yt-dlp state without provisioning it: the managed folder's
 * binary version/date when present, 'empty' when configured but missing, or
 * the system yt-dlp otherwise.
 */
export async function getYtdlStatus (): Promise<YtdlStatusReport> {
  const mode = getYtdlMode()
  const dir = getYtdlDir()
  const explicitBin = !!ytdlBinOverride || !!process.env.KES_YTDL_BIN

  if (!dir && !explicitBin) {
    // no managed folder and no explicit binary: not configured
    return { version: null, mode, status: 'empty', updatedAt: null, dir: null }
  }

  if (mode !== 'managed' || !dir) {
    return { version: await getYtdlVersion(), mode, status: 'system', updatedAt: null, dir: null }
  }

  try {
    const binStat = await fsPromises.stat(getYtdlBin())
    const updatedAt = await readYtdlUpdatedAt(dir, binStat.mtimeMs)

    return { version: await getYtdlVersion(), mode, status: 'ready', updatedAt, dir }
  } catch {
    return { version: null, mode, status: 'empty', updatedAt: null, dir }
  }
}

function getUpdateCommand (): string[] {
  const cmd = process.env.KES_YTDL_UPDATE_CMD

  return cmd ? cmd.trim().split(/\s+/).filter(Boolean) : [getYtdlBin(), '-U']
}

/**
 * Runs the configured yt-dlp update command and captures its combined output.
 * The default self-updates a standalone yt-dlp binary; KES_YTDL_UPDATE_CMD can
 * override it (e.g. a pip-installed binary) without a code change.
 */
export async function updateYtdl (): Promise<{ ok: boolean, output: string, version: string | null }> {
  await ensureYtdlBinary()

  const [bin, ...args] = getUpdateCommand()

  return new Promise((resolve, reject) => {
    let output = ''
    let child: ReturnType<typeof spawn>

    try {
      child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (err) {
      reject(err)

      return
    }

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')

    const collect = (chunk: string) => {
      output += chunk
    }

    child.stdout.on('data', collect)
    child.stderr.on('data', collect)

    child.on('error', err => reject(err))

    child.on('close', async (code) => {
      const trimmed = output.trim()

      let version: string | null = null

      try {
        version = await getYtdlVersion()
      } catch {
        version = null
      }

      if (code === 0) await writeYtdlUpdatedAt(getYtdlDir())

      resolve({ ok: code === 0, output: trimmed, version })
    })
  })
}

export function parseVideoId (url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  )

  return match ? match[1] : null
}

export function formatDuration (seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''

  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)

  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

export function buildSearchArgs (query: string, { count = SEARCH_COUNT }: { count?: number } = {}): string[] {
  const cleanQuery = query.trim().replace(/\s+/g, ' ')
  const karaokeQuery = /\bkaraoke\b/i.test(cleanQuery) ? cleanQuery : `${cleanQuery} karaoke`

  return [
    `ytsearch${count}:"${karaokeQuery}"`,
    '--flat-playlist',
    '--no-playlist',
    '-j',
  ]
}

export function buildStreamArgs (url: string): string[] {
  return [
    '-g',
    '-f', PREVIEW_FORMAT,
    '--no-playlist',
    '--extractor-args', 'youtube:player_client=android',
    url,
  ]
}

export function buildVideoMetadataArgs (url: string): string[] {
  return [
    '--no-playlist',
    '-j',
    url,
  ]
}

/**
 * JavaScript runtime for YouTube's JS challenge (signature deciphering).
 *
 * Only deno is enabled in yt-dlp by default, so request node explicitly.
 * The server always runs on node, therefore process.execPath is guaranteed
 * to exist in every deployment (host, Docker, Pi) with no new dependency.
 */
export function jsRuntimeArgs (): string[] {
  return ['--js-runtimes', `node:${process.execPath}`]
}

export function buildDownloadArgs (url: string, output: string, extraArgs: string[] = []): string[] {
  return [
    '-f', DOWNLOAD_FORMAT,
    '-o', output,
    '--no-playlist',
    '--newline',
    '--progress-template', DOWNLOAD_PROGRESS_TEMPLATE,
    '--progress-template', POSTPROCESS_PROGRESS_TEMPLATE,
    ...jsRuntimeArgs(),
    ...extraArgs,
    url,
  ]
}

export function parseSearchLine (line: string): ParsedSearchLine | null {
  const trimmed = line.trim()

  if (!trimmed) return null

  let json: unknown

  try {
    json = JSON.parse(trimmed)
  } catch {
    return null
  }

  if (!json || typeof json !== 'object') return null

  const record = json as Record<string, unknown>
  const title = record.title
  const id = record.id
  const duration = Number(record.duration)

  if (typeof title !== 'string' || !title || typeof id !== 'string' || !id) return null

  const channel = record.channel ?? record.uploader

  return {
    id,
    url: typeof record.url === 'string' ? record.url : `https://www.youtube.com/watch?v=${id}`,
    title,
    artist: typeof channel === 'string' ? channel : '',
    duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
    durationLabel: formatDuration(duration),
    thumbnail: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
  }
}

export function parseSearchOutput (stdout: string): YouTubeResult[] {
  const seen = new Set<string>()
  const results: YouTubeResult[] = []

  for (const line of stdout.split('\n')) {
    const parsed = parseSearchLine(line)

    if (parsed && !seen.has(parsed.id)) {
      seen.add(parsed.id)
      results.push(parsed)
    }
  }

  return results
}

export function parseProgressLine (line: string): ParsedProgressLine | null {
  const downloadMatch = line.match(/^download:(.+)$/)

  if (downloadMatch) {
    const [percentStr, speed, eta] = downloadMatch[1].split('|').map(part => part.trim())
    const percent = parseFloat(percentStr)

    return {
      status: 'download',
      percent: Number.isFinite(percent) ? percent : undefined,
      speed,
      eta,
    }
  }

  if (line.startsWith('postprocess:')) {
    return { postprocessor: line.slice('postprocess:'.length).trim() }
  }

  const legacy = line.match(/^\[download\]\s+(\d+(?:\.\d+)?)%/)

  if (legacy) {
    return { status: 'download', percent: parseFloat(legacy[1]) }
  }

  return null
}

export interface RunYtdlOptions {
  onLine?: (line: string) => void
}

export interface RunYtdlResult {
  stdout: string
  stderr: string
}

/**
 * Spawns the (configurable) yt-dlp binary, feeding each stdout/stderr line
 * to onLine (for progress) and resolving once the process exits cleanly.
 */
export async function runYtdl (args: string[], { onLine }: RunYtdlOptions = {}): Promise<RunYtdlResult> {
  await ensureYtdlBinary()

  const bin = getYtdlBin()

  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''

    const handleLine = (line: string) => {
      const trimmed = line.trim()

      if (trimmed && onLine) {
        try {
          onLine(trimmed)
        } catch (err) {
          log.error('onLine handler failed: %s', err instanceof Error ? err.message : String(err))
        }
      }
    }

    let child: ReturnType<typeof spawn>

    try {
      child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (err) {
      reject(err)

      return
    }

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')

    child.stdout.on('data', (chunk) => {
      const text = String(chunk)
      stdout += text

      for (const line of text.split('\n')) handleLine(line)
    })

    child.stderr.on('data', (chunk) => {
      const text = String(chunk)
      stderr += text

      for (const line of text.split('\n')) handleLine(line)
    })

    child.on('error', err => reject(err))

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })

        return
      }

      const tail = stderr.trim().split('\n').slice(-5).join('\n')
      const message = tail ? `: ${tail}` : ''

      reject(new Error(`yt-dlp exited with code ${code}${message}`))
    })
  })
}
