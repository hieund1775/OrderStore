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

  describe('Generic mutation single-flight guard', () => {
    it('sends one request for a duplicate mutation on the same resource', async () => {
      let networkCalls = 0;
      vi.stubGlobal('fetch', vi.fn(async () => {
        networkCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }));

      const [first, second] = await Promise.all([
        apiModule.apiFetch('/admin/branches/1', {
          method: 'PUT',
          body: JSON.stringify({ is_active: 0 }),
        }),
        apiModule.apiFetch('/admin/branches/1', {
          method: 'PUT',
          body: JSON.stringify({ is_active: 0 }),
        }),
      ]);

      expect(networkCalls).toBe(1);
      expect(second).toEqual(first);
      vi.unstubAllGlobals();
    });

    it('keeps different resource mutations independent', async () => {
      let networkCalls = 0;
      vi.stubGlobal('fetch', vi.fn(async () => {
        networkCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }));

      await Promise.all([
        apiModule.apiFetch('/admin/branches/1', { method: 'PUT', body: '{}' }),
        apiModule.apiFetch('/admin/branches/2', { method: 'PUT', body: '{}' }),
      ]);

      expect(networkCalls).toBe(2);
      vi.unstubAllGlobals();
    });

    it('releases a failed mutation so the user can retry', async () => {
      let networkCalls = 0;
      vi.stubGlobal('fetch', vi.fn(async () => {
        networkCalls += 1;
        if (networkCalls === 1) {
          return new Response(JSON.stringify({ error: 'temporary failure' }), {
            status: 503,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }));

      await expect(apiModule.apiFetch('/admin/branches/1', { method: 'PUT', body: '{}' })).rejects.toThrow();
      await expect(apiModule.apiFetch('/admin/branches/1', { method: 'PUT', body: '{}' })).resolves.toEqual({ ok: true });

      expect(networkCalls).toBe(2);
      vi.unstubAllGlobals();
    });
  });

  describe('Generic GET single-flight guard', () => {
    it('shares one identical in-flight GET request', async () => {
      let networkCalls = 0;
      vi.stubGlobal('fetch', vi.fn(async () => {
        networkCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }));

      const [first, second] = await Promise.all([
        apiModule.apiGet('/admin/branches/3/capabilities'),
        apiModule.apiGet('/admin/branches/3/capabilities'),
      ]);

      expect(networkCalls).toBe(1);
      expect(second).toEqual(first);
      vi.unstubAllGlobals();
    });

    it('does not share caller-owned GET requests with an AbortSignal', async () => {
      let networkCalls = 0;
      vi.stubGlobal('fetch', vi.fn(async () => {
        networkCalls += 1;
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }));

      await Promise.all([
        apiModule.apiGet('/admin/tables?store_id=1', { signal: new AbortController().signal }),
        apiModule.apiGet('/admin/tables?store_id=1', { signal: new AbortController().signal }),
      ]);

      expect(networkCalls).toBe(2);
      vi.unstubAllGlobals();
    });
  });

  describe('Order tracking (theo-doi-don) single-flight & timer lifecycle', () => {
    it('imports useRef for its in-flight and lifecycle refs', () => {
      expect(theoDoiDonSource).toMatch(/import\s*\{[^}]*useRef[^}]*\}\s*from\s*["']react["']/);
    });

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
    it('imports every React hook used by the checkout route', () => {
      expect(thanhToanSource).toMatch(
        /import\s*\{[^}]*\buseCallback\b[^}]*\}\s*from\s*["']react["']/s,
      );
      expect(thanhToanSource).toContain('const fetchPaymentStatus = useCallback(');
    });

    it('shares in-flight status requests between periodic polling and manual checkPaymentNow', () => {
      expect(thanhToanSource).toContain('inFlightPaymentStatusRef = useRef(new Map());');
      expect(thanhToanSource).toContain('inFlightPaymentStatusRef.current.get(key)');
      expect(thanhToanSource).toContain('inFlightPaymentStatusRef.current.set(key, promise)');
      expect(thanhToanSource).toContain('inFlightPaymentStatusRef.current.delete(key)');
    });

    it('clears applied voucher code and discount when checkout returns promotion rejection', () => {
      expect(thanhToanSource).toContain('setVoucherDiscount(0)');
      expect(thanhToanSource).toContain('setAppliedCode("")');
    });
  });

  it('handles a fully voucher-covered order without requesting a PayOS QR', () => {
    expect(thanhToanSource).toContain('res.payment_required === false && createdPaymentCode');
    expect(thanhToanSource).toContain('to: "/theo-doi-don", search: { code: createdPaymentCode }');
  });
});
