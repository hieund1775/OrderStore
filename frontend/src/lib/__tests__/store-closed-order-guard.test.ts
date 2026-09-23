import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isStoreOpen, parseHours } from '@/lib/store-hours';

describe('Store Closed & Order Button Guard Suite', () => {
  it('parseHours extracts opening and closing times correctly', () => {
    expect(parseHours('08:00 - 22:00')).toEqual({ open: '08:00', close: '22:00' });
    expect(parseHours('07:30 – 21:45')).toEqual({ open: '07:30', close: '21:45' });
  });

  it('isStoreOpen accurately identifies open vs closed based on current time', () => {
    // 10:00 AM (during open hours 08:00 - 22:00)
    const midDay = new Date(2026, 8, 24, 10, 0, 0);
    expect(isStoreOpen('08:00 - 22:00', midDay)).toBe(true);

    // 07:00 AM (before open hours 08:00 - 22:00)
    const earlyMorning = new Date(2026, 8, 24, 7, 0, 0);
    expect(isStoreOpen('08:00 - 22:00', earlyMorning)).toBe(false);

    // 23:30 PM (after close hours 08:00 - 22:00)
    const lateNight = new Date(2026, 8, 24, 23, 30, 0);
    expect(isStoreOpen('08:00 - 22:00', lateNight)).toBe(false);
  });

  it('contract: cua-hang.tsx disables button and displays "Quán hiện đã đóng cửa" when store is closed', () => {
    const cuaHangPath = path.resolve(process.cwd(), 'src/routes/cua-hang.tsx');
    const content = fs.readFileSync(cuaHangPath, 'utf8');

    // Button disabled state checks both is_active and isStoreOpen
    expect(content).toContain('disabled={!s.is_active || !isStoreOpen(s.hours)}');

    // Button label shows "Quán hiện đã đóng cửa" when closed
    expect(content).toContain('!isStoreOpen(s.hours)');
    expect(content).toContain('"Quán hiện đã đóng cửa"');

    // orderFrom function rejects order when store is closed
    expect(content).toContain('if (!isStoreOpen(s.hours)) {');
    expect(content).toContain('return toast.error("Quán hiện đã đóng cửa");');
  });

  it('contract: index.tsx disables button and displays "Quán hiện đã đóng cửa" when store is closed', () => {
    const indexPath = path.resolve(process.cwd(), 'src/routes/index.tsx');
    const content = fs.readFileSync(indexPath, 'utf8');

    // Checks isStoreOpen for status badge
    expect(content).toContain('isStoreOpen(s.hours || "07:00 – 22:30")');
    expect(content).toContain('🔴 Đã đóng cửa');

    // Button disabled state and label
    expect(content).toContain('disabled={!s.is_active || !isStoreOpen(s.hours || "07:00 – 22:30")}');
    expect(content).toContain('"Quán hiện đã đóng cửa"');

    // handleOrderAtBranch guards against closed store
    expect(content).toContain('if (!isStoreOpen(store.hours || "07:00 – 22:30")) {');
    expect(content).toContain('toast.error("Quán hiện đã đóng cửa");');
  });

  it('contract: preserves preorder feature without hiding or disabling /dat-truoc', () => {
    const datTruocPath = path.resolve(process.cwd(), 'src/routes/dat-truoc.tsx');
    expect(fs.existsSync(datTruocPath)).toBe(true);

    const datTruocContent = fs.readFileSync(datTruocPath, 'utf8');
    // Preorder route continues to function normally
    expect(datTruocContent).toContain("createFileRoute('/dat-truoc')");
    expect(datTruocContent).toContain('PreorderCheckoutPage');
  });
});
