import { ConflictError, NotFoundError, ValidationError } from './Errors.js'

export interface HttpContext {
  user?: { isAdmin?: boolean } | null
  params: Record<string, string | undefined>
  request?: { body?: unknown, headers?: Record<string, string | string[] | undefined> }
  throw: (status: number, message?: string) => never
}

export function requireAdmin (ctx: HttpContext): void {
  if (!ctx.user?.isAdmin) ctx.throw(401)
}

/**
 * Blocks cross-site request forgery on state-changing GET endpoints.
 * Browsers always send Sec-Fetch-Site on fetch (same-origin for our own
 * client); cross-site img/link/navigations arrive as cross-site/same-site
 * or empty. Absent header (curl, old browsers) is allowed: without ambient
 * cookies there is nothing to forge.
 */
export function requireSameOrigin (ctx: HttpContext): void {
  const site = ctx.request?.headers?.['sec-fetch-site']

  if (typeof site === 'string' && site !== '' && site !== 'same-origin') {
    ctx.throw(403, 'Cross-site requests are not allowed here')
  }
}

export function parseIdParam (ctx: HttpContext, name: string): number {
  const id = parseInt(ctx.params[name] ?? '', 10)

  if (Number.isNaN(id)) ctx.throw(422, `Invalid ${name}`)

  return id
}

/**
 * Maps domain errors to HTTP statuses (rethrows anything else).
 * Call it as the last statement of a catch block.
 */
export function mapDomainError (ctx: HttpContext, err: unknown): never {
  if (err instanceof ConflictError) ctx.throw(409, err.message)
  if (err instanceof NotFoundError) ctx.throw(404, err.message)
  if (err instanceof ValidationError) ctx.throw(422, err.message)
  throw err
}
