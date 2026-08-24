export const COMPLETION_CONFIRM_WINDOW_MS = 5_000;

export type ArmedCompletionState = {
  orderId: number;
  expiresAt: number;
} | null;

export interface CompletionClickEvaluation {
  action: "arm" | "confirm";
  nextState: ArmedCompletionState;
}

export function evaluateCompletionClick(
  currentState: ArmedCompletionState,
  clickedOrderId: number,
  nowMs: number = Date.now(),
): CompletionClickEvaluation {
  if (currentState && currentState.orderId === clickedOrderId && nowMs < currentState.expiresAt) {
    return {
      action: "confirm",
      nextState: null,
    };
  }

  return {
    action: "arm",
    nextState: {
      orderId: clickedOrderId,
      expiresAt: nowMs + COMPLETION_CONFIRM_WINDOW_MS,
    },
  };
}
