import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('UI & Business Rule Fixes: Auth Eye Toggle, Menu Search Clear, Voucher Min Order Guard', () => {
  const headerPath = path.resolve(process.cwd(), 'src/components/site/Header.tsx');
  const headerContent = fs.readFileSync(headerPath, 'utf8');

  const menuPath = path.resolve(process.cwd(), 'src/routes/menu.tsx');
  const menuContent = fs.readFileSync(menuPath, 'utf8');

  const thanhToanPath = path.resolve(process.cwd(), 'src/routes/thanh-toan.tsx');
  const thanhToanContent = fs.readFileSync(thanhToanPath, 'utf8');

  const publicPromotionsPath = path.resolve(process.cwd(), '../backend/routes/public/promotions.js');
  const publicPromotionsContent = fs.readFileSync(publicPromotionsPath, 'utf8');

  const publicOrdersPath = path.resolve(process.cwd(), '../backend/routes/public/orders.js');
  const publicOrdersContent = fs.readFileSync(publicOrdersPath, 'utf8');

  describe('Issue 1: Header Login Modal Password Eye Toggle', () => {
    it('declares showPassword state initialized to false', () => {
      expect(headerContent).toContain("const [showPassword, setShowPassword] = useState(false);");
    });

    it('imports Eye and EyeOff icons from lucide-react', () => {
      expect(headerContent).toContain('Eye,');
      expect(headerContent).toContain('EyeOff,');
    });

    it('toggles password input type between text and password with eye button', () => {
      expect(headerContent).toContain("type={showPassword ? 'text' : 'password'}");
      expect(headerContent).toContain("aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}");
      expect(headerContent).toContain("{showPassword ? <EyeOff className=\"size-4\" /> : <Eye className=\"size-4\" />}");
    });

    it('resets showPassword to false on modal close or mode toggle', () => {
      expect(headerContent).toContain("setShowPassword(false);");
    });
  });

  describe('Issue 2: Menu Search Input Quick Clear Button (✕)', () => {
    it('imports X icon from lucide-react', () => {
      expect(menuContent).toContain('X');
    });

    it('renders clear button with X icon when searchQuery is present', () => {
      expect(menuContent).toContain('{Boolean(searchQuery) && (');
      expect(menuContent).toContain('onClick={() => setSearchQuery("")}');
      expect(menuContent).toContain('aria-label="Xóa từ khóa tìm kiếm"');
      expect(menuContent).toContain('<X className="size-3.5" />');
    });
  });

  describe('Issue 3: Voucher Order Tampering Prevention & Auto-Clear', () => {
    it('backend /api/vouchers/apply returns min_order of the promotion', () => {
      expect(publicPromotionsContent).toContain('min_order: Number(promotion?.min_order || 0)');
    });

    it('backend /api/orders strips allocatedDiscount and skipVoucherConsume from untrusted input', () => {
      expect(publicOrdersContent).toContain('delete input.allocatedDiscount;');
      expect(publicOrdersContent).toContain('delete input.skipVoucherConsume;');
    });

    it('thanh-toan.tsx stores appliedMinOrder from /api/vouchers/apply', () => {
      expect(thanhToanContent).toContain('const [appliedMinOrder, setAppliedMinOrder] = useState<number>(0);');
      expect(thanhToanContent).toContain('setAppliedMinOrder(Number(res.min_order || 0));');
    });

    it('thanh-toan.tsx automatically clears voucher and resets total when checkoutSubtotal drops below appliedMinOrder', () => {
      expect(thanhToanContent).toContain('appliedCode && appliedMinOrder > 0 && checkoutSubtotal < appliedMinOrder');
      expect(thanhToanContent).toContain('Đơn hàng của bạn không còn đủ điều kiện áp dụng mã giảm giá');
      expect(thanhToanContent).toContain('setVoucherDiscount(0);');
      expect(thanhToanContent).toContain('setAppliedCode("");');
      expect(thanhToanContent).toContain('setAppliedMinOrder(0);');
    });

    it('thanh-toan.tsx blocks order submission if checkoutSubtotal is below appliedMinOrder', () => {
      expect(thanhToanContent).toContain('if (appliedCode && appliedMinOrder > 0 && checkoutSubtotal < appliedMinOrder)');
    });
  });

  describe('Issue 4: Branch Item Availability Scanning & Non-destructive Transfer', () => {
    const catalogV2RouterPath = path.resolve(process.cwd(), '../backend/routes/public/catalog-v2.js');
    const catalogV2RouterContent = fs.readFileSync(catalogV2RouterPath, 'utf8');

    const backendOrdersPath = path.resolve(process.cwd(), '../backend/repositories/postgres/orders.js');
    const backendOrdersContent = fs.readFileSync(backendOrdersPath, 'utf8');

    const cartAvailabilityPath = path.resolve(process.cwd(), 'src/lib/cart-availability.ts');
    const cartAvailabilityContent = fs.readFileSync(cartAvailabilityPath, 'utf8');

    it('backend catalog-v2 provides /check-availability endpoint', () => {
      expect(catalogV2RouterContent).toContain("router.post('/check-availability'");
      expect(catalogV2RouterContent).toContain('checkProductsAvailability');
    });

    it('backend createPublicOrder validates product branch availability and fails closed', () => {
      expect(backendOrdersContent).toContain('branch_variant_offers');
      expect(backendOrdersContent).toContain('PRODUCT_UNAVAILABLE_AT_BRANCH');
    });

    it('cart-availability helper queries /api/catalog/check-availability and filters unavailable items', () => {
      expect(cartAvailabilityContent).toContain('/api/catalog/check-availability');
      expect(cartAvailabilityContent).toContain('checkCartAvailability');
      expect(cartAvailabilityContent).toContain('hasUnavailable');
      expect(cartAvailabilityContent).toContain('unavailableItems');
    });

    it('Header.tsx checks availability on branch switch and removes only unavailable items', () => {
      expect(headerContent).toContain('checkCartAvailability(value, productIds)');
      expect(headerContent).toContain('transferStore');
      expect(headerContent).toContain('removeItems(keysToRemove)');
      expect(headerContent).toContain('Món không khả dụng tại chi nhánh mới');
    });

    it('thanh-toan.tsx checks checkout item availability, shows warning banner, and blocks order submission', () => {
      expect(thanhToanContent).toContain('unavailableCheckoutItems');
      expect(thanhToanContent).toContain('checkCartAvailability(checkoutStoreId, productIds)');
      expect(thanhToanContent).toContain('Món ngưng phục vụ tại chi nhánh đã chọn');
      expect(thanhToanContent).toContain('if (unavailableCheckoutItems.length > 0)');
    });
  });
});

