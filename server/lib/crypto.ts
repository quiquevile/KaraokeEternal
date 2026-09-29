import getLogger from './Log.js'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'

const log = getLogger('crypto')

const ARGON2_CONFIG = {
  parallelism: 1,
  tagLength: 32,
  memory: 65536,
  passes: 3,
}

function hash (password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(16, (err, nonce) => {
      if (err) {
        log.error(err)
        return reject(err)
      }

      crypto.argon2('argon2id', {
        message: password,
        nonce,
        ...ARGON2_CONFIG,
      }, (err, derivedKey) => {
        if (err) {
          log.error(err)
          return reject(err)
        }

        const saltB64 = nonce.toString('base64').replace(/=/g, '')
        const hashB64 = derivedKey.toString('base64').replace(/=/g, '')
        const str = `$argon2id$v=19$m=${ARGON2_CONFIG.memory},t=${ARGON2_CONFIG.passes},p=${ARGON2_CONFIG.parallelism}$${saltB64}$${hashB64}`

        resolve(str)
      })
    })
  })
}

function compare (password: string, hashStr: string): Promise<boolean> {
  if (!hashStr) return Promise.resolve(false)

  // legacy bcrypt verify
  if (hashStr.startsWith('$2')) {
    return new Promise((resolve, reject) => {
      bcrypt.compare(password, hashStr, function (err, matched) {
        if (err) {
          log.error(err)
          return reject(err)
        }
        return resolve(matched)
      })
    })
  }

  // Argon2 verify
  return new Promise((resolve, reject) => {
    try {
      const parts = hashStr.split('$')
      if (parts.length !== 6 || parts[1] !== 'argon2id' || parts[2] !== 'v=19') {
        return resolve(false)
      }

      const params = new URLSearchParams(parts[3].replace(/,/g, '&'))
      const m = parseInt(params.get('m') || '', 10)
      const t = parseInt(params.get('t') || '', 10)
      const p = parseInt(params.get('p') || '', 10)

      const nonce = Buffer.from(parts[4], 'base64')
      const expectedHash = Buffer.from(parts[5], 'base64')

      if (isNaN(m) || isNaN(t) || isNaN(p) || !nonce.length || !expectedHash.length) {
        return resolve(false)
      }

      crypto.argon2('argon2id', {
        message: password,
        nonce,
        parallelism: p,
        tagLength: expectedHash.length,
        memory: m,
        passes: t,
      }, (err, derivedKey) => {
        if (err) {
          log.error(err)
          return reject(err)
        }

        try {
          if (derivedKey.length !== expectedHash.length) {
            return resolve(false)
          }

          const match = crypto.timingSafeEqual(derivedKey, expectedHash)
          resolve(match)
        } catch (e) {
          log.error(e)
          resolve(false)
        }
      })
    } catch (e) {
      log.error(e)
      resolve(false)
    }
  })
}

function isLegacy (hashStr: string) {
  return typeof hashStr === 'string' && hashStr.startsWith('$2')
}

/**
 * Reversible room-password encoding: base64 UTF-8, exactly what travels
 * in QR login URLs. Room keys are low-value shared secrets (unlike user
 * passwords, which always stay hashed); reversibility is what lets the
 * player embed them in QR codes without ever asking again.
 */
function encodeRoomPassword (password: string): string {
  return Buffer.from(password, 'utf8').toString('base64')
}

function isEncodedRoomPassword (stored: unknown): boolean {
  return typeof stored === 'string' && stored.length > 0 && !stored.startsWith('$')
}

/**
 * Verifies a room password against either storage format: legacy hashes
 * (bcrypt/argon2, verified as before) or the current reversible encoding
 * (byte-exact base64 comparison). Unknown formats never match.
 */
function verifyRoomPassword (password: string, stored: string): Promise<boolean> {
  if (!stored) return Promise.resolve(false)

  if (!isEncodedRoomPassword(stored)) return compare(password, stored)

  const expected = Buffer.from(stored, 'base64')
  const actual = Buffer.from(Buffer.from(password, 'utf8').toString('base64'), 'base64')

  if (expected.length !== actual.length) return Promise.resolve(false)

  return Promise.resolve(crypto.timingSafeEqual(expected, actual))
}

export default {
  hash,
  compare,
  isLegacy,
  encodeRoomPassword,
  isEncodedRoomPassword,
  verifyRoomPassword,
}
