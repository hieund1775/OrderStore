# PayOS QR replay design

## Goal

Ensure an online PayOS order always returns its checkout URL and QR payload when
the client retries the same idempotent request. A successful order response must
never silently fall back to a generic success screen without payment details.

## Design

- Store PayOS `checkoutUrl` and `qrCode` alongside the existing payment link
  fields on `orders`.
- Include both stored values in the payment reservation/attachment repository
  queries and return them from the existing-payment-link branch.
- Validate the first PayOS response. If neither payment artifact is present,
  return an upstream payment error instead of creating a misleading success
  response.
- Keep the frontend pending-payment branch for either artifact, but treat a
  PayOS response without one as an error.

## Verification

Add a migration and an integration regression assertion that the second request
with the same idempotency key receives the original checkout URL and QR value.
Run backend tests, frontend typecheck/build, and `git diff --check`.
