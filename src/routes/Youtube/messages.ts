import type { MessageDescriptor } from 'react-intl'

export const youtubeMessages: Record<string, MessageDescriptor> = {
  complete: { id: 'youtube.downloads.complete', defaultMessage: 'complete' },
  downloading: { id: 'youtube.downloads.downloading', defaultMessage: 'downloading' },
  failed: { id: 'youtube.downloads.failed', defaultMessage: 'failed' },
  loading: { id: 'youtube.preview.loading', defaultMessage: 'Loading preview' },
  merging: { id: 'youtube.downloads.merging', defaultMessage: 'merging' },
  noResults: { id: 'youtube.search.noResults', defaultMessage: 'No results found' },
  placeholder: { id: 'youtube.search.placeholder', defaultMessage: 'search / YouTube URL' },
  queue: { id: 'youtube.download.queue', defaultMessage: 'Add to queue' },
  queued: { id: 'youtube.downloads.queued', defaultMessage: 'queued' },
  registering: { id: 'youtube.downloads.registering', defaultMessage: 'registering' },
  remove: { id: 'youtube.downloads.remove', defaultMessage: 'Remove notification' },
  submit: { id: 'youtube.search.submit', defaultMessage: 'Search' },
  title: { id: 'youtube.download.title', defaultMessage: 'Download song' },
  user: { id: 'youtube.download.user', defaultMessage: 'User' },
  you: { id: 'youtube.download.you', defaultMessage: '(you)' },
}
