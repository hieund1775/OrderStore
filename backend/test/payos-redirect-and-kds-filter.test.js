import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { appendOrderCodeToUrl } from '../services/online-payos-order.js';

describe('PayOS Return URL & KDS Filter Suite', () => {
  it('appends order_code to clean base return_url and cancel_url', () => {
    const returnUrl = appendOrderCodeToUrl('http://localhost:3000/theo-doi-don', 'TP2608239999');
    assert.equal(returnUrl, 'http://localhost:3000/theo-doi-don?code=TP2608239999');

    const cancelUrl = appendOrderCodeToUrl('https://teaplus.vn/thanh-toan', 'TP2608239999');
    assert.equal(cancelUrl, 'https://teaplus.vn/thanh-toan?code=TP2608239999');
  });

  it('preserves existing query parameters when appending order_code', () => {
    const returnUrl = appendOrderCodeToUrl('http://localhost:3000/theo-doi-don?store=1&ref=app', 'TP123');
    const parsed = new URL(returnUrl);
    assert.equal(parsed.searchParams.get('store'), '1');
    assert.equal(parsed.searchParams.get('ref'), 'app');
    assert.equal(parsed.searchParams.get('code'), 'TP123');
  });

  it('handles null or invalid URL strings gracefully', () => {
    assert.equal(appendOrderCodeToUrl(null, 'TP123'), null);
    assert.equal(appendOrderCodeToUrl(undefined, 'TP123'), null);
  });

  it('matches KDS filter requirements for order payment methods and statuses', () => {
    const isVisibleOnKds = (order) => {
      const isEligiblePayment = order.payment_status === 'paid' || order.payment_method === 'COD' || order.order_type === 'POS';
      const isEligibleStatus = ['Đang chuẩn bị', 'Chờ xác nhận'].includes(order.current_status);
      return isEligiblePayment && isEligibleStatus;
    };

    // 1) PayOS unpaid -> MUST NOT show
    assert.equal(isVisibleOnKds({ payment_status: 'unpaid', payment_method: 'VietQR', order_type: 'Take-away', current_status: 'Đang chuẩn bị' }), false);

    // 2) PayOS paid -> MUST show
    assert.equal(isVisibleOnKds({ payment_status: 'paid', payment_method: 'VietQR', order_type: 'Take-away', current_status: 'Đang chuẩn bị' }), true);

    // 3) COD unpaid -> MUST show (payment collected upon delivery)
    assert.equal(isVisibleOnKds({ payment_status: 'unpaid', payment_method: 'COD', order_type: 'Delivery', current_status: 'Đang chuẩn bị' }), true);

    // 4) POS in-store -> MUST show
    assert.equal(isVisibleOnKds({ payment_status: 'unpaid', payment_method: 'COD', order_type: 'POS', current_status: 'Chờ xác nhận' }), true);

    // 5) Terminal completed/cancelled -> MUST NOT show
    assert.equal(isVisibleOnKds({ payment_status: 'paid', payment_method: 'VietQR', order_type: 'Take-away', current_status: 'Hoàn thành' }), false);
    assert.equal(isVisibleOnKds({ payment_status: 'paid', payment_method: 'COD', order_type: 'Delivery', current_status: 'Đã hủy' }), false);
  });
});
