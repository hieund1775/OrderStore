import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();
let currentSearch: Record<string, any> = {};

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: any) => ({
    ...config,
    useSearch: () => currentSearch,
  }),
  useNavigate: () => mockNavigate,
}));

vi.mock("@/lib/api", () => ({
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  getUser: vi.fn(() => ({ role: "super" })),
}));

import { OrdersPage } from "@/routes/admin.don-hang";
import * as api from "@/lib/api";

const reactTestGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };

describe("Admin Orders List Pagination & Count Suite", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
    currentSearch = {};
    mockNavigate.mockClear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    container.remove();
    reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("correctly displays total item count and total pages from backend camelCase pagination", async () => {
    vi.mocked(api.apiGet).mockImplementation(async (url: string) => {
      if (url === "/admin/branches") {
        return [{ id: 1, name: "Chi nhánh Quận 1" }];
      }
      if (url.startsWith("/admin/orders")) {
        return {
          orders: [
            {
              id: 101,
              order_code: "ORD-101",
              customer_name: "Khách A",
              customer_phone: "0901234567",
              order_type: "Dine-in",
              payment_method: "Tiền mặt",
              payment_status: "paid",
              current_status: "Chờ xác nhận",
              total: 50000,
              created_at: new Date().toISOString(),
              store_name: "Chi nhánh Quận 1",
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            totalItems: 51,
            totalPages: 6,
          },
        };
      }
      return [];
    });

    await act(async () => {
      root?.render(<OrdersPage />);
    });

    // Wait for debounce and async load
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    // Check header text: must not say "undefined đơn khớp bộ lọc"
    expect(container.textContent).toContain("51 đơn khớp bộ lọc");
    expect(container.textContent).not.toContain("undefined đơn");

    // Check pagination: must show 1 / 6 (51 đơn hàng)
    expect(container.textContent).toContain("Trang 1 / 6");
    expect(container.textContent).toContain("51 đơn hàng");

    // "Trang sau" button should be enabled
    const nextBtn = container.querySelector("button[aria-label='Trang sau']") as HTMLButtonElement | null;
    expect(nextBtn).not.toBeNull();
    expect(nextBtn?.disabled).toBe(false);
  });

  it("supports legacy snake_case pagination fields gracefully", async () => {
    vi.mocked(api.apiGet).mockImplementation(async (url: string) => {
      if (url === "/admin/branches") {
        return [{ id: 1, name: "Chi nhánh Quận 1" }];
      }
      if (url.startsWith("/admin/orders")) {
        return {
          orders: [],
          pagination: {
            page: 1,
            limit: 10,
            total_items: 28,
            total_pages: 3,
          },
        };
      }
      return [];
    });

    await act(async () => {
      root?.render(<OrdersPage />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    expect(container.textContent).toContain("28 đơn khớp bộ lọc");
    expect(container.textContent).toContain("Trang 1 / 3");
    expect(container.textContent).toContain("28 đơn hàng");
  });
});
