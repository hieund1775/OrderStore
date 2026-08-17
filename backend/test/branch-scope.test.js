import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveStoreScope, ScopeError } from '../middleware/branch-scope.js';

test('resolveStoreScope - super role', () => {
  const superUser = { role: 'super', sub: 1 };

  // super without requested store -> returns null (all branches)
  assert.equal(resolveStoreScope(superUser, null), null);
  assert.equal(resolveStoreScope(superUser, undefined), null);
  assert.equal(resolveStoreScope(superUser, ''), null);

  // super with requested store -> returns parsed number
  assert.equal(resolveStoreScope(superUser, '2'), 2);
  assert.equal(resolveStoreScope(superUser, 3), 3);
});

test('resolveStoreScope - non-super roles (manager/cashier/kitchen)', () => {
  const cashierUser = { role: 'cashier', branch_id: 1, sub: 2 };
  const managerUser = { role: 'manager', branch_id: 2, sub: 3 };

  // no requested store -> returns user's branch_id
  assert.equal(resolveStoreScope(cashierUser, null), 1);
  assert.equal(resolveStoreScope(cashierUser, undefined), 1);
  assert.equal(resolveStoreScope(managerUser, ''), 2);

  // matches user's branch_id -> returns user's branch_id
  assert.equal(resolveStoreScope(cashierUser, '1'), 1);
  assert.equal(resolveStoreScope(managerUser, 2), 2);

  // different store_id requested -> throws ScopeError (403)
  assert.throws(() => resolveStoreScope(cashierUser, '2'), {
    name: 'ScopeError',
    status: 403,
  });

  assert.throws(() => resolveStoreScope(managerUser, 1), {
    name: 'ScopeError',
    status: 403,
  });
});

test('resolveStoreScope - non-super without branch_id throws 403', () => {
  const invalidCashier = { role: 'cashier', branch_id: null, sub: 4 };
  assert.throws(() => resolveStoreScope(invalidCashier, null), {
    name: 'ScopeError',
    status: 403,
  });
});
