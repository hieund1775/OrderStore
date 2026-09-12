import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCustomerOrderService } from '../services/orders/customer-order-service.js';
import { createTableQrToken, hashTableQrToken } from '../services/table-qr-token.js';
import { validateCreateOrderInput } from '../validation/order-schemas.js';
import { createPromotionsRepository } from '../repositories/postgres/promotions.js';

const tableToken = createTableQrToken();
const tableTokenHash = hashTableQrToken(tableToken);

function createTableQrService({ resolveTable = async () => ({
  id: 21,
  name: 'Bàn 21',
  store_id: 7,
  store_name: 'TeaPlus Quận 1',
}) } = {}) {
  return createCustomerOrderService({
    storesRepository: { resolveTableByCheckoutToken: resolveTable },
    checkPayOSConfigured: () => true,
    resolvePaymentProfile: async () => ({
      isGrouped: false,
      profile: { code: 'DEFAULT_PROFILE', id: 1 },
      rootCategory: { rootCategoryId: 3, rootCategoryName: 'Trà' },
    }),
    createPayOSOrder: async (payload) => ({
      id: 91,
      order_code: 'TPQR001',
      total: 35000,
      checkout_url: 'https://pay.example/checkout',
      ...payload.input,
    }),
  });
}

function validTableQrInput(overrides = {}) {
  return {
    source: 'table_qr',
    table_token: tableToken,
    order_type: 'Dine-in',
    payment_method: 'VietQR',
    items: [{ product_id: 11, qty: 1 }],
    ...overrides,
  };
}

describe('table QR guest checkout contract', () => {
  it('keeps 0031 additive, read-only-preflighted, and independent from payment-attempt schema changes', async () => {
    const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'database', 'postgres');
    const [migration, preflight] = await Promise.all([
      readFile(path.join(directory, 'migrations', '0031_table_qr_guest_dinein.sql'), 'utf8'),
      readFile(path.join(directory, 'verification', '0031_table_qr_guest_dinein_preflight_readonly.sql'), 'utf8'),
    ]);
    assert.match(migration, /qr_checkout_token_hash CHAR\(64\)/);
    assert.match(migration, /applies_to_table_qr BOOLEAN NOT NULL DEFAULT FALSE/);
    assert.match(migration, /'Dine-in'/);
    assert.doesNotMatch(migration, /\bpayment_attempts\b/i);
    assert.doesNotMatch(migration, /^\s*(?:DROP|TRUNCATE|DELETE|UPDATE)\b/im);
    assert.match(preflight, /^\s*--[\s\S]*WITH checks AS/m);
    assert.doesNotMatch(preflight, /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|BEGIN|COMMIT|ROLLBACK)\b/i);
  });

  it('derives store and table from the opaque token, then uses the normal direct PayOS path', async () => {
    let lookupHash = null;
    let payosPayload = null;
    const service = createCustomerOrderService({
      storesRepository: {
        async resolveTableByCheckoutToken(tokenHash) {
          lookupHash = tokenHash;
          return { id: 21, name: 'Bàn 21', store_id: 7 };
        },
      },
      checkPayOSConfigured: () => true,
      resolvePaymentProfile: async () => ({
        isGrouped: false,
        profile: { code: 'DEFAULT_PROFILE', id: 1 },
        rootCategory: { rootCategoryId: 3, rootCategoryName: 'Trà' },
      }),
      createPayOSOrder: async (payload) => {
        payosPayload = payload;
        return { id: 91, order_code: 'TPQR001', total: 35000, checkout_url: 'https://pay.example/checkout' };
      },
    });

    const result = await service.create({ input: validTableQrInput(), userId: null, idempotencyKey: 'table-qr-direct-1' });

    assert.equal(lookupHash, tableTokenHash);
    assert.equal(payosPayload.userId, null);
    assert.equal(payosPayload.input.source, 'table_qr');
    assert.equal(payosPayload.input.order_type, 'Dine-in');
    assert.equal(payosPayload.input.payment_method, 'VietQR');
    assert.equal(payosPayload.input.store_id, 7);
    assert.equal(payosPayload.input.table_id, 21);
    assert.equal(payosPayload.input.table_qr_token_hash, tableTokenHash);
    assert.equal(payosPayload.input.customer_phone, '0000000000');
    assert.ok(payosPayload.cancelToken);
    assert.equal(result.checkout_url, 'https://pay.example/checkout');
  });

  it('does not trust browser-supplied store, table, customer, delivery, or a non-Dine-in method', () => {
    for (const input of [
      validTableQrInput({ store_id: 7 }),
      validTableQrInput({ table_id: 21 }),
      validTableQrInput({ customer_name: 'Khách tự khai' }),
      validTableQrInput({ delivery_addr: 'Không được phép' }),
      validTableQrInput({ order_type: 'Delivery' }),
      validTableQrInput({ payment_method: 'COD' }),
    ]) {
      assert.throws(() => validateCreateOrderInput(input), /QR|Dine-in|VietQR|tự khai/);
    }
  });

  it('fails closed when the opaque QR token no longer maps to an active table', async () => {
    const service = createTableQrService({ resolveTable: async () => null });
    await assert.rejects(
      () => service.create({ input: validTableQrInput(), idempotencyKey: 'table-qr-missing' }),
      (error) => error?.code === 'TABLE_QR_NOT_FOUND' && error?.status === 404,
    );
  });

  it('allows only explicit table-QR shared promotions and never accepts single-use vouchers', async () => {
    const database = {
      async query(sql) {
        if (sql.includes('FROM promotions')) {
          return [[{
            id: 5,
            code: 'BAN10',
            is_active: true,
            deleted_at: null,
            start_date: '2020-01-01',
            end_date: null,
            applies_to_table_qr: true,
            voucher_type: 'shared',
            usage_limit: null,
            used_count: 0,
            discount_type: 'fixed',
            discount_value: 10000,
            min_order: 0,
            max_discount: null,
          }], 1];
        }
        throw new Error(`Unexpected query: ${sql}`);
      },
    };
    const repository = createPromotionsRepository(database, { clock: () => new Date('2026-09-12T05:00:00.000Z') });
    const allowed = await repository.preview({ code: 'BAN10', subtotal: 50000, phone: '', storeId: 7, checkoutChannel: 'table_qr' });
    assert.equal(allowed.discount_amount, 10000);

    database.query = async (sql) => {
      if (sql.includes('FROM promotions')) return [[{
        id: 6, code: 'ONE', is_active: true, deleted_at: null, start_date: '2020-01-01', end_date: null,
        applies_to_table_qr: true, voucher_type: 'single_use', usage_limit: null, used_count: 0,
        discount_type: 'fixed', discount_value: 10000, min_order: 0, max_discount: null,
      }], 1];
      throw new Error(`Unexpected query: ${sql}`);
    };
    await assert.rejects(
      () => repository.preview({ code: 'ONE', subtotal: 50000, phone: '', storeId: 7, checkoutChannel: 'table_qr' }),
      (error) => error?.status === 400,
    );
  });
});
