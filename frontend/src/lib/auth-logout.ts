import { toast } from 'sonner';
import { clearToken, clearCustomerToken } from './api';

export const LOGOUT_SUCCESS_MESSAGE = 'Đã đăng xuất tài khoản';

export interface ExplicitLogoutOptions {
  navigate?: () => void;
  redirectTo?: string;
}

/**
 * Explicit customer-initiated logout:
 * 1. Clears customer token & user session
 * 2. Displays success toast "Đã đăng xuất tài khoản"
 * 3. Navigates/redirects if callback or url is provided
 */
export function explicitCustomerLogout(options?: ExplicitLogoutOptions) {
  clearCustomerToken();
  toast.success(LOGOUT_SUCCESS_MESSAGE);
  if (options?.navigate) {
    options.navigate();
  } else if (options?.redirectTo && typeof window !== 'undefined') {
    window.location.href = options.redirectTo;
  }
}

/**
 * Explicit admin/staff-initiated logout:
 * 1. Clears staff token & admin session
 * 2. Displays success toast "Đã đăng xuất tài khoản"
 * 3. Navigates/redirects to admin login
 */
export function explicitAdminLogout(options?: ExplicitLogoutOptions) {
  clearToken();
  toast.success(LOGOUT_SUCCESS_MESSAGE);
  if (options?.navigate) {
    options.navigate();
  } else if (typeof window !== 'undefined') {
    window.location.href = options?.redirectTo || '/admin/login';
  }
}
