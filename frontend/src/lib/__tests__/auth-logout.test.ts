import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { explicitAdminLogout, explicitCustomerLogout, LOGOUT_SUCCESS_MESSAGE } from '../auth-logout';
import { clearCustomerToken, clearToken, getCustomerToken, getToken, setCustomerToken, setToken } from '../api';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('Auth Logout Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('explicit customer logout clears customer token and displays success toast', () => {
    setCustomerToken('test-customer-jwt');
    expect(getCustomerToken()).toBe('test-customer-jwt');

    const navigateMock = vi.fn();
    explicitCustomerLogout({ navigate: navigateMock });

    expect(getCustomerToken()).toBeNull();
    expect(toast.success).toHaveBeenCalledWith(LOGOUT_SUCCESS_MESSAGE);
    expect(navigateMock).toHaveBeenCalledTimes(1);
  });

  it('explicit admin/staff logout clears staff token and displays success toast', () => {
    setToken('test-admin-jwt');
    expect(getToken()).toBe('test-admin-jwt');

    const navigateMock = vi.fn();
    explicitAdminLogout({ navigate: navigateMock });

    expect(getToken()).toBeNull();
    expect(toast.success).toHaveBeenCalledWith(LOGOUT_SUCCESS_MESSAGE);
    expect(navigateMock).toHaveBeenCalledTimes(1);
  });

  it('silent clearCustomerToken() clears token without displaying success toast', () => {
    setCustomerToken('auto-customer-jwt');
    clearCustomerToken();

    expect(getCustomerToken()).toBeNull();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('silent clearToken() clears staff token without displaying success toast', () => {
    setToken('auto-admin-jwt');
    clearToken();

    expect(getToken()).toBeNull();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
