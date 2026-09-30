import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { open, close, db } from '../lib/Database.js'
import Rooms from './Rooms.js'
import { NotFoundError, ValidationError } from '../lib/Errors.js'

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

  it('merges eq prefs, leaving qr and the rest intact', () => {
    const eq = { eqEnabled: true, eqGains: [1, 0, 0, 0, 0, 0, 0, 0, 0, -1], eqPreset: 'Custom' }
    const merged = Rooms.setRoomOptions(1, { prefs: { eq } }) as { eq: object, qr: object }

    expect(merged.eq).toEqual(eq)
    expect(merged.qr).toMatchObject({ isEnabled: false })

    const stored = db.get<{ data: string }>('SELECT data FROM rooms WHERE roomId = 1')
    expect(JSON.parse(stored.data).prefs).toEqual(merged)
  })

  it('merges partial eq updates over stored eq', () => {
    const merged = Rooms.setRoomOptions(1, {
      prefs: { eq: { eqPreset: 'Rock' } },
    }) as { eq: Record<string, unknown> }

    expect(merged.eq).toMatchObject({
      eqEnabled: true,
      eqGains: [1, 0, 0, 0, 0, 0, 0, 0, 0, -1],
      eqPreset: 'Rock',
    })
  })

  it('rejects malformed eq prefs', () => {
    expect(() => Rooms.setRoomOptions(1, {
      prefs: { eq: { eqGains: [0, 0] } },
    })).toThrowError(ValidationError)
    expect(() => Rooms.setRoomOptions(1, {
      prefs: { eq: { eqEnabled: 'yes' } },
    })).toThrowError(ValidationError)
    expect(() => Rooms.setRoomOptions(1, {
      prefs: { eq: { eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, Number.NaN] } },
    })).toThrowError(ValidationError)
  })
})

describe('Rooms room-password format', () => {
  it('stores new passwords reversibly (base64)', async () => {
    await Rooms.set(1, { name: 'Room 1', status: 'open', password: 'secret', prefs: {} })

    const stored = db.get<{ password: string }>('SELECT password FROM rooms WHERE roomId = 1')
    expect(stored.password).toBe(Buffer.from('secret', 'utf8').toString('base64'))
  })

  it('verifies the reversible format and rejects wrong passwords', async () => {
    await expect(Rooms.validate(1, 'secret', {})).resolves.toBe(true)
    await expect(Rooms.validate(1, 'wrong', {})).rejects.toThrow('Incorrect room password')
  })

  it('verifies legacy hashes and rewrites them on success', async () => {
    const bcrypt = (await import('bcryptjs')).default
    const legacy = bcrypt.hashSync('oldsecret', 4)
    db.run('UPDATE rooms SET password = ? WHERE roomId = 1', [legacy])

    await expect(Rooms.validate(1, 'oldsecret', {})).resolves.toBe(true)

    const stored = db.get<{ password: string }>('SELECT password FROM rooms WHERE roomId = 1')
    expect(stored.password).toBe(Buffer.from('oldsecret', 'utf8').toString('base64'))
    await expect(Rooms.validate(1, 'nope', {})).rejects.toThrow('Incorrect room password')
  })

  it('exposes the reversible key but never legacy hashes', () => {
    db.run('UPDATE rooms SET password = ? WHERE roomId = 1', ['$2b$10$abcdef'])

    const hashed = Rooms.get(1, { status: ['open', 'closed'] }).entities[1]
    expect(hashed.qrPassword).toBeNull()

    db.run('UPDATE rooms SET password = ? WHERE roomId = 1', [Buffer.from('s3', 'utf8').toString('base64')])

    const clear = Rooms.get(1, { status: ['open', 'closed'] }).entities[1]
    expect(clear.qrPassword).toBe(Buffer.from('s3', 'utf8').toString('base64'))
  })
})
