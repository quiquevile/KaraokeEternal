import type { MessageDescriptor } from 'react-intl'

export const queueMessages: Record<string, MessageDescriptor> = {
  empty: { id: 'queue.view.empty', defaultMessage: 'Queue Empty' },
  getRoom: { id: 'queue.view.getRoom', defaultMessage: 'Get a Room!' },
  moveTop: { id: 'queue.item.moveTop', defaultMessage: 'Move to top' },
  noMatches: { id: 'queue.view.noMatches', defaultMessage: 'No Songs Match the Filters' },
  remove: { id: 'queue.item.remove', defaultMessage: 'Remove song' },
  replay: { id: 'queue.item.replay', defaultMessage: 'Replay song' },
  requeue: { id: 'queue.item.requeue', defaultMessage: 'Queue again' },
  search: { id: 'queue.header.search', defaultMessage: 'search' },
  signIn: { id: 'queue.view.signIn', defaultMessage: '<link>Sign in to a room</link> to start queueing songs.' },
  skip: { id: 'queue.item.skip', defaultMessage: 'Skip song' },
  starredOnly: { id: 'queue.header.starredOnly', defaultMessage: 'Show only starred songs' },
  tapLibrary: { id: 'queue.view.tapLibrary', defaultMessage: 'Tap a song in the <link>library</link> to queue it.' },
  userFilter: { id: 'queue.header.userFilter', defaultMessage: 'Filter songs by user' },
}
