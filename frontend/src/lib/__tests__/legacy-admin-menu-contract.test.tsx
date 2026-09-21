import { describe, it, expect } from 'vitest';
import { formatAdminRoleLabel } from '../admin-topbar';
import { adminNav } from '@/components/admin/AdminSidebar';

describe('Legacy Admin Menu & RBAC Contract Suite', () => {
  it('formats valid role labels for legacy staff and admin hierarchy', () => {
    expect(formatAdminRoleLabel('super')).toBe('Quản trị viên cấp cao');
    expect(formatAdminRoleLabel('manager')).toBe('Quản lý chi nhánh');
    expect(formatAdminRoleLabel('cashier')).toBe('Thu ngân');
    expect(formatAdminRoleLabel('kitchen')).toBe('Bếp / Pha chế');
    expect(formatAdminRoleLabel('packing')).toBe('Soạn hàng / Đóng gói');
    expect(formatAdminRoleLabel('unknown')).toBe('Nhân viên');
  });

  it('Legacy menu route /admin/thuc-don exists in compatibility window', async () => {
    const routeModule = await import('@/routes/admin.thuc-don');
    expect(routeModule.Route).toBeDefined();
  });

  it('Admin sidebar has removed legacy menu item in favor of unified Catalog', () => {
    const legacyItem = adminNav.find((item) => String(item.to) === '/admin/thuc-don');
    expect(legacyItem).toBeUndefined();

    const catalogItem = adminNav.find((item) => item.to === '/admin/catalog');
    expect(catalogItem).toBeDefined();
    expect(catalogItem?.label).toContain('Sản phẩm & Danh mục');
  });

  it('Admin sidebar categorizes orders into catalog, packing into operations, and branch/qr into store_management', () => {
    const donHang = adminNav.find((item) => item.to === '/admin/don-hang');
    const dongGoi = adminNav.find((item) => item.to === '/admin/dong-goi');
    const chiNhanh = adminNav.find((item) => item.to === '/admin/chi-nhanh');
    const viTri = adminNav.find((item) => item.to === '/admin/vi-tri');

    expect(donHang?.section).toBe('catalog');
    expect(dongGoi?.section).toBe('operations');
    expect(chiNhanh?.section).toBe('store_management');
    expect(viTri?.section).toBe('store_management');
  });

  it('Admin sidebar restricts sensitive system config menus to super admin only', () => {
    const catalog = adminNav.find((item) => item.to === '/admin/catalog');
    const chiNhanh = adminNav.find((item) => item.to === '/admin/chi-nhanh');
    const khuyenMai = adminNav.find((item) => item.to === '/admin/khuyen-mai');
    const danhGia = adminNav.find((item) => item.to === '/admin/danh-gia');
    const tuyenDung = adminNav.find((item) => item.to === '/admin/tuyen-dung');
    const caiDat = adminNav.find((item) => item.to === '/admin/cai-dat');

    expect(catalog?.roles).toEqual(['super']);
    expect(chiNhanh?.roles).toEqual(['super']);
    expect(khuyenMai?.roles).toEqual(['super']);
    expect(danhGia?.roles).toEqual(['super']);
    expect(tuyenDung?.roles).toEqual(['super']);
    expect(caiDat?.roles).toEqual(['super']);
  });
});
