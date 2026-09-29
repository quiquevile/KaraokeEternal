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
