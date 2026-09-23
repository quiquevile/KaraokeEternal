import { ConflictError, NotFoundError, ValidationError } from './Errors.js'

export interface HttpContext {
  user?: { isAdmin?: boolean } | null
  params: Record<string, string | undefined>
  throw: (status: number, message?: string) => never
}

export function requireAdmin (ctx: HttpContext): void {
  if (!ctx.user?.isAdmin) ctx.throw(401)
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
