import fs from 'fs'
import { ConflictError } from './Errors.js'

export interface FileRename {
  from: string
  to: string
}

/**
 * Ensures no rename destination exists (and no two sources share one).
 * Throws ConflictError without touching anything otherwise.
 */
export function assertNoRenameClash (renames: FileRename[]): void {
  const destinations = new Set<string>()

  for (const { from, to } of renames) {
    if (to === from) continue

    if (destinations.has(to)) {
      throw new ConflictError(`Rename target already exists: ${to}`)
    }

    destinations.add(to)

    if (fs.existsSync(to)) {
      throw new ConflictError(`File already exists: ${to}`)
    }
  }
}

/**
 * Renames every pair, undoing the completed ones when one fails
 */
export function atomicRenameAll (renames: FileRename[]): void {
  const done: FileRename[] = []

  try {
    for (const { from, to } of renames) {
      if (to === from) continue
      fs.renameSync(from, to)
      done.push({ from, to })
    }
  } catch (err) {
    for (const { from, to } of done.reverse()) {
      try {
        fs.renameSync(to, from)
      } catch {
        // best effort: the original error is more relevant
      }
    }

    throw err
  }
}
