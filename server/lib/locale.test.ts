import { describe, it, expect } from 'vitest'
import { DEFAULT_LOCALE, localeFromHeader, t } from './locale.js'

describe('server locale', () => {
  it('picks the best supported language honoring q-weights', () => {
    expect(localeFromHeader('es-ES,es;q=0.9,en;q=0.8')).toBe('es')
    expect(localeFromHeader('fr-FR,fr;q=0.9')).toBe(DEFAULT_LOCALE)
    expect(localeFromHeader(undefined)).toBe(DEFAULT_LOCALE)
    expect(localeFromHeader('es;q=0')).toBe(DEFAULT_LOCALE)
    expect(localeFromHeader(['fr;q=0.5', 'es;q=0.7'])).toBe('es')
  })

  it('translates known IDs and falls back to English', () => {
    expect(t('es', 'server.auth.incorrectCredentials', 'Incorrect username or password'))
      .toBe('Usuario o contraseña incorrectos')
    expect(t('fr', 'server.auth.incorrectCredentials', 'Incorrect username or password'))
      .toBe('Incorrect username or password')
    expect(t('es', 'server.nope.missing', 'Some English default'))
      .toBe('Some English default')
  })

  it('interpolates values', () => {
    expect(t(
      'es', 'server.rooms.nameLength',
      'Room name must have {min}-{max} characters',
      { min: 1, max: 32 },
    )).toBe('El nombre de la sala debe tener entre 1 y 32 caracteres')
  })
})
