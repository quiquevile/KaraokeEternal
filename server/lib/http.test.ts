import { describe, it, expect, vi } from 'vitest'
import { mapDomainError, parseIdParam, requireAdmin, requireSameOrigin, type HttpContext } from './http.js'

const makeCtx = (headers?: Record<string, string | string[] | undefined>): HttpContext & { status: number } => ({
  params: {},
  request: headers ? { headers } : {},
  status: 200,
  throw: ((status: number, message?: string): never => {
    const err = new Error(message || String(status)) as Error & { status: number }
    err.status = status
    throw err
  }) as HttpContext['throw'],
})

describe('requireSameOrigin', () => {
  it('allows same-origin browser requests', () => {
    const ctx = makeCtx({ 'sec-fetch-site': 'same-origin' })

    expect(() => requireSameOrigin(ctx)).not.toThrow()
  })

  it('allows requests without the header (curl, old browsers)', () => {
    expect(() => requireSameOrigin(makeCtx())).not.toThrow()
    expect(() => requireSameOrigin(makeCtx({}))).not.toThrow()
  })

  it('rejects cross-site and same-site navigations with 403', () => {
    for (const site of ['cross-site', 'same-site', 'none']) {
      const ctx = makeCtx({ 'sec-fetch-site': site })

      expect(() => requireSameOrigin(ctx)).toThrowError(expect.objectContaining({ status: 403 }))
    }
  })
})

describe('requireAdmin', () => {
  it('rejects non-admins with 401', () => {
    expect(() => requireAdmin({ ...makeCtx(), user: { isAdmin: false } }))
      .toThrowError(expect.objectContaining({ status: 401 }))
  })
})

describe('parseIdParam', () => {
  it('parses valid ids and rejects the rest with 422', () => {
    expect(parseIdParam({ ...makeCtx(), params: { roomId: '3' } }, 'roomId')).toBe(3)
    expect(() => parseIdParam({ ...makeCtx(), params: { roomId: 'abc' } }, 'roomId'))
      .toThrowError(expect.objectContaining({ status: 422 }))
  })
})

describe('mapDomainError', () => {
  it('rethrows unknown errors untouched', () => {
    const err = new Error('boom')

    expect(() => mapDomainError(makeCtx(), err)).toThrow(err)
  })
})
