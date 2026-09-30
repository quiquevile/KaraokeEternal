import { Permission } from 'shared/types'

export const PERMISSIONS: Array<{ value: Permission, label: string, parent?: Permission }> = [
  { value: 'queueDelete', label: 'Can delete queue songs' },
  { value: 'queueMove', label: 'Can move queue songs' },
  { value: 'queueReplay', label: 'Can restart queue songs' },
  { value: 'playerAccess', label: 'Can open the player' },
  { value: 'playerControls', label: 'Can control playback' },
  { value: 'eqPresetSave', label: 'Can save equalizer presets', parent: 'playerControls' },
  { value: 'youtubeDownload', label: 'Can download from YouTube' },
  { value: 'downloadForOthers', label: 'Can queue downloads for others' },
]
