import React, { useEffect, useState } from 'react'
import { IntlProvider } from 'react-intl'
import { useAppSelector } from 'store/hooks'
import { DEFAULT_LOCALE, loadLocaleMessages } from 'lib/intl'

// loads the active locale file (English lives inline as defaultMessage)
// and provides react-intl below; other locales render English until
// their file arrives, and permanently on load failure
const IntlLoader = ({ children }: { children: React.ReactNode }) => {
  const locale = useAppSelector(state => state.ui.locale)
  const [loaded, setLoaded] = useState({ locale: DEFAULT_LOCALE, messages: {} })

  useEffect(() => {
    if (loaded.locale === locale) return

    let cancelled = false

    ;(async () => {
      try {
        const messages = await loadLocaleMessages(locale)
        if (!cancelled) setLoaded({ locale, messages })
      } catch {
        if (!cancelled) setLoaded({ locale: DEFAULT_LOCALE, messages: {} })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [locale, loaded.locale])

  const effective = loaded.locale === locale ? loaded : { locale: DEFAULT_LOCALE, messages: {} }

  return (
    <IntlProvider
      locale={effective.locale}
      messages={effective.messages}
      defaultLocale={DEFAULT_LOCALE}
    >
      {children}
    </IntlProvider>
  )
}

export default IntlLoader
