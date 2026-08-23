import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveStoreScope, ScopeError } from '../middleware/branch-scope.js';

describe('KDS Branch Scope & Kitchen Route Filtering', () => {
  it('resolves null storeId for super admin when no store_id query is provided', () => {
    const user = { id: 1, role: 'super', branch_id: null };
    const storeId = resolveStoreScope(user, undefined);
    assert.equal(storeId, null, 'Super admin should see all branches when no filter is given');
  });

  it('resolves specific storeId for super admin when valid store_id query is provided', () => {
    const user = { id: 1, role: 'super', branch_id: null };
    const storeId = resolveStoreScope(user, '2');
    assert.equal(storeId, 2, 'Super admin should be scoped to branch 2');
  });

  it('rejects invalid store_id with 400 for super admin', () => {
    const user = { id: 1, role: 'super', branch_id: null };
    assert.throws(
      () => resolveStoreScope(user, 'invalid_store'),
      (err) => err instanceof ScopeError && err.status === 400,
    );
  });

  it('enforces assigned branch_id for kitchen role even without query param', () => {
    const user = { id: 4, role: 'kitchen', branch_id: 1 };
    const storeId = resolveStoreScope(user, undefined);
    assert.equal(storeId, 1, 'Kitchen user should be strictly scoped to their assigned branch');
  });

  it('allows kitchen role when query param matches assigned branch_id', () => {
    const user = { id: 4, role: 'kitchen', branch_id: 1 };
    const storeId = resolveStoreScope(user, '1');
    assert.equal(storeId, 1);
  });

  it('rejects kitchen role with 403 when requesting a different branch_id', () => {
    const user = { id: 4, role: 'kitchen', branch_id: 1 };
    assert.throws(
      () => resolveStoreScope(user, '2'),
      (err) => err instanceof ScopeError && err.status === 403,
    );
  });
});
