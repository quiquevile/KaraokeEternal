import { describe, it, expect, vi } from 'vitest'
import { DownloadManager, type DownloadJob, type DownloadManagerDeps } from './downloadManager.js'
import { buildDownloadArgs, parseProgressLine } from './ytdlp.js'

type FakeYtdl = (args: string[], opts: { onLine: (line: string) => void }) => Promise<unknown>
type FakeRegister = (opts: { job: DownloadJob, io: unknown }) => Promise<void>

interface JobOverrides {
  url?: string
  artist?: string
  title?: string
  baseName?: string
  destDir?: string
}

function makeJob (overrides: JobOverrides = {}) {
  return {
    url: overrides.url ?? 'https://www.youtube.com/watch?v=abc',
    artist: overrides.artist ?? 'ABBA',
    title: overrides.title ?? 'Dancing Queen',
    artistNorm: 'ABBA',
    titleNorm: 'Dancing Queen',
    thumbnail: null,
    destDir: overrides.destDir ?? '/media/musica',
    pathRoot: '/media',
    pathId: 1,
    baseName: overrides.baseName ?? 'ABBA - Dancing Queen',
    extraArgs: [],
  }
}

function makeDeps (opts: {
  outcome?: 'ok' | 'fail'
  lines?: string[]
} = {}) {
  const { outcome = 'ok', lines = ['download:100.0%| 2.0MiB/s | 00:00 | abc', 'postprocess:Merger'] } = opts

  return {
    buildDownloadArgs,
    parseProgressLine,
    runYtdl: vi.fn<FakeYtdl>(async (args, { onLine }) => {
      if (outcome === 'fail') throw new Error('boom')
      for (const line of lines) {
        onLine(line)
        await new Promise(resolve => setTimeout(resolve, 5))
      }
    }),
    registerDownload: vi.fn<FakeRegister>(async () => {}),
  } satisfies DownloadManagerDeps
}

describe('DownloadManager', () => {
  it('enqueues a job, downloads it and marks it complete with 100% progress', async () => {
    const deps = makeDeps()
    const manager = new DownloadManager({ deps })
    const job = manager.enqueue(makeJob())

    expect(job.status).toBe('queued')
    await vi.waitFor(() => expect(job.status).toBe('complete'))
    expect(job.progress).toBe(100)
    expect(deps.registerDownload).toHaveBeenCalledTimes(1)
  })

  it('reports merging phase when a postprocessor line arrives', async () => {
    const deps = makeDeps({ lines: ['download:50%| 1.0MiB/s | 00:10 | abc', 'postprocess:Merger'] })
    const manager = new DownloadManager({ deps })
    const job = manager.enqueue(makeJob())

    let sawMerging = false
    const deadline = Date.now() + 2000

    while (Date.now() < deadline) {
      if (job.status === 'merging') sawMerging = true
      if (job.status === 'complete') break

      await new Promise(resolve => setTimeout(resolve, 0))
    }

    expect(sawMerging).toBe(true)
    await vi.waitFor(() => expect(job.status).toBe('complete'))
    expect(job.progress).toBe(100)
  })

  it('passes the output template with the resolved base name to yt-dlp', async () => {
    const deps = makeDeps()
    const manager = new DownloadManager({ deps })
    manager.enqueue(makeJob({ baseName: 'ABBA - Dancing Queen', destDir: '/media/musica' }))

    await vi.waitFor(() => expect(deps.runYtdl).toHaveBeenCalledTimes(1))
    const args = deps.runYtdl.mock.calls[0][0]
    expect(args).toContain('/media/musica/ABBA - Dancing Queen.%(ext)s')
    expect(args).toContain('https://www.youtube.com/watch?v=abc')
  })

  it('downloads jobs serially, never two at once', async () => {
    let activeCount = 0
    let maxActive = 0
    const deps = {
      buildDownloadArgs,
      parseProgressLine,
      runYtdl: vi.fn<FakeYtdl>(async () => {
        activeCount++
        if (activeCount > maxActive) maxActive = activeCount
        await new Promise(resolve => setTimeout(resolve, 10))
        activeCount--
      }),
      registerDownload: vi.fn<FakeRegister>(async () => {}),
    } satisfies DownloadManagerDeps
    const manager = new DownloadManager({ deps })
    const a = manager.enqueue(makeJob({ url: 'https://www.youtube.com/watch?v=a' }))
    const b = manager.enqueue(makeJob({ url: 'https://www.youtube.com/watch?v=b' }))

    await vi.waitFor(() => expect(a.status).toBe('complete'))
    await vi.waitFor(() => expect(b.status).toBe('complete'))
    expect(maxActive).toBe(1)
  })

  it('passes the bound io to registerDownload', async () => {
    const deps = makeDeps()
    const manager = new DownloadManager({ deps })
    const io = { emit: vi.fn() }
    manager.bindIo(io)
    manager.enqueue(makeJob())
    await vi.waitFor(() => expect(deps.registerDownload).toHaveBeenCalledTimes(1))
    expect(deps.registerDownload.mock.calls[0][0].io).toBe(io)
  })

  it('marks the job as failed when the download throws and continues with the queue', async () => {
    const deps = makeDeps()
    deps.runYtdl.mockImplementationOnce(async () => {
      throw new Error('boom')
    })
    const manager = new DownloadManager({ deps })
    const a = manager.enqueue(makeJob({ url: 'https://www.youtube.com/watch?v=a' }))
    const b = manager.enqueue(makeJob({ url: 'https://www.youtube.com/watch?v=b' }))

    await vi.waitFor(() => expect(a.status).toBe('failed'))
    expect(a.error).toBe('boom')
    await vi.waitFor(() => expect(b.status).toBe('complete'))
  })

  it('clears the download history', async () => {
    const deps = makeDeps()
    const manager = new DownloadManager({ deps })
    manager.enqueue(makeJob())

    await vi.waitFor(() => expect(manager.getStatus().history.length).toBe(1))

    manager.clearHistory()

    expect(manager.getStatus().history).toEqual([])
  })

  it('removes a single job from the download history', async () => {
    const deps = makeDeps()
    const manager = new DownloadManager({ deps })
    manager.enqueue(makeJob({ url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' }))
    manager.enqueue(makeJob({ url: 'https://www.youtube.com/watch?v=bbbbbbbbbbb' }))

    await vi.waitFor(() => expect(manager.getStatus().history.length).toBe(2))

    expect(manager.removeHistory('aaaaaaaaaaa')).toBe(true)
    expect(manager.getStatus().history.map(job => job.id)).toEqual(['bbbbbbbbbbb'])
    expect(manager.removeHistory('nope')).toBe(false)
  })
})
