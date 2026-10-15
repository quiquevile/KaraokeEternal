import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { atomicRenameAll } from './fsUtils.js'

let dir: string

const write = (name: string, content: string): string => {
  const file = path.join(dir, name)
  fs.writeFileSync(file, content)

  return file
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ke-fsutils-test-'))
})

afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('atomicRenameAll', () => {
  it('renames within a filesystem', () => {
    const from = write('a.txt', 'hello')

    atomicRenameAll([{ from, to: path.join(dir, 'b.txt') }])

    expect(fs.existsSync(from)).toBe(false)
    expect(fs.readFileSync(path.join(dir, 'b.txt'), 'utf8')).toBe('hello')
  })

  it('falls back to copy+delete across filesystems (EXDEV)', () => {
    const from = write('a.txt', 'hello')
    const to = path.join(dir, 'b.txt')
    const rename = vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
      throw Object.assign(new Error('EXDEV'), { code: 'EXDEV' })
    })

    atomicRenameAll([{ from, to }])

    expect(rename).toHaveBeenCalledTimes(1)
    expect(fs.existsSync(from)).toBe(false)
    expect(fs.readFileSync(to, 'utf8')).toBe('hello')
  })

  it('leaves the source untouched when the copy fails', () => {
    const from = write('a.txt', 'hello')
    vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
      throw Object.assign(new Error('EXDEV'), { code: 'EXDEV' })
    })
    vi.spyOn(fs, 'copyFileSync').mockImplementationOnce(() => {
      throw new Error('no space')
    })

    expect(() => atomicRenameAll([{ from, to: path.join(dir, 'b.txt') }])).toThrow('no space')
    expect(fs.readFileSync(from, 'utf8')).toBe('hello')
  })

  it('rethrows non-EXDEV errors without copying', () => {
    const from = write('a.txt', 'hello')
    const copy = vi.spyOn(fs, 'copyFileSync')
    vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
      throw Object.assign(new Error('EACCES'), { code: 'EACCES' })
    })

    expect(() => atomicRenameAll([{ from, to: path.join(dir, 'b.txt') }])).toThrow('EACCES')
    expect(copy).not.toHaveBeenCalled()
    expect(fs.readFileSync(from, 'utf8')).toBe('hello')
  })

  it('rolls back completed moves when a later one fails', () => {
    const a = write('a.txt', 'aaa')
    const b = write('b.txt', 'bbb')

    vi.spyOn(fs, 'renameSync').mockImplementationOnce(fs.renameSync).mockImplementationOnce(() => {
      throw Object.assign(new Error('EXDEV'), { code: 'EXDEV' })
    })
    vi.spyOn(fs, 'copyFileSync').mockImplementationOnce(() => {
      throw new Error('no space')
    })

    expect(() => atomicRenameAll([
      { from: a, to: path.join(dir, 'a2.txt') },
      { from: b, to: path.join(dir, 'b2.txt') },
    ])).toThrow('no space')
    expect(fs.readFileSync(a, 'utf8')).toBe('aaa')
    expect(fs.readFileSync(b, 'utf8')).toBe('bbb')
  })
})
