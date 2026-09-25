import { describe, expect, it } from 'vitest';
import { getRoleLandingRoute } from '@/lib/api';
import { getPromotionStatus } from '@/lib/promotion-status';

describe('Admin Operational Fixes Suite', () => {
  describe('Role-based landing routes', () => {
    it('redirects cashier to POS', () => {
      expect(getRoleLandingRoute('cashier')).toBe('/admin/pos');
    });

    it('redirects kitchen to KDS bep', () => {
      expect(getRoleLandingRoute('kitchen')).toBe('/admin/bep');
    });

    it('redirects packing to packing station', () => {
      expect(getRoleLandingRoute('packing')).toBe('/admin/dong-goi');
    });

    it('redirects manager and super to general orders page', () => {
      expect(getRoleLandingRoute('manager')).toBe('/admin/don-hang');
      expect(getRoleLandingRoute('super')).toBe('/admin/don-hang');
      expect(getRoleLandingRoute(null)).toBe('/admin/don-hang');
    });
  });

  describe('Expired promotion status and switch lock', () => {
    it('marks promotion as expired when past end date', () => {
      const pastDate = '2020-01-01';
      const status = getPromotionStatus({
        is_active: true,
        start_date: '2019-01-01',
        end_date: pastDate,
        voucher_type: 'shared',
      });
      expect(status.variant).toBe('expired');
      expect(status.label).toBe('Hết hạn');
    });

    it('marks promotion as exhausted when usage limit reached', () => {
      const status = getPromotionStatus({
        is_active: true,
        voucher_type: 'shared',
        usage_limit: 10,
        used_count: 10,
      });
      expect(status.variant).toBe('exhausted');
      expect(status.label).toBe('Hết lượt');
    });
  });
});
