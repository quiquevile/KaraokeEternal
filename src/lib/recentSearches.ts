// Recent search history, stored per-scope in the browser's localStorage.
//
// The server injects the configured limits as window.__KE_CONFIG__ when
// serving index.html (KES_HISTORY_LIBRARY_SIZE / KES_HISTORY_YOUTUBE_SIZE,
// default 10, 0 disables the history).

export type RecentSearchKind = 'library' | 'youtube'

export const DEFAULT_HISTORY_SIZE = 10

const STORAGE_KEYS: Record<RecentSearchKind, string> = {
  library: 'ke-recent-library',
  youtube: 'ke-recent-youtube',
}

interface KEClientConfig {
  historyLibrarySize?: number
  historyYoutubeSize?: number
}

declare global {
  interface Window {
    __KE_CONFIG__?: KEClientConfig
  }
}

function sanitizeLimit (raw: unknown): number | null {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : null
}

export function getHistoryLimit (kind: RecentSearchKind): number {
  const config = typeof window === 'undefined' ? undefined : window.__KE_CONFIG__
  const raw = kind === 'library' ? config?.historyLibrarySize : config?.historyYoutubeSize

  return sanitizeLimit(raw) ?? DEFAULT_HISTORY_SIZE
}

function readStored (kind: RecentSearchKind): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEYS[kind]) ?? '[]')

    if (!Array.isArray(parsed)) return []

    return parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
  } catch {
    return []
  }
}

export function getRecentSearches (kind: RecentSearchKind): string[] {
  const limit = getHistoryLimit(kind)

  if (limit === 0) return []

  return readStored(kind).slice(0, limit)
}

// most-recent-first, case-insensitive dedupe, capped at the limit;
// returns the updated list (unchanged when disabled or blank)
export function pushRecentSearch (kind: RecentSearchKind, term: string): string[] {
  const limit = getHistoryLimit(kind)
  const text = term.trim()

  if (limit === 0 || text === '') return getRecentSearches(kind)

  const lowered = text.toLowerCase()
  const next = [text, ...readStored(kind).filter(item => item.toLowerCase() !== lowered)].slice(0, limit)

  try {
    window.localStorage.setItem(STORAGE_KEYS[kind], JSON.stringify(next))
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
