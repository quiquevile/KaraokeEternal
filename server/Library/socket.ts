import Library from './Library.js'
import { can } from '../lib/permissions.js'
import { sockLocale, t } from '../lib/locale.js'
import {
  STAR_SONG, SONG_STARRED, UNSTAR_SONG, SONG_UNSTARRED,
  FLAW_SONG, SONG_FLAWED, UNFLAW_SONG, SONG_UNFLAWED,
  _SUCCESS,
} from '../../shared/actionTypes.js'

const ACTION_HANDLERS = {
  [STAR_SONG]: (sock, { payload }, acknowledge) => {
    const changes = Library.starSong(payload.songId, sock.user.userId)

    // success
    acknowledge({ type: STAR_SONG + _SUCCESS })

    // tell all clients (some users may be in multiple rooms)
    if (changes) {
      sock.server.emit('action', {
        type: SONG_STARRED,
        payload: {
          userId: sock.user.userId,
          songId: payload.songId,
        },
      })
    }
  },
  [UNSTAR_SONG]: (sock, { payload }, acknowledge) => {
    const changes = Library.unstarSong(payload.songId, sock.user.userId)

    // success
    acknowledge({ type: UNSTAR_SONG + _SUCCESS })

    if (changes) {
      // tell all clients (some users may be in multiple rooms)
      sock.server.emit('action', {
        type: SONG_UNSTARRED,
        payload: {
          userId: sock.user.userId,
          songId: payload.songId,
        },
      })
    }
  },
  [FLAW_SONG]: (sock, { payload }, acknowledge) => {
    if (!can(sock.user, 'songFlaws')) {
      return acknowledge({
        type: FLAW_SONG + '_ERROR',
        error: t(sockLocale(sock), 'server.library.flawForbidden', 'Cannot mark songs as defective'),
      })
    }

    const changes = Library.flawSong(payload.songId, sock.user.userId)

    // success
    acknowledge({ type: FLAW_SONG + _SUCCESS })

    // tell all clients (some users may be in multiple rooms)
    if (changes) {
      sock.server.emit('action', {
        type: SONG_FLAWED,
        payload: {
          userId: sock.user.userId,
          songId: payload.songId,
        },
      })
    }
  },
  [UNFLAW_SONG]: (sock, { payload }, acknowledge) => {
    if (!can(sock.user, 'songFlaws')) {
      return acknowledge({
        type: UNFLAW_SONG + '_ERROR',
        error: t(sockLocale(sock), 'server.library.flawForbidden', 'Cannot mark songs as defective'),
      })
    }

    const changes = Library.unflawSong(payload.songId, sock.user.userId)

    // success
    acknowledge({ type: UNFLAW_SONG + _SUCCESS })

    if (changes) {
      // tell all clients (some users may be in multiple rooms)
      sock.server.emit('action', {
        type: SONG_UNFLAWED,
        payload: {
          userId: sock.user.userId,
          songId: payload.songId,
        },
      })
    }
  },
}

export default ACTION_HANDLERS
