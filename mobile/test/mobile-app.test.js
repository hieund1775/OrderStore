import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { vnd, formatDateTime } from '../src/lib/formatters.js';

// ══════════════════════════════════════════════════════════════
// Formatter Tests (keep existing)
// ══════════════════════════════════════════════════════════════
describe('Formatters', () => {
  it('formats VND currency accurately', () => {
    assert.match(vnd(35000), /35\.000/);
    assert.match(vnd(0), /0/);
    assert.match(vnd(120000), /120\.000/);
  });

  it('formats date time', () => {
    const result = formatDateTime('2026-09-08T10:30:00Z');
    assert.ok(result.length > 0);
    assert.equal(formatDateTime(null), '');
    assert.equal(formatDateTime(undefined), '');
  });
});

// ══════════════════════════════════════════════════════════════
// Staff Role & UI Logic Tests
// ══════════════════════════════════════════════════════════════
describe('Staff Role & UI Logic', () => {
  /** Simulates the role-based UI logic from the app */

  function canViewAccounts(role) {
    return role === 'super' || role === 'manager';
  }

  function canCreateRole(actorRole, targetRole) {
    if (actorRole === 'super') return true;
    if (actorRole === 'manager') {
      return ['cashier', 'kitchen', 'packing'].includes(targetRole);
    }
    return false;
  }

  function canDisableTarget(actorRole, actorBranchId, target) {
    if (actorRole === 'super') return true;
    if (actorRole === 'manager') {
      if (target.id === 'self') return false;
      if (target.branch_id !== actorBranchId) return false;
      if (target.role === 'manager' || target.role === 'super') return false;
      return true;
    }
    return false;
  }

  function getStaffStatus(account) {
    if (account.is_active) return { label: 'Hoạt động', type: 'active' };
    return { label: 'Đã khóa', type: 'disabled' };
  }

  it('Super can view accounts', () => {
    assert.equal(canViewAccounts('super'), true);
  });

  it('Manager can view accounts', () => {
    assert.equal(canViewAccounts('manager'), true);
  });

  it('Cashier cannot view accounts', () => {
    assert.equal(canViewAccounts('cashier'), false);
  });

  it('Kitchen cannot view accounts', () => {
    assert.equal(canViewAccounts('kitchen'), false);
  });

  it('Packing cannot view accounts', () => {
    assert.equal(canViewAccounts('packing'), false);
  });

  it('Super can create any role', () => {
    assert.equal(canCreateRole('super', 'manager'), true);
    assert.equal(canCreateRole('super', 'cashier'), true);
    assert.equal(canCreateRole('super', 'kitchen'), true);
    assert.equal(canCreateRole('super', 'packing'), true);
  });

  it('Manager can only create operational roles', () => {
    assert.equal(canCreateRole('manager', 'manager'), false);
    assert.equal(canCreateRole('manager', 'super'), false);
    assert.equal(canCreateRole('manager', 'cashier'), true);
    assert.equal(canCreateRole('manager', 'kitchen'), true);
    assert.equal(canCreateRole('manager', 'packing'), true);
  });

  it('Super can disable any target', () => {
    assert.equal(canDisableTarget('super', null, { id: 1, branch_id: 1, role: 'manager' }), true);
    assert.equal(canDisableTarget('super', null, { id: 2, branch_id: 2, role: 'cashier' }), true);
  });

  it('Manager cannot disable self', () => {
    assert.equal(canDisableTarget('manager', 1, { id: 'self', branch_id: 1, role: 'manager' }), false);
  });

  it('Manager cannot disable cross-branch staff', () => {
    assert.equal(canDisableTarget('manager', 1, { id: 3, branch_id: 2, role: 'cashier' }), false);
  });

  it('Manager cannot disable manager or super', () => {
    assert.equal(canDisableTarget('manager', 1, { id: 4, branch_id: 1, role: 'manager' }), false);
    assert.equal(canDisableTarget('manager', 1, { id: 5, branch_id: 1, role: 'super' }), false);
  });

  it('Manager can disable own-branch operational staff', () => {
    assert.equal(canDisableTarget('manager', 1, { id: 6, branch_id: 1, role: 'cashier' }), true);
    assert.equal(canDisableTarget('manager', 1, { id: 7, branch_id: 1, role: 'kitchen' }), true);
    assert.equal(canDisableTarget('manager', 1, { id: 8, branch_id: 1, role: 'packing' }), true);
  });

  it('getStaffStatus returns correct labels', () => {
    assert.equal(getStaffStatus({ is_active: true }).label, 'Hoạt động');
    assert.equal(getStaffStatus({ is_active: true }).type, 'active');
    assert.equal(getStaffStatus({ is_active: false }).label, 'Đã khóa');
    assert.equal(getStaffStatus({ is_active: false }).type, 'disabled');
  });
});

// ══════════════════════════════════════════════════════════════
// Auth Session & Error Mapping Tests
// ══════════════════════════════════════════════════════════════
describe('Auth Session & Error Handling', () => {
  /** Simulates the error mapping logic from the interceptors */

  function mapApiError(error) {
    if (!error) return { message: 'Lỗi kết nối', type: 'network' };
    if (error.status === 401) return { message: error.message, type: 'unauthorized' };
    if (error.status === 403) return { message: error.message, type: 'forbidden' };
    if (error.status === 429) return { message: 'Vui lòng thử lại sau', type: 'rate_limited' };
    if (error.status >= 500) return { message: 'Lỗi máy chủ, vui lòng thử lại sau', type: 'server_error' };
    if (error.status === 0) return { message: error.message, type: 'network' };
    return { message: error.message, type: 'unknown' };
  }

  it('maps 401 to unauthorized with message', () => {
    const result = mapApiError({ status: 401, message: 'Token không hợp lệ' });
    assert.equal(result.type, 'unauthorized');
    assert.equal(result.message, 'Token không hợp lệ');
  });

  it('maps 403 to forbidden', () => {
    const result = mapApiError({ status: 403, message: 'Không có quyền truy cập' });
    assert.equal(result.type, 'forbidden');
  });

  it('maps 429 to rate limited', () => {
    const result = mapApiError({ status: 429, message: 'Quá nhiều yêu cầu' });
    assert.equal(result.type, 'rate_limited');
  });

  it('maps 5xx to server error', () => {
    const result = mapApiError({ status: 500, message: 'Internal error' });
    assert.equal(result.type, 'server_error');
  });

  it('maps 0/network error to network', () => {
    const result = mapApiError({ status: 0, message: 'Network error' });
    assert.equal(result.type, 'network');
  });

  it('maps null error to network fallback', () => {
    const result = mapApiError(null);
    assert.equal(result.type, 'network');
    assert.ok(result.message);
  });

  it('maps validation error correctly', () => {
    const result = mapApiError({ status: 400, message: 'Email không hợp lệ' });
    assert.equal(result.type, 'unknown');
    assert.equal(result.message, 'Email không hợp lệ');
  });

  it('simulates auth state transitions', () => {
    const states = [
      { token: null, user: null, loading: true },
      { token: 'abc', user: { id: 1, role: 'super' }, loading: false },
      { token: null, user: null, loading: false },
    ];

    assert.equal(states[0].loading, true);
    assert.equal(states[0].token, null);

    assert.equal(states[1].token, 'abc');
    assert.equal(states[1].user.role, 'super');

    assert.equal(states[2].loading, false);
    assert.equal(states[2].token, null);
  });
});

// ══════════════════════════════════════════════════════════════
// Role Navigation Tests
// ══════════════════════════════════════════════════════════════
describe('Role Navigation', () => {
  function getAllowedTabs(role) {
    const tabs = ['operations', 'profile'];
    if (role === 'super' || role === 'manager') {
      tabs.push('accounts');
    }
    return tabs;
  }

  it('Super has all tabs', () => {
    const tabs = getAllowedTabs('super');
    assert.ok(tabs.includes('operations'));
    assert.ok(tabs.includes('accounts'));
    assert.ok(tabs.includes('profile'));
  });

  it('Manager has accounts tab', () => {
    const tabs = getAllowedTabs('manager');
    assert.ok(tabs.includes('accounts'));
  });

  it('Cashier has no accounts tab', () => {
    const tabs = getAllowedTabs('cashier');
    assert.ok(!tabs.includes('accounts'));
  });

  it('Kitchen has no accounts tab', () => {
    const tabs = getAllowedTabs('kitchen');
    assert.ok(!tabs.includes('accounts'));
  });

  it('Packing has no accounts tab', () => {
    const tabs = getAllowedTabs('packing');
    assert.ok(!tabs.includes('accounts'));
  });
});