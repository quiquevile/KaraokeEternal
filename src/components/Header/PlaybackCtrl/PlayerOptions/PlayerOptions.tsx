import React, { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useIntl } from 'react-intl'
import Modal, { ModalProps } from 'components/Modal/Modal'
import Button from 'components/Button/Button'
import Icon from 'components/Icon/Icon'
import DisplayCtrl from './DisplayCtrl/DisplayCtrl'
import AudioCtrl from './AudioCtrl/AudioCtrl'
import RoomOptions from './RoomOptions/RoomOptions'
import styles from './PlayerOptions.css'
import { MediaType, PlaybackOptions } from 'shared/types'
import { commonMessages } from 'lib/messages'
import { useAppSelector } from 'store/hooks'
import { headerMessages } from '../../messages'

const TABS = [
  { id: 'display', label: headerMessages.display, icon: 'TV' },
  { id: 'qr', label: headerMessages.qrCode, icon: 'QR_CODE' },
  { id: 'audio', label: headerMessages.audio, icon: 'MUSIC_NOTE' },
] as const

type TabId = typeof TABS[number]['id']

// QR is a room pref: it only exists while the room is open
// (RoomOptions hides with it), so its tab does too
const ROOM_TAB_IDS: readonly TabId[] = ['qr']

let lastActiveTab: TabId = 'display'

interface PlayerOptionsProps {
  cdgAlpha: number
  cdgSize: number
  eqEnabled: boolean
  eqGains: number[]
  eqPreset: string
  globalPitch: number
  isPitchSupported: boolean
  isReplayGainEnabled: boolean
  isVideoKeyingEnabled: boolean
  isVisualizerEnabled: boolean
  isWebGLSupported: boolean
  mediaType?: MediaType
  mp4Alpha: number
  pitch: number
  sensitivity: number
  userPitch: number | null
  visualizerPresetName: string
  // actions
  onRequestOptions(opts: PlaybackOptions): void
  onSetGlobalPitch?(pitch: number): void
  onSetUserPitch?(pitch: number | null): void
  onClose: ModalProps['onClose']
}

const PlayerOptions = ({
  cdgAlpha,
  cdgSize,
  eqEnabled,
  eqGains,
  eqPreset,
  globalPitch,
  isPitchSupported,
  isReplayGainEnabled,
  isVideoKeyingEnabled,
  isVisualizerEnabled,
  isWebGLSupported,
  mediaType,
  mp4Alpha,
  pitch,
  sensitivity,
  userPitch,
  visualizerPresetName,
  onRequestOptions,
  onSetGlobalPitch,
  onSetUserPitch,
  onClose,
}: PlayerOptionsProps) => {
  const intl = useIntl()
  const [activeTab, setActiveTab] = useState<TabId>(lastActiveTab)
  const [animatingTab, setAnimatingTab] = useState<TabId | null>(null)
  const tabsRef = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({})
  const isRoomOpen = useAppSelector(state =>
    (typeof state.user.roomId === 'number'
      ? state.rooms.entities[state.user.roomId]?.status
      : undefined) === 'open',
  )

  const tabs = isRoomOpen ? TABS : TABS.filter(tab => !ROOM_TAB_IDS.includes(tab.id))
  // the room can close under an open modal, hiding its tabs: fall back to
  // the first one instead of leaving an unselectable panel on screen
  const currentTab = tabs.some(tab => tab.id === activeTab) ? activeTab : tabs[0].id

  useEffect(() => {
    lastActiveTab = currentTab
  }, [currentTab])

  const selectTab = (id: TabId) => {
    if (id !== activeTab) setAnimatingTab(id)
    setActiveTab(id)
  }

  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return

    const curIdx = tabs.findIndex(tab => tab.id === currentTab)
    const delta = e.key === 'ArrowRight' ? 1 : -1
    const nextTab = tabs[(curIdx + delta + tabs.length) % tabs.length].id

    selectTab(nextTab)
    tabsRef.current[nextTab]?.focus()
  }

  return (
    <Modal
      aria-label={intl.formatMessage(commonMessages.playerOptions)}
      className={styles.modal}
      headingClassName={styles.tabRow}
      onClose={onClose}
      headingComponent={(
        <div className={styles.tabs} role='tablist' aria-label={intl.formatMessage(headerMessages.options)}>
          {tabs.map(({ id, label, icon }) => (
            <button
              key={id}
              ref={(el) => { tabsRef.current[id] = el }}
              className={clsx(styles.tab, animatingTab === id && styles.tabAnimate)}
              type='button'
              role='tab'
              id={`tab-${id}`}
              aria-label={intl.formatMessage(label)}
              aria-selected={currentTab === id}
              aria-controls={`tabpanel-${id}`}
              onClick={() => selectTab(id)}
              onKeyDown={handleTabKeyDown}
              onAnimationEnd={() => setAnimatingTab(null)}
            >
              <Icon icon={icon} />
            </button>
          ))}
        </div>
      )}
      buttons={<Button variant='primary' onClick={onClose}>{intl.formatMessage(commonMessages.done)}</Button>}
    >
      <div className={styles.panels}>
        <div
          className={clsx(styles.panel, currentTab !== 'display' && styles.panelHidden)}
          role='tabpanel'
          id='tabpanel-display'
          aria-labelledby='tab-display'
        >
          <DisplayCtrl
            cdgAlpha={cdgAlpha}
            cdgSize={cdgSize}
            isVideoKeyingEnabled={isVideoKeyingEnabled}
            isVisualizerEnabled={isVisualizerEnabled}
            isWebGLSupported={isWebGLSupported}
            mediaType={mediaType}
            mp4Alpha={mp4Alpha}
            onRequestOptions={onRequestOptions}
            sensitivity={sensitivity}
            visualizerPresetName={visualizerPresetName}
          />

          {isRoomOpen && <RoomOptions section='progress' />}
        </div>

        {isRoomOpen && (
          <div
            className={clsx(styles.panel, currentTab !== 'qr' && styles.panelHidden)}
            role='tabpanel'
            id='tabpanel-qr'
            aria-labelledby='tab-qr'
          >
            <RoomOptions section='qr' />
          </div>
        )}

        <div
          className={clsx(styles.panel, currentTab !== 'audio' && styles.panelHidden)}
          role='tabpanel'
          id='tabpanel-audio'
          aria-labelledby='tab-audio'
        >
          <AudioCtrl
            eqEnabled={eqEnabled}
            eqGains={eqGains}
            eqPreset={eqPreset}
            globalPitch={globalPitch}
            isPitchSupported={isPitchSupported}
            isReplayGainEnabled={isReplayGainEnabled}
            mediaType={mediaType}
            pitch={pitch}
            userPitch={userPitch}
            onRequestOptions={onRequestOptions}
            onSetGlobalPitch={onSetGlobalPitch}
            onSetUserPitch={onSetUserPitch}
          />
        </div>
      </div>
    </Modal>
  )
}

export default PlayerOptions
