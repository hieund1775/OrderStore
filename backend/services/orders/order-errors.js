/**
 * Error contract shared by the order HTTP boundary and repositories.
 *
 * `code` is intended for clients and observability; `expose` makes it explicit
 * whether a message is safe to return to a caller.  Existing handlers still
 * own their response DTOs, so introducing this type does not alter successful
 * or known-business-error payloads.
 */
export class OrderDomainError extends Error {
  constructor(message, { code = 'ORDER_BUSINESS_RULE', status = 400, expose = true, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'OrderDomainError';
    this.code = code;
    this.status = status;
    this.expose = expose;
  }
}

export class OrderValidationError extends OrderDomainError {
  constructor(message, code = 'ORDER_VALIDATION_ERROR') {
    super(message, { code, status: 400, expose: true });
    this.name = 'OrderValidationError';
  }
}

export function isOrderBusinessError(error) {
  return error instanceof OrderDomainError
    || (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500);
}

/**
 * Keep known 4xx messages stable while allowing unknown failures to become a
 * safe 500 response through the existing production response sanitizer.
 */
export function orderErrorStatus(error, fallback = 500) {
  return isOrderBusinessError(error) ? error.status : fallback;
}
