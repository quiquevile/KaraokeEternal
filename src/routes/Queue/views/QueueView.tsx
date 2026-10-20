import React, { useEffect, useRef } from 'react'
import { FormattedMessage } from 'react-intl'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { ensureState } from 'redux-optimistic-ui'
import { Link } from 'react-router'
import getRoundRobinQueue from '../selectors/getRoundRobinQueue'
import getVisibleQueue from '../selectors/getVisibleQueue'
import QueueList from '../components/QueueList/QueueList'
import Spinner from 'components/Spinner/Spinner'
import TextOverlay from 'components/TextOverlay/TextOverlay'
import { prepareLibrarySearch } from '../lib/librarySearch'
import styles from './QueueView.css'
import { queueMessages } from '../messages'
import { libraryMessages } from '../../Library/messages'

const QUEUE_ITEM_HEIGHT = 92

const QueueView = () => {
  const { innerWidth, innerHeight, headerHeight, footerHeight } = useAppSelector(state => state.ui)
  const isInRoom = useAppSelector(state => !!state.user.roomId)
  const isLoading = useAppSelector(state => ensureState(state.queue).isLoading)
  const filterStr = useAppSelector(state => state.ui.filterStr)
  // raw queue drives the empty state, the mount scroll and movement;
  // only the filtered list renders
  const queue = useAppSelector(getRoundRobinQueue)
  const visibleQueue = useAppSelector(getVisibleQueue)
  const queueId = useAppSelector(state => state.status.queueId)
  const containerRef = useRef<HTMLDivElement>(null)
  const dispatch = useAppDispatch()

  // ensure current song is in view on first mount only
  useEffect(() => {
    if (containerRef.current) {
      const i = queue.result.indexOf(queueId)
      containerRef.current.scrollTop = QUEUE_ITEM_HEIGHT * i
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={styles.container}
      ref={containerRef}
      style={{
        paddingTop: headerHeight,
        paddingBottom: footerHeight,
        width: innerWidth,
        height: innerHeight,
      }}
    >
      {!isInRoom && (
        <TextOverlay>
          <h1><FormattedMessage {...queueMessages.getRoom} /></h1>
          <p>
            <FormattedMessage
              {...queueMessages.signIn}
              values={{ link: chunks => <Link to='/account'>{chunks}</Link> }}
            />
          </p>
        </TextOverlay>
      )}

      {isLoading && <Spinner />}

      {!isLoading && queue.result.length === 0 && (
        <TextOverlay>
          <h1><FormattedMessage {...queueMessages.empty} /></h1>
          <p>
            <FormattedMessage
              {...queueMessages.tapLibrary}
              values={{ link: chunks => <Link to='/library'>{chunks}</Link> }}
            />
          </p>
        </TextOverlay>
      )}

      {!isLoading && queue.result.length > 0 && visibleQueue.result.length === 0 && (
        <TextOverlay>
          <h1><FormattedMessage {...queueMessages.noMatches} /></h1>
          {/* only the text filter can be handed over to the library: other
              filters (starred, user) leave nothing to search for */}
          {filterStr.trim() !== '' && (
            <p>
              <Link to='/library' onClick={() => prepareLibrarySearch(dispatch, filterStr)}>
                <FormattedMessage {...libraryMessages.searchLibrary} />
              </Link>
            </p>
          )}
        </TextOverlay>
      )}

      <QueueList />
    </div>
  )
}

export default QueueView
