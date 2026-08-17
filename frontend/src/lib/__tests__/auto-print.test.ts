import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  silentPrintTicket,
  isOrderPrinted,
  setActivePrinterConfig,
} from '../auto-print';

describe('Production Print Lifecycle & Deduplication Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePrinterConfig({
      mode: 'kiosk',
      device_name: 'Test Kiosk Printer',
      configured_at: new Date().toISOString(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks order as printed only after successful iframe print execution', async () => {
    vi.useFakeTimers();

    const order = {
      id: 501,
      order_code: 'TP501',
      store_name: 'Chi nhánh 1',
      items: [{ product_name: 'Trà Đào Cam Sả', qty: 1, unit_price: 35000, line_total: 35000 }],
      total: 35000,
    };

    expect(isOrderPrinted('TP501')).toBe(false);

    const printPromise = silentPrintTicket(order);

    // Before timer fires (during 250ms rendering), order is NOT yet marked printed
    expect(isOrderPrinted('TP501')).toBe(false);

    // Advance 300ms to trigger print()
    await vi.advanceTimersByTimeAsync(300);
    const result = await printPromise;

    expect(result).toBe(true);
    expect(isOrderPrinted('TP501')).toBe(true);

    vi.useRealTimers();
  });

  it('does NOT mark order as printed when BLE printer is disconnected, preserving retry', async () => {
    setActivePrinterConfig({
      mode: 'ble',
      device_name: 'Bluetooth POS Printer',
      configured_at: new Date().toISOString(),
    });

    const order = {
      id: 502,
      order_code: 'TP502_FAIL',
      total: 45000,
    };

    expect(isOrderPrinted('TP502_FAIL')).toBe(false);

    // Since Web Bluetooth / connected printer is null in jsdom, BLE returns false
    const result = await silentPrintTicket(order);

    expect(result).toBe(false);
    expect(isOrderPrinted('TP502_FAIL')).toBe(false); // Retries must still be possible!
  });

  it('deduplicates concurrent print calls for the same order code into a single job', async () => {
    vi.useFakeTimers();

    const order = {
      id: 503,
      order_code: 'TP503_CONCURRENT',
      total: 60000,
    };

    // Fire 3 simultaneous print calls
    const promise1 = silentPrintTicket(order);
    const promise2 = silentPrintTicket(order);
    const promise3 = silentPrintTicket(order);

    // Must return the exact same Promise reference
    expect(promise1).toBe(promise2);
    expect(promise2).toBe(promise3);

    await vi.advanceTimersByTimeAsync(300);
    const [r1, r2, r3] = await Promise.all([promise1, promise2, promise3]);

    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(r3).toBe(true);
    expect(isOrderPrinted('TP503_CONCURRENT')).toBe(true);

    vi.useRealTimers();
  });
});
