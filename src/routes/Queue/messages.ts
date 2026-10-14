import type { MessageDescriptor } from 'react-intl'

export const queueMessages: Record<string, MessageDescriptor> = {
  empty: { id: 'queue.view.empty', defaultMessage: 'Queue Empty' },
  getRoom: { id: 'queue.view.getRoom', defaultMessage: 'Get a Room!' },
  moveTop: { id: 'queue.item.moveTop', defaultMessage: 'Move to top' },
  remove: { id: 'queue.item.remove', defaultMessage: 'Remove song' },
  replay: { id: 'queue.item.replay', defaultMessage: 'Replay song' },
  requeue: { id: 'queue.item.requeue', defaultMessage: 'Queue again' },
  signIn: { id: 'queue.view.signIn', defaultMessage: '<link>Sign in to a room</link> to start queueing songs.' },
  skip: { id: 'queue.item.skip', defaultMessage: 'Skip song' },
  tapLibrary: { id: 'queue.view.tapLibrary', defaultMessage: 'Tap a song in the <link>library</link> to queue it.' },
}
