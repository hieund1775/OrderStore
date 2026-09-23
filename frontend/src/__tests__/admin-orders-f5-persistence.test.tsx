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

describe("Admin Orders F5 Filter Persistence Suite", () => {
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

    vi.mocked(api.apiGet).mockImplementation(async (url: string) => {
      if (url === "/admin/branches") {
        return [
          { id: 1, name: "Chi nhánh Quận 1" },
          { id: 2, name: "Chi nhánh Cầu Giấy" },
        ];
      }
      if (url.startsWith("/admin/orders")) {
        return {
          orders: [],
          pagination: {
            page: 1,
            limit: 10,
            total_items: 0,
            total_pages: 1,
            has_next: false,
            has_prev: false,
          },
        };
      }
      return [];
    });
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

  it("persists active searchParams into sessionStorage", async () => {
    currentSearch = {
      branchId: "2",
      status: "Đang chuẩn bị",
      type: "Delivery",
      payment: "VietQR",
      page: 2,
    };

    await act(async () => {
      root?.render(<OrdersPage />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const stored = JSON.parse(sessionStorage.getItem("admin_orders_filters") || "{}");
    expect(stored.branchId).toBe("2");
    expect(stored.status).toBe("Đang chuẩn bị");
    expect(stored.type).toBe("Delivery");
    expect(stored.payment).toBe("VietQR");
    expect(stored.page).toBe(2);
  });

  it("restores filters from sessionStorage when URL search parameters are empty on F5/navigation", async () => {
    // SessionStorage has saved filters
    sessionStorage.setItem(
      "admin_orders_filters",
      JSON.stringify({
        branchId: "1",
        status: "Chờ xác nhận",
        type: "POS",
        page: 3,
      })
    );

    // URL has empty search
    currentSearch = {};

    await act(async () => {
      root?.render(<OrdersPage />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Should call navigate to sync URL with restored filters
    expect(mockNavigate).toHaveBeenCalled();
    const calls = mockNavigate.mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.to).toBe("/admin/don-hang");
    const computedSearch = typeof lastCall.search === "function" ? lastCall.search({}) : lastCall.search;
    expect(computedSearch.branchId).toBe("1");
    expect(computedSearch.status).toBe("Chờ xác nhận");
    expect(computedSearch.type).toBe("POS");
    expect(computedSearch.page).toBe(3);
  });
});
