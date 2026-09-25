import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { open, close, db } from '../lib/Database.js'
import { NotFoundError, ValidationError } from '../lib/Errors.js'
import Queue from './Queue.js'

let dir: string

const orderOf = (roomId: number): number[] => {
  const rows = db.all<{ queueId: number, prevQueueId: number | null }>(
    'SELECT queueId, prevQueueId FROM queue WHERE roomId = ? ORDER BY queueId', [roomId],
  ) ?? []
  const next = new Map(rows.map(row => [row.prevQueueId, row.queueId]))
  const ordered: number[] = []
  let cur = next.get(null) ?? null

  while (cur != null) {
    ordered.push(cur)
    cur = next.get(cur) ?? null
  }

  return ordered
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'ke-queue-test-'))
  open({ file: join(dir, 'test.sqlite3'), ro: false })

  db.run('INSERT INTO users (username, password, name, roleId) VALUES (?, ?, ?, ?)',
    ['tester', 'x', 'Tester', 3])
  db.run('INSERT INTO rooms (name, status) VALUES (?, ?)', ['Room 1', 'open'])
})

afterAll(() => {
  close()
  rmSync(dir, { recursive: true, force: true })
})

describe('Queue.move', () => {
  beforeEach(() => {
    db.run('DELETE FROM queue')
    // chain 1 -> 2 -> 3
    db.run('INSERT INTO queue (queueId, roomId, songId, userId, prevQueueId) VALUES (?, ?, ?, ?, ?)', [1, 1, 1, 1, null])
    db.run('INSERT INTO queue (queueId, roomId, songId, userId, prevQueueId) VALUES (?, ?, ?, ?, ?)', [2, 1, 2, 1, 1])
    db.run('INSERT INTO queue (queueId, roomId, songId, userId, prevQueueId) VALUES (?, ?, ?, ?, ?)', [3, 1, 3, 1, 2])
  })

  it('moves the head to the tail', () => {
    Queue.move({ prevQueueId: 3, queueId: 1, roomId: 1 })

    expect(orderOf(1)).toEqual([2, 3, 1])
  })

  it('moves an item right after its own child', () => {
    Queue.move({ prevQueueId: 2, queueId: 1, roomId: 1 })

    expect(orderOf(1)).toEqual([2, 1, 3])
  })

  it('moves an item to the head with null', () => {
    Queue.move({ prevQueueId: null, queueId: 3, roomId: 1 })

    expect(orderOf(1)).toEqual([3, 1, 2])
  })

  it('is a no-op when already after the target', () => {
    Queue.move({ prevQueueId: 1, queueId: 2, roomId: 1 })

    expect(orderOf(1)).toEqual([1, 2, 3])
  })

  it('rejects moving an item after itself', () => {
    expect(() => Queue.move({ prevQueueId: 1, queueId: 1, roomId: 1 }))
      .toThrowError(ValidationError)
    expect(orderOf(1)).toEqual([1, 2, 3])
  })

  it('rejects unknown targets and items', () => {
    expect(() => Queue.move({ prevQueueId: 999, queueId: 1, roomId: 1 }))
      .toThrowError(ValidationError)
    expect(() => Queue.move({ prevQueueId: null, queueId: 999, roomId: 1 }))
      .toThrowError(NotFoundError)
    expect(orderOf(1)).toEqual([1, 2, 3])
  })
})

describe('Queue.get with corrupt chains', () => {
  beforeAll(() => {
    db.run('INSERT INTO artists (name, nameNorm) VALUES (?, ?)', ['Cycle', 'Cycle'])
    db.run('INSERT INTO songs (artistId, title, titleNorm) VALUES (?, ?, ?), (?, ?, ?)',
      [1, 'Song A', 'Song A', 1, 'Song B', 'Song B'])
    db.run('INSERT INTO paths (path, priority, data) VALUES (?, ?, ?)', ['/music', 1, '{}'])
    db.run('INSERT INTO media (songId, pathId, relPath, duration) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
      [1, 1, 'a.mp3', 200, 2, 1, 'b.mp3', 200])
    db.run('INSERT INTO rooms (name, status) VALUES (?, ?)', ['Room 2', 'open'])
  })

  beforeEach(() => {
    db.run('DELETE FROM queue WHERE roomId = 2')
  })

  it('stops at a fork instead of crashing', () => {
    db.run('INSERT INTO queue (queueId, roomId, songId, userId, prevQueueId) VALUES (?, ?, ?, ?, ?)', [20, 2, 1, 1, null])
    db.run('INSERT INTO queue (queueId, roomId, songId, userId, prevQueueId) VALUES (?, ?, ?, ?, ?)', [21, 2, 2, 1, 20])
    db.run('INSERT INTO queue (queueId, roomId, songId, userId, prevQueueId) VALUES (?, ?, ?, ?, ?)', [22, 2, 1, 1, 20])

    expect(Queue.get(2).result).toEqual([20, 22])
  })

  it('terminates on a cycle instead of hanging', () => {
    db.run('INSERT INTO queue (queueId, roomId, songId, userId, prevQueueId) VALUES (?, ?, ?, ?, ?)', [30, 2, 1, 1, null])
    db.run('INSERT INTO queue (queueId, roomId, songId, userId, prevQueueId) VALUES (?, ?, ?, ?, ?)', [31, 2, 2, 1, 30])
    db.run('UPDATE queue SET prevQueueId = 31 WHERE queueId = 30')

    expect(Queue.get(2).result).toEqual([])
  }, 5000)
})
