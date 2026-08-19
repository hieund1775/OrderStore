import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { vnd, formatDateTime, getOrderStatusLabel, getTierBadge } from '../src/lib/formatters.js';

describe('TeaPlus Mobile App Unit Tests', () => {
  it('formats VND currency accurately', () => {
    assert.match(vnd(35000), /35\.000/);
    assert.match(vnd(0), /0/);
    assert.match(vnd(120000), /120\.000/);
  });

  it('provides correct order status mapping and colors', () => {
    const received = getOrderStatusLabel('received');
    assert.equal(received.label, 'Đã nhận đơn');
    assert.equal(received.color, '#ea580c');

    const preparing = getOrderStatusLabel('preparing');
    assert.equal(preparing.label, 'Đang pha chế');

    const completed = getOrderStatusLabel('completed');
    assert.equal(completed.label, 'Hoàn thành');

    const cancelled = getOrderStatusLabel('cancelled');
    assert.equal(cancelled.label, 'Đã hủy');
  });

  it('provides correct tier badge info', () => {
    assert.equal(getTierBadge('diamond').label, 'Kim Cương');
    assert.equal(getTierBadge('gold').label, 'Vàng');
    assert.equal(getTierBadge('member').label, 'Thành viên');
  });
});
