import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  validateOrderCreationInput,
  buildPublicLookupDto,
  VALID_SOURCES,
  VALID_ORDER_TYPES,
  VALID_PAYMENT_METHODS,
} from '../services/public-dto.js';

describe('Public DTO & Input Validation Policy (Production Module)', () => {
  it('validates allowed sources, order types, and payment methods strictly', () => {
    assert.deepEqual(VALID_SOURCES, ['online', 'pos']);
    assert.deepEqual(VALID_ORDER_TYPES, ['Delivery', 'Take-away', 'POS']);
    assert.deepEqual(VALID_PAYMENT_METHODS, ['COD', 'VietQR', 'MoMo', 'ZaloPay']);

    // Rejections
    assert.equal(validateOrderCreationInput({ source: 'poss' }).valid, false);
    assert.equal(validateOrderCreationInput({ order_type: 'DineIn' }).valid, false);
    assert.equal(validateOrderCreationInput({ payment_method: 'Bitcoin' }).valid, false);

    // Acceptances
    assert.equal(
      validateOrderCreationInput({ source: 'pos', order_type: 'Take-away', payment_method: 'VietQR' }).valid,
      true
    );
    assert.equal(
      validateOrderCreationInput({ source: 'online', order_type: 'Delivery', payment_method: 'COD' }).valid,
      true
    );
  });

  it('masks sensitive PII in public lookup for anonymous and admin tokens while revealing for customer owner', () => {
    const order = {
      id: 99,
      order_code: 'TP123456',
      user_id: 10,
      customer_name: 'Nguyễn Văn A',
      customer_phone: '0987654321',
      delivery_addr: '123 Đường Lê Lợi, Q.1',
      total: 80000,
      current_status: 'Đang chuẩn bị',
    };

    // Anonymous viewer
    const anonDto = buildPublicLookupDto(order, null);
    assert.equal(anonDto.customer_phone, '098***4321');
    assert.equal(anonDto.customer_name, 'N***A');
    assert.equal(anonDto.delivery_addr, '*** (Đã ẩn địa chỉ)');

    // Admin token viewer (must NOT bypass masking on public route)
    const adminDto = buildPublicLookupDto(order, { sub: 1, role: 'manager', branch_id: 2 });
    assert.equal(adminDto.customer_phone, '098***4321');
    assert.equal(adminDto.customer_name, 'N***A');
    assert.equal(adminDto.delivery_addr, '*** (Đã ẩn địa chỉ)');

    // Logged-in customer owner
    const ownerDto = buildPublicLookupDto(order, { sub: 10, role: 'customer' });
    assert.equal(ownerDto.customer_phone, '0987654321');
    assert.equal(ownerDto.customer_name, 'Nguyễn Văn A');
    assert.equal(ownerDto.delivery_addr, '123 Đường Lê Lợi, Q.1');
  });

  it('exposes payment_checkout_url only to customer owner or guest with valid cancel_token, never exposes QR', () => {
    const rawToken = 'secret-cancel-token-123';
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const payosOrder = {
      id: 100,
      order_code: 'TPPAYOS1',
      user_id: 15,
      customer_name: 'Trần B',
      customer_phone: '0901234567',
      payment_method: 'VietQR',
      payment_provider: 'payos',
      payment_status: 'unpaid',
      payment_checkout_url: 'https://pay.payos.vn/web/123456',
      payment_qr_code: '00020101021238540010A0000007270124000697045401100901234567',
      payment_expires_at: '2026-08-25T12:00:00.000Z',
      cancel_token_hash: hash,
      current_status: 'Chờ xác nhận',
    };

    // Anonymous: gets payment_provider and expiry, but NO checkout_url or qr_code
    const anon = buildPublicLookupDto(payosOrder, null);
    assert.equal(anon.payment_provider, 'payos');
    assert.equal(anon.can_resume_payment, false);
    assert.equal(anon.payment_checkout_url, null);
    assert.equal(anon.payment_qr_code, undefined);

    // Wrong token: NO checkout_url
    const wrongToken = buildPublicLookupDto(payosOrder, null, [], [], 'wrong-token');
    assert.equal(wrongToken.payment_checkout_url, null);

    // Logged in owner: gets payment_checkout_url, but never qr_code in lookup DTO
    const owner = buildPublicLookupDto(payosOrder, { sub: 15, role: 'customer' });
    assert.equal(owner.can_resume_payment, true);
    assert.equal(owner.payment_checkout_url, 'https://pay.payos.vn/web/123456');
    assert.equal(owner.payment_qr_code, undefined);

    // Guest with valid cancel_token: gets payment_checkout_url
    const guestWithToken = buildPublicLookupDto(payosOrder, null, [], [], rawToken);
    assert.equal(guestWithToken.can_resume_payment, true);
    assert.equal(guestWithToken.payment_checkout_url, 'https://pay.payos.vn/web/123456');
    assert.equal(guestWithToken.payment_qr_code, undefined);

    const completed = buildPublicLookupDto({ ...payosOrder, current_status: 'Hoàn thành' }, { sub: 15, role: 'customer' });
    assert.equal(completed.can_resume_payment, false);
    assert.equal(completed.payment_checkout_url, null);
  });
});
