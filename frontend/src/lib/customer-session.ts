import { useEffect, useState } from 'react';
import { getCustomerToken, getCustomerUser, openCustomerLoginModal } from './api';

export interface CustomerSession {
  userId: number;
  token: string;
}

/**
 * Get canonical customer session from storage synchronously.
 * Canonical identity requires both a non-empty token and a positive integer user ID.
 * Returns null for guests, malformed storage, non-positive IDs, or missing tokens.
 */
export function getCustomerSession(): CustomerSession | null {
  if (typeof window === 'undefined') return null;
  const token = getCustomerToken();
  if (!token || typeof token !== 'string' || !token.trim()) return null;

  const user = getCustomerUser();
  if (!user || typeof user !== 'object') return null;

  const rawId = Number((user as { id?: unknown }).id);
  if (!Number.isInteger(rawId) || rawId <= 0) return null;

  return { userId: rawId, token: token.trim() };
}

/**
 * SSR-safe hook for tracking the active customer session.
 * Initial state is null to ensure identical hydration markup between SSR and client.
 */
export function useCustomerSession(): CustomerSession | null {
  const [session, setSession] = useState<CustomerSession | null>(null);

  useEffect(() => {
    setSession(getCustomerSession());

    const handleAuthChange = () => {
      setSession(getCustomerSession());
    };

    window.addEventListener('teaplus:customer-auth-changed', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);

    return () => {
      window.removeEventListener('teaplus:customer-auth-changed', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  return session;
}

export { openCustomerLoginModal };
