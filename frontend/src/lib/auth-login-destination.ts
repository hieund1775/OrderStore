export type LoginDestination = 'admin' | 'customer';

type LoginResponseIdentity = {
  login_destination?: string | null;
  user?: { is_admin?: boolean | null } | null;
};

/**
 * Prefer the server-issued destination. `is_admin` is retained only as a
 * backwards-compatible fallback while browser and backend deployments roll
 * forward independently.
 */
export function resolveLoginDestination(response: LoginResponseIdentity): LoginDestination {
  if (response.login_destination === 'admin') return 'admin';
  if (response.login_destination === 'customer') return 'customer';
  return response.user?.is_admin ? 'admin' : 'customer';
}
