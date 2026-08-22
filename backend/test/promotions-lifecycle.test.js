import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePromotionInput,
  validatePromotionId,
  validateVoucherApplyInput,
  PromotionValidationError,
} from '../validation/promotion-schemas.js';
import { toPromotionDto } from '../dto/promotion-dto.js';
import { createAdminPromotionService } from '../services/promotions/admin-promotion-service.js';

test('Promotions Lifecycle Suite', async (t) => {
  await t.test('rejects promotion when end_date is before start_date', () => {
    assert.throws(
      () => {
        validatePromotionInput({
          title: 'Giảm giá hè',
          code: 'SUMMER20',
          discount_type: 'percent',
          discount_value: 20,
          start_date: '2026-08-25',
          end_date: '2026-08-20',
        });
      },
      (err) => err instanceof PromotionValidationError && err.code === 'PROMOTION_INVALID_DATES',
    );
  });

  await t.test('accepts valid dates when start_date equals or precedes end_date', () => {
    const validated = validatePromotionInput({
      title: 'Giảm giá hè',
      code: 'summer20',
      discount_type: 'percent',
      discount_value: 20,
      start_date: '2026-08-20',
      end_date: '2026-08-25',
      voucher_type: 'time_bounded',
      usage_limit: 100,
    });
    assert.equal(validated.code, 'SUMMER20');
    assert.equal(validated.start_date, '2026-08-20');
    assert.equal(validated.end_date, '2026-08-25');
    assert.equal(validated.voucher_type, 'time_bounded');
    assert.equal(validated.usage_limit, 100);
  });

  await t.test('rejects invalid voucher_type', () => {
    assert.throws(
      () => {
        validatePromotionInput({
          title: 'Khuyến mãi',
          code: 'PROMO1',
          voucher_type: 'invalid_type',
        });
      },
      (err) => err instanceof PromotionValidationError,
    );
  });

  await t.test('maps promotion DTO with lifecycle and usage fields', () => {
    const dto = toPromotionDto({
      id: 10,
      title: 'Mã Giảm 10K',
      code: 'GIAM10K',
      discount_type: 'fixed',
      discount_value: 10000,
      min_order: 50000,
      max_discount: null,
      voucher_type: 'single_use',
      usage_limit: null,
      used_count: 5,
      status: 'Đang diễn ra',
      start_date: '2026-08-01',
      end_date: '2026-08-30',
      is_active: true,
      store_id: null,
      stores: [{ id: 1, name: 'Chi nhánh 1' }],
    });

    assert.equal(dto.id, 10);
    assert.equal(dto.code, 'GIAM10K');
    assert.equal(dto.voucher_type, 'single_use');
    assert.equal(dto.usage_limit, null);
    assert.equal(dto.used_count, 5);
    assert.equal(dto.status, 'Đang diễn ra');
    assert.equal(dto.stores.length, 1);
  });

  await t.test('admin promotion service calls delete on repository', async () => {
    let deletedId = null;
    const fakeRepo = {
      deletePromotion: async (id) => {
        deletedId = id;
        return true;
      },
    };
    const service = createAdminPromotionService(fakeRepo);
    const result = await service.deletePromotion(99);
    assert.equal(result, true);
    assert.equal(deletedId, 99);
  });
});
