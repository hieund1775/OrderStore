import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PollingController } from '../polling-controller';

describe('Production PollingController Suite (Direct Module Import)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('guarantees zero concurrent overlapping requests when network is slower than interval', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    let fetchCount = 0;

    const slowFetch = async () => {
      fetchCount++;
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      // Wait for 30s virtual time
      await new Promise((resolve) => setTimeout(resolve, 30_000));
      inFlight--;
    };

    const controller = new PollingController({
      fetchFn: slowFetch,
      visibleIntervalMs: 10_000,
    });

    controller.start();
    expect(fetchCount).toBe(1);
    expect(maxInFlight).toBe(1);

    // Fast-forward 15s (past the 10s interval, but fetch is still taking 30s)
    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetchCount).toBe(1); // Must NOT start request 2 while request 1 is still in-flight
    expect(maxInFlight).toBe(1);

    // Advance remaining 15s to complete request 1
    await vi.advanceTimersByTimeAsync(15_000);
    expect(inFlight).toBe(0);

    // Advance 10s for the next scheduled poll
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchCount).toBe(2);
    expect(maxInFlight).toBe(1);

    controller.stop();
  });

  it('triggerImmediate ignores redundant calls while a fetch is already in flight', async () => {
    let resolveFetch: () => void;
    let fetchCount = 0;

    const blockingFetch = () => {
      fetchCount++;
      return new Promise<void>((resolve) => {
        resolveFetch = resolve;
      });
    };

    const controller = new PollingController({
      fetchFn: blockingFetch,
      visibleIntervalMs: 10_000,
    });

    controller.start();
    expect(fetchCount).toBe(1);

    // Trigger immediate multiple times while first is blocked
    controller.triggerImmediate();
    controller.triggerImmediate();
    controller.triggerImmediate();

    expect(fetchCount).toBe(1);

    resolveFetch!();
    await vi.advanceTimersByTimeAsync(0);

    // After resolution, advance interval to verify normal resumption
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchCount).toBe(2);

    controller.stop();
  });

  it('immediately triggers poll upon tab visibility change when idle', async () => {
    let fetchCount = 0;
    const fetchFn = async () => {
      fetchCount++;
    };

    const controller = new PollingController({
      fetchFn,
      visibleIntervalMs: 10_000,
      hiddenIntervalMs: 60_000,
    });

    controller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchCount).toBe(1);

    // Advance 5s (halfway through the 10s interval)
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchCount).toBe(1);

    // Simulate tab becoming visible
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);

    // Must have immediately triggered the fetch
    expect(fetchCount).toBe(2);

    controller.stop();
  });

  it('cancels pending timers and aborts in-flight request on stop()', async () => {
    let aborted = false;

    const cancellableFetch = async (signal?: AbortSignal) => {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 50_000);
        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          aborted = true;
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    };

    const controller = new PollingController({
      fetchFn: cancellableFetch,
      visibleIntervalMs: 10_000,
    });

    controller.start();
    expect(controller.getStatus().isRunning).toBe(true);

    controller.stop();
    expect(controller.getStatus().isRunning).toBe(false);
    expect(aborted).toBe(true);
  });
});
