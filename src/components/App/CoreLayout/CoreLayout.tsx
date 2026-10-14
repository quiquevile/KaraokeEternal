import React, { useRef } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { useMatch } from 'react-router'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import useResizeObserver from 'use-resize-observer'
// global stylesheets should be imported before any
// components that will import their own modular css
import '../../../styles/global.css'
import Button from 'components/Button/Button'
import Header from 'components/Header/Header'
import Navigation from 'components/Navigation/Navigation'
import Modal from 'components/Modal/Modal'
import SongInfo from 'components/SongInfo/SongInfo'
import EditSongDialog from 'components/EditSongDialog/EditSongDialog'
import DeleteSongDialog from 'components/DeleteSongDialog/DeleteSongDialog'
import Routes from '../Routes/Routes'
import { clearErrorMessage, setFooterHeight, setHeaderHeight } from 'store/modules/ui'

const CoreLayout = () => {
  const intl = useIntl()
  const isPlayerRoute = useMatch('/player')
  const dispatch = useAppDispatch()
  const headerRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLDivElement>(null)

  useResizeObserver({
    onResize: ({ height }) => { dispatch(setHeaderHeight(height)) },
    ref: headerRef,
  })

  useResizeObserver({
    onResize: ({ height }) => { dispatch(setFooterHeight(height)) },
    ref: navRef,
  })

  const ui = useAppSelector(state => state.ui)
  const closeError = () => dispatch(clearErrorMessage())

  return (
    <>
      <Header ref={headerRef} />

      <Routes />

      {!isPlayerRoute && <Navigation ref={navRef} />}

      <SongInfo />

      <EditSongDialog />

      <DeleteSongDialog />

      {ui.isErrored && (
        <Modal
          title={intl.formatMessage({ id: 'app.errorTitle', defaultMessage: 'Oops...' })}
          onClose={closeError}
          buttons={(
            <Button variant='primary' onClick={closeError}>
              <FormattedMessage id='app.ok' defaultMessage='OK' />
            </Button>
          )}
        >
          <p style={{ WebkitUserSelect: 'text', userSelect: 'text' }}>
            {ui.errorMessage}
          </p>
        </Modal>
      )}
    </>
  )
}

export default CoreLayout
