import { describe, it, expect, vi, afterEach } from 'vitest'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, getInitialLocale, persistLocale } from './intl'

const stubBrowser = (stored: string | null, language: string) => {
  const store: Record<string, string> = stored ? { 'ke-locale': stored } : {}

  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value },
    },
    navigator: { language },
  })

  return store
}

describe('intl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('supports English and Spanish', () => {
    expect(DEFAULT_LOCALE).toBe('en')
    expect(SUPPORTED_LOCALES.map(l => l.code)).toEqual(['en', 'es'])
  })

  it('prefers the stored override', () => {
    stubBrowser('es', 'en-US')

    expect(getInitialLocale()).toBe('es')
  })

  it('falls back to the browser language, then English', () => {
    stubBrowser(null, 'es-MX')

    expect(getInitialLocale()).toBe('es')

    stubBrowser(null, 'fr-FR')

    expect(getInitialLocale()).toBe('en')
  })

  it('ignores unknown stored values', () => {
    stubBrowser('xx', 'en-US')

    expect(getInitialLocale()).toBe('en')
  })

  it('persists the choice for the next visit', () => {
    const store = stubBrowser(null, 'en-US')

    persistLocale('es')

    expect(store['ke-locale']).toBe('es')
  })
})
