// Library search history, stored in the browser's localStorage.
//
// The server injects the configured limit as window.__KE_CONFIG__ when
// serving index.html (KES_HISTORY_LIBRARY_SIZE,
// default 10, 0 disables the history).

export const DEFAULT_HISTORY_SIZE = 10

const STORAGE_KEY = 'ke-recent-library'

interface KEClientConfig {
  historyLibrarySize?: number
}

declare global {
  interface Window {
    __KE_CONFIG__?: KEClientConfig
  }
}

function sanitizeLimit (raw: unknown): number | null {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : null
}

export function getHistoryLimit (): number {
  const config = typeof window === 'undefined' ? undefined : window.__KE_CONFIG__
  const raw = config?.historyLibrarySize

  return sanitizeLimit(raw) ?? DEFAULT_HISTORY_SIZE
}

function readStored (): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')

    if (!Array.isArray(parsed)) return []

    return parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
  } catch {
    return []
  }
}

export function getRecentSearches (): string[] {
  const limit = getHistoryLimit()

  if (limit === 0) return []

  return readStored().slice(0, limit)
}

// most-recent-first, case-insensitive dedupe, capped at the limit;
// returns the updated list (unchanged when disabled or blank)
export function pushRecentSearch (term: string): string[] {
  const limit = getHistoryLimit()
  const text = term.trim()

  if (limit === 0 || text === '') return getRecentSearches()

  const lowered = text.toLowerCase()
  const next = [text, ...readStored().filter(item => item.toLowerCase() !== lowered)].slice(0, limit)

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // non-fatal: the search simply won't be remembered
  }

  return next
}

// live-filter the history by the current input; empty input shows all
export function filterRecentSearches (items: string[], text: string): string[] {
  const needle = text.trim().toLowerCase()

  if (needle === '') return items

  return items.filter(item => item.toLowerCase().includes(needle))
}
