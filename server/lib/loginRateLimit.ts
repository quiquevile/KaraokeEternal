// Brute-force protection for the login endpoint (no new dependencies).
// Counts credential failures per client IP inside a sliding window;
// successes clear the entry. Limits default to 5 fails / 15 min and are
// configurable via KES_LOGIN_MAX_FAILS / KES_LOGIN_WINDOW_MIN.
//
// The IP prefers X-Forwarded-For (reverse proxy in front) with the socket
// address as fallback. That header is spoofable on direct access, so the
// server port must only be reachable through the proxy.

export const DEFAULT_LOGIN_MAX_FAILS = 5
export const DEFAULT_LOGIN_WINDOW_MIN = 15

interface Attempt {
  fails: number
  resetAt: number
}

const attempts = new Map<string, Attempt>()

function parsePositiveInt (value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)

  return parsed > 0 ? parsed : fallback
}

export function loginMaxFails (): number {
  return parsePositiveInt(process.env.KES_LOGIN_MAX_FAILS, DEFAULT_LOGIN_MAX_FAILS)
}

export function loginWindowMs (): number {
  return parsePositiveInt(process.env.KES_LOGIN_WINDOW_MIN, DEFAULT_LOGIN_WINDOW_MIN) * 60 * 1000
}

export function getClientIp (forwardedFor: string | string[] | undefined, fallbackIp: string | undefined): string {
  const first = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor
  const ip = (first ?? '').split(',')[0].trim()

  return ip || fallbackIp || 'unknown'
}

function prune (now: number): void {
  for (const [ip, entry] of attempts) {
    if (now >= entry.resetAt) attempts.delete(ip)
  }
}

export function checkLoginRateLimit (ip: string): { limited: boolean, retryAfterSec: number } {
  const now = Date.now()
  prune(now)

  const entry = attempts.get(ip)

  if (entry && entry.fails >= loginMaxFails() && now < entry.resetAt) {
    return { limited: true, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) }
  }

  return { limited: false, retryAfterSec: 0 }
}

export function recordLoginFailure (ip: string): void {
  const now = Date.now()
  const entry = attempts.get(ip)

  if (!entry || now >= entry.resetAt) {
    attempts.set(ip, { fails: 1, resetAt: now + loginWindowMs() })
  } else {
    entry.fails += 1
  }
}

export function clearLoginAttempts (ip: string): void {
  attempts.delete(ip)
}

// test helper: drop all tracked state
export function resetLoginRateLimits (): void {
  attempts.clear()
}
