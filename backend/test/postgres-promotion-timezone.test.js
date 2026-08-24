import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPromotionsRepository } from '../repositories/postgres/promotions.js';
import { createEngagementRepository } from '../repositories/postgres/engagement.js';

describe('PostgreSQL Promotions Vietnam Timezone Suite', () => {
  it('evaluates voucher date boundary in Vietnam business time (Asia/Ho_Chi_Minh)', async () => {
    let capturedParams = null;
    let capturedSql = null;
    const mockDb = {
      async query(sql, params) {
        capturedSql = sql;
        capturedParams = params;
        return [[{
          id: 1,
          code: 'SALE20',
          discount_type: 'percent',
          discount_value: 20,
          max_discount: 50000,
          min_order: 100000,
          voucher_type: 'shared',
          is_active: true,
          deleted_at: null,
          start_date: '2026-08-25',
          end_date: '2026-08-25',
          used_count: 0,
          usage_limit: 100,
        }], 1];
      },
    };

    // 16:59:59 UTC on 24/08/2026 is 23:59:59 on 24/08/2026 in Vietnam
    const clockBeforeMidnight = () => new Date('2026-08-24T16:59:59.000Z');
    const repoBefore = createPromotionsRepository(mockDb, { clock: clockBeforeMidnight });
    await repoBefore.preview({ code: 'SALE20', subtotal: 150000, phone: '0901234567', storeId: 1 });
    assert.equal(capturedParams[2], '2026-08-24');

    // 17:00:00 UTC on 24/08/2026 is 00:00:00 on 25/08/2026 in Vietnam
    const clockAfterMidnight = () => new Date('2026-08-24T17:00:00.000Z');
    const repoAfter = createPromotionsRepository(mockDb, { clock: clockAfterMidnight });
    await repoAfter.preview({ code: 'SALE20', subtotal: 150000, phone: '0901234567', storeId: 1 });
    assert.equal(capturedParams[2], '2026-08-25');
    assert.equal(capturedSql.includes('CURRENT_DATE'), false);
    assert.match(capturedSql, /p\.start_date <= \$3/);
  });

  it('validates voucher on create order with identical Vietnam business date', async () => {
    let capturedParams = null;
    const mockTx = {
      async query(sql, params) {
        capturedParams = params;
        return [[{
          id: 1,
          code: 'SALE20',
          discount_type: 'fixed',
          discount_value: 20000,
          min_order: 50000,
          voucher_type: 'shared',
          is_active: true,
          deleted_at: null,
          start_date: '2026-08-25',
          end_date: null,
          used_count: 0,
          usage_limit: null,
        }], 1];
      },
    };

    const clock = () => new Date('2026-08-24T17:05:00.000Z'); // 00:05 on 25/08 in VN
    const repo = createPromotionsRepository(null, { clock });
    const result = await repo.validateForOrder({
      code: 'SALE20',
      subtotal: 100000,
      phone: '0901234567',
      storeId: 1,
      tx: mockTx,
    });

    assert.equal(capturedParams[2], '2026-08-25');
    assert.equal(result.discount_amount, 20000);
  });

  it('filters the customer voucher wallet with the same Vietnam business date', async () => {
    let captured = null;
    const repository = createEngagementRepository({
      async query(sql, params) {
        captured = { sql, params };
        return [[], 0];
      },
    }, {
      clock: () => new Date('2026-08-24T17:00:00.000Z'),
    });

    await repository.listUserVouchers(42);

    assert.deepEqual(captured.params, [42, '2026-08-25']);
    assert.equal(captured.sql.includes('CURRENT_DATE'), false);
    assert.match(captured.sql, /uv\.expires_at >= \$2/);
  });
});
