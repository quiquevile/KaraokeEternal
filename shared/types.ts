export interface Artist {
  artistId: number
  name: string
  songIds: number[]
}

export interface Song {
  artistId: number
  duration: number
  songId: number
  title: string
  numMedia: number
}

export interface QueueItem {
  queueId: number
  songId: number
  userId: number
  prevQueueId: number
  mediaId: number
  rgTrackGain: number
  rgTrackPeak: number
  userDateUpdated: number
  userDisplayName: string
  mediaType: 'cdg' | 'mp4'
  isOptimistic?: false
  isVideoKeyingEnabled: boolean
}

export interface OptimisticQueueItem {
  isOptimistic: true
  prevQueueId: number
  queueId: number
  songId: number
}

export interface IRoomPrefs {
  qr: {
    isEnabled: boolean
    opacity: number
    password: string
    size: number
    // whether the stored password is embedded in the QR; toggling it
    // never destroys the value (use the password box for that)
    includePassword?: boolean
  }
  user?: {
    isNewAllowed?: boolean
    isGuestAllowed?: boolean
  }
  roles?: Record<number, {
    allowNew: boolean
  }>
}

export interface Room {
  roomId: number
  name: string
  status: 'open' | 'closed'
  dateCreated: number
  hasPassword: boolean
  numUsers: number
  prefs?: IRoomPrefs
  // reversible room key (base64) for QR embedding; only sent to admins
  // and members of the room, never for legacy hashed values
  qrPassword?: string | null
}

export interface Role {
  roleId: number
  name: string
}

export interface Path {
  pathId: number
  path: string
  priority: number
  prefs: {
    isVideoKeyingEnabled: boolean
    isWatchingEnabled: boolean
  }
}

export type Permission
  = | 'queueDelete'
    | 'queueMove'
    | 'queueReplay'
    | 'playerAccess'
    | 'playerControls'
    | 'youtubeDownload'
    | 'downloadForOthers'

export interface User {
  userId: number
  username: string
  name: string
  isAdmin: boolean // todo: client and server ctx only
  isGuest: boolean // todo: client and server ctx only
  permissions?: Record<string, boolean>
  dateCreated: number
  dateUpdated: number
}

export interface UserWithRole extends User {
  role?: string
}

export interface PlaybackOptions {
  cdgAlpha?: number
  cdgSize?: number
  mp4Alpha?: number
  pitchSemitones?: number
  isReplayGainEnabled?: boolean
  eqEnabled?: boolean
  eqGains?: number[]
  eqPreset?: string
  visualizer?: {
    sensitivity?: number
    isEnabled?: boolean
    nextPreset?: boolean
    prevPreset?: boolean
    randomPreset?: boolean
  }
}

export type MediaType = 'cdg' | 'mp4' | ''

export interface Media {
  songId: number
  mediaId: number
  isPreferred: boolean
  path: string
  relPath: string
  duration: number
  rgTrackGain: number | null
  rgTrackPeak: number | null
}

export interface Prefs {
  isFirstRun?: boolean
  isScanning: boolean
  paths: {
    result: number[]
    entities: Record<number, Path>
  }
  roles: {
    result: number[]
    entities: Record<number, Role>
  }
  [key: string]: unknown
}
