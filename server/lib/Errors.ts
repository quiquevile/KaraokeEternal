export class ValidationError extends Error {
  constructor (message) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class ConflictError extends Error {
  constructor (message) {
    super(message)
    this.name = 'ConflictError'
  }
}

export class NotFoundError extends Error {
  constructor (message) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export const DUPLICATE_SONG_MESSAGE = 'Another song already has that artist and title'
