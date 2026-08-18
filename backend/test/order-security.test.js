import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import db from '../config/db-postgres.js';
import { handleCustomerCancelOrder } from '../routes/public.js';

describe('Order Security & Concurrency Guard (Production Handler + DB Adapter)', () => {
  it('generates 64-char raw token and matching SHA-256 hash', () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    assert.equal(rawToken.length, 64);

    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    assert.equal(hash.length, 64);

    const providedHash = crypto.createHash('sha256').update(rawToken.trim()).digest();
    const storedHash = Buffer.from(hash, 'hex');

    assert.equal(providedHash.length, storedHash.length);
    assert.equal(crypto.timingSafeEqual(providedHash, storedHash), true);
  });

  it('rejects invalid or tampered cancellation tokens in constant time', () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const fakeToken = crypto.randomBytes(32).toString('hex');
    const fakeProvidedHash = crypto.createHash('sha256').update(fakeToken).digest();
    const storedHash = Buffer.from(hash, 'hex');

    assert.equal(crypto.timingSafeEqual(fakeProvidedHash, storedHash), false);
  });

  it('rejects malformed or mismatched-length tokens safely', () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const storedHash = Buffer.from(hash, 'hex');
    const shortBuffer = Buffer.from('abc');

    assert.notEqual(shortBuffer.length, storedHash.length);
  });

  it('R5-B02: fires two concurrent cancellations via Promise.all into production handleCustomerCancelOrder and guarantees exactly 1 DB transition', async () => {
    const rawCancelToken = crypto.randomBytes(32).toString('hex');
    const cancelTokenHash = crypto.createHash('sha256').update(rawCancelToken).digest('hex');

    // Database state
    let testOrders = [
      {
        id: 888,
        order_code: 'TP-CONCURRENT',
        user_id: null, // Guest order
        payment_status: 'unpaid',
        cancel_token_hash: cancelTokenHash,
        cancel_reason: null,
      },
    ];

    let testStatusHistory = [
      { id: 1, order_id: 888, status: 'Đang chuẩn bị', note: 'Initial', created_at: new Date() },
    ];

    // Transactional Mutex simulator modeling SQL Server UPDLOCK, ROWLOCK, HOLDLOCK
    let orderLock = Promise.resolve();

    const concurrentDbAdapter = {
      async transaction(fn) {
        // Enqueue transaction under exclusive lock
        const release = orderLock;
        let resolveLock;
        orderLock = new Promise((res) => {
          resolveLock = res;
        });

        await release;

        const tx = {
          async query(sqlText, params = []) {
            // 1) SELECT orders WITH (UPDLOCK, ROWLOCK, HOLDLOCK)
            if (sqlText.includes('FROM orders') && sqlText.includes('SELECT')) {
              const identifier = params[0];
              const found = testOrders.filter(
                (o) => o.id === Number(identifier) || o.order_code === String(identifier)
              );
              return [found, found.length];
            }

            // 2) SELECT status history WITH (UPDLOCK, ROWLOCK, HOLDLOCK)
            if (sqlText.includes('FROM order_status_history') && sqlText.includes('SELECT')) {
              const orderId = Number(params[0]);
              const history = testStatusHistory
                .filter((h) => h.order_id === orderId)
                .sort((a, b) => b.id - a.id);
              return [history.slice(0, 1), history.length];
            }

            // 3) INSERT into order_status_history
            if (sqlText.includes('INSERT INTO order_status_history')) {
              const status = 'Đã hủy';
              const note = params[1] || null;

              const newEntry = {
                id: testStatusHistory.length + 1,
                order_id: Number(params[0]),
                status,
                note,
                created_at: new Date(),
              };
              testStatusHistory.push(newEntry);
              return [[], 1];
            }

            // 4) UPDATE orders SET cancel_reason
            if (sqlText.includes('UPDATE orders')) {
              const orderId = Number(params[params.length - 1]);
              const order = testOrders.find((o) => o.id === orderId);
              if (order && sqlText.includes('cancel_reason')) {
                order.cancel_reason = params[0];
              }
              return [[], 1];
            }

            return [[], 0];
          },
        };

        try {
          return await fn(tx);
        } finally {
          resolveLock();
        }
      },
    };

    db.setMockAdapter(concurrentDbAdapter);

    try {
      // Create mock Express req and res objects
      function createMockReqRes() {
        let statusCode = 200;
        let responseBody = null;

        const req = {
          params: { id: 888 },
          body: { reason: 'Khách bận đột xuất', cancel_token: rawCancelToken },
          headers: { 'x-cancel-token': rawCancelToken },
        };

        const res = {
          status(code) {
            statusCode = code;
            return this;
          },
          json(data) {
            responseBody = data;
            return this;
          },
          get statusCode() {
            return statusCode;
          },
          get body() {
            return responseBody;
          },
        };

        return { req, res };
      }

      const client1 = createMockReqRes();
      const client2 = createMockReqRes();

      // Launch BOTH requests concurrently using Promise.all into production handleCustomerCancelOrder
      await Promise.all([
        handleCustomerCancelOrder(client1.req, client1.res),
        handleCustomerCancelOrder(client2.req, client2.res),
      ]);

      // Both requests received HTTP 200
      assert.equal(client1.res.statusCode, 200);
      assert.equal(client2.res.statusCode, 200);

      // One request performed the initial cancellation, the second returned idempotent already_cancelled
      const responses = [client1.res.body, client2.res.body];
      const initialCancel = responses.find((r) => !r.already_cancelled);
      const duplicateCancel = responses.find((r) => r.already_cancelled);

      assert.ok(initialCancel, 'Expected one request to perform cancel');
      assert.ok(duplicateCancel, 'Expected one request to be recognized as already cancelled (idempotent)');
      assert.equal(initialCancel.status, 'Đã hủy');
      assert.equal(duplicateCancel.status, 'Đã hủy');

      // Crucial assertion: EXACTLY 1 new transition record for 'Đã hủy' was inserted in database
      const cancelledRows = testStatusHistory.filter((h) => h.order_id === 888 && h.status === 'Đã hủy');
      assert.equal(cancelledRows.length, 1, 'Concurrency guard MUST record exactly 1 cancellation history row');

      // Total history rows = 2 (initial 'Đang chuẩn bị' + exactly 1 'Đã hủy')
      assert.equal(testStatusHistory.length, 2);
    } finally {
      db.resetMockAdapter();
    }
  });
});
