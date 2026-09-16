import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SandboxCheckoutPage } from "../../routes/thanh-toan_.sandbox";

// Mock @tanstack/react-router
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => ({
    component: () => null,
    useSearch: () => ({ token: "valid-sandbox-token-123" }),
  }),
  useNavigate: () => vi.fn(),
  useSearch: () => ({ token: "valid-sandbox-token-123" }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// Mock api utilities
vi.mock("@/lib/api", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  getCustomerToken: vi.fn(() => "test-customer-jwt"),
  getCustomerUser: vi.fn(() => ({ id: 7, name: "QA Customer 1", phone: "0999000007" })),
}));

// Mock customer session
vi.mock("@/lib/customer-session", () => ({
  openCustomerLoginModal: vi.fn(),
  getCustomerSession: vi.fn(() => ({
    user: { id: 7, name: "QA Customer 1", phone: "0999000007" },
    token: "test-token",
  })),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { apiGet, apiPost } from "@/lib/api";
import { toast } from "sonner";

function setInputValue(input: HTMLInputElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )!.set!;
  nativeInputValueSetter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("Sandbox Checkout Gateway (Frontend)", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    delete (window as any).location;
    window.location = {
      ...originalLocation,
      search: "?token=valid-sandbox-token-123",
      pathname: "/thanh-toan/sandbox",
    } as any;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    window.location = originalLocation;
  });

  it("renders loading state then loads session details", async () => {
    (apiGet as any).mockResolvedValueOnce({
      status: "active",
      amount: 50000,
      payment_code: "TP260917-0001",
      order_id: 101,
      expires_at: new Date(Date.now() + 600000).toISOString(),
      seconds_remaining: 600,
    });

    await act(async () => {
      root.render(<SandboxCheckoutPage />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(container.textContent).toContain("Môi trường chuyển khoản Sandbox");
    expect(container.textContent).toContain("50.000");
    expect(container.textContent).toContain("TP260917-0001");
  });

  it("requires exact integer amount matching attempt amount", async () => {
    (apiGet as any).mockResolvedValueOnce({
      status: "active",
      amount: 50000,
      payment_code: "TP260917-0001",
      order_id: 101,
      expires_at: new Date(Date.now() + 600000).toISOString(),
      seconds_remaining: 600,
    });

    await act(async () => {
      root.render(<SandboxCheckoutPage />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    const input = container.querySelector("#sandbox-amount") as HTMLInputElement;
    expect(input).toBeDefined();

    // Floating point amount (e.g. 50000.5) triggers validation toast
    await act(async () => {
      setInputValue(input, "50000.5");
    });
    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(toast.error).toHaveBeenCalledWith("Vui lòng nhập số tiền chuyển khoản hợp lệ (số nguyên VND).");

    // Integer amount enables submission
    await act(async () => {
      setInputValue(input, "50000");
    });
    expect(submitBtn.disabled).toBe(false);
  });

  it("submits transfer request with exact amount and handles success", async () => {
    (apiGet as any).mockResolvedValueOnce({
      status: "active",
      amount: 50000,
      payment_code: "TP260917-0001",
      order_id: 101,
      expires_at: new Date(Date.now() + 600000).toISOString(),
      seconds_remaining: 600,
    });

    (apiPost as any).mockResolvedValueOnce({
      ok: true,
      success: true,
      order_code: "TP260917-0001",
    });

    await act(async () => {
      root.render(<SandboxCheckoutPage />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const input = container.querySelector("#sandbox-amount") as HTMLInputElement;
    await act(async () => {
      setInputValue(input, "50000");
    });

    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(apiPost).toHaveBeenCalledWith(
      "/api/payments/sandbox/transfer",
      {
        token: "valid-sandbox-token-123",
        amount: 50000,
      }
    );
  });

  it("displays expired state when session is expired", async () => {
    (apiGet as any).mockResolvedValueOnce({
      status: "expired",
      amount: 50000,
      payment_code: "TP260917-0001",
      order_id: 101,
      expires_at: new Date(Date.now() - 60000).toISOString(),
      seconds_remaining: 0,
    });

    await act(async () => {
      root.render(<SandboxCheckoutPage />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(container.textContent).toContain("Phiên thanh toán đã hết hạn");
    expect(container.textContent).toContain("Xem đơn hàng");
  });
});
