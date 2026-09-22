import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findDownloadedFile } from './registerDownload.js'

let dir: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'ke-find-download-test-'))
  writeFileSync(join(dir, 'ABBA - Dancing Queen.mp4'), 'video')
  writeFileSync(join(dir, 'ABBA - Dancing Queen.mp3'), 'audio without video')
  writeFileSync(join(dir, 'ABBA - Dancing Queen.txt'), 'notes')
  writeFileSync(join(dir, 'ABBA - Other Song.webm'), 'video')
  writeFileSync(join(dir, 'Solo - Audio.mp3'), 'audio without video')
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('findDownloadedFile', () => {
  it('locates the video file matching the base name', async () => {
    await expect(findDownloadedFile(dir, 'ABBA - Dancing Queen'))
      .resolves.toBe(join(dir, 'ABBA - Dancing Queen.mp4'))
  })

  it('returns null when only a non-video file matches', async () => {
    // .mp3 audio alone is not a downloadable video artifact
    await expect(findDownloadedFile(dir, 'Solo - Audio')).resolves.toBeNull()
  })

  it('returns null when nothing matches', async () => {
    await expect(findDownloadedFile(dir, 'Nobody - Nothing')).resolves.toBeNull()
  })
})
