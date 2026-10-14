import { Permission } from 'shared/types'
import { accountMessages } from 'routes/Account/messages'

export const PERMISSIONS: Array<{ value: Permission, message: (typeof accountMessages)[keyof typeof accountMessages], parent?: Permission }> = [
  { value: 'queueDelete', message: accountMessages.permsQueueDelete },
  { value: 'queueMove', message: accountMessages.permsQueueMove },
  { value: 'queueReplay', message: accountMessages.permsQueueReplay },
  { value: 'playerAccess', message: accountMessages.permsPlayerAccess },
  { value: 'playerControls', message: accountMessages.permsPlayerControls },
  { value: 'youtubeDownload', message: accountMessages.permsYoutubeDownload },
  { value: 'downloadForOthers', message: accountMessages.permsDownloadForOthers, parent: 'youtubeDownload' },
]
