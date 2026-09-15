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
    expect(adminPreorders).toContain("'pending' | 'check-in' | 'today' | 'upcoming' | 'archive'");
    expect(adminPreorders).toContain('<details className="group rounded-xl border bg-card p-4">');
    expect(adminPreorders).toContain('Tất cả chi nhánh');
    expect(adminPreorders).not.toContain('useEffect(() => { void load(); }, [load])');
    expect(adminPreorders).toContain('const isBackground = !isFirst;');
  });

  it('shows confirmed preorders as a read-only kitchen preview bounded to 6 instead of a KDS action card', () => {
    expect(kitchen).toContain('/admin/preorders/kitchen/confirmed');
    expect(kitchen).toContain('limit: "6"');
    expect(kitchen).not.toContain('confirmedPreorders.slice');
    expect(kitchen).toContain('Preorder sắp tới');
    expect(kitchen).toContain('Bếp có thể chủ động chuẩn bị món theo lịch hẹn (không cần đợi khách check-in)');
  });

  it('contracts customer self check-in and admin handover confirmation flow', () => {
    expect(preordersTab).toContain('/api/preorders/${encodeURIComponent(preorder.preorder_code)}/check-in');
    expect(preordersTab).toContain('Check-in thành công');
    expect(preordersTab).toContain('Check-in mở từ 08:00 đến 24:00');
    expect(adminPreorders).toContain('/admin/preorders/${id}/handover');
    expect(adminPreorders).toContain('Xác nhận giao hàng');
  });
});
