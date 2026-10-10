import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  checkLoginRateLimit,
  clearLoginAttempts,
  getClientIp,
  loginMaxFails,
  loginWindowMs,
  recordLoginFailure,
  resetLoginRateLimits,
} from './loginRateLimit.js'

describe('login rate limiting', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    resetLoginRateLimits()
  })

  afterEach(() => {
    vi.useRealTimers()
    resetLoginRateLimits()
    delete process.env.KES_LOGIN_MAX_FAILS
    delete process.env.KES_LOGIN_WINDOW_MIN
  })

  it('reads policy from the environment with built-in defaults', () => {
    expect(loginMaxFails()).toBe(5)
    expect(loginWindowMs()).toBe(15 * 60 * 1000)

    process.env.KES_LOGIN_MAX_FAILS = '2'
    process.env.KES_LOGIN_WINDOW_MIN = '1'
    expect(loginMaxFails()).toBe(2)
    expect(loginWindowMs()).toBe(60 * 1000)

    process.env.KES_LOGIN_MAX_FAILS = 'banana'
    process.env.KES_LOGIN_WINDOW_MIN = '0'
    expect(loginMaxFails()).toBe(5)
    expect(loginWindowMs()).toBe(15 * 60 * 1000)
  })

  it('derives the client IP from X-Forwarded-For first', () => {
    expect(getClientIp('9.9.9.9, 10.0.0.1', '127.0.0.1')).toBe('9.9.9.9')
    expect(getClientIp(['9.9.9.9', '10.0.0.1'], '127.0.0.1')).toBe('9.9.9.9')
    expect(getClientIp(undefined, '127.0.0.1')).toBe('127.0.0.1')
    expect(getClientIp(undefined, undefined)).toBe('unknown')
  })

  it('limits after too many failures and releases after the window', () => {
    process.env.KES_LOGIN_MAX_FAILS = '2'
    process.env.KES_LOGIN_WINDOW_MIN = '1'

    expect(checkLoginRateLimit('1.2.3.4')).toEqual({ limited: false, retryAfterSec: 0 })

    recordLoginFailure('1.2.3.4')
    recordLoginFailure('1.2.3.4')
    expect(checkLoginRateLimit('1.2.3.4')).toEqual({ limited: true, retryAfterSec: 60 })

    // other IPs are unaffected
    expect(checkLoginRateLimit('5.6.7.8')).toEqual({ limited: false, retryAfterSec: 0 })

    // window expiry releases the IP
    vi.setSystemTime(1_000_000 + 61 * 1000)
    expect(checkLoginRateLimit('1.2.3.4')).toEqual({ limited: false, retryAfterSec: 0 })
  })

  it('clears entries on success', () => {
    process.env.KES_LOGIN_MAX_FAILS = '2'

    recordLoginFailure('1.2.3.4')
    clearLoginAttempts('1.2.3.4')
    recordLoginFailure('1.2.3.4')

    expect(checkLoginRateLimit('1.2.3.4')).toEqual({ limited: false, retryAfterSec: 0 })
  })
})
