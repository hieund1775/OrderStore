/**
 * Google OAuth client IDs are public identifiers, but must still be supplied
 * by the frontend deployment. Keeping this out of source prevents a stale
 * client from rendering a GSI button for an origin it does not authorize.
 */
export function normalizeGoogleClientId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export const googleClientId = normalizeGoogleClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID);
export const hasGoogleSignIn = Boolean(googleClientId);
