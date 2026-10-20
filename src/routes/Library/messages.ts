import type { MessageDescriptor } from 'react-intl'

export const libraryMessages: Record<string, MessageDescriptor> = {
  admin: { id: 'library.empty.admin', defaultMessage: '<link>Add media folders</link> to get started.' },
  counts: { id: 'library.search.counts', defaultMessage: '{artists, plural, one {# artist} other {# artists}}, {songs, plural, one {# song} other {# songs}}' },
  flawedOnly: { id: 'library.header.flawedOnly', defaultMessage: 'Show only defective songs' },
  filterFolder: { id: 'library.header.filterFolder', defaultMessage: 'Filter songs by folder' },
  folderFilterTitle: { id: 'library.folderFilter.title', defaultMessage: 'Filter by folder' },
  flawMark: { id: 'library.flaw.mark', defaultMessage: 'Mark as defective' },
  flawUnmark: { id: 'library.flaw.unmark', defaultMessage: 'Remove defective mark' },
  multiVersionOnly: { id: 'library.header.multiVersionOnly', defaultMessage: 'Show only songs with multiple versions' },
  noMatches: { id: 'library.search.noMatches', defaultMessage: 'No Songs Match the Filters' },
  preferredAny: { id: 'library.header.preferredAny', defaultMessage: 'Show songs with or without a preferred version' },
  preferredWithout: { id: 'library.header.preferredWithout', defaultMessage: 'Show only songs without a preferred version' },
  preferredWith: { id: 'library.header.preferredWith', defaultMessage: 'Show only songs with a preferred version' },
  queueForUser: { id: 'library.queue.queueForUser', defaultMessage: 'Queue for user' },
  recentSearches: { id: 'library.header.recentSearches', defaultMessage: 'Recent searches' },
  search: { id: 'library.header.search', defaultMessage: 'search' },
  searchLibrary: { id: 'library.header.searchLibrary', defaultMessage: 'Search library' },
  searchYoutube: { id: 'library.header.searchYoutube', defaultMessage: 'Search YouTube' },
  starredOnly: { id: 'library.header.starredOnly', defaultMessage: 'Show only starred songs' },
  title: { id: 'library.empty.title', defaultMessage: 'Library Empty' },
}
