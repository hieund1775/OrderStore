import { describe, expect, it } from 'vitest';
import { resolveLoginDestination } from '../auth-login-destination';

describe('resolveLoginDestination', () => {
  it('uses the server-issued admin destination for staff accounts', () => {
    expect(resolveLoginDestination({ login_destination: 'admin', user: { is_admin: true } })).toBe('admin');
  });

  it('keeps customers on the customer surface', () => {
    expect(resolveLoginDestination({ login_destination: 'customer', user: { is_admin: false } })).toBe('customer');
  });

  it('fails safely to the historical staff flag during a rolling deployment', () => {
    expect(resolveLoginDestination({ user: { is_admin: true } })).toBe('admin');
    expect(resolveLoginDestination({ user: { is_admin: false } })).toBe('customer');
  });
});
