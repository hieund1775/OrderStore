import { afterEach, describe, expect, it, vi } from "vitest";
import { apiPost, createIdempotencyKey } from "../api";

describe("order idempotency API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards a caller-provided Idempotency-Key header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: { get: () => "application/json" },
      json: async () => ({ order_code: "TP-TEST" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiPost("/api/orders", { items: [] }, {
      headers: { "Idempotency-Key": "order-test-key" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      "Content-Type": "application/json",
      "Idempotency-Key": "order-test-key",
    });
  });

  it("creates a non-empty key within the backend length limit", () => {
    const key = createIdempotencyKey();
    expect(key).toEqual(expect.any(String));
    expect(key.length).toBeGreaterThan(0);
    expect(key.length).toBeLessThanOrEqual(255);
  });
});
