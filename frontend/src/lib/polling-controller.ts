/**
 * Production Non-Overlapping Polling Controller
 *
 * Guarantees zero overlapping network requests by using chained self-scheduling timeouts.
 * Dynamically adjusts polling interval when tab visibility changes (visible vs hidden).
 * Supports cancellation via AbortController on unmount.
 */

export type PollingControllerOptions = {
  fetchFn: (signal?: AbortSignal) => Promise<void>;
  visibleIntervalMs?: number; // Default 10s (10,000ms)
  hiddenIntervalMs?: number;  // Default 60s (60,000ms)
  onError?: (error: unknown) => void;
};

export class PollingController {
  private fetchFn: (signal?: AbortSignal) => Promise<void>;
  private visibleIntervalMs: number;
  private hiddenIntervalMs: number;
  private onError?: (error: unknown) => void;

  private isRunning = false;
  private isFetching = false;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private abortController: AbortController | null = null;

  constructor(options: PollingControllerOptions) {
    this.fetchFn = options.fetchFn;
    this.visibleIntervalMs = options.visibleIntervalMs ?? 10_000;
    this.hiddenIntervalMs = options.hiddenIntervalMs ?? 60_000;
    this.onError = options.onError;

    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    void this.executePoll();
  }

  public stop(): void {
    this.isRunning = false;

    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  public triggerImmediate(): void {
    if (!this.isRunning) return;

    if (this.isFetching) {
      return; // Already in-flight; next poll will schedule after completion
    }

    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    void this.executePoll();
  }

  private async executePoll(): Promise<void> {
    if (!this.isRunning || this.isFetching) return;

    this.isFetching = true;
    this.abortController = new AbortController();

    try {
      await this.fetchFn(this.abortController.signal);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Normal cancellation
        return;
      }
      if (this.onError) {
        this.onError(err);
      }
    } finally {
      this.isFetching = false;
      this.abortController = null;

      if (this.isRunning) {
        const isHidden = typeof document !== 'undefined' && document.hidden;
        const delay = isHidden ? this.hiddenIntervalMs : this.visibleIntervalMs;

        this.timerId = setTimeout(() => {
          void this.executePoll();
        }, delay);
      }
    }
  }

  private handleVisibilityChange(): void {
    if (typeof document === 'undefined') return;

    if (!document.hidden && this.isRunning && !this.isFetching) {
      // User switched back to the tab: immediately refetch latest KDS state
      if (this.timerId !== null) {
        clearTimeout(this.timerId);
        this.timerId = null;
      }
      void this.executePoll();
    }
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      isFetching: this.isFetching,
    };
  }
}
