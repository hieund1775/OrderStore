import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), 'src');
const headerContent = fs.readFileSync(path.join(root, 'components/site/Header.tsx'), 'utf8');
const smartCartContent = fs.readFileSync(path.join(root, 'components/cart/SmartCartDrawer.tsx'), 'utf8');
const datTruocContent = fs.readFileSync(path.join(root, 'routes/dat-truoc.tsx'), 'utf8');
const indexContent = fs.readFileSync(path.join(root, 'routes/index.tsx'), 'utf8');
const adminSidebarContent = fs.readFileSync(path.join(root, 'components/admin/AdminSidebar.tsx'), 'utf8');
const adminRouteContent = fs.readFileSync(path.join(root, 'routes/admin.tsx'), 'utf8');
import { parseHoursRange } from '../../routes/dat-truoc';

describe('UI Fixes Verification Suite', () => {
  describe('Header branch switch availability protection', () => {
    it('checks cart availability and warns with item list instead of blindly wiping cart', () => {
      expect(headerContent).toContain('checkCartAvailability');
      expect(headerContent).toContain('AlertDialog');
      expect(headerContent).toContain('Món không khả dụng tại chi nhánh mới');
      expect(headerContent).toContain('removeItems(keysToRemove)');
      expect(headerContent).toContain('transferStore');
    });
  });

  describe('SmartCartDrawer header padding & Chọn tất cả protection', () => {
    it('applies generous right padding to prevent overlap with absolute close button', () => {
      expect(smartCartContent).toContain('pr-14');
      expect(smartCartContent).toContain('whitespace-nowrap');
      expect(smartCartContent).toContain('shrink-0');
      expect(smartCartContent).toContain('Chọn tất cả');
    });
  });

  describe('Preorder page search input persistence & action grouping', () => {
    it('keeps search input and categories mounted while loading products', () => {
      // Input must be rendered within selectedStore && selectedStorePreorderAvailable === true
      // and NOT gated behind !catalogLoading
      expect(datTruocContent).toContain('Tìm món preorder');
      expect(datTruocContent).toContain('Loader2');
      expect(datTruocContent).toContain('Đang tải thực đơn…');

      // The catalogSearch input should be outside of catalogLoading
      const searchIndex = datTruocContent.indexOf('aria-label="Tìm món preorder"');
      const loadingSpinnerIndex = datTruocContent.indexOf('catalogLoading ?');
      expect(searchIndex).toBeGreaterThan(0);
      expect(loadingSpinnerIndex).toBeGreaterThan(searchIndex);
    });

    it('groups Sửa button together with quantity stepper and trash button in the item card', () => {
      // In preorder cart items, Sửa button is next to Minus/Plus and Trash2
      const cartItemSection = datTruocContent.slice(
        datTruocContent.indexOf('Giỏ preorder'),
        datTruocContent.lastIndexOf('selectedSubtotal'),
      );
      expect(cartItemSection).toContain('Edit2');
      expect(cartItemSection).toContain('Sửa');
      expect(cartItemSection).toContain('Trash2');
      expect(cartItemSection).toContain('Giảm số lượng');
      expect(cartItemSection).toContain('Tăng số lượng');
    });
  });

  describe('Admin sidebar mobile drawer toggle overlap fix', () => {
    it('hides PanelLeftClose toggle on mobile to prevent overlapping with Sheet close button', () => {
      expect(adminSidebarContent).toContain('isMobileMode');
      expect(adminSidebarContent).toContain('!isMobileMode &&');
      expect(adminSidebarContent).toContain('PanelLeftClose');
      expect(adminRouteContent).toContain('isMobile');
    });
  });

  describe('Best Seller Skeleton Cards overflow protection', () => {
    it('uses auto height and min-h instead of fixed h-[350px] to contain all elements', () => {
      expect(indexContent).not.toContain('h-[350px] flex flex-col justify-between animate-pulse');
      expect(indexContent).toContain('h-auto min-h-[380px] flex flex-col justify-between overflow-hidden animate-pulse');
    });
  });

  describe('Preorder operating hours and slot constraint', () => {
    it('parses operating hours accurately and bounds slotRangeText to branch hours', () => {
      const suoiTien = parseHoursRange('07:00 – 22:00');
      expect(suoiTien).toEqual({ openHour: 7, openMinute: 0, closeHour: 22, closeMinute: 0 });

      const nguyenHue = parseHoursRange('08:00 – 21:00');
      expect(nguyenHue).toEqual({ openHour: 8, openMinute: 0, closeHour: 21, closeMinute: 0 });

      expect(parseHoursRange(null)).toBeNull();
      expect(parseHoursRange('invalid')).toBeNull();
    });

    it('dat-truoc route does not hardcode 09:00–23:00 and guards against out-of-hours slots', () => {
      expect(datTruocContent).not.toContain("return '09:00–23:00'");
      expect(datTruocContent).toContain('isOutOfHours');
      expect(datTruocContent).toContain('Khung giờ đã chọn nằm ngoài giờ mở cửa của chi nhánh');
    });
  });
});
