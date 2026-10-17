import { RootState } from 'store/store'
import { createSelector } from '@reduxjs/toolkit'

const getResult = (state: RootState) => state.users.result
const getEntities = (state: RootState) => state.users.entities
const getFilterOnline = (state: RootState) => state.users.filterOnline
const getFilterRoomId = (state: RootState) => state.users.filterRoomId

const getUsers = createSelector(
  [getResult, getEntities, getFilterOnline, getFilterRoomId],
  (result, entities, filterOnline, filterRoomId) => {
    const passes = (userId: number) => {
      if (filterOnline) return !!entities[userId].rooms.length
      if (typeof filterRoomId === 'number') return entities[userId].rooms.includes(filterRoomId)
      return true
    }

    // ghosts are never online or in a room: they always pass the filter
    // and force their creator into the list so they can nest below them
    const keep = new Set<number>()

    for (const userId of result) {
      const user = entities[userId]

      if (user.role === 'ghost') keep.add(userId)
      else if (passes(userId)) keep.add(userId)
    }

    for (const userId of result) {
      const user = entities[userId]

      if (user.role === 'ghost' && typeof user.createdBy === 'number') {
        keep.add(user.createdBy)
      }
    }

    const kept = result.filter(userId => keep.has(userId))

    // interleave each user's ghosts right below them (visual nesting)
    const ghostsByCreator = new Map<number, number[]>()

    for (const userId of kept) {
      const user = entities[userId]

      if (user.role !== 'ghost') continue

      const key = typeof user.createdBy === 'number' ? user.createdBy : -1

      if (!ghostsByCreator.has(key)) ghostsByCreator.set(key, [])
      ghostsByCreator.get(key)!.push(userId)
    }

    const ordered: number[] = []
    const placed = new Set<number>()

    for (const userId of kept) {
      if (entities[userId].role === 'ghost') continue

      ordered.push(userId)

      for (const ghostId of ghostsByCreator.get(userId) ?? []) {
        ordered.push(ghostId)
        placed.add(ghostId)
      }
    }

    // orphaned ghosts (creator not in list) go to the end
    for (const userId of kept) {
      if (entities[userId].role === 'ghost' && !placed.has(userId)) {
        ordered.push(userId)
      }
    }

    return {
      result: ordered,
      entities,
    }
  })

export default getUsers
