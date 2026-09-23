import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: any) => ({
    ...config,
    useSearch: () => ({}),
  }),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: window.location.pathname, search: window.location.search }),
}));

vi.mock("@/lib/api", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  fetchCatalogCategories: vi.fn(),
  fetchProductTypes: vi.fn(),
  fetchCatalogProducts: vi.fn(),
  fetchSchemaDetails: vi.fn(),
  createCatalogCategory: vi.fn(),
  createCatalogIndustry: vi.fn(),
  updateCatalogCategory: vi.fn(),
  archiveCatalogCategory: vi.fn(),
  createCatalogProduct: vi.fn(),
  updateCatalogProduct: vi.fn(),
  getUser: () => ({ id: 1, name: "Super Admin", role: "super" }),
}));

import { AdminCatalogPage } from "@/routes/admin.catalog";
import * as api from "@/lib/api";

const reactTestGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };

describe("Admin Catalog F5 Root Category Persistence Suite", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
    window.history.pushState({}, "", "/admin/catalog/packing");
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

  it("preserves selected root category from sessionStorage on F5 and does not reset to first root category", async () => {
    // Set sessionStorage as if user previously selected "Quần Áo QA" (id: 202)
    sessionStorage.setItem("admin_catalog_root_packing", "202");

    // Mock API returning two root categories
    vi.mocked(api.fetchCatalogCategories).mockResolvedValue([
      {
        id: 101,
        name: "Hàng đóng gói QA",
        parent_id: null,
        default_fulfillment_lane: "packing",
        is_active: true,
        sort_order: 1,
        children: [],
      } as any,
      {
        id: 202,
        name: "Quần Áo QA",
        parent_id: null,
        default_fulfillment_lane: "packing",
        is_active: true,
        sort_order: 2,
        children: [],
      } as any,
    ]);
    vi.mocked(api.fetchProductTypes).mockResolvedValue([
      { id: 1, code: "retail_goods", name: "Đóng gói", default_fulfillment_lane: "packing", options_schema: [] } as any,
    ]);
    vi.mocked(api.fetchCatalogProducts).mockResolvedValue([]);

    await act(async () => {
      root?.render(<AdminCatalogPage lane="packing" />);
    });

    // Wait for async loads
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    // Verify sessionStorage retains 202
    expect(sessionStorage.getItem("admin_catalog_root_packing")).toBe("202");

    // The navigate call to sync URL should have been called with rootId: '202'
    expect(mockNavigate).toHaveBeenCalled();
    const lastCall = mockNavigate.mock.calls[mockNavigate.mock.calls.length - 1][0];
    const computedSearch = typeof lastCall.search === "function" ? lastCall.search({}) : lastCall.search;
    expect(computedSearch?.rootId).toBe("202");
  });

  it("preserves selected root category from URL rootId param across reloads", async () => {
    // Set URL search containing rootId=202 via history API
    window.history.pushState({}, "", "/admin/catalog/packing?rootId=202");

    vi.mocked(api.fetchCatalogCategories).mockResolvedValue([
      {
        id: 101,
        name: "Hàng đóng gói QA",
        parent_id: null,
        default_fulfillment_lane: "packing",
        is_active: true,
        sort_order: 1,
        children: [],
      } as any,
      {
        id: 202,
        name: "Quần Áo QA",
        parent_id: null,
        default_fulfillment_lane: "packing",
        is_active: true,
        sort_order: 2,
        children: [],
      } as any,
    ]);
    vi.mocked(api.fetchProductTypes).mockResolvedValue([
      { id: 1, code: "retail_goods", name: "Đóng gói", default_fulfillment_lane: "packing", options_schema: [] } as any,
    ]);
    vi.mocked(api.fetchCatalogProducts).mockResolvedValue([]);

    await act(async () => {
      root?.render(<AdminCatalogPage lane="packing" />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(sessionStorage.getItem("admin_catalog_root_packing")).toBe("202");
  });
});
