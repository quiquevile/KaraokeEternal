import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { open, close, db } from '../lib/Database.js'
import crypto from '../lib/crypto.js'
import User from './User.js'

// getById reports a miss as false; tests want the entity or a hard failure
function getOrThrow (userId: number, creds: boolean = false) {
  const found = User.getById(userId, creds)
  if (found === false) throw new Error(`expected user ${userId}`)
  return found
}

let dir: string
let creatorId: number
let standardId: number

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'ke-ghosts-test-'))
  open({ file: join(dir, 'test.sqlite3'), ro: false })

  creatorId = await User.create({
    username: 'ghostmgr',
    newPassword: 'ghostmgr12',
    newPasswordConfirm: 'ghostmgr12',
    name: 'Ghost Manager',
  })
  standardId = await User.create({
    username: 'standard',
    newPassword: 'standard12',
    newPasswordConfirm: 'standard12',
    name: 'Standard',
  })
})

afterAll(() => {
  close()
  rmSync(dir, { recursive: true, force: true })
})

describe('ghost users', () => {
  it('creates ghosts with an auto username, no password and a creator', async () => {
    const ghostId = await User.create({ name: 'Ana', createdBy: creatorId }, 'ghost')
    const ghost = getOrThrow(ghostId, true)

    expect(ghost).toMatchObject({
      role: 'ghost',
      name: 'Ana',
      createdBy: creatorId,
      password: 'guest',
    })
    expect(ghost!.username).toMatch(/^ghost-[a-zA-Z0-9]{5}$/)
    expect(JSON.parse(String(getOrThrow(ghostId).permissions))).toEqual({})
  })

  it('rejects ghosts without a creator', async () => {
    await expect(User.create({ name: 'No Creator' }, 'ghost'))
      .rejects.toThrow('A ghost user requires its creator')
  })

  it('ignores preset permissions on ghosts', async () => {
    const ghostId = await User.create(
      { name: 'No Perms', permissions: { queueForOthers: true }, createdBy: creatorId },
      'ghost',
    )

    expect(JSON.parse(String(getOrThrow(ghostId).permissions))).toEqual({})
  })

  it('lists createdBy in get()', async () => {
    const ghostId = await User.create({ name: 'Listed', createdBy: creatorId }, 'ghost')
    const users = User.get()

    expect(users.entities[ghostId]).toMatchObject({ role: 'ghost', createdBy: creatorId })
  })

  it('never lets a ghost sign in, even with a real password', async () => {
    const ghostId = await User.create({ name: 'Signin', createdBy: creatorId }, 'ghost')
    const ghost = getOrThrow(ghostId, true)
    const hashed = await crypto.hash('supersecret123')

    // simulate someone setting an actual password on the ghost
    db.run('UPDATE users SET password = ? WHERE userId = ?', [hashed, ghostId])

    await expect(User.validate({ username: ghost.username, password: 'supersecret123' }))
      .rejects.toThrow('Incorrect username or password')
  })

  it('removes a creator\'s ghosts with them (cascade)', async () => {
    const doomed = await User.create({
      username: 'doomed',
      newPassword: 'doomed123',
      newPasswordConfirm: 'doomed123',
      name: 'Doomed',
    })
    const g1 = await User.create({ name: 'D1', createdBy: doomed }, 'ghost')
    const g2 = await User.create({ name: 'D2', createdBy: doomed }, 'ghost')

    User.remove(doomed)

    expect(User.getById(doomed)).toBe(false)
    expect(User.getById(g1)).toBe(false)
    expect(User.getById(g2)).toBe(false)
    // other users untouched
    expect(User.getById(creatorId)).not.toBe(false)
    expect(User.getById(standardId)).not.toBe(false)
  })

  it('removeGhostsByCreator only removes that creator\'s ghosts', async () => {
    const otherGhost = await User.create({ name: 'Other', createdBy: standardId }, 'ghost')
    const g1 = await User.create({ name: 'R1', createdBy: creatorId }, 'ghost')
    const g2 = await User.create({ name: 'R2', createdBy: creatorId }, 'ghost')

    const removed = User.removeGhostsByCreator(creatorId)

    expect(removed).toContain(g1)
    expect(removed).toContain(g2)
    expect(User.getById(g1)).toBe(false)
    expect(User.getById(g2)).toBe(false)
    // the creator and another creator's ghost survive
    expect(User.getById(creatorId)).not.toBe(false)
    expect(User.getById(otherGhost)).not.toBe(false)
  })
})
