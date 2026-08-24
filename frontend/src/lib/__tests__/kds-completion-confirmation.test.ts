import { describe, expect, it, vi } from "vitest";
import {
  evaluateCompletionClick,
  COMPLETION_CONFIRM_WINDOW_MS,
  type ArmedCompletionState,
} from "../kds-completion-confirmation";

describe("KDS Inline 2-Step Completion Confirmation", () => {
  it("arms on first click", () => {
    const now = 10000;
    const result = evaluateCompletionClick(null, 42, now);

    expect(result.action).toBe("arm");
    expect(result.nextState).toEqual({
      orderId: 42,
      expiresAt: now + COMPLETION_CONFIRM_WINDOW_MS,
    });
  });

  it("confirms on second click within window on same order", () => {
    const now = 10000;
    const armedState: ArmedCompletionState = {
      orderId: 42,
      expiresAt: now + COMPLETION_CONFIRM_WINDOW_MS,
    };

    const result = evaluateCompletionClick(armedState, 42, now + 2000);
    expect(result.action).toBe("confirm");
    expect(result.nextState).toBeNull();
  });

  it("re-arms if second click occurs after window has expired", () => {
    const now = 10000;
    const armedState: ArmedCompletionState = {
      orderId: 42,
      expiresAt: now + COMPLETION_CONFIRM_WINDOW_MS,
    };

    const result = evaluateCompletionClick(armedState, 42, now + 5001);
    expect(result.action).toBe("arm");
    expect(result.nextState).toEqual({
      orderId: 42,
      expiresAt: now + 5001 + COMPLETION_CONFIRM_WINDOW_MS,
    });
  });

  it("treats the exact five-second boundary as expired", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T12:00:00Z"));
    const first = evaluateCompletionClick(null, 42);
    vi.advanceTimersByTime(COMPLETION_CONFIRM_WINDOW_MS);
    const boundary = evaluateCompletionClick(first.nextState, 42);
    expect(boundary.action).toBe("arm");
    vi.useRealTimers();
  });

  it("arms new order if clicking different order while another is armed", () => {
    const now = 10000;
    const armedState: ArmedCompletionState = {
      orderId: 42,
      expiresAt: now + COMPLETION_CONFIRM_WINDOW_MS,
    };

    const result = evaluateCompletionClick(armedState, 99, now + 1000);
    expect(result.action).toBe("arm");
    expect(result.nextState).toEqual({
      orderId: 99,
      expiresAt: now + 1000 + COMPLETION_CONFIRM_WINDOW_MS,
    });
  });
});
