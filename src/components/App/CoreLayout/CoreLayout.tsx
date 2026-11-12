import React, { useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useMatch } from 'react-router'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import useResizeObserver from 'lib/useResizeObserver'
// global stylesheets should be imported before any
// components that will import their own modular css
import '../../../styles/global.css'
import Button from 'components/Button/Button'
import Header from 'components/Header/Header'
import { sharedMessages } from 'components/messages'
import Navigation from 'components/Navigation/Navigation'
import Modal from 'components/Modal/Modal'
import ProviderInfoHost from 'components/ProviderInfo/ProviderInfoHost'
import SongInfo from 'components/SongInfo/SongInfo'
import EditSongDialog from 'components/EditSongDialog/EditSongDialog'
import EditArtistDialog from 'components/EditArtistDialog/EditArtistDialog'
import DeleteSongDialog from 'components/DeleteSongDialog/DeleteSongDialog'
import Spinner from 'components/Spinner/Spinner'
import Routes from '../Routes/Routes'
import { clearErrorMessage, setFooterHeight, setHeaderHeight } from 'store/modules/ui'

const CoreLayout = () => {
  const intl = useIntl()
  const isPlayerRoute = useMatch('/player')
  const dispatch = useAppDispatch()
  const isSignedIn = useAppSelector(state => state.user.userId !== null)
  const [headerEl, setHeaderEl] = useState<HTMLDivElement | null>(null)
  const [navEl, setNavEl] = useState<HTMLDivElement | null>(null)

  useResizeObserver({
    onResize: ({ height }) => { dispatch(setHeaderHeight(height)) },
    element: headerEl,
  })

  useResizeObserver({
    onResize: ({ height }) => { dispatch(setFooterHeight(height)) },
    element: navEl,
  })

  const ui = useAppSelector(state => state.ui)
  const closeError = () => dispatch(clearErrorMessage())

  return (
    <ProviderInfoHost>
      <Header ref={setHeaderEl} />

      <React.Suspense fallback={<Spinner />}>
        <Routes />
      </React.Suspense>

      {isSignedIn && !isPlayerRoute && <Navigation ref={setNavEl} />}

      <SongInfo />

      <EditSongDialog />

      <EditArtistDialog />

      <DeleteSongDialog />

      {ui.isErrored && (
        <Modal
          title={intl.formatMessage(sharedMessages.appErrorTitle)}
          onClose={closeError}
          buttons={(
            <Button variant='primary' onClick={closeError}>
              <FormattedMessage {...sharedMessages.appOk} />
            </Button>
          )}
        >
          <p style={{ WebkitUserSelect: 'text', userSelect: 'text' }}>
            {ui.errorMessage}
          </p>
        </Modal>
      )}
    </ProviderInfoHost>
  )
}

export default CoreLayout
