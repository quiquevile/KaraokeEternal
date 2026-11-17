import { db } from '../lib/Database.js'
import { ConflictError, NotFoundError, ValidationError } from '../lib/Errors.js'
import type { Tag, TagVisibility } from '../../shared/types.js'

interface TagUser {
  isAdmin: boolean
  permissions?: Record<string, boolean>
}

export interface TagSnapshot {
  tags: Tag[]
  songTags: Record<number, number[]>
}

export default class Tags {
  static visible (user: TagUser): TagSnapshot {
    const tags = db.all<Tag>(
      `SELECT tagId, name, visibility FROM tags
       WHERE ? OR visibility IN ('public', 'manager')
       ORDER BY name COLLATE NOCASE`,
      [user.isAdmin ? 1 : 0],
    )
    const songTags: Record<number, number[]> = {}
    const rows = db.all<{ songId: number, tagId: number }>(
      `SELECT st.songId, st.tagId FROM songTags st
       JOIN tags t ON t.tagId = st.tagId
       WHERE ? OR t.visibility IN ('public', 'manager')
       ORDER BY st.songId, st.tagId`,
      [user.isAdmin ? 1 : 0],
    )
    for (const row of rows) (songTags[row.songId] ??= []).push(row.tagId)
    return { tags, songTags }
  }

  static get (tagId: number): Tag {
    const tag = db.get<Tag>('SELECT tagId, name, visibility FROM tags WHERE tagId = ?', [tagId])
    if (!tag) throw new NotFoundError('Tag not found')
    return tag
  }

  static canManage (user: TagUser, tag: Tag): boolean {
    return user.isAdmin || (user.permissions?.manageTags === true && tag.visibility === 'manager')
  }

  static save (user: TagUser, tagId: number | null, data: unknown): Tag {
    if (!user.isAdmin && user.permissions?.manageTags !== true) throw new ValidationError('Cannot manage tags')
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ValidationError('Invalid tag')
    const { name, visibility } = data as Record<string, unknown>
    if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 50) {
      throw new ValidationError('Tag name must have 1-50 characters')
    }
    if (visibility !== 'public' && visibility !== 'admin' && visibility !== 'manager') {
      throw new ValidationError('Invalid tag visibility')
    }
    if (!user.isAdmin && visibility !== 'manager') throw new ValidationError('Cannot manage this tag')
    if (tagId !== null && !this.canManage(user, this.get(tagId))) throw new ValidationError('Cannot manage this tag')

    const trimmed = name.trim()
    const duplicate = db.get<{ tagId: number }>('SELECT tagId FROM tags WHERE name = ? COLLATE NOCASE', [trimmed])
    if (duplicate && duplicate.tagId !== tagId) throw new ConflictError('A tag with this name already exists')

    if (tagId === null) {
      const result = db.run('INSERT INTO tags (name, visibility) VALUES (?, ?)', [trimmed, visibility as TagVisibility])
      return this.get(Number(result.lastID))
    }
    db.run('UPDATE tags SET name = ?, visibility = ? WHERE tagId = ?', [trimmed, visibility, tagId])
    return this.get(tagId)
  }

  static remove (user: TagUser, tagId: number): void {
    if (!this.canManage(user, this.get(tagId))) throw new ValidationError('Cannot manage this tag')
    db.transaction(() => {
      db.run('DELETE FROM songTags WHERE tagId = ?', [tagId])
      db.run('DELETE FROM tags WHERE tagId = ?', [tagId])
    })
  }

  static assign (user: TagUser, songId: number, tagIds: unknown): void {
    if (!user.isAdmin && user.permissions?.manageTags !== true) throw new ValidationError('Cannot assign tags')
    if (!Number.isInteger(songId) || !db.get('SELECT songId FROM songs WHERE songId = ?', [songId])) {
      throw new NotFoundError('Song not found')
    }
    if (!Array.isArray(tagIds) || tagIds.length > 500
      || tagIds.some(id => !Number.isInteger(id) || id <= 0)
      || new Set(tagIds).size !== tagIds.length) throw new ValidationError('Invalid tags')
    const tags = tagIds.map(id => this.get(id))
    if (tags.some(tag => !this.canManage(user, tag))) throw new ValidationError('Cannot assign this tag')

    db.transaction(() => {
      if (user.isAdmin) db.run('DELETE FROM songTags WHERE songId = ?', [songId])
      else db.run(`DELETE FROM songTags WHERE songId = ? AND tagId IN
        (SELECT tagId FROM tags WHERE visibility = 'manager')`, [songId])
      for (const id of tagIds) db.run('INSERT INTO songTags (songId, tagId) VALUES (?, ?)', [songId, id])
    })
  }
}
