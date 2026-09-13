import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), 'src');
const customerTracking = fs.readFileSync(path.join(root, 'routes/don-dat-truoc.tsx'), 'utf8');
const preordersTab = fs.readFileSync(path.join(root, 'components/profile/CustomerPreordersTab.tsx'), 'utf8');
const checkout = fs.readFileSync(path.join(root, 'routes/dat-truoc.tsx'), 'utf8');
const adminPreorders = fs.readFileSync(path.join(root, 'routes/admin.dat-truoc.tsx'), 'utf8');
const kitchen = fs.readFileSync(path.join(root, 'routes/admin.bep.tsx'), 'utf8');

describe('preorder customer and operations contract', () => {
  it('keeps preorder tracking separate from normal order tracking and shows item snapshots', () => {
    expect(checkout).toContain('return_url: `${window.location.origin}/don-dat-truoc`');
    expect(customerTracking).toContain("createFileRoute('/don-dat-truoc')");
    expect(customerTracking).toContain("to: '/ho-so'");
    expect(customerTracking).toContain("tab: 'preorders'");
    expect(preordersTab).toContain("apiGet<{ preorders?: unknown }>('/api/preorders/mine')");
    expect(preordersTab).toContain('Món đã đặt');
    expect(preordersTab).toContain('scheduled_start_at');
  });

  it('does not put unpaid preorders in the operational queue and makes configuration compact', () => {
    expect(adminPreorders).toContain("'pending' | 'confirmed' | 'checked-in' | 'today' | 'upcoming' | 'archive'");
    expect(adminPreorders).toContain('<details className="group rounded-xl border bg-card p-4">');
    expect(adminPreorders).toContain('Tất cả chi nhánh');
  });

  it('shows confirmed preorders as a read-only kitchen preview instead of a KDS action card', () => {
    expect(kitchen).toContain('/admin/preorders/kitchen/confirmed');
    expect(kitchen).toContain('Preorder sắp tới');
    expect(kitchen).toContain('chưa được bắt đầu/hoàn thành trước khi khách check-in');
  });

  it('contracts customer check-in request and admin check-in confirmation/rejection flow', () => {
    expect(preordersTab).toContain('/api/preorders/${encodeURIComponent(preorder.preorder_code)}/check-in-request');
    expect(preordersTab).toContain('Đã gửi yêu cầu check-in · Đang chờ Quản lý xác nhận');
    expect(preordersTab).toContain('Check-in mở lúc');
    expect(adminPreorders).toContain('/admin/preorders/${id}/check-in');
    expect(adminPreorders).toContain('/check-in/reject');
    expect(adminPreorders).toContain('Xác nhận check-in sau thời hạn T+30');
    expect(adminPreorders).toContain('Từ chối yêu cầu check-in');
  });
});
