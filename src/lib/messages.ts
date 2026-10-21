import type { MessageDescriptor } from 'react-intl'

// messages shared across areas with identical meaning and grammar.
// Rule: share an ID if and only if the meaning is identical in every
// use; when in doubt (gender, number, verb/adjective), keep separate IDs:
// a duplicated es.json line is cheaper than a wrong translation.
export const commonMessages: Record<string, MessageDescriptor> = {
  cancel: { id: 'common.cancel', defaultMessage: 'Cancel' },
  accept: { id: 'common.accept', defaultMessage: 'Accept' },
  done: { id: 'common.done', defaultMessage: 'Done' },
  download: { id: 'common.download', defaultMessage: 'Download' },
  addFolder: { id: 'common.addFolder', defaultMessage: 'Add Folder' },
  preview: { id: 'common.preview', defaultMessage: 'Preview' },
  equalizer: { id: 'common.equalizer', defaultMessage: 'Equalizer' },
  language: { id: 'common.language', defaultMessage: 'Language' },
  play: { id: 'common.play', defaultMessage: 'Play' },
  playerOptions: { id: 'common.playerOptions', defaultMessage: 'Player Options' },
  songInfo: { id: 'common.songInfo', defaultMessage: 'Song info' },
  deleteSong: { id: 'common.deleteSong', defaultMessage: 'Delete song' },
  editSong: { id: 'common.editSong', defaultMessage: 'Edit song' },
  editArtist: { id: 'common.editArtist', defaultMessage: 'Edit artist' },
  checkArtistTitle: { id: 'common.checkArtistTitle', defaultMessage: 'Check artist and title' },
  checkArtist: { id: 'common.checkArtist', defaultMessage: 'Check artist' },
  password: { id: 'common.password', defaultMessage: 'password' },
  username: { id: 'common.username', defaultMessage: 'username' },
  displayName: { id: 'common.displayName', defaultMessage: 'display name' },
  confirmPassword: { id: 'common.confirmPassword', defaultMessage: 'confirm password' },
  clearSearch: { id: 'common.clearSearch', defaultMessage: 'Clear search' },
  guest: { id: 'common.guest', defaultMessage: 'Guest' },
  createRoom: { id: 'common.createRoom', defaultMessage: 'Create Room' },
  createUser: { id: 'common.createUser', defaultMessage: 'Create User' },
  users: { id: 'common.users', defaultMessage: 'Users' },
}
