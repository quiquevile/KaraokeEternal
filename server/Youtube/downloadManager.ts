import { buildDownloadArgs, parseProgressLine, parseVideoId, runYtdl, type ParsedProgressLine } from './ytdlp.js'
import registerDownload from './registerDownload.js'

export type DownloadJobStatus = 'queued' | 'downloading' | 'merging' | 'registering' | 'complete' | 'failed'

export interface DownloadJobInput {
  url: string
  artist: string
  artistNorm: string
  title: string
  titleNorm: string
  thumbnail: string | null
  destDir: string
  pathRoot: string
  pathId: number
  baseName: string
  extraArgs?: string[]
}

export interface DownloadJob extends DownloadJobInput {
  id: string
  status: DownloadJobStatus
  progress: number
  error: string | null
  dateQueued: number
  dateCompleted: number | null
}

export interface DownloadManagerDeps {
  buildDownloadArgs: typeof buildDownloadArgs
  runYtdl: (args: string[], opts: { onLine: (line: string) => void }) => Promise<unknown>
  parseProgressLine: (line: string) => ParsedProgressLine | null
  registerDownload: (opts: { job: DownloadJob, io: unknown }) => Promise<void>
}

export interface DownloadReport {
  active: DownloadJob | null
  queue: DownloadJob[]
  history: DownloadJob[]
}

const HISTORY_LIMIT = 50

const defaultDeps: DownloadManagerDeps = {
  buildDownloadArgs,
  runYtdl,
  parseProgressLine,
  registerDownload,
}

export class DownloadManager {
  private readonly deps: DownloadManagerDeps
  private active: DownloadJob | null = null
  private readonly queue: DownloadJob[] = []
  private readonly history: DownloadJob[] = []
  private io: unknown = null

  constructor (options: { deps?: DownloadManagerDeps } = {}) {
    this.deps = options.deps ?? defaultDeps
  }

  bindIo (io: unknown): void {
    this.io = io
  }

  getStatus (): DownloadReport {
    return {
      active: this.active,
      queue: [...this.queue],
      history: [...this.history],
    }
  }

  enqueue (input: DownloadJobInput): DownloadJob {
    const job: DownloadJob = {
      ...input,
      id: parseVideoId(input.url) ?? input.url,
      status: 'queued',
      progress: 0,
      error: null,
      dateQueued: Date.now(),
      dateCompleted: null,
    }

    this.queue.push(job)

    queueMicrotask(() => {
      this.processNext()
    })

    return job
  }

  private async processNext (): Promise<void> {
    if (this.active) return

    const job = this.queue.shift()

    if (!job) return

    this.active = job

    try {
      const output = `${job.destDir}/${job.baseName}.%(ext)s`
      const args = this.deps.buildDownloadArgs(job.url, output, job.extraArgs ?? [])

      job.status = 'downloading'

      await this.deps.runYtdl(args, {
        onLine: (line) => {
          const parsed = this.deps.parseProgressLine(line)

          if (!parsed) return

          if (parsed.postprocessor) {
            job.status = 'merging'
          }

          if (typeof parsed.percent === 'number' && Number.isFinite(parsed.percent)) {
            job.progress = parsed.percent
          }
        },
      })

      job.status = 'registering'
      await this.deps.registerDownload({ job, io: this.io })
      job.status = 'complete'
      job.progress = 100
      job.dateCompleted = Date.now()
    } catch (err) {
      job.status = 'failed'
      job.error = err instanceof Error ? err.message : String(err)
      job.dateCompleted = Date.now()
    } finally {
      this.history.push(job)

      if (this.history.length > HISTORY_LIMIT) this.history.shift()

      this.active = null
      void this.processNext()
    }
  }
}

export const downloadManager = new DownloadManager()
