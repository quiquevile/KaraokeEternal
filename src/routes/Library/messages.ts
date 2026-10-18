import type { MessageDescriptor } from 'react-intl'

export const libraryMessages: Record<string, MessageDescriptor> = {
  admin: { id: 'library.empty.admin', defaultMessage: '<link>Add media folders</link> to get started.' },
  counts: { id: 'library.search.counts', defaultMessage: '{artists, plural, one {# artist} other {# artists}}, {songs, plural, one {# song} other {# songs}}' },
  downloadedOnly: { id: 'library.header.downloadedOnly', defaultMessage: 'Show only downloaded songs' },
  flawMark: { id: 'library.flaw.mark', defaultMessage: 'Mark as defective' },
  flawUnmark: { id: 'library.flaw.unmark', defaultMessage: 'Remove defective mark' },
  queueForUser: { id: 'library.queue.queueForUser', defaultMessage: 'Queue for user' },
  recentSearches: { id: 'library.header.recentSearches', defaultMessage: 'Recent searches' },
  search: { id: 'library.header.search', defaultMessage: 'search' },
  searchLibrary: { id: 'library.header.searchLibrary', defaultMessage: 'Search library' },
  searchYoutube: { id: 'library.header.searchYoutube', defaultMessage: 'Search YouTube' },
  starredOnly: { id: 'library.header.starredOnly', defaultMessage: 'Show only starred songs' },
  title: { id: 'library.empty.title', defaultMessage: 'Library Empty' },
}
