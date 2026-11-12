import { describe, it, expect } from 'vitest'
import bcrypt from 'bcryptjs'
import crypto from './crypto.js'

describe('room passwords', () => {
  it('round-trips through the reversible encoding, including unicode', async () => {
    for (const password of ['secret', 'con ñ y emoji 🎤']) {
      const stored = crypto.encodeRoomPassword(password)

      expect(stored.startsWith('$')).toBe(false)
      await expect(crypto.verifyRoomPassword(password, stored)).resolves.toBe(true)
      await expect(crypto.verifyRoomPassword(password + 'x', stored)).resolves.toBe(false)
    }
  })

  it('still verifies legacy hashes', async () => {
    const bcryptHash = bcrypt.hashSync('secret', 4)

    await expect(crypto.verifyRoomPassword('secret', bcryptHash)).resolves.toBe(true)
    await expect(crypto.verifyRoomPassword('wrong', bcryptHash)).resolves.toBe(false)
    await expect(crypto.verifyRoomPassword('x', '')).resolves.toBe(false)
    await expect(crypto.verifyRoomPassword('x', '!!!not-base64!!!')).resolves.toBe(false)
  })

  it('distinguishes formats by prefix', () => {
    expect(crypto.isEncodedRoomPassword(crypto.encodeRoomPassword('a'))).toBe(true)
    expect(crypto.isEncodedRoomPassword('$2b$10$abc')).toBe(false)
    expect(crypto.isEncodedRoomPassword('$argon2id$v=19$m=1,t=1,p=1$xx$yy')).toBe(false)
    expect(crypto.isEncodedRoomPassword('')).toBe(false)
  })
})

describe('crypto', () => {
  it('hashes with argon2id and verifies the round trip', async () => {
    const hashed = await crypto.hash('correct horse')
    expect(hashed.startsWith('$argon2id$')).toBe(true)
    expect(crypto.isLegacy(hashed)).toBe(false)
    await expect(crypto.compare('correct horse', hashed)).resolves.toBe(true)
    await expect(crypto.compare('wrong horse', hashed)).resolves.toBe(false)
  })

  it('treats a missing or malformed hash as a mismatch', async () => {
    await expect(crypto.compare('anything', '')).resolves.toBe(false)
    await expect(crypto.compare('anything', '$argon2id$garbage')).resolves.toBe(false)
  })

  it('still verifies legacy bcrypt hashes', async () => {
    const legacy = bcrypt.hashSync('old password', 4)
    expect(crypto.isLegacy(legacy)).toBe(true)
    await expect(crypto.compare('old password', legacy)).resolves.toBe(true)
    await expect(crypto.compare('not it', legacy)).resolves.toBe(false)
  })

  it('rejects non-string passwords instead of throwing', async () => {
    const hashed = await crypto.hash('real')
    await expect(crypto.hash(12345678 as unknown as string)).rejects.toThrow(TypeError)
    await expect(crypto.compare(12345678 as unknown as string, hashed)).resolves.toBe(false)
  })

  it('serves a burst of concurrent compares without deadlocking', async () => {
    const hashed = await crypto.hash('burst')
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) =>
      crypto.compare(i % 2 ? 'burst' : 'nope', hashed)))
    expect(results).toEqual([false, true, false, true, false, true])
  })
})
