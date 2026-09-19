import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createAdminStoresRepository, AdminStoreError } from '../repositories/postgres/admin-stores.js';

describe('Admin Stores Hours Conflict Unit Suite', () => {
  it('blocks updating store hours if active preorders fall into the cut-off window', async () => {
    // A confirmed preorder booked for 20:00 - 21:00 (Vietnam time = 13:00 - 14:00 UTC) on 2026-09-25
    const mockDb = {
      async query(sql, params) {
        if (sql.includes('FROM preorders')) {
          return [[{
            id: 101,
            preorder_code: 'PO-260925-001',
            scheduled_start_at: new Date('2026-09-25T13:00:00.000Z'), // 20:00 VN
            scheduled_end_at: new Date('2026-09-25T14:00:00.000Z'),   // 21:00 VN
          }]];
        }
        if (sql.includes('UPDATE stores')) {
          return [[{ id: params[params.length - 1], hours: params[0] }]];
        }
        return [[], 1];
      },
    };

    const repo = createAdminStoresRepository(mockDb);

    // Attempt to change hours from 08:00 - 22:00 to 08:00 - 20:00
    // Under 20:00 close, preorder must end by 19:00, but customer booked until 21:00
    await assert.rejects(
      () => repo.updateBranch(1, { hours: '08:00 – 20:00' }),
      (err) => {
        assert.equal(err instanceof AdminStoreError, true);
        assert.equal(err.status, 409);
        assert.match(err.message, /PO-260925-001/);
        assert.match(err.message, /khoảng thời gian bị cắt/);
        return true;
      },
    );
  });

  it('allows updating store hours if active preorders are within the new window', async () => {
    // A confirmed preorder booked for 10:00 - 11:00 (Vietnam time)
    const mockDb = {
      async query(sql, params) {
        if (sql.includes('FROM preorders')) {
          return [[{
            id: 102,
            preorder_code: 'PO-260925-002',
            scheduled_start_at: new Date('2026-09-25T03:00:00.000Z'), // 10:00 VN
            scheduled_end_at: new Date('2026-09-25T04:00:00.000Z'),   // 11:00 VN
          }]];
        }
        if (sql.includes('UPDATE stores')) {
          return [[{ id: params[params.length - 1], hours: params[0] }]];
        }
        return [[], 1];
      },
    };

    const repo = createAdminStoresRepository(mockDb);
    const updated = await repo.updateBranch(1, { hours: '08:00 – 20:00' });
    assert.equal(updated.hours, '08:00 – 20:00');
  });

  it('allows updating other branch fields without checking preorders when hours is omitted', async () => {
    let checkedPreorders = false;
    const mockDb = {
      async query(sql, params) {
        if (sql.includes('FROM preorders')) {
          checkedPreorders = true;
          return [[]];
        }
        if (sql.includes('UPDATE stores')) {
          return [[{ id: params[params.length - 1], phone: params[0] }]];
        }
        return [[], 1];
      },
    };

    const repo = createAdminStoresRepository(mockDb);
    const updated = await repo.updateBranch(1, { phone: '0901234567' });
    assert.equal(updated.phone, '0901234567');
    assert.equal(checkedPreorders, false);
  });

  it('rejects store hours when close <= open or duration is less than 4 hours', async () => {
    const { validateBranchInput, StoreValidationError } = await import('../validation/store-schemas.js');

    // Case 1: close <= open (e.g. 08:00 - 08:00)
    assert.throws(
      () => validateBranchInput({ hours: '08:00 – 08:00' }, { isUpdate: true }),
      (err) => {
        assert.equal(err instanceof StoreValidationError, true);
        assert.match(err.message, /Giờ đóng cửa phải lớn hơn giờ mở cửa/);
        return true;
      },
    );

    // Case 2: duration < 4 hours (e.g. 08:00 - 11:00 = 3 hours)
    assert.throws(
      () => validateBranchInput({ hours: '08:00 – 11:00' }, { isUpdate: true }),
      (err) => {
        assert.equal(err instanceof StoreValidationError, true);
        assert.match(err.message, /ít nhất 4 tiếng/);
        return true;
      },
    );

    // Case 3: exactly 4 hours (e.g. 08:00 - 12:00) -> valid
    const valid4h = validateBranchInput({ hours: '08:00 – 12:00' }, { isUpdate: true });
    assert.equal(valid4h.hours, '08:00 – 12:00');
  });
});
