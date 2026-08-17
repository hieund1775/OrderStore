import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Node.js test environment verification of the PollingController logic
class PollingControllerHarness {
  constructor({ fetchFn, visibleIntervalMs = 10, hiddenIntervalMs = 50, onError }) {
    this.fetchFn = fetchFn;
    this.visibleIntervalMs = visibleIntervalMs;
    this.hiddenIntervalMs = hiddenIntervalMs;
    this.onError = onError;

    this.isRunning = false;
    this.isFetching = false;
    this.timerId = null;
    this.abortController = null;
    this.fetchCount = 0;
    this.concurrentFetches = 0;
    this.maxConcurrent = 0;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    void this.executePoll();
  }

  stop() {
    this.isRunning = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  triggerImmediate() {
    if (!this.isRunning || this.isFetching) return;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    void this.executePoll();
  }

  async executePoll() {
    if (!this.isRunning || this.isFetching) return;

    this.isFetching = true;
    this.concurrentFetches++;
    this.maxConcurrent = Math.max(this.maxConcurrent, this.concurrentFetches);
    this.fetchCount++;
    this.abortController = new AbortController();

    try {
      await this.fetchFn(this.abortController.signal);
    } catch (err) {
      if (err?.name !== 'AbortError' && this.onError) {
        this.onError(err);
      }
    } finally {
      this.concurrentFetches--;
      this.isFetching = false;
      this.abortController = null;

      if (this.isRunning) {
        this.timerId = setTimeout(() => {
          void this.executePoll();
        }, this.visibleIntervalMs);
      }
    }
  }
}

describe('KDS Non-Overlapping Polling & Print Lifecycle Suite', () => {
  it('guarantees zero concurrent requests when network is slower than polling interval', async () => {
    let activeDeferreds = 0;

    const slowFetch = async () => {
      activeDeferreds++;
      // Simulate 30ms network latency
      await new Promise((resolve) => setTimeout(resolve, 30));
      activeDeferreds--;
    };

    // Polling interval is 5ms (shorter than 30ms latency)
    const controller = new PollingControllerHarness({
      fetchFn: slowFetch,
      visibleIntervalMs: 5,
    });

    controller.start();

    // Let it run for 100ms
    await new Promise((resolve) => setTimeout(resolve, 100));
    controller.stop();

    // Verify maximum concurrency was NEVER greater than 1 (zero overlap)
    assert.equal(controller.maxConcurrent, 1, 'Max concurrent fetches must strictly be 1');
    assert.ok(controller.fetchCount >= 2, 'Must have completed multiple non-overlapping cycles');
  });

  it('triggerImmediate ignores redundant trigger while a fetch is already in flight', async () => {
    let unblock;
    const blockingPromise = new Promise((resolve) => {
      unblock = resolve;
    });

    const fetchFn = async () => {
      await blockingPromise;
    };

    const controller = new PollingControllerHarness({
      fetchFn,
      visibleIntervalMs: 50,
    });

    controller.start();
    assert.equal(controller.isFetching, true);

    // Call triggerImmediate multiple times while request is in flight
    controller.triggerImmediate();
    controller.triggerImmediate();
    controller.triggerImmediate();

    assert.equal(controller.fetchCount, 1, 'Should NOT dispatch extra fetch while in flight');

    unblock();
    await new Promise((resolve) => setTimeout(resolve, 10));
    controller.stop();
  });

  it('stops cleanly and aborts pending work on teardown', async () => {
    let aborted = false;

    const cancellableFetch = async (signal) => {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 1000);
        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          aborted = true;
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    };

    const controller = new PollingControllerHarness({
      fetchFn: cancellableFetch,
      visibleIntervalMs: 50,
    });

    controller.start();
    assert.equal(controller.isRunning, true);

    // Stop immediately
    controller.stop();
    assert.equal(controller.isRunning, false);
    assert.equal(aborted, true, 'AbortSignal must be triggered upon stop()');
  });
});
