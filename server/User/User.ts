import { db } from '../lib/Database.js'
import sql from 'sqlate'
import crypto from '../lib/crypto.js'
import Queue from '../Queue/Queue.js'
import { randomChars } from '../lib/util.js'
import { parsePermissions } from '../lib/permissions.js'
import { ValidationError } from '../lib/Errors.js'
import { DEFAULT_LOCALE, t, type LocaleCode } from '../lib/locale.js'
import { User as UserType } from '../../shared/types.js'

export type ServerUser = UserType & {
  role: string
  password?: string // only populated if requesting creds
  image?: string
  rooms?: number[] // populated in router
}

export const IMG_MAX_LENGTH = 51200 // 50KB
export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 128
export const PASSWORD_MIN_LENGTH = 6
export const NAME_MIN_LENGTH = 2
export const NAME_MAX_LENGTH = 50

export const EQ_PRESET_SLOTS = ['P1', 'P2', 'P3']
export const EQ_BAND_COUNT = 10

class User {
  /**
   * Get user by userId
   *
   * @param creds Whether to include username and password in result
   */
  static getById (userId: number, creds: boolean = false): ServerUser | false {
    if (typeof userId !== 'number') {
      throw new Error('userId must be a number')
    }

    return User._get({ userId, username: undefined }, creds)
  }

  /**
   * Get user by username
   *
   * @param creds Whether to include username and password in result
   */
  static getByUsername (username: string, creds: boolean = false): ServerUser | false {
    if (typeof username !== 'string') {
      throw new Error('username must be a string')
    }

    return User._get({ userId: undefined, username }, creds)
  }

  /**
   * Gets all users
   *
   * @returns normalized list of users
   */
  static get (): { result: number[], entities: Record<number, ServerUser> } {
    const result = []
    const entities = {}

    const query = sql`
      SELECT users.userId, users.username, users.name, users.dateCreated, users.dateUpdated, users.permissions, users.createdBy, roles.name AS role
      FROM users
        INNER JOIN roles USING (roleId)
      ORDER BY dateCreated DESC
    `
    const res = db.all<UserType & { role: string }>(String(query), query.parameters)

    res.forEach((row) => {
      result.push(row.userId)
      if (typeof row.permissions === 'string') {
        row.permissions = JSON.parse(row.permissions)
      }
      entities[row.userId] = row
    })

    return { result, entities }
  }

  static async create ({
    username,
    newPassword,
    newPasswordConfirm,
    name,
    image,
    permissions,
    createdBy,
  }: {
    username?: string
    newPassword?: string
    newPasswordConfirm?: string
    name?: string
    image?: Buffer
    permissions?: unknown
    createdBy?: number | null
  }, role = 'standard', locale: LocaleCode = DEFAULT_LOCALE) {
    username = username?.trim()
    name = name?.trim()

    const fields = new Map()

    if (role !== 'guest' && role !== 'ghost') {
      if (!username) {
        throw new Error(t(locale, 'server.users.usernameRequired', 'Username is required'))
      }

      if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
        throw new Error(t(
          locale, 'server.users.usernameLength',
          'Username must have {min}-{max} characters',
          { min: USERNAME_MIN_LENGTH, max: USERNAME_MAX_LENGTH },
        ))
      }

      if (!newPassword) {
        throw new Error(t(locale, 'server.users.passwordRequired', 'Password is required'))
      }

      if (newPassword.length < PASSWORD_MIN_LENGTH) {
        throw new Error(t(
          locale, 'server.users.passwordLength',
          'Password must have at least {min} characters',
          { min: PASSWORD_MIN_LENGTH },
        ))
      }

      if (!newPasswordConfirm) {
        throw new Error(t(locale, 'server.users.passwordConfirmRequired', 'Password confirmation is required'))
      }

      if (newPassword !== newPasswordConfirm) {
        throw new Error(t(locale, 'server.users.passwordMismatch', 'New passwords do not match'))
      }

      if (User.getByUsername(username)) {
        throw new Error(t(locale, 'server.users.usernameTaken', 'Username is not available'))
      }

      fields.set('username', username)
      fields.set('password', await crypto.hash(newPassword))
    } else {
      let res: { count?: number } = {}

      // ensure unique guest/ghost username
      do {
        fields.set('username', `${role}-${randomChars(5)}`)

        const query = sql`
        SELECT COUNT(*) AS count
        FROM users
        WHERE username = ${fields.get('username')}
        `
        res = db.get(String(query), query.parameters) as { count: number }
      } while (res.count > 0)

      fields.set('password', 'guest')
    }

    if (!name) {
      throw new Error(t(locale, 'server.users.displayNameRequired', 'Display name is required'))
    }

    if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
      throw new Error(t(
        locale, 'server.users.displayNameLength',
        'Display name must have {min}-{max} characters',
        { min: NAME_MIN_LENGTH, max: NAME_MAX_LENGTH },
      ))
    }

    fields.set('name', name)
    fields.set('dateCreated', Math.floor(Date.now() / 1000))
    fields.set('roleId', sql`(SELECT roleId FROM roles WHERE name = ${role})`)

    if (role === 'ghost') {
      // ghosts are always tied to the user who creates them
      if (typeof createdBy !== 'number') {
        throw new Error(t(locale, 'server.users.ghostCreatorRequired', 'A ghost user requires its creator'))
      }

      fields.set('createdBy', createdBy)
    } else if (permissions) {
      const perms = parsePermissions(permissions)

      if (perms) {
        fields.set('permissions', JSON.stringify(perms))
      }
    }

    // user image?
    if (image) {
      if (image.length > IMG_MAX_LENGTH) {
        throw new Error('Invalid image')
      }

      fields.set('image', image)
    }

    const query = sql`
    INSERT INTO users ${sql.tuple(Array.from(fields.keys()).map(sql.column))}
    VALUES ${sql.tuple(Array.from(fields.values()))}
  `
    const res = db.run(String(query), query.parameters)

    if (typeof res.lastID !== 'number') {
      throw new Error('Unable to create user')
    }

    return res.lastID
  }

  static async validate (
    { username, password }: { username?: string, password?: string },
    locale: LocaleCode = DEFAULT_LOCALE,
  ) {
    if (!username || !password) {
      throw new Error(t(locale, 'server.auth.credentialsRequired', 'Username and password are required'))
    }

    const user = User.getByUsername(username, true) as ServerUser

    // ghosts are owned accounts and can never sign in, even if a real
    // password was set on them
    if (!user || user.role === 'ghost' || !(await crypto.compare(password, user.password))) {
      throw new Error(t(locale, 'server.auth.incorrectCredentials', 'Incorrect username or password'))
    }

    return user
  }

  /**
   * Per-user EQ preset slots ({ P1: gains, ... }); missing slots are Flat
   */
  static getEqPresets (userId: number): Record<string, number[]> {
    return (User.getUserData(userId)?.eqPresets ?? {}) as Record<string, number[]>
  }

  static setEqPreset (
    userId: number,
    name: string,
    gains: number[],
    locale: LocaleCode = DEFAULT_LOCALE,
  ): Record<string, number[]> {
    if (!EQ_PRESET_SLOTS.includes(name)) {
      throw new ValidationError(t(locale, 'server.users.invalidPresetSlot', 'Invalid preset slot'))
    }

    if (!Array.isArray(gains)
      || gains.length !== EQ_BAND_COUNT
      || gains.some(g => typeof g !== 'number' || !Number.isFinite(g))
    ) {
      throw new ValidationError(t(locale, 'server.users.invalidPresetGains', 'Invalid preset gains'))
    }

    const data = User.getUserData(userId)
    const next = { ...((data?.eqPresets ?? {}) as Record<string, number[]>), [name]: gains }
    db.run('UPDATE users SET data = ? WHERE userId = ?', [JSON.stringify({ ...data, eqPresets: next }), userId])

    return next
  }

  static getUserData (userId: number): Record<string, unknown> {
    const row = db.get<{ data: string }>('SELECT data FROM users WHERE userId = ?', [userId])

    if (!row) {
      throw new Error('User not found')
    }

    try {
      const data: unknown = JSON.parse(row.data ?? '{}')
      return (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>
    } catch {
      return {}
    }
  }

  /**
   * Number of admin users (guarding the last one out of demotions/deletion)
   */
  static countAdmins (): number {
    const query = sql`
      SELECT COUNT(*) AS count
      FROM users
      WHERE roleId = (SELECT roleId FROM roles WHERE name = 'admin')
    `
    const res = db.get<{ count: number }>(String(query), query.parameters)

    return res?.count ?? 0
  }

  /**
   * Remove a user
   */
  static remove (userId: number): void {
    if (typeof userId !== 'number') {
      throw new Error('userId must be a number')
    }

    // ghosts cannot outlive the user who created them
    User.removeGhostsByCreator(userId)

    // remove user's queue items
    const queueQuery = sql`
      SELECT queueId, roomId
      FROM queue
      WHERE userId = ${userId}
    `
    const queueRows = db.all<{ queueId: number, roomId: number }>(String(queueQuery), queueQuery.parameters)

    for (const row of queueRows) {
      Queue.remove(row.queueId, row.roomId)
    }

    // remove user's song stars
    const songStarsQuery = sql`
      DELETE FROM songStars
      WHERE userId = ${userId}
    `
    db.run(String(songStarsQuery), songStarsQuery.parameters)

    // remove user's artist stars
    const artistStarsQuery = sql`
      DELETE FROM artistStars
      WHERE userId = ${userId}
    `
    db.run(String(artistStarsQuery), artistStarsQuery.parameters)

    // remove user's defective song marks
    const songFlawsQuery = sql`
      DELETE FROM songFlaws
      WHERE userId = ${userId}
    `
    db.run(String(songFlawsQuery), songFlawsQuery.parameters)

    // remove the user
    const usersQuery = sql`
      DELETE FROM users
      WHERE userId = ${userId}
    `
    const usersQueryRes = db.run(String(usersQuery), usersQuery.parameters)

    if (!usersQueryRes.changes) {
      throw new Error(`unable to remove userId: ${userId}`)
    }
  }

  /**
   * Remove every ghost user created by the given user (e.g. when the
   * creator is deleted or loses the ghostUsers permission)
   *
   * @returns the removed ghost userIds
   */
  static removeGhostsByCreator (creatorId: number): number[] {
    if (typeof creatorId !== 'number') {
      throw new Error('creatorId must be a number')
    }

    const query = sql`
      SELECT userId
      FROM users
      WHERE createdBy = ${creatorId}
    `
    const rows = db.all<{ userId: number }>(String(query), query.parameters)

    for (const row of rows) {
      User.remove(row.userId)
    }

    return rows.map(row => row.userId)
  }

  /**
   * (private) runs the query
   * @param id with fields 'username' or 'userId'
   * @param creds whether to include username and password in result
   * @returns user object
   */
  static _get ({ userId, username }: { userId?: number, username?: string }, creds: boolean = false): ServerUser | false {
    const query = sql`
      SELECT users.*, roles.name AS role
      FROM users
        INNER JOIN roles USING (roleId)
      WHERE ${typeof userId === 'number' ? sql`userId = ${userId}` : sql`LOWER(username) = ${username.toLowerCase()}`}
    `

    const user = db.get<ServerUser>(String(query), query.parameters)
    if (!user) return false

    if (!creds) {
      delete user.username
      delete user.password
    }

    return user
  }
}

export default User
