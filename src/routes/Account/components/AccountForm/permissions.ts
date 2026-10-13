import { Permission } from 'shared/types'

export const PERMISSIONS: Array<{ value: Permission, labelId: string, label: string, parent?: Permission }> = [
  { value: 'queueDelete', labelId: 'account.perms.queueDelete', label: 'Can delete queue songs' },
  { value: 'queueMove', labelId: 'account.perms.queueMove', label: 'Can move queue songs' },
  { value: 'queueReplay', labelId: 'account.perms.queueReplay', label: 'Can restart queue songs' },
  { value: 'playerAccess', labelId: 'account.perms.playerAccess', label: 'Can open the player' },
  { value: 'playerControls', labelId: 'account.perms.playerControls', label: 'Can control playback' },
  { value: 'youtubeDownload', labelId: 'account.perms.youtubeDownload', label: 'Can download from YouTube' },
  { value: 'downloadForOthers', labelId: 'account.perms.downloadForOthers', label: 'Can queue downloads for others', parent: 'youtubeDownload' },
]
