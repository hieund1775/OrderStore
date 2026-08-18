export class IdentityError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'IdentityError';
    this.code = code;
    this.status = status;
  }
}

export function isUniqueViolation(error) {
  return error?.code === '23505';
}
