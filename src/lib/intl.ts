export const DEFAULT_LOCALE = 'en'

export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
] as const

export type LocaleCode = typeof SUPPORTED_LOCALES[number]['code']

const STORAGE_KEY = 'ke-locale'

const normalize = (tag: string | null | undefined): LocaleCode => {
  const lang = (tag ?? '').split(/[-_]/)[0].toLowerCase()

  return (SUPPORTED_LOCALES.some(l => l.code === lang) ? lang : DEFAULT_LOCALE) as LocaleCode
}

// stored override first, browser language second, English fallback
export function getInitialLocale (): LocaleCode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)

    if (stored) return normalize(stored)
  } catch {
    // private mode etc: fall through to the browser language
  }

  return normalize(window.navigator.language)
}

export function persistLocale (locale: LocaleCode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // non-fatal: the choice simply won't survive refresh
  }
}

// English lives inline as defaultMessage: only other locales ship files
export async function loadLocaleMessages (locale: LocaleCode): Promise<Record<string, string>> {
  if (locale === DEFAULT_LOCALE) return {}

  const messages = await import(
    /* webpackChunkName: 'locale-[request]' */
    `shared/locales/${locale}.json`,
  )

  return (messages.default ?? {}) as Record<string, string>
}
