import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDeviceUserAgent, formatAuditAction, formatAuditDetail } from '../audit-format';

describe('Admin UI Enhancements (7 fixes)', () => {
  const viTriPath = path.resolve(process.cwd(), 'src/routes/admin.vi-tri.tsx');
  const viTriContent = fs.readFileSync(viTriPath, 'utf8');

  const thongBaoPath = path.resolve(process.cwd(), 'src/routes/admin.thong-bao.tsx');
  const thongBaoContent = fs.readFileSync(thongBaoPath, 'utf8');

  const notificationsPath = path.resolve(process.cwd(), 'src/lib/notifications.ts');
  const notificationsContent = fs.readFileSync(notificationsPath, 'utf8');

  const caiDatPath = path.resolve(process.cwd(), 'src/routes/admin.cai-dat.tsx');
  const caiDatContent = fs.readFileSync(caiDatPath, 'utf8');

  const hangDangBanPath = path.resolve(process.cwd(), 'src/routes/admin.hang-dang-ban.tsx');
  const hangDangBanContent = fs.readFileSync(hangDangBanPath, 'utf8');

  const sidebarPath = path.resolve(process.cwd(), 'src/components/admin/AdminSidebar.tsx');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

  const chiNhanhPath = path.resolve(process.cwd(), 'src/routes/admin.chi-nhanh.tsx');
  const chiNhanhContent = fs.readFileSync(chiNhanhPath, 'utf8');

  describe('Issue 1 & 3: QR Quiet Zone and Branch Tables Pagination Guard', () => {
    it('sets QRCode margin to at least 2 for quiet zone safety', () => {
      expect(viTriContent).toContain('margin: 2');
    });

    it('uses rounded-2xl with ample padding (p-4 or p-5) for QR card preview', () => {
      expect(viTriContent).toContain('rounded-2xl border p-4 shadow-2xs');
      expect(viTriContent).toContain('object-contain');
    });

    it('fetches all branch tables without pagination limit when viewing all branches to avoid table splitting', () => {
      expect(viTriContent).toContain('if (branchFilter === "all")');
      expect(viTriContent).toContain('apiGet<any>("/admin/tables")');
    });

    it('computes and displays true branch table count in branch badges', () => {
      expect(viTriContent).toContain('branchTableCounts[group.store_id]');
    });
  });

  describe('Issue 2: Notification Pagination Item Count Consistency', () => {
    it('notifications.ts preserves both camelCase and snake_case pagination fields', () => {
      expect(notificationsContent).toContain('totalItems,');
      expect(notificationsContent).toContain('total_items: totalItems');
    });

    it('admin.thong-bao.tsx resolves totalItems with fallback to total_items/total', () => {
      expect(thongBaoContent).toContain('paginatedData?.pagination?.totalItems');
      expect(thongBaoContent).toContain('paginatedData?.pagination?.total_items');
    });
  });

  describe('Issue 4: User-friendly Audit Logs & Device Formatting', () => {
    it('parses system/bot user agent to friendly Vietnamese label', () => {
      const parsed = parseDeviceUserAgent('node');
      expect(parsed.label).toContain('Hệ thống tự động');
      expect(parsed.isServer).toBe(true);
    });

    it('parses browser user agent into OS and browser string', () => {
      const parsed = parseDeviceUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
      expect(parsed.label).toBe('Windows - Chrome');
      expect(parsed.isServer).toBe(false);
    });

    it('formats audit actions and technical change details into human-readable text', () => {
      const branchMap = new Map([[2, 'Bình Thạnh - D2']]);
      const productMap = new Map([[1, 'Trà Dâu Tươi']]);

      const formattedAction = formatAuditAction('Cập nhật trạng thái món #1 (store 2)', productMap, branchMap);
      expect(formattedAction).toContain('Trà Dâu Tươi');
      expect(formattedAction).toContain('Chi nhánh Bình Thạnh - D2');

      const formattedDetail = formatAuditDetail('is_available: false, removed_wishlists: 2, notified: 2');
      expect(formattedDetail).toContain('Ẩn món (Ngừng bán)');
      expect(formattedDetail).toContain('gỡ khỏi 2 danh sách yêu thích');
      expect(formattedDetail).toContain('gửi thông báo đến 2 khách hàng');
    });

    it('admin.cai-dat.tsx integrates audit formatters and fetches branches/products for lookup', () => {
      expect(caiDatContent).toContain('parseDeviceUserAgent');
      expect(caiDatContent).toContain('formatAuditAction');
      expect(caiDatContent).toContain('formatAuditDetail');
    });
  });

  describe('Issue 5: Hang-dang-ban Pagination Spacing Tightening', () => {
    it('wraps BranchOfferTable and AdminPagination in a tight space-y-3 container', () => {
      expect(hangDangBanContent).toContain('<div className="space-y-3">');
      expect(hangDangBanContent).toContain('<BranchOfferTable');
      expect(hangDangBanContent).toContain('className="!mt-2 pt-2"');
    });
  });

  describe('Issue 6: AdminSidebar Toggle Consistency', () => {
    it('keeps toggle button in top header bar at size-8 for both expanded and collapsed states', () => {
      expect(sidebarContent).toContain('aria-label="Thu gọn sidebar"');
      expect(sidebarContent).toContain('aria-label="Mở rộng sidebar"');
      expect(sidebarContent).toContain('PanelLeftOpen className="size-4"');
      expect(sidebarContent).toContain('PanelLeftClose className="size-4"');
    });

    it('removes the bottom footer toggle button completely', () => {
      expect(sidebarContent).not.toContain('size-10 w-full place-items-center');
    });
  });

  describe('Issue 7: Chi-nhanh Search Pagination & Total Counter', () => {
    it('tracks isFiltering state based on search query and cityFilter', () => {
      expect(chiNhanhContent).toContain('const isFiltering = Boolean(search.trim()) || cityFilter !== "all";');
    });

    it('only renders AdminPagination when filteredStores.length > 0', () => {
      expect(chiNhanhContent).toContain('{filteredStores.length > 0 && (');
    });

    it('passes filtered count to totalItems and recalculates totalPages when filtering', () => {
      expect(chiNhanhContent).toContain('totalItems={isFiltering ? filteredStores.length : (totalStores ?? stores.length)}');
      expect(chiNhanhContent).toContain('totalPages={isFiltering ? Math.max(1, Math.ceil(filteredStores.length / 6)) : totalPages}');
    });
  });
});
