import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { open, close, db } from '../lib/Database.js'
import { ConflictError, ValidationError } from '../lib/Errors.js'
import Tags from './Tags.js'

let dir: string
const admin = { isAdmin: true }
const manager = { isAdmin: false, permissions: { manageTags: true } }
const listener = { isAdmin: false, permissions: {} }

beforeAll(() => {
  mkdirSync(join(process.cwd(), 'tmp'), { recursive: true })
  dir = mkdtempSync(join(process.cwd(), 'tmp', 'tags-test-'))
  open({ file: join(dir, 'tags.sqlite3'), ro: false })
  db.run('INSERT INTO artists (name, nameNorm) VALUES (?, ?)', ['Artist', 'artist'])
  db.run('INSERT INTO songs (artistId, title, titleNorm) VALUES (?, ?, ?)', [1, 'Song', 'song'])
})

afterAll(() => {
  close()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  db.run('DELETE FROM songTags')
  db.run('DELETE FROM tags')
})

describe('Tags', () => {
  it('enforces case-insensitive unique names', () => {
    Tags.save(admin, null, { name: ' Error ', visibility: 'admin' })
    expect(() => Tags.save(admin, null, { name: 'error', visibility: 'public' })).toThrow(ConflictError)
  })

  it('exposes public and manager tags to everyone, but admin tags only to admins', () => {
    const pub = Tags.save(admin, null, { name: 'Public', visibility: 'public' })
    const mgr = Tags.save(admin, null, { name: 'Managed', visibility: 'manager' })
    const secret = Tags.save(admin, null, { name: 'Secret', visibility: 'admin' })
    Tags.assign(admin, 1, [pub.tagId, mgr.tagId, secret.tagId])

    expect(Tags.visible(admin).tags).toHaveLength(3)
    expect(Tags.visible(listener).tags.map(t => t.name)).toEqual(['Managed', 'Public'])
    expect(Tags.visible(listener).songTags[1]).toEqual([pub.tagId, mgr.tagId])
  })

  it('lets managers replace manager assignments without changing other tags', () => {
    const pub = Tags.save(admin, null, { name: 'Public', visibility: 'public' })
    const mgr = Tags.save(manager, null, { name: 'Managed', visibility: 'manager' })
    const secret = Tags.save(admin, null, { name: 'Secret', visibility: 'admin' })
    Tags.assign(admin, 1, [pub.tagId, secret.tagId])

    expect(() => Tags.assign(manager, 1, [pub.tagId])).toThrow(ValidationError)
    expect(Tags.visible(admin).songTags[1]).toEqual([pub.tagId, secret.tagId])
    Tags.assign(manager, 1, [mgr.tagId])
    expect(Tags.visible(admin).songTags[1]).toEqual([pub.tagId, mgr.tagId, secret.tagId])
    Tags.assign(manager, 1, [])
    expect(Tags.visible(admin).songTags[1]).toEqual([pub.tagId, secret.tagId])
  })

  it('keeps manager edits inside manager visibility', () => {
    const mgr = Tags.save(manager, null, { name: 'Managed', visibility: 'manager' })
    expect(() => Tags.save(manager, mgr.tagId, { name: 'Moved', visibility: 'public' })).toThrow(ValidationError)
    expect(() => Tags.save(listener, null, { name: 'No', visibility: 'manager' })).toThrow(ValidationError)
    expect(Tags.get(mgr.tagId).name).toBe('Managed')
  })
})
