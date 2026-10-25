import type { DropdownItem } from 'components/RecentSearches/RecentSearches'

export interface QueueUserTarget {
  userId: number
  username: string
  name: string
  isGhost?: boolean
}

// dropdown entries for the requeue-for-user picker: the caller's own
// entry comes first (highlighted in the list, like the queue user
// filter), the rest alphabetically; ghosts show their visible name only
// (their username is auto-generated)
export const buildQueueTargets = (
  queueUsers: QueueUserTarget[],
  selfUserId: number | null,
): DropdownItem[] =>
  queueUsers
    .map(u => ({
      value: String(u.userId),
      label: u.isGhost ? u.name : `${u.name} (${u.username})`,
      isSelf: u.userId === selfUserId,
    }))
    .sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || a.label.localeCompare(b.label))
    .map(({ value, label }) => ({ value, label }))
