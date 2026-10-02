import React from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { saveEqPreset, type EqPresetSlot } from 'store/modules/prefs'
import { updateCurrentRoomOptions } from 'store/modules/rooms'
import { canSaveEqPresets } from 'store/modules/user'
import Button from 'components/Button/Button'
import InputCheckbox from 'components/InputCheckbox/InputCheckbox'
import Modal, { ModalProps } from 'components/Modal/Modal'
import EqualizerBand from './EqualizerBand'
import { EQ_FREQUENCIES, EQ_PRESETS, equalGains } from 'routes/Player/lib/equalizer'
import styles from './EqualizerDialog.css'
import { PlaybackOptions } from 'shared/types'

interface EqualizerDialogProps {
  eqEnabled: boolean
  eqGains: number[]
  eqPreset: string
  // actions
  onRequestOptions(opts: PlaybackOptions): void
  onClose: ModalProps['onClose']
}

const EQ_CUSTOM_SLOTS: EqPresetSlot[] = ['P1', 'P2', 'P3']

const EqualizerDialog = ({
  eqEnabled,
  eqGains,
  eqPreset,
  onRequestOptions,
  onClose,
}: EqualizerDialogProps) => {
  const handleToggle = () => onRequestOptions({ eqEnabled: !eqEnabled })

  const handleBand = (index: number, value: number) => {
    const gains = eqGains.slice()
    gains[index] = value
    onRequestOptions({ eqGains: gains, eqPreset: 'Custom' })
  }

  const handlePreset = (name: string) => {
    const preset = EQ_PRESETS.find(p => p.name === name)
    if (!preset) return

    onRequestOptions({ eqGains: preset.gains.slice(), eqPreset: preset.name })
  }

  const dispatch = useAppDispatch()
  const storedPresets = useAppSelector(state => state.prefs.eqPresets)
  const maySavePresets = useAppSelector(state => canSaveEqPresets(state.user))

  // global custom slots (Flat until saved); recall works for anyone who
  // can open this dialog, saving needs the nested permission
  const customPresets = EQ_CUSTOM_SLOTS.map(name => ({
    name,
    gains: storedPresets?.[name] ?? EQ_PRESETS[0].gains,
  }))

  const handleRecallCustom = (name: string, gains: number[]) => {
    onRequestOptions({ eqGains: gains.slice(), eqPreset: name })
  }

  const handleSaveCustom = (name: EqPresetSlot) => {
    // mark the slot live only once it is really stored (dialog stays open)
    dispatch(saveEqPreset({ name, gains: eqGains.slice() })).then((action) => {
      if (saveEqPreset.fulfilled.match(action)) {
        onRequestOptions({ eqPreset: name })
      }
    })
  }

  // persist the live values shown above to the room; closing via the
  // dialog's X keeps them ephemeral (lost on player reload)
  const handleSave = () => {
    dispatch(updateCurrentRoomOptions({
      prefs: { eq: { eqEnabled, eqGains: eqGains.slice(), eqPreset } },
    }))
    onClose()
  }

  return (
    <Modal
      onClose={onClose}
      title='Equalizer'
      buttons={(
        <div className={styles.saveRow}>
          {maySavePresets && (
            <div className={styles.saveSlots}>
              {EQ_CUSTOM_SLOTS.map(name => {
                // active when the slot holds exactly what is playing:
                // instant feedback on save, no status round-trip needed
                const isActive = eqEnabled && equalGains(storedPresets?.[name] ?? EQ_PRESETS[0].gains, eqGains)

                return (
                  <Button
                    key={name}
                    variant={isActive ? 'primary' : 'default'}
                    className={styles.preset}
                    onClick={() => handleSaveCustom(name)}
                    disabled={!eqEnabled}
                    aria-label={`Save current equalizer as ${name}`}
                    aria-pressed={isActive}
                  >
                    {name}
                  </Button>
                )
              })}
            </div>
          )}
          <Button variant='primary' onClick={handleSave}>Save</Button>
        </div>
      )}
    >
      <div className={styles.container}>
        <InputCheckbox
          label='Equalizer'
          checked={eqEnabled}
          onChange={handleToggle}
        />

        <div className={styles.presets}>
          {EQ_PRESETS.map(preset => (
            <Button
              key={preset.name}
              variant={eqPreset === preset.name && eqEnabled ? 'primary' : 'default'}
              className={styles.preset}
              onClick={() => handlePreset(preset.name)}
              disabled={!eqEnabled}
              aria-pressed={eqPreset === preset.name}
            >
              {preset.name}
            </Button>
          ))}
          {customPresets.map(preset => (
            <Button
              key={preset.name}
              variant={eqPreset === preset.name && eqEnabled ? 'primary' : 'default'}
              className={styles.preset}
              onClick={() => handleRecallCustom(preset.name, preset.gains)}
              disabled={!eqEnabled}
              aria-pressed={eqPreset === preset.name}
            >
              {preset.name}
            </Button>
          ))}
        </div>

        <div className={styles.bands}>
          {EQ_FREQUENCIES.map((freq, index) => (
            <EqualizerBand
              key={freq}
              freq={freq}
              gain={eqGains[index] ?? 0}
              disabled={!eqEnabled}
              onChange={(value: number) => handleBand(index, value)}
            />
          ))}
        </div>
      </div>
    </Modal>
  )
}

export default EqualizerDialog
