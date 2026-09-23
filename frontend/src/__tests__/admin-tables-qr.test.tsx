import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();
let mockSearch: Record<string, any> = {};

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: any) => ({
    ...config,
    useSearch: () => mockSearch,
  }),
  useNavigate: () => mockNavigate,
}));

vi.mock("@/lib/api", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

import { TablesPage } from "@/routes/admin.vi-tri";
import * as api from "@/lib/api";

const reactTestGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };

describe("Admin Tables & QR Management Suite", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
    mockSearch = {};
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

  it("disables Xem, Tải xuống, In QR buttons and renders 'Chưa tạo QR' badge when table lacks QR token", async () => {
    vi.mocked(api.apiGet).mockImplementation(async (url: string) => {
      if (url.startsWith("/admin/tables")) {
        return {
          items: [
            {
              id: 1,
              store_id: 1,
              store_name: "Chi nhánh 1",
              name: "Bàn 1",
              is_active: true,
              has_checkout_qr: false,
              qr_checkout_token: undefined,
            },
          ],
          pagination: { totalPages: 1, totalItems: 1 },
        };
      }
      if (url.startsWith("/admin/branches")) {
        return [{ id: 1, name: "Chi nhánh 1" }];
      }
      return [];
    });

    await act(async () => {
      root?.render(<TablesPage />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    // Verify "Chưa tạo QR" badge is shown
    expect(container.textContent).toContain("Chưa tạo QR");
    expect(container.textContent).not.toContain("Đang hoạt động");

    // Verify view, download, print buttons are disabled
    const viewBtn = container.querySelector('button[aria-label="Xem mã QR Bàn 1"]') as HTMLButtonElement;
    const downloadBtn = container.querySelector('button[aria-label="Tải mã QR Bàn 1"]') as HTMLButtonElement;
    const printBtn = container.querySelector('button[aria-label="In mã QR Bàn 1"]') as HTMLButtonElement;

    expect(viewBtn).not.toBeNull();
    expect(viewBtn.disabled).toBe(true);

    expect(downloadBtn).not.toBeNull();
    expect(downloadBtn.disabled).toBe(true);

    expect(printBtn).not.toBeNull();
    expect(printBtn.disabled).toBe(true);

    // Edit and Delete buttons should still be enabled
    const editBtn = container.querySelector('button[aria-label="Sửa Bàn 1"]') as HTMLButtonElement;
    const deleteBtn = container.querySelector('button[aria-label="Xóa Bàn 1"]') as HTMLButtonElement;
    expect(editBtn.disabled).toBe(false);
    expect(deleteBtn.disabled).toBe(false);
  });

  it("enables Xem, Tải xuống, In QR buttons and renders 'Đang hoạt động' badge when table has QR token", async () => {
    vi.mocked(api.apiGet).mockImplementation(async (url: string) => {
      if (url.startsWith("/admin/tables")) {
        return {
          items: [
            {
              id: 2,
              store_id: 1,
              store_name: "Chi nhánh 1",
              name: "Bàn 2",
              is_active: true,
              has_checkout_qr: true,
              qr_checkout_token: "test_token_xyz_12345678901234567890",
            },
          ],
          pagination: { totalPages: 1, totalItems: 1 },
        };
      }
      if (url.startsWith("/admin/branches")) {
        return [{ id: 1, name: "Chi nhánh 1" }];
      }
      return [];
    });

    await act(async () => {
      root?.render(<TablesPage />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    // Badge should be "Đang hoạt động"
    expect(container.textContent).toContain("Đang hoạt động");
    expect(container.textContent).not.toContain("Chưa tạo QR");

    // Buttons should be enabled
    const viewBtn = container.querySelector('button[aria-label="Xem mã QR Bàn 2"]') as HTMLButtonElement;
    const downloadBtn = container.querySelector('button[aria-label="Tải mã QR Bàn 2"]') as HTMLButtonElement;
    const printBtn = container.querySelector('button[aria-label="In mã QR Bàn 2"]') as HTMLButtonElement;

    expect(viewBtn).not.toBeNull();
    expect(viewBtn.disabled).toBe(false);

    expect(downloadBtn).not.toBeNull();
    expect(downloadBtn.disabled).toBe(false);

    expect(printBtn).not.toBeNull();
    expect(printBtn.disabled).toBe(false);

    // Clicking "Xem mã QR" should open dialog
    await act(async () => {
      viewBtn.click();
    });

    // Check dialog title exists in DOM
    const dialogTitle = document.querySelector('[role="dialog"]');
    expect(dialogTitle).not.toBeNull();
    expect(dialogTitle?.textContent).toContain("Mã QR - Bàn 2");
  });

  it("sorts tables in ascending order by natural table number (Bàn 1 -> Bàn 2 -> Bàn 3) even if returned reversed", async () => {
    // API returns tables in reversed order: Bàn 3, Bàn 2, Bàn 1
    vi.mocked(api.apiGet).mockImplementation(async (url: string) => {
      if (url.startsWith("/admin/tables")) {
        return {
          items: [
            { id: 3, store_id: 1, store_name: "TeaPlus Bình Thạnh", name: "Bàn 3", is_active: true, has_checkout_qr: true, qr_checkout_token: "tok3" },
            { id: 2, store_id: 1, store_name: "TeaPlus Bình Thạnh", name: "Bàn 2", is_active: true, has_checkout_qr: true, qr_checkout_token: "tok2" },
            { id: 1, store_id: 1, store_name: "TeaPlus Bình Thạnh", name: "Bàn 1", is_active: true, has_checkout_qr: true, qr_checkout_token: "tok1" },
          ],
          pagination: { totalPages: 1, totalItems: 3 },
        };
      }
      if (url.startsWith("/admin/branches")) {
        return [{ id: 1, name: "TeaPlus Bình Thạnh" }];
      }
      return [];
    });

    await act(async () => {
      root?.render(<TablesPage />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    // Verify DOM order of table titles: Bàn 1 must appear before Bàn 2, and Bàn 2 before Bàn 3
    const cardTitles = Array.from(container.querySelectorAll(".font-display.font-bold"))
      .map((el) => el.textContent?.trim())
      .filter((t) => t && t.startsWith("Bàn"));

    expect(cardTitles).toEqual(["Bàn 1", "Bàn 2", "Bàn 3"]);
  });

  it("groups tables by branch with distinct section headers and table count badges", async () => {
    vi.mocked(api.apiGet).mockImplementation(async (url: string) => {
      if (url.startsWith("/admin/tables")) {
        return {
          items: [
            { id: 1, store_id: 1, store_name: "Chi nhánh Quận 1", name: "Bàn 1", is_active: true, has_checkout_qr: true, qr_checkout_token: "tok1" },
            { id: 2, store_id: 1, store_name: "Chi nhánh Quận 1", name: "Bàn 2", is_active: true, has_checkout_qr: true, qr_checkout_token: "tok2" },
            { id: 3, store_id: 2, store_name: "Chi nhánh Bình Thạnh", name: "Bàn 1", is_active: true, has_checkout_qr: true, qr_checkout_token: "tok3" },
          ],
          pagination: { totalPages: 1, totalItems: 3 },
        };
      }
      if (url.startsWith("/admin/branches")) {
        return [
          { id: 1, name: "Chi nhánh Quận 1" },
          { id: 2, name: "Chi nhánh Bình Thạnh" },
        ];
      }
      return [];
    });

    await act(async () => {
      root?.render(<TablesPage />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    // Check section headers
    const sectionHeaders = Array.from(container.querySelectorAll("h2.font-display.font-bold"))
      .map((el) => el.textContent?.trim());

    expect(sectionHeaders).toContain("Chi nhánh Quận 1");
    expect(sectionHeaders).toContain("Chi nhánh Bình Thạnh");

    // Check table count badges in headers
    expect(container.textContent).toContain("2 bàn");
    expect(container.textContent).toContain("1 bàn");
  });
});
