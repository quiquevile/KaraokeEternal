import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { open, close, db } from '../lib/Database.js'
import Rooms from './Rooms.js'
import { NotFoundError } from '../lib/Errors.js'

let dir: string

const data = (prefs: object) => JSON.stringify({ prefs })

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'ke-rooms-test-'))
  open({ file: join(dir, 'test.sqlite3'), ro: false })

  db.run('INSERT INTO rooms (name, status, password, data) VALUES (?, ?, ?, ?)',
    ['Room 1', 'open', null, data({
      qr: { isEnabled: true, size: 0.5, opacity: 0.625, password: 'secret', includePassword: true },
      roles: { 3: { allowNew: false } },
      user: { isGuestAllowed: true },
    })])
})

afterAll(() => {
  close()
  rmSync(dir, { recursive: true, force: true })
})

describe('Rooms.setRoomOptions', () => {
  it('merges only qr prefs, leaving everything else intact', () => {
    const merged = Rooms.setRoomOptions(1, {
      prefs: { qr: { isEnabled: false }, roles: { 3: { allowNew: true } }, user: { isGuestAllowed: false } },
    }) as { qr: Record<string, unknown>, roles: object, user: object }

    // qr merged, roles/user untouched despite being sent
    expect(merged.qr).toMatchObject({ isEnabled: false, password: 'secret', includePassword: true })
    expect(merged.roles).toEqual({ 3: { allowNew: false } })
    expect(merged.user).toEqual({ isGuestAllowed: true })

    const stored = db.get<{ data: string }>('SELECT data FROM rooms WHERE roomId = 1')
    expect(JSON.parse(stored.data).prefs).toEqual(merged)
  })

  it('throws NotFoundError for unknown rooms', () => {
    expect(() => Rooms.setRoomOptions(999, { prefs: {} })).toThrowError(NotFoundError)
  })
})
