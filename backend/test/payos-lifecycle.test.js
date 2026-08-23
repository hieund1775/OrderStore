import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentsRepository } from '../repositories/postgres/payments.js';

describe('PayOS QR Lifecycle & Regenerate Contract', () => {
  it('throws 404 if order does not exist', async () => {
    const mockDb = {
      transaction: async (fn) => fn({
        query: async () => [[]],
      }),
    };
    const repo = createPaymentsRepository(mockDb);

    await assert.rejects(
      () => repo.renewPayOSOrderLink({ orderCode: 'TP9999999999', userId: 1 }),
      (err) => {
        assert.equal(err.status, 404);
        assert.match(err.message, /Không tìm thấy/);
        return true;
      },
    );
  });

  it('throws 403 if ownership is not established via userId or cancelToken', async () => {
    const mockDb = {
      transaction: async (fn) => fn({
        query: async () => [[{
          id: 10,
          order_code: 'TP2608230001',
          user_id: 99,
          customer_phone: '0901234567',
          cancel_token_hash: 'secret_token_hash',
          total: 50000,
          payment_status: 'unpaid',
          payment_provider: 'payos',
          current_status: 'Đang chuẩn bị',
        }]],
      }),
    };
    const repo = createPaymentsRepository(mockDb);

    // Wrong user ID and no cancel token
    await assert.rejects(
      () => repo.renewPayOSOrderLink({ orderCode: 'TP2608230001', userId: 1 }),
      (err) => {
        assert.equal(err.status, 403);
        assert.match(err.message, /quyền/);
        return true;
      },
    );

    // Wrong cancel token
    await assert.rejects(
      () => repo.renewPayOSOrderLink({ orderCode: 'TP2608230001', cancelToken: 'wrong_token' }),
      (err) => {
        assert.equal(err.status, 403);
        assert.match(err.message, /quyền/);
        return true;
      },
    );
  });

  it('throws 400 if order is already cancelled or already paid', async () => {
    const mockDbCancelled = {
      transaction: async (fn) => fn({
        query: async () => [[{
          id: 10,
          order_code: 'TP2608230001',
          user_id: 1,
          cancel_token_hash: 'tok123',
          total: 50000,
          payment_status: 'unpaid',
          payment_provider: 'payos',
          current_status: 'Đã hủy',
        }]],
      }),
    };
    const repoCancelled = createPaymentsRepository(mockDbCancelled);

    await assert.rejects(
      () => repoCancelled.renewPayOSOrderLink({ orderCode: 'TP2608230001', userId: 1 }),
      (err) => {
        assert.equal(err.status, 400);
        assert.match(err.message, /hủy/);
        return true;
      },
    );

    const mockDbPaid = {
      transaction: async (fn) => fn({
        query: async () => [[{
          id: 10,
          order_code: 'TP2608230001',
          user_id: 1,
          cancel_token_hash: 'tok123',
          total: 50000,
          payment_status: 'paid',
          payment_provider: 'payos',
          current_status: 'Đang chuẩn bị',
        }]],
      }),
    };
    const repoPaid = createPaymentsRepository(mockDbPaid);

    await assert.rejects(
      () => repoPaid.renewPayOSOrderLink({ orderCode: 'TP2608230001', userId: 1 }),
      (err) => {
        assert.equal(err.status, 400);
        assert.match(err.message, /thanh toán/);
        return true;
      },
    );
  });

  it('successfully renews PayOS link with matching owner and updates PostgreSQL atomically', async () => {
    let updatedPayload = null;
    const mockDb = {
      transaction: async (fn) => fn({
        query: async (sql, params) => {
          if (sql.includes('SELECT')) {
            return [[{
              id: 10,
              order_code: 'TP2608230001',
              user_id: 1,
              customer_phone: '0901234567',
              cancel_token_hash: 'tok123',
              total: 65000,
              payment_status: 'unpaid',
              payment_provider: 'payos',
              current_status: 'Đang chuẩn bị',
              payos_order_code: 1111111111,
              payment_link_id: 'old_link_1',
            }]];
          }
          if (sql.includes('UPDATE')) {
            updatedPayload = params;
            return [[{
              id: 10,
              order_code: 'TP2608230001',
              total: 65000,
              payment_status: 'unpaid',
              payment_provider: 'payos',
              payment_link_id: params[2],
              payos_order_code: params[1],
              payment_checkout_url: params[3],
              payment_qr_code: params[4],
              payment_expires_at: params[5],
            }]];
          }
          return [[]];
        },
      }),
    };

    const mockCreatePaymentLink = async ({ orderId, total, payosOrderCode }) => {
      assert.equal(orderId, 10);
      assert.equal(total, 65000);
      return {
        checkoutUrl: 'https://pay.payos.vn/web/test12345',
        qrCode: '00020101021238540010A00000072701240006970454011012345678905204599953037045405650005802VN',
        paymentLinkId: 'new_link_999',
        payosOrderCode,
        paymentExpiresAt: new Date(Date.now() + 15 * 60000),
      };
    };

    const repo = createPaymentsRepository(mockDb);
    const result = await repo.renewPayOSOrderLink({
      orderCode: 'TP2608230001',
      userId: 1,
      createLinkFn: mockCreatePaymentLink,
    });

    assert.equal(result.order_code, 'TP2608230001');
    assert.equal(result.payment_link_id, 'new_link_999');
    assert.equal(result.payment_status, 'unpaid');
    assert.ok(result.payment_checkout_url.includes('payos.vn'));
    assert.ok(result.payment_qr_code.startsWith('00020101'));
  });

  it('rejects old QR webhook when order has been regenerated with new payosOrderCode', async () => {
    const mockDb = {
      transaction: async (fn) => fn({
        query: async (sql, params) => {
          if (sql.includes('INSERT INTO payment_events')) {
            return [[{ id: 101 }]];
          }
          if (sql.includes('SELECT id, order_code, total, payment_status, payment_provider')) {
            // Webhook uses OLD code 1111111111, but DB currently only matches active code 2222222222 -> returns nothing
            if (params[0] === 1111111111) {
              return [[]];
            }
            return [[{ id: 10, order_code: 'TP2608230001', total: 50000, payment_status: 'unpaid', payment_provider: 'payos' }]];
          }
          if (sql.includes('UPDATE payment_events')) {
            return [[]];
          }
          return [[]];
        },
      }),
    };

    const repo = createPaymentsRepository(mockDb);
    const result = await repo.processSuccessfulWebhook({
      eventKey: 'old_webhook_evt_1',
      orderCode: 1111111111, // Old code
      amount: 50000,
      paymentLinkId: 'old_link_1',
    });

    assert.equal(result.kind, 'not_found');
  });

  it('reuses an active regenerated link on retry instead of creating another link', async () => {
    let createCalls = 0;
    const mockDb = {
      transaction: async (fn) => fn({
        query: async (sql) => {
          if (sql.includes('SELECT')) {
            return [[{
              id: 10,
              order_code: 'TP2608230001',
              user_id: 1,
              total: 50000,
              payment_status: 'unpaid',
              payment_provider: 'payos',
              current_status: 'Đang chuẩn bị',
              payment_link_id: 'active-link',
              payos_order_code: 2222222222,
              payment_checkout_url: 'https://pay.payos.vn/active',
              payment_qr_code: 'active-qr',
              payment_expires_at: new Date(Date.now() + 60_000),
            }]];
          }
          throw new Error('UPDATE should not run for an active retry');
        },
      }),
    };
    const repo = createPaymentsRepository(mockDb);
    const result = await repo.renewPayOSOrderLink({
      orderCode: 'TP2608230001',
      userId: 1,
      createLinkFn: async () => { createCalls += 1; return {}; },
    });
    assert.equal(createCalls, 0);
    assert.equal(result.payment_link_id, 'active-link');
  });

  it('rejects simulator requests for non-PayOS orders', async () => {
    const mockDb = {
      transaction: async (fn) => fn({
        query: async () => [[{
          id: 10,
          order_code: 'TPCOD0001',
          payment_status: 'unpaid',
          payment_provider: 'cod',
          current_status: 'Đang chuẩn bị',
        }]],
      }),
    };
    const repo = createPaymentsRepository(mockDb);
    await assert.rejects(
      () => repo.simulatePaymentSuccess({ orderCode: 'TPCOD0001' }),
      (err) => {
        assert.equal(err.status, 400);
        assert.match(err.message, /không sử dụng PayOS/);
        return true;
      },
    );
  });
});
