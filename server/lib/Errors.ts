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
