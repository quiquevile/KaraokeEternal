import fs from 'fs'
import path from 'path'
import { IntlMessageFormat, type PrimitiveType } from 'intl-messageformat'

export const DEFAULT_LOCALE = 'en'
export const SUPPORTED_LOCALES = ['en', 'es']

export type LocaleCode = string

// best match from an Accept-Language header value (honors q-weights)
export function localeFromHeader (value: string | string[] | undefined): LocaleCode {
  const tags = (Array.isArray(value) ? value.join(',') : (value ?? ''))
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [tag, ...params] = part.split(';')
      const q = params
        .map(p => p.trim().match(/^q=([0-9.]+)$/))
        .find(Boolean)

      return { tag: tag.trim().toLowerCase(), q: q ? Number(q[1]) : 1 }
    })
    .filter(({ tag, q }) => tag && Number.isFinite(q) && q > 0)
    .sort((a, b) => b.q - a.q)

  for (const { tag } of tags) {
    const lang = tag.split('-')[0]

    if (SUPPORTED_LOCALES.includes(lang)) return lang
  }

  return DEFAULT_LOCALE
}

const messageCache = new Map<string, Record<string, string>>()

// English lives inline as defaultMessage: only other locales ship files.
// Locales sit next to this file in dev (server/lib) and prod
// (build/server/lib) alike: ../../shared/locales in both trees.
function loadMessages (locale: LocaleCode): Record<string, string> {
  const cached = messageCache.get(locale)

  if (cached) return cached

  let messages: Record<string, string> = {}

  try {
    const raw = fs.readFileSync(
      path.join(import.meta.dirname, '..', '..', 'shared', 'locales', `${locale}.json`),
      'utf8',
    )
    messages = JSON.parse(raw) as Record<string, string>
  } catch {
    messages = {}
  }

  messageCache.set(locale, messages)

  return messages
}

// locale for an HTTP router context (Accept-Language request header)
export function ctxLocale (ctx: unknown): LocaleCode {
  const headers = (ctx as {
    request?: { headers?: Record<string, string | string[] | undefined> } | null | undefined
  } | null | undefined)?.request?.headers

  return localeFromHeader(headers?.['accept-language'])
}

// locale for a socket.io socket (headers captured at handshake)
export function sockLocale (sock: unknown): LocaleCode {
  const headers = (sock as {
    handshake?: { headers?: Record<string, string | string[] | undefined> } | null | undefined
  } | null | undefined)?.handshake?.headers

  return localeFromHeader(headers?.['accept-language'])
}

// translate a user-facing server message; unknown locales, missing keys
// and bad syntax all fall back to the English default
export function t (
  locale: LocaleCode | undefined,
  id: string,
  defaultMessage: string,
  values?: Record<string, PrimitiveType>,
): string {
  const lang = SUPPORTED_LOCALES.includes(locale ?? '') ? (locale as string) : DEFAULT_LOCALE
  const template = loadMessages(lang)[id] ?? defaultMessage

  try {
    return new IntlMessageFormat<Record<string, PrimitiveType>>(template, lang).format(values) as string
  } catch {
    return defaultMessage
  }
}
