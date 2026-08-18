# Order Idempotency-Key Design

## Scope

Fix both customer online checkout and admin POS checkout so every `POST /api/orders`
request includes a valid `Idempotency-Key` header.

## Design

- Extend the frontend API helper so order callers can pass request headers without
  losing the default JSON and authentication headers.
- Generate one UUID per checkout attempt in each checkout screen.
- Send that UUID as `Idempotency-Key` for the order request.
- Keep the key for the request lifecycle, including a user retry of the same
  submission, so PostgreSQL idempotency returns the original response.
- Do not weaken backend validation or auto-generate keys server-side.

## Error handling

The backend remains the source of truth for key validation and conflict handling.
Existing API errors continue to be surfaced to the user.

## Verification

- Add/extend frontend tests for header propagation and order key generation.
- Run TypeScript checking and the production frontend build.
- Run the existing backend order/idempotency test suite.
