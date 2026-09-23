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
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
  useRouterState: () => ({ location: { pathname: "/admin/cai-dat" } }),
}));

vi.mock("@/lib/api", () => ({
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  getUser: vi.fn(),
  getToken: vi.fn(),
}));

import { AdminAccessDenied } from "@/routes/admin";
import { OrdersPage } from "@/routes/admin.don-hang";
import { SettingsPage } from "@/routes/admin.cai-dat";
import { StoresAdminPage } from "@/routes/admin.chi-nhanh";
import * as api from "@/lib/api";

const reactTestGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };

describe("Admin Access Control Suite", () => {
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
          { id: 1, name: "TeaPlus Quận 1 - Nguyễn Huệ" },
          { id: 2, name: "TeaPlus Bình Thạnh - D2" },
          { id: 15, name: "Suối Tiên" },
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

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    container.remove();
  });

  it("renders AdminAccessDenied frame with 403 status and warning description", () => {
    act(() => {
      root?.render(<AdminAccessDenied />);
    });

    expect(container.textContent).toContain("403");
    expect(container.textContent).toContain("Bạn không có quyền truy cập vào trang này");
    expect(container.textContent).toContain("Về trang Đơn hàng");
  });

  it("blocks non-super manager on /admin/cai-dat and renders AdminAccessDenied", async () => {
    vi.mocked(api.getUser).mockReturnValue({
      id: 74,
      fullname: "QA Manager A",
      role: "manager",
      branch_id: 15,
      branch_name: "Suối Tiên",
    } as any);

    await act(async () => {
      root?.render(<SettingsPage />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("403");
    expect(container.textContent).toContain("Bạn không có quyền truy cập vào trang này");
    expect(container.textContent).not.toContain("Kênh Thanh Toán");
  });

  it("blocks non-super manager on /admin/chi-nhanh and renders AdminAccessDenied", async () => {
    vi.mocked(api.getUser).mockReturnValue({
      id: 75,
      fullname: "QA Manager B",
      role: "manager",
      branch_id: 2,
      branch_name: "TeaPlus Bình Thạnh - D2",
    } as any);

    await act(async () => {
      root?.render(<StoresAdminPage />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("403");
    expect(container.textContent).toContain("Bạn không có quyền truy cập vào trang này");
    expect(container.textContent).not.toContain("Thêm chi nhánh");
  });

  it("locks branch filter to assigned branch for manager in /admin/don-hang", async () => {
    vi.mocked(api.getUser).mockReturnValue({
      id: 74,
      fullname: "QA Manager A",
      role: "manager",
      branch_id: 15,
      branch_name: "Suối Tiên",
    } as any);

    await act(async () => {
      root?.render(<OrdersPage />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    // The assigned branch is displayed
    expect(container.textContent).toContain("Suối Tiên");
    // "Tất cả chi nhánh" is NOT an option for manager
    expect(container.textContent).not.toContain("Tất cả chi nhánh");

    // The select trigger for branch is disabled
    const selectTriggers = Array.from(container.querySelectorAll("button[role='combobox']"));
    const branchTrigger = selectTriggers.find((btn) => btn.textContent?.includes("Suối Tiên"));
    expect(branchTrigger).toBeDefined();
    expect(branchTrigger?.hasAttribute("disabled")).toBe(true);

    // Verify API was called with store_id = 15
    const orderCalls = vi.mocked(api.apiGet).mock.calls.filter((call) =>
      String(call[0]).startsWith("/admin/orders"),
    );
    expect(orderCalls.length).toBeGreaterThan(0);
    expect(orderCalls[0][0]).toContain("store_id=15");
  });

  it("allows super admin to view and change all branches in /admin/don-hang", async () => {
    vi.mocked(api.getUser).mockReturnValue({
      id: 73,
      fullname: "QA Super Admin",
      role: "super",
    } as any);

    await act(async () => {
      root?.render(<OrdersPage />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    // Super admin sees "Tất cả chi nhánh"
    expect(container.textContent).toContain("Tất cả chi nhánh");

    // The select trigger for branch is not disabled
    const selectTriggers = Array.from(container.querySelectorAll("button[role='combobox']"));
    const branchTrigger = selectTriggers.find((btn) => btn.textContent?.includes("Tất cả chi nhánh"));
    expect(branchTrigger).toBeDefined();
    expect(branchTrigger?.hasAttribute("disabled")).toBe(false);
  });
});
