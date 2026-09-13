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

describe('classifyPayOSPaymentStatus Suite', () => {
  it('classifies PAID accurately regardless of case and whitespace', async () => {
    const { classifyPayOSPaymentStatus } = await import('../services/payos.js');
    assert.equal(classifyPayOSPaymentStatus('PAID'), 'paid');
    assert.equal(classifyPayOSPaymentStatus('paid'), 'paid');
    assert.equal(classifyPayOSPaymentStatus('  PAID  '), 'paid');
    assert.equal(classifyPayOSPaymentStatus({ status: 'PAID' }), 'paid');
    assert.equal(classifyPayOSPaymentStatus({ status: '  paid  ' }), 'paid');
  });

  it('classifies CANCELLED, CANCELED, and EXPIRED as terminal_unpaid', async () => {
    const { classifyPayOSPaymentStatus } = await import('../services/payos.js');
    assert.equal(classifyPayOSPaymentStatus('CANCELLED'), 'terminal_unpaid');
    assert.equal(classifyPayOSPaymentStatus('cancelled'), 'terminal_unpaid');
    assert.equal(classifyPayOSPaymentStatus('  CANCELLED  '), 'terminal_unpaid');
    assert.equal(classifyPayOSPaymentStatus({ status: 'CANCELLED' }), 'terminal_unpaid');

    assert.equal(classifyPayOSPaymentStatus('CANCELED'), 'terminal_unpaid');
    assert.equal(classifyPayOSPaymentStatus('canceled'), 'terminal_unpaid');
    assert.equal(classifyPayOSPaymentStatus('  CANCELED  '), 'terminal_unpaid');
    assert.equal(classifyPayOSPaymentStatus({ status: 'CANCELED' }), 'terminal_unpaid');

    assert.equal(classifyPayOSPaymentStatus('EXPIRED'), 'terminal_unpaid');
    assert.equal(classifyPayOSPaymentStatus('expired'), 'terminal_unpaid');
    assert.equal(classifyPayOSPaymentStatus('  EXPIRED  '), 'terminal_unpaid');
    assert.equal(classifyPayOSPaymentStatus({ status: 'EXPIRED' }), 'terminal_unpaid');
  });

  it('classifies pending, processing, or unknown provider statuses as pending_or_unknown', async () => {
    const { classifyPayOSPaymentStatus } = await import('../services/payos.js');
    assert.equal(classifyPayOSPaymentStatus('PENDING'), 'pending_or_unknown');
    assert.equal(classifyPayOSPaymentStatus('PROCESSING'), 'pending_or_unknown');
    assert.equal(classifyPayOSPaymentStatus('UNDERPAID'), 'pending_or_unknown');
    assert.equal(classifyPayOSPaymentStatus('FAILED'), 'pending_or_unknown');
    assert.equal(classifyPayOSPaymentStatus('SOMETHING_ELSE'), 'pending_or_unknown');
    assert.equal(classifyPayOSPaymentStatus({ status: 'PENDING' }), 'pending_or_unknown');
  });

  it('fails closed and returns pending_or_unknown on empty, missing, or malformed inputs', async () => {
    const { classifyPayOSPaymentStatus } = await import('../services/payos.js');
    assert.equal(classifyPayOSPaymentStatus(null), 'pending_or_unknown');
    assert.equal(classifyPayOSPaymentStatus(undefined), 'pending_or_unknown');
    assert.equal(classifyPayOSPaymentStatus(''), 'pending_or_unknown');
    assert.equal(classifyPayOSPaymentStatus('   '), 'pending_or_unknown');
    assert.equal(classifyPayOSPaymentStatus({}), 'pending_or_unknown');
    assert.equal(classifyPayOSPaymentStatus({ status: null }), 'pending_or_unknown');
    assert.equal(classifyPayOSPaymentStatus(123), 'pending_or_unknown');
    assert.equal(classifyPayOSPaymentStatus(new Error('timeout')), 'pending_or_unknown');
  });
});
