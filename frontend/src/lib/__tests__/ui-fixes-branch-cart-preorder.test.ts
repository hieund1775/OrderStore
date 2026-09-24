import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), 'src');
const headerContent = fs.readFileSync(path.join(root, 'components/site/Header.tsx'), 'utf8');
const smartCartContent = fs.readFileSync(path.join(root, 'components/cart/SmartCartDrawer.tsx'), 'utf8');
const datTruocContent = fs.readFileSync(path.join(root, 'routes/dat-truoc.tsx'), 'utf8');

describe('UI Fixes Verification Suite', () => {
  describe('Header branch switch protection', () => {
    it('includes confirmation dialog when cart has items and switches branches', () => {
      expect(headerContent).toContain('AlertDialog');
      expect(headerContent).toContain('Xác nhận đổi chi nhánh');
      expect(headerContent).toContain(
        'Thay đổi chi nhánh sẽ xóa các món đang có trong giỏ hàng. Bạn có muốn tiếp tục?',
      );
      expect(headerContent).toContain('clear()');
      expect(headerContent).toContain('executeSwitchBranch(pendingStoreId)');
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
});
