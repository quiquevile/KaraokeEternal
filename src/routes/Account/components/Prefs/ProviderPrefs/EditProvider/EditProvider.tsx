import React, { useState } from 'react'
import { useIntl, type IntlShape } from 'react-intl'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Modal from 'components/Modal/Modal'
import Accordion from 'components/Accordion/Accordion'
import Button from 'components/Button/Button'
import Icon from 'components/Icon/Icon'
import InputCheckbox from 'components/InputCheckbox/InputCheckbox'
import InputRadio from 'components/InputRadio/InputRadio'
import HttpApi from 'lib/HttpApi'
import { receivePrefs, setProviderPrefs } from 'store/modules/prefs'
import { commonMessages } from 'lib/messages'
import type { Provider, ProviderStatus, ProviderTypeStatus, SongProviderPrefs } from 'shared/types'
import styles from './EditProvider.css'
import { accountMessages } from '../../../../messages'

const providersApi = new HttpApi('providers')
const prefsApi = new HttpApi('prefs/provider')

interface ProbeResult {
  name: string
  authVersion: number
  types: Record<string, ProviderTypeStatus>
}

const describeProvider = (intl: IntlShape, enabled: boolean, status?: ProviderStatus) => {
  if (!enabled) return intl.formatMessage(accountMessages.providerDisabled)
  if (!status || status.state === 'checking') return intl.formatMessage(accountMessages.providerChecking)
  if (status.state === 'ready') return intl.formatMessage(accountMessages.providerReady)
  return status.message ?? status.state
}

const describeType = (intl: IntlShape, type: string, status?: ProviderStatus) => {
  if (!status || status.state === 'checking') return null

  const typeStatus = status.types[type]
  if (!typeStatus) return status.state === 'ready' ? intl.formatMessage(accountMessages.providerNotOffered) : null
  return typeStatus.version === null ? intl.formatMessage(accountMessages.providerUnsupported) : `v${typeStatus.version}`
}

interface EditProviderProps {
  provider?: Provider
  onClose: () => void
}

const EditProvider = ({ provider, onClose }: EditProviderProps) => {
  const intl = useIntl()
  const dispatch = useAppDispatch()
  const [url, setUrl] = useState(provider?.url ?? '')
  const [apiKey, setApiKey] = useState(provider?.apiKey ?? '')
  const [name, setName] = useState(provider?.name ?? '')
  const [enabled, setEnabled] = useState(provider?.prefs.enabled ?? true)
  const storedSong = provider?.prefs.types.song
  const [songEnabled, setSongEnabled] = useState(storedSong?.enabled ?? false)
  const [alwaysShown, setAlwaysShown] = useState((storedSong?.maxLibraryResults ?? null) === null)
  const [maxLibraryResults, setMaxLibraryResults] = useState(String(storedSong?.maxLibraryResults ?? 0))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // an existing provider's saved url/apiKey pair is trusted as-is
  const needsConnect = !provider
    || provider.url !== url.trim()
    || (provider.apiKey ?? '') !== apiKey.trim()

  const status = useAppSelector(state => provider ? state.prefs.providerStatus[provider.providerId] : undefined)

  // a type that went away keeps its section (and stored prefs) in case it returns
  const isSongShown = !!provider && (!!status?.types.song || !!storedSong)
  const songStatusText = describeType(intl, 'song', status)
  const parsedMaxLibraryResults = Number(maxLibraryResults)
  const isMaxLibraryResultsValid = alwaysShown
    || (maxLibraryResults.trim() !== '' && Number.isInteger(parsedMaxLibraryResults) && parsedMaxLibraryResults >= 0)

  const connect = () => providersApi.post<ProbeResult>('/', {
    body: { url: url.trim(), apiKey: apiKey.trim() || undefined },
  })

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const result = needsConnect ? await connect() : null

      if (provider) {
        const data: Record<string, unknown> = {}
        if (name.trim() !== provider.name) data.name = name.trim()
        if (url.trim() !== provider.url) data.url = url.trim()
        if (apiKey.trim() !== (provider.apiKey ?? '')) data.apiKey = apiKey.trim()

        const prefs: { enabled?: boolean, types?: { song: Partial<SongProviderPrefs> } } = {}
        if (enabled !== provider.prefs.enabled) prefs.enabled = enabled

        if (isSongShown) {
          const song: Partial<SongProviderPrefs> = {}
          if (songEnabled !== (storedSong?.enabled ?? false)) song.enabled = songEnabled
          const newMax = alwaysShown ? null : parsedMaxLibraryResults
          if (newMax !== (storedSong?.maxLibraryResults ?? null)) song.maxLibraryResults = newMax
          if (Object.keys(song).length > 0) prefs.types = { song }
        }

        if (Object.keys(prefs).length > 0) data.prefs = prefs

        if (Object.keys(data).length > 0) {
          await dispatch(setProviderPrefs({ providerId: provider.providerId, data })).unwrap()
        }
      } else if (result) {
        // types offered now start enabled; any offered later start disabled
        const types = Object.fromEntries(Object.entries(result.types)
          .filter(([, typeStatus]) => typeStatus.version !== null)
          .map(([type]) => [type, { enabled: true }]))

        dispatch(receivePrefs(await prefsApi.post('', {
          body: {
            name: result.name,
            url: url.trim(),
            apiKey: apiKey.trim() || undefined,
            prefs: { types },
          },
        })))
      }

      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  const handleRemove = async () => {
    if (!provider || !confirm(intl.formatMessage(accountMessages.providerRemoveConfirm, { name: provider.name }))) return

    try {
      dispatch(receivePrefs(await prefsApi.delete(`/${provider.providerId}`)))
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const isSubmitDisabled
    = submitting
      || !url.trim()
      || (!!provider && !name.trim())
      || (isSongShown && !isMaxLibraryResultsValid)

  const submitLabel = submitting && needsConnect
    ? intl.formatMessage(accountMessages.providerConnecting)
    : provider ? intl.formatMessage(accountMessages.providerUpdate) : intl.formatMessage(accountMessages.providerAdd)

  const urlInput = (
    <input
      type='text'
      autoComplete='off'
      inputMode='url'
      value={url}
      onChange={e => setUrl(e.target.value)}
      placeholder={intl.formatMessage(accountMessages.providerUrl)}
    />
  )

  // the key travels in a header, so a plain-http provider URL exposes it
  const isKeyUnencrypted = !!apiKey.trim() && /^http:\/\//i.test(url.trim())

  const apiKeyInput = (
    <>
      <input
        type='password'
        autoComplete='new-password'
        value={apiKey}
        onChange={e => setApiKey(e.target.value)}
        onFocus={e => e.target.select()}
        placeholder={intl.formatMessage(accountMessages.providerApiKey)}
      />
      {/* providers scope downloads by key, so servers sharing one would share
          (and could cancel) each other's downloads */}
      {!!apiKey.trim() && (
        <p className={styles.meta}>
          {intl.formatMessage(accountMessages.providerKeyServerOnly)}
        </p>
      )}
      {isKeyUnencrypted && (
        <p className={styles.meta}>
          {intl.formatMessage(accountMessages.providerKeyUnencrypted)}
        </p>
      )}
    </>
  )

  return (
    <Modal
      className={styles.modal}
      onClose={onClose}
      title={provider ? intl.formatMessage(accountMessages.providerEdit) : intl.formatMessage(accountMessages.providerAdd)}
      buttons={(
        <>
          <Button
            onClick={handleSubmit}
            variant='primary'
            disabled={isSubmitDisabled}
          >
            {submitLabel}
          </Button>
          {provider && (
            <Button onClick={handleRemove} variant='danger'>
              {intl.formatMessage(accountMessages.providerRemove)}
            </Button>
          )}
          <Button onClick={onClose} variant='default'>
            {intl.formatMessage(commonMessages.cancel)}
          </Button>
        </>
      )}
    >
      <form className={styles.form} onSubmit={e => e.preventDefault()}>
        {!provider && (
          <div className={styles.fieldContainer}>
            {urlInput}
            {apiKeyInput}
          </div>
        )}

        {provider && (
          <>
            <div className={styles.fieldContainer}>
              <InputCheckbox
                label={intl.formatMessage(accountMessages.providerEnabled)}
                checked={enabled}
                onChange={e => setEnabled(e.currentTarget.checked)}
              />
              <input
                type='text'
                autoComplete='off'
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={intl.formatMessage(accountMessages.providerName)}
              />
              <div>
                <p className={styles.meta}>
                  <span className={styles.metaLabel}>{intl.formatMessage(commonMessages.statusLabel)}</span>
                  {describeProvider(intl, provider.prefs.enabled, status)}
                </p>
                <p className={styles.meta}>
                  <span className={styles.metaLabel}>{intl.formatMessage(commonMessages.providerIdLabel)}</span>
                  {provider.providerId}
                </p>
              </div>
            </div>

            <div className={styles.prefsContainer}>
              <Accordion
                renderHeading={button => <div className={styles.heading}>{button}</div>}
                heading={(
                  <>
                    <Icon icon='CLOUD' />
                    <div>{intl.formatMessage(accountMessages.providerConnection)}</div>
                  </>
                )}
              >
                <div className={styles.content}>
                  {urlInput}
                  {apiKeyInput}
                </div>
              </Accordion>

              {isSongShown && (
                <Accordion
                  renderHeading={button => <div className={styles.heading}>{button}</div>}
                  heading={(
                    <>
                      <Icon icon='MUSIC_NOTE' />
                      <div>{intl.formatMessage(accountMessages.providerSongs)}</div>
                      {songStatusText && <div className={styles.headingStatus}>{songStatusText}</div>}
                    </>
                  )}
                >
                  <div className={styles.content}>
                    <InputCheckbox
                      label={intl.formatMessage(accountMessages.providerEnabled)}
                      checked={songEnabled}
                      onChange={e => setSongEnabled(e.currentTarget.checked)}
                    />
                  </div>
                  <fieldset className={styles.content}>
                    <legend className={styles.legend}>{intl.formatMessage(accountMessages.providerAllowSearches)}</legend>
                    <InputRadio
                      name='maxLibraryResults'
                      value='always'
                      checked={alwaysShown}
                      onChange={() => setAlwaysShown(true)}
                      label={intl.formatMessage(accountMessages.providerAlways)}
                    />
                    <div className={styles.sentence}>
                      <InputRadio
                        name='maxLibraryResults'
                        value='max'
                        checked={!alwaysShown}
                        onChange={() => setAlwaysShown(false)}
                        label={intl.formatMessage(accountMessages.providerWhenSearched)}
                      />
                      <input
                        type='number'
                        min={0}
                        step={1}
                        inputMode='numeric'
                        aria-label={intl.formatMessage(accountMessages.providerMaxResults)}
                        value={maxLibraryResults}
                        onChange={e => setMaxLibraryResults(e.target.value)}
                        onFocus={() => setAlwaysShown(false)}
                      />
                      {intl.formatMessage(accountMessages.providerOrFewer)}
                    </div>
                  </fieldset>
                </Accordion>
              )}
            </div>
          </>
        )}

        {error && <p className={styles.error}>{error}</p>}
      </form>
    </Modal>
  )
}

export default EditProvider
