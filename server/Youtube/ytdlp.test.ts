import { describe, it, expect, vi } from 'vitest'
import { spawn } from 'child_process'
import { EventEmitter } from 'events'
import {
  getYtdlBin,
  parseVideoId,
  formatDuration,
  buildSearchArgs,
  buildStreamArgs,
  buildVideoMetadataArgs,
  buildDownloadArgs,
  parseSearchLine,
  parseSearchOutput,
  parseProgressLine,
  searchYoutube,
  resolveVideo,
  resolveStreamUrl,
  runYtdl,
  setYtdlBin,
  getYtdlVersion,
  updateYtdl,
} from './ytdlp.js'

vi.mock('child_process', () => ({ spawn: vi.fn() }))

interface FakeChildOptions {
  stdoutLines?: string[]
  stderrLines?: string[]
  code?: number
}

function fakeChild (options: FakeChildOptions = {}) {
  const { stdoutLines = [], stderrLines = [], code = 0 } = options
  const stdout = new EventEmitter() as EventEmitter & { setEncoding: (enc: string) => void }
  const stderr = new EventEmitter() as EventEmitter & { setEncoding: (enc: string) => void }
  const handlers: Record<string, (arg?: unknown) => void> = {}

  stdout.setEncoding = () => {}
  stderr.setEncoding = () => {}

  const child = {
    stdout,
    stderr,
    on (event: string, cb: (arg?: unknown) => void) {
      handlers[event] = cb
    },
  }

  queueMicrotask(() => {
    for (const line of stdoutLines) stdout.emit('data', line)
    for (const line of stderrLines) stderr.emit('data', line)
    handlers['close']?.(code)
  })

  return child
}

describe('getYtdlBin', () => {
  it('defaults to yt-dlp when KES_YTDL_BIN is not set', () => {
    delete process.env.KES_YTDL_BIN
    expect(getYtdlBin()).toBe('yt-dlp')
  })

  it('uses KES_YTDL_BIN when set', () => {
    process.env.KES_YTDL_BIN = '/custom/yt-dlp'
    expect(getYtdlBin()).toBe('/custom/yt-dlp')
    delete process.env.KES_YTDL_BIN
  })

  it('setYtdlBin overrides KES_YTDL_BIN', () => {
    process.env.KES_YTDL_BIN = '/custom/yt-dlp'
    setYtdlBin('/prefs/yt-dlp')
    expect(getYtdlBin()).toBe('/prefs/yt-dlp')
    setYtdlBin(null)
    expect(getYtdlBin()).toBe('/custom/yt-dlp')
    delete process.env.KES_YTDL_BIN
  })
})

describe('parseVideoId', () => {
  it('parses watch URLs', () => {
    expect(parseVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('parses youtu.be short links', () => {
    expect(parseVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('parses shorts URLs', () => {
    expect(parseVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('returns null for non-YouTube URLs', () => {
    expect(parseVideoId('https://vimeo.com/12345')).toBe(null)
    expect(parseVideoId('https://example.com')).toBe(null)
  })
})

describe('formatDuration', () => {
  it('formats seconds as M:SS', () => {
    expect(formatDuration(62)).toBe('1:02')
    expect(formatDuration(0)).toBe('')
  })

  it('renders minutes above an hour', () => {
    expect(formatDuration(3600)).toBe('60:00')
  })
})

describe('buildSearchArgs', () => {
  it('appends karaoke to the query and returns flat playlist JSON args', () => {
    const args = buildSearchArgs('Dancing Queen')
    expect(args[0]).toBe('ytsearch15:"Dancing Queen karaoke"')
    expect(args).toContain('--flat-playlist')
    expect(args).toContain('--no-playlist')
    expect(args).toContain('-j')
  })

  it('respects a custom count', () => {
    const args = buildSearchArgs('Bad Guy', { count: 5 })
    expect(args[0]).toBe('ytsearch5:"Bad Guy karaoke"')
  })

  it('does not duplicate karaoke when already in the query', () => {
    const args = buildSearchArgs('Dancing Queen karaoke')
    expect(args[0]).toBe('ytsearch15:"Dancing Queen karaoke"')
  })
})

describe('buildStreamArgs', () => {
  it('uses worst progressive mp4 and the android player client', () => {
    const args = buildStreamArgs('https://www.youtube.com/watch?v=abc')
    expect(args).toContain('-g')
    expect(args).toContain('-f')
    expect(args.find(x => x.startsWith('worst[ext=mp4]'))).toBeDefined()
    expect(args).toContain('--extractor-args')
    expect(args[args.indexOf('--extractor-args') + 1]).toBe('youtube:player_client=android')
    expect(args).toContain('--no-playlist')
    expect(args[args.length - 1]).toBe('https://www.youtube.com/watch?v=abc')
  })
})

describe('buildVideoMetadataArgs', () => {
  it('asks for single-video JSON metadata', () => {
    const args = buildVideoMetadataArgs('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(args).toContain('--no-playlist')
    expect(args).toContain('-j')
    expect(args[args.length - 1]).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })
})

describe('buildDownloadArgs', () => {
  it('uses the best mp4 format, output template, newline and progress templates', () => {
    const args = buildDownloadArgs(
      'https://www.youtube.com/watch?v=abc',
      '/media/ABBA - Dancing Queen.%(ext)s',
      [],
    )
    expect(args).toContain('-f')
    expect(args).toContain('bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best')
    expect(args).toContain('-o')
    expect(args).toContain('/media/ABBA - Dancing Queen.%(ext)s')
    expect(args).toContain('--no-playlist')
    expect(args).toContain('--newline')
    expect(args).toContain('--progress-template')
  })

  it('appends extra args before the URL', () => {
    const args = buildDownloadArgs(
      'https://www.youtube.com/watch?v=abc',
      '/media/out.%(ext)s',
      ['--postprocessor-args', 'ffmpeg:-threads 1'],
    )
    expect(args[args.length - 1]).toBe('https://www.youtube.com/watch?v=abc')
    expect(args[args.length - 2]).toBe('ffmpeg:-threads 1')
  })
})

describe('parseSearchLine', () => {
  it('maps a flat playlist JSON line to a result', () => {
    const line = JSON.stringify({
      id: 'dQw4w9WgXcQ',
      title: 'Dancing Queen (Karaoke Version)',
      channel: 'SingKing Karaoke',
      duration: 240,
    })
    const res = parseSearchLine(line)
    expect(res).toEqual({
      id: 'dQw4w9WgXcQ',
      url: expect.stringContaining('watch?v=dQw4w9WgXcQ'),
      title: 'Dancing Queen (Karaoke Version)',
      artist: 'SingKing Karaoke',
      duration: 240,
      durationLabel: '4:00',
      thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
    })
  })

  it('returns null for non-JSON or empty lines', () => {
    expect(parseSearchLine('')).toBe(null)
    expect(parseSearchLine('not json')).toBe(null)
  })
})

describe('parseSearchOutput', () => {
  it('parses multiple JSON lines, ignores junk and de-dupes by id', () => {
    const line = id => JSON.stringify({ id, title: 'Song ' + id, channel: 'Chan', duration: 120 })
    const stdout = `${line('a')}\nWARNING: something\n${line('a')}\n${line('b')}\n`
    const res = parseSearchOutput(stdout)
    expect(res).toHaveLength(2)
    expect(res[0].id).toBe('a')
    expect(res[1].id).toBe('b')
  })

  it('returns qrcode otherwise', () => {
    expect(parseSearchOutput('')).toEqual([])
  })
})

describe('parseProgressLine', () => {
  it('parses download progress lines', () => {
    const parsed = parseProgressLine('download: 45.2%| 1.2MiB/s | 00:12 | dQw4w9WgXcQ')
    expect(parsed).toMatchObject({ status: 'download', percent: 45.2 })
    expect(parsed.speed).toBe('1.2MiB/s')
    expect(parsed.eta).toBe('00:12')
  })

  it('parses 100% as completion', () => {
    const parsed = parseProgressLine('[download]  100.0% of 2.00MiB in 00:00  at 20.0MiB/s ')
    expect(parsed).toMatchObject({ status: 'download', percent: 100 })
  })

  it('parses postprocessor / merger lines', () => {
    const parsed = parseProgressLine('postprocess:Merger')
    expect(parsed).toMatchObject({ postprocessor: 'Merger' })
  })

  it('returns null for unrelated lines', () => {
    expect(parseProgressLine('Downloading item 1 of 15')).toBe(null)
  })
})

describe('runYtdl', () => {
  it('captures stdout/stderr and forwards lines to onLine', async () => {
    const onLine = vi.fn()
    vi.mocked(spawn).mockImplementation(() => fakeChild({
      stdoutLines: ['line1\n', 'line2\n'],
      stderrLines: ['warn\n'],
    }) as unknown as ReturnType<typeof spawn>)

    const res = await runYtdl(['-V'], { onLine })

    expect(res.stdout).toBe('line1\nline2\n')
    expect(res.stderr).toBe('warn\n')
    expect(onLine).toHaveBeenCalledWith('line1')
    expect(onLine).toHaveBeenCalledWith('line2')
    expect(onLine).toHaveBeenCalledWith('warn')
  })

  it('rejects when the process exits non-zero', async () => {
    vi.mocked(spawn).mockImplementation(() => fakeChild({
      stderrLines: ['ERROR: boom\n'],
      code: 1,
    }) as unknown as ReturnType<typeof spawn>)

    await expect(runYtdl(['-V'])).rejects.toThrow(/exited with code 1/)
  })
})

describe('getYtdlVersion', () => {
  it('returns the trimmed --version output', async () => {
    vi.mocked(spawn).mockImplementation(() => fakeChild({
      stdoutLines: ['2025.12.17\n'],
    }) as unknown as ReturnType<typeof spawn>)

    await expect(getYtdlVersion()).resolves.toBe('2025.12.17')
  })

  it('returns null when yt-dlp is missing or fails', async () => {
    vi.mocked(spawn).mockImplementation(() => fakeChild({
      stderrLines: ['yt-dlp: not found\n'],
      code: 2,
    }) as unknown as ReturnType<typeof spawn>)

    await expect(getYtdlVersion()).resolves.toBe(null)
  })
})

describe('updateYtdl', () => {
  it('runs the default [bin, -U] command and returns the new version', async () => {
    vi.mocked(spawn).mockClear()
    vi.mocked(spawn)
      .mockImplementationOnce(() => fakeChild({
        stdoutLines: ['Latest version: 2025.12.17, Current version: 2025.10.1, Update is required!\n'],
      }) as unknown as ReturnType<typeof spawn>)
      .mockImplementationOnce(() => fakeChild({
        stdoutLines: ['2025.12.17\n'],
      }) as unknown as ReturnType<typeof spawn>)

    const res = await updateYtdl()

    expect(spawn).toHaveBeenNthCalledWith(1, 'yt-dlp', ['-U'], expect.anything())
    expect(res).toEqual({
      ok: true,
      output: 'Latest version: 2025.12.17, Current version: 2025.10.1, Update is required!',
      version: '2025.12.17',
    })
  })

  it('honours KES_YTDL_UPDATE_CMD for pip-managed installs', async () => {
    process.env.KES_YTDL_UPDATE_CMD = 'pip3 install -U yt-dlp'
    vi.mocked(spawn).mockClear()
    vi.mocked(spawn)
      .mockImplementationOnce(() => fakeChild({}) as unknown as ReturnType<typeof spawn>)
      .mockImplementationOnce(() => fakeChild({
        stdoutLines: ['2025.12.17\n'],
      }) as unknown as ReturnType<typeof spawn>)

    await updateYtdl()

    expect(spawn).toHaveBeenNthCalledWith(1, 'pip3', ['install', '-U', 'yt-dlp'], expect.anything())
    delete process.env.KES_YTDL_UPDATE_CMD
  })

  it('reports ok:false when the update exits non-zero', async () => {
    vi.mocked(spawn).mockClear()
    vi.mocked(spawn)
      .mockImplementationOnce(() => fakeChild({
        stderrLines: ['ERROR: failed to update\n'],
        code: 1,
      }) as unknown as ReturnType<typeof spawn>)
      .mockImplementationOnce(() => fakeChild({
        stdoutLines: ['2025.10.1\n'],
      }) as unknown as ReturnType<typeof spawn>)

    const res = await updateYtdl()

    expect(res.ok).toBe(false)
    expect(res.output).toContain('ERROR: failed to update')
    expect(res.version).toBe('2025.10.1')
  })
})

describe('searchYoutube', () => {
  it('spawns with ytsearch args and parses the output', async () => {
    const line = JSON.stringify({
      id: 'dQw4w9WgXcQ',
      title: 'Dancing Queen (Karaoke)',
      channel: 'SingKing',
      duration: 240,
    })
    vi.mocked(spawn).mockImplementation(() => fakeChild({
      stdoutLines: [`${line}\n`],
    }) as unknown as ReturnType<typeof spawn>)

    const results = await searchYoutube('Dancing Queen', { count: 5 })

    expect(spawn).toHaveBeenCalledWith(
      expect.stringContaining('yt-dlp'),
      expect.arrayContaining(['ytsearch5:"Dancing Queen karaoke"']),
      expect.anything(),
    )
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('dQw4w9WgXcQ')
    expect(results[0].durationLabel).toBe('4:00')
  })
})

describe('resolveVideo', () => {
  it('spawns with no-playlist JSON args and parses a single video result', async () => {
    const line = JSON.stringify({
      id: 'dQw4w9WgXcQ',
      title: 'Dancing Queen (Karaoke Version)',
      channel: 'SingKing Karaoke',
      duration: 240,
    })
    vi.mocked(spawn).mockImplementation(() => fakeChild({
      stdoutLines: [`noise\n${line}\n`],
    }) as unknown as ReturnType<typeof spawn>)

    const result = await resolveVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ')

    expect(spawn).toHaveBeenCalledWith(
      expect.stringContaining('yt-dlp'),
      expect.arrayContaining(['--no-playlist', '-j', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ']),
      expect.anything(),
    )
    expect(result.id).toBe('dQw4w9WgXcQ')
    expect(result.durationLabel).toBe('4:00')
  })

  it('throws when yt-dlp returns no metadata', async () => {
    vi.mocked(spawn).mockImplementation(() => fakeChild({
      stdoutLines: ['\n'],
    }) as unknown as ReturnType<typeof spawn>)

    await expect(resolveVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))
      .rejects.toThrow('yt-dlp did not return video metadata')
  })
})

describe('resolveStreamUrl', () => {
  it('returns the first non-empty output line', async () => {
    vi.mocked(spawn).mockImplementation(() => fakeChild({
      stdoutLines: ['https://example.com/stream.mp4\n'],
    }) as unknown as ReturnType<typeof spawn>)

    const url = await resolveStreamUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')

    expect(url).toBe('https://example.com/stream.mp4')
  })
})
