import { describe, it, expect } from 'vitest'
import getRoomList from './getRoomList'

const stateWithRooms = (rooms: object) => ({ rooms }) as never

describe('getRoomList', () => {
  it('hides closed rooms when filtering by open (login list)', () => {
    const list = getRoomList(stateWithRooms({
      result: [1, 2],
      entities: {
        1: { roomId: 1, name: 'Open', status: 'open' },
        2: { roomId: 2, name: 'Closed', status: 'closed' },
      },
      filterStatus: 'open',
    }))

    expect(list.result).toEqual([1])
  })

  it('shows everything when the filter is off', () => {
    const list = getRoomList(stateWithRooms({
      result: [1, 2],
      entities: {
        1: { roomId: 1, name: 'Open', status: 'open' },
        2: { roomId: 2, name: 'Closed', status: 'closed' },
      },
      filterStatus: false,
    }))

    expect(list.result).toEqual([1, 2])
  })
})
