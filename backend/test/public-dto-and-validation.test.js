import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
});
