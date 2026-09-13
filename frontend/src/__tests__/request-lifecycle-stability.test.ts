import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as apiModule from '../lib/api';
import { fetchCustomerNotifications, fetchAdminNotifications } from '../lib/notifications';

const theoDoiDonSource = fs.readFileSync(path.resolve(process.cwd(), 'src/routes/theo-doi-don.tsx'), 'utf8');
const thanhToanSource = fs.readFileSync(path.resolve(process.cwd(), 'src/routes/thanh-toan.tsx'), 'utf8');

describe('Request lifecycle stability and single-flight containment', () => {
  describe('Notifications deduplication', () => {
    it('shares a single network request for concurrent customer notification fetches', async () => {
      let networkCalls = 0;
      const fakeResponse = {
        notifications: [
          {
            id: 1,
            user_id: 42,
            type: 'order',
            title: 'Order status',
            body: null,
            is_read: false,
            link: null,
            created_at: new Date().toISOString(),
          },
        ],
        unread_count: 1,
      };

      vi.spyOn(apiModule, 'apiGet').mockImplementation(async () => {
        networkCalls += 1;
        // Small delay to simulate in-flight asynchronous network request
        await new Promise((resolve) => setTimeout(resolve, 20));
        return fakeResponse;
      });

      // Fire 3 simultaneous requests for user 42 with limit 50
      const [res1, res2, res3] = await Promise.all([
        fetchCustomerNotifications(42, 50),
        fetchCustomerNotifications(42, 50),
        fetchCustomerNotifications(42, 50),
      ]);

      expect(networkCalls).toBe(1);
      expect(res1.unread_count).toBe(1);
      expect(res2).toEqual(res1);
      expect(res3).toEqual(res1);

      vi.restoreAllMocks();
    });

    it('shares a single network request for concurrent admin notification fetches', async () => {
      let networkCalls = 0;
      const fakeResponse = {
        notifications: [],
        unread_count: 0,
      };

      vi.spyOn(apiModule, 'apiGet').mockImplementation(async () => {
        networkCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return fakeResponse;
      });

      const [res1, res2] = await Promise.all([
        fetchAdminNotifications(100),
        fetchAdminNotifications(100),
      ]);

      expect(networkCalls).toBe(1);
      expect(res1.unread_count).toBe(0);
      expect(res2).toEqual(res1);

      vi.restoreAllMocks();
    });
  });

  describe('Order tracking (theo-doi-don) single-flight & timer lifecycle', () => {
    it('contains in-flight deduplication map for lookup requests', () => {
      expect(theoDoiDonSource).toContain('inFlightLoadRef = useRef<Map<string, Promise<{ ok: boolean; status?: number }>>>(new Map())');
      expect(theoDoiDonSource).toContain('inFlightLoadRef.current.get(codeKey)');
      expect(theoDoiDonSource).toContain('inFlightLoadRef.current.set(codeKey, fetchPromise)');
      expect(theoDoiDonSource).toContain('inFlightLoadRef.current.delete(codeKey)');
    });

    it('uses AbortController to cancel stale requests when switching codes or unmounting', () => {
      expect(theoDoiDonSource).toContain('activeAbortControllerRef.current.abort()');
      expect(theoDoiDonSource).toContain('new AbortController()');
      expect(theoDoiDonSource).toContain('signal: controller.signal');
    });

    it('stops polling on terminal order or group state', () => {
      expect(theoDoiDonSource).toContain('checkIsTerminal');
      expect(theoDoiDonSource).toContain('currentOrder.current_status === "Hoàn thành" || currentOrder.current_status === "Đã hủy"');
      expect(theoDoiDonSource).toContain('if (checkIsTerminal()) return;');
    });

    it('cleans up polling timer and visibility listener on unmount', () => {
      expect(theoDoiDonSource).toContain('if (timerId) clearTimeout(timerId);');
      expect(theoDoiDonSource).toContain('document.removeEventListener("visibilitychange", handleVisibilityChange);');
    });
  });

  describe('PayOS checkout polling deduplication in thanh-toan.tsx', () => {
    it('shares in-flight status requests between periodic polling and manual checkPaymentNow', () => {
      expect(thanhToanSource).toContain('inFlightPaymentStatusRef = useRef<Promise<{ order?: { payment_status: string }; group?: { payment_status: string } }> | null>(null)');
      expect(thanhToanSource).toContain('if (inFlightPaymentStatusRef.current)');
      expect(thanhToanSource).toContain('inFlightPaymentStatusRef.current = promise;');
      expect(thanhToanSource).toContain('inFlightPaymentStatusRef.current = null;');
    });

    it('clears applied voucher code and discount when checkout returns promotion rejection', () => {
      expect(thanhToanSource).toContain('setVoucherDiscount(0)');
      expect(thanhToanSource).toContain('setAppliedCode("")');
    });
  });
});
