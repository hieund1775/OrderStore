import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateOrderTransition,
  VALID_STATUSES,
  VALID_TRANSITIONS,
  ROLE_ALLOWED_TARGET_STATUS,
} from '../services/order-transition-policy.js';

describe('Admin Role & Order State Transition Engine (Production Policy Module)', () => {
  it('exports valid state constants and transitions matching system specifications', () => {
    assert.equal(VALID_STATUSES.length, 6);
    assert.deepEqual(VALID_TRANSITIONS['Hoàn thành'], []);
    assert.deepEqual(VALID_TRANSITIONS['Đã hủy'], []);
  });

  it('allows valid kitchen transitions and rejects invalid kitchen operations', () => {
    // 1) Kitchen accepts order from 'Chờ xác nhận' / 'Đã xác nhận' -> 'Đang chuẩn bị'
    const accept1 = evaluateOrderTransition({
      currentStatus: 'Chờ xác nhận',
      targetStatus: 'Đang chuẩn bị',
      role: 'kitchen',
    });
    assert.equal(accept1.allowed, true);

    const accept2 = evaluateOrderTransition({
      currentStatus: 'Đã xác nhận',
      targetStatus: 'Đang chuẩn bị',
      role: 'kitchen',
    });
    assert.equal(accept2.allowed, true);

    // 2) KDS Contract: Kitchen marks cooking done 'Đang chuẩn bị' -> 'Hoàn thành'
    const complete = evaluateOrderTransition({
      currentStatus: 'Đang chuẩn bị',
      targetStatus: 'Hoàn thành',
      role: 'kitchen',
    });
    assert.equal(complete.allowed, true);

    // 3) Kitchen marks cooking done 'Đang chuẩn bị' -> 'Đang giao'
    const ship = evaluateOrderTransition({
      currentStatus: 'Đang chuẩn bị',
      targetStatus: 'Đang giao',
      role: 'kitchen',
    });
    assert.equal(ship.allowed, true);

    // 4) Kitchen CANNOT cancel order
    const cancel = evaluateOrderTransition({
      currentStatus: 'Đang chuẩn bị',
      targetStatus: 'Đã hủy',
      role: 'kitchen',
    });
    assert.equal(cancel.allowed, false);
    assert.equal(cancel.status, 403);
  });

  it('narrows cashier role permissions and prevents cashier workflow overrides', () => {
    // Cashier CAN confirm orders from 'Chờ xác nhận' -> 'Đã xác nhận'
    const confirm = evaluateOrderTransition({
      currentStatus: 'Chờ xác nhận',
      targetStatus: 'Đã xác nhận',
      role: 'cashier',
    });
    assert.equal(confirm.allowed, true);

    // Cashier CANNOT override kitchen / delivery / completion workflow
    const toPrep = evaluateOrderTransition({
      currentStatus: 'Đã xác nhận',
      targetStatus: 'Đang chuẩn bị',
      role: 'cashier',
    });
    assert.equal(toPrep.allowed, false);
    assert.equal(toPrep.status, 403);

    const toShip = evaluateOrderTransition({
      currentStatus: 'Đang chuẩn bị',
      targetStatus: 'Đang giao',
      role: 'cashier',
    });
    assert.equal(toShip.allowed, false);
    assert.equal(toShip.status, 403);

    const toDone = evaluateOrderTransition({
      currentStatus: 'Đang chuẩn bị',
      targetStatus: 'Hoàn thành',
      role: 'cashier',
    });
    assert.equal(toDone.allowed, false);
    assert.equal(toDone.status, 403);

    // Cashier cannot cancel paid order
    const cancelPaid = evaluateOrderTransition({
      currentStatus: 'Đang chuẩn bị',
      targetStatus: 'Đã hủy',
      role: 'cashier',
      isPaid: true,
    });
    assert.equal(cancelPaid.allowed, false);
    assert.equal(cancelPaid.status, 403);

    // Cashier CAN cancel unpaid order
    const cancelUnpaid = evaluateOrderTransition({
      currentStatus: 'Đang chuẩn bị',
      targetStatus: 'Đã hủy',
      role: 'cashier',
      isPaid: false,
    });
    assert.equal(cancelUnpaid.allowed, true);
  });

  it('allows manager and super roles to manage full workflow and cancel paid orders', () => {
    const managerCancelPaid = evaluateOrderTransition({
      currentStatus: 'Đang chuẩn bị',
      targetStatus: 'Đã hủy',
      role: 'manager',
      isPaid: true,
    });
    assert.equal(managerCancelPaid.allowed, true);

    const superCancelPaid = evaluateOrderTransition({
      currentStatus: 'Đang chuẩn bị',
      targetStatus: 'Đã hủy',
      role: 'super',
      isPaid: true,
    });
    assert.equal(superCancelPaid.allowed, true);
  });

  it('rejects any transition from terminal states (Hoàn thành / Đã hủy)', () => {
    const fromDone = evaluateOrderTransition({
      currentStatus: 'Hoàn thành',
      targetStatus: 'Đang chuẩn bị',
      role: 'super',
    });
    assert.equal(fromDone.allowed, false);
    assert.equal(fromDone.status, 400);

    const fromCancel = evaluateOrderTransition({
      currentStatus: 'Đã hủy',
      targetStatus: 'Đang chuẩn bị',
      role: 'super',
    });
    assert.equal(fromCancel.allowed, false);
    assert.equal(fromCancel.status, 400);
  });

  it('handles idempotent transitions safely', () => {
    const idempotent = evaluateOrderTransition({
      currentStatus: 'Đang chuẩn bị',
      targetStatus: 'Đang chuẩn bị',
      role: 'kitchen',
    });
    assert.equal(idempotent.allowed, true);
    assert.equal(idempotent.idempotent, true);
  });
});
