import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { open, close, db } from '../lib/Database.js'
import User from './User.js'
import { ValidationError } from '../lib/Errors.js'

let dir: string
let userA: number
let userB: number

const gainsA = [1, 0, 0, 0, 0, 0, 0, 0, 0, -1]
const gainsB = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'ke-user-eq-test-'))
  open({ file: join(dir, 'test.sqlite3'), ro: false })

  userA = await User.create({
    username: 'eqa',
    newPassword: 'eqaeqa12',
    newPasswordConfirm: 'eqaeqa12',
    name: 'EQ A',
  })
  userB = await User.create({
    username: 'eqb',
    newPassword: 'eqbeqb12',
    newPasswordConfirm: 'eqbeqb12',
    name: 'EQ B',
  })
})

afterAll(() => {
  close()
  rmSync(dir, { recursive: true, force: true })
})

describe('User EQ presets', () => {
  it('starts empty and merges slots per user', () => {
    expect(User.getEqPresets(userA)).toEqual({})

    expect(User.setEqPreset(userA, 'P1', gainsA)).toEqual({ P1: gainsA })
    expect(User.setEqPreset(userA, 'P2', gainsB)).toEqual({ P1: gainsA, P2: gainsB })
    expect(User.getEqPresets(userA)).toEqual({ P1: gainsA, P2: gainsB })
  })

  it('isolates users from each other', () => {
    expect(User.getEqPresets(userB)).toEqual({})
    expect(User.setEqPreset(userB, 'P1', gainsB)).toEqual({ P1: gainsB })
    expect(User.getEqPresets(userA)).toEqual({ P1: gainsA, P2: gainsB })
  })

  it('rejects bad slots, gains and unknown users', () => {
    expect(() => User.setEqPreset(userA, 'P9', gainsA)).toThrowError(ValidationError)
    expect(() => User.setEqPreset(userA, 'P1', [0, 0])).toThrowError(ValidationError)
    expect(() => User.setEqPreset(userA, 'P1', [0, 0, 0, 0, 0, 0, 0, 0, 0, Number.NaN])).toThrowError(ValidationError)
    expect(() => User.getEqPresets(424242)).toThrowError('User not found')
    expect(() => User.setEqPreset(424242, 'P1', gainsA)).toThrowError('User not found')
    expect(User.getEqPresets(userA)).toEqual({ P1: gainsA, P2: gainsB })
  })

  it('preserves other user-data keys on write', () => {
    db.run('UPDATE users SET data = ? WHERE userId = ?', [JSON.stringify({ eqPresets: {}, other: 1 }), userB])

    User.setEqPreset(userB, 'P3', gainsA)

    expect(db.get<{ data: string }>('SELECT data FROM users WHERE userId = ?', [userB])?.data).toContain('"other":1')
  })
})
