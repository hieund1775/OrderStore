import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  buildWishlistQuickCartItem,
  createOptimisticWishlistItem,
  customerWishlistKey,
  ensureUserWishlist,
  hasPendingWishlistMutation,
  normalizeWishlistProductId,
  restoreWishlistMembership,
  type WishlistDeleteResponse,
  type WishlistEnsureResponse,
  type WishlistItem,
} from "../wishlist";
import { handleLocalMock } from "../mock-engine";

function authenticateMockCustomer(userId: number) {
  window.localStorage.setItem("teaplus_customer_token", `token-${userId}`);
  window.localStorage.setItem("teaplus_customer_user", JSON.stringify({ id: userId }));
}

function item(productId: number): WishlistItem {
  return {
    id: productId,
    user_id: 10,
    product_id: productId,
    product_name: `Món ${productId}`,
    product_slug: `mon-${productId}`,
    base_tea: "Trà lài",
    price: 45000,
    image_url: null,
    created_at: "2026-08-24T00:00:00.000Z",
  };
}

describe("wishlist cache helpers and API contract", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("isolates query keys and accepts only positive numeric product IDs", () => {
    expect(customerWishlistKey(10)).toEqual(["customer-wishlist", 10]);
    expect(customerWishlistKey(10)).not.toEqual(customerWishlistKey(11));
    expect(normalizeWishlistProductId("2")).toBe(2);
    expect(normalizeWishlistProductId("tra-dao")).toBeNull();
    expect(normalizeWishlistProductId(0)).toBeNull();
  });

  it("uses the mounted /api wishlist path", async () => {
    authenticateMockCustomer(10);
    const responseBody: WishlistEnsureResponse = {
      present: true,
      created: false,
      item: item(2),
      message: "Món đã có trong danh sách yêu thích",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await ensureUserWishlist(10, 2);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/users/10/wishlist/2");
  });

  it("restores only target membership and preserves unrelated concurrent cache changes", () => {
    const unrelatedNewItem = item(3);
    const failedOptimisticItem = item(1);
    const currentAfterAnotherMutation = [unrelatedNewItem, failedOptimisticItem];

    expect(restoreWishlistMembership(currentAfterAnotherMutation, 1, null)).toEqual([
      unrelatedNewItem,
    ]);

    const previouslyRemovedItem = item(2);
    expect(restoreWishlistMembership([unrelatedNewItem], 2, previouslyRemovedItem)).toEqual([
      previouslyRemovedItem,
      unrelatedNewItem,
    ]);
  });

  it("detects a pending product mutation synchronously from the shared mutation cache", async () => {
    const queryClient = new QueryClient();
    let resolveMutation!: (value: unknown) => void;
    const mutationGate = new Promise((resolve) => {
      resolveMutation = resolve;
    });
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationKey: ["customer-wishlist-mutation", 10],
      mutationFn: () => mutationGate,
    });
    const execution = mutation.execute({ userId: 10, productId: 2 });

    expect(hasPendingWishlistMutation(queryClient, 10, 2)).toBe(true);
    expect(hasPendingWishlistMutation(queryClient, 10, 3)).toBe(false);

    resolveMutation({});
    await execution;
    expect(hasPendingWishlistMutation(queryClient, 10, 2)).toBe(false);
  });

  it("builds optimistic and quick-cart items without fabricated base or price fallbacks", () => {
    const optimistic = createOptimisticWishlistItem(10, {
      id: "2",
      name: "Trà Dâu",
      slug: "tra-dau",
      base: "Trà lài",
      price: 55000,
      image: "",
    });
    expect(optimistic?.id).toBe(-2);
    expect(buildWishlistQuickCartItem(optimistic as WishlistItem)).toMatchObject({
      productId: "2",
      name: "Trà Dâu",
      base: "Trà lài",
      size: "M",
      sugar: "100%",
      ice: "100%",
      toppings: [],
      unitPrice: 55000,
      qty: 1,
    });

    expect(buildWishlistQuickCartItem({ ...item(2), base_tea: "" })).toBeNull();
    expect(buildWishlistQuickCartItem({ ...item(2), price: Number.NaN })).toBeNull();
  });
});

describe("wishlist mock-engine production parity", () => {
  beforeEach(() => window.localStorage.clear());

  it("requires matching customer identity and isolates account state", async () => {
    await expect(handleLocalMock("/api/users/10/wishlist")).rejects.toThrow("Thiếu token");

    authenticateMockCustomer(10);
    const add10 = await handleLocalMock<WishlistEnsureResponse>("/api/users/10/wishlist/1", {
      method: "PUT",
      body: "{}",
    });
    expect(add10.created).toBe(true);

    await expect(handleLocalMock("/api/users/11/wishlist")).rejects.toThrow("Không có quyền");
    authenticateMockCustomer(11);
    const add11 = await handleLocalMock<WishlistEnsureResponse>("/api/users/11/wishlist/2", {
      method: "PUT",
      body: "{}",
    });
    expect(add11.created).toBe(true);

    authenticateMockCustomer(10);
    const list10 = await handleLocalMock<WishlistItem[]>("/api/users/10/wishlist");
    authenticateMockCustomer(11);
    const list11 = await handleLocalMock<WishlistItem[]>("/api/users/11/wishlist");
    expect(list10.map((entry) => entry.product_id)).toEqual([1]);
    expect(list11.map((entry) => entry.product_id)).toEqual([2]);
  });

  it("supports idempotent PUT and DELETE", async () => {
    authenticateMockCustomer(10);
    const firstPut = await handleLocalMock<WishlistEnsureResponse>("/api/users/10/wishlist/3", {
      method: "PUT",
      body: "{}",
    });
    const secondPut = await handleLocalMock<WishlistEnsureResponse>("/api/users/10/wishlist/3", {
      method: "PUT",
      body: "{}",
    });
    expect(firstPut.created).toBe(true);
    expect(secondPut.created).toBe(false);

    const firstDelete = await handleLocalMock<WishlistDeleteResponse>("/api/users/10/wishlist/3", {
      method: "DELETE",
    });
    const secondDelete = await handleLocalMock<WishlistDeleteResponse>("/api/users/10/wishlist/3", {
      method: "DELETE",
    });
    expect(firstDelete.removed).toBe(true);
    expect(secondDelete.removed).toBe(false);
  });

  it("cleans affected mock wishlists and keeps availability updates idempotent", async () => {
    authenticateMockCustomer(10);
    await handleLocalMock("/api/users/10/wishlist/1", { method: "PUT", body: "{}" });
    authenticateMockCustomer(11);
    await handleLocalMock("/api/users/11/wishlist/1", { method: "PUT", body: "{}" });

    const firstDisable = await handleLocalMock<{
      changed: boolean;
      removed_wishlist_count: number;
      notification_count: number;
    }>("/admin/menu/products/1/availability", {
      method: "PUT",
      body: JSON.stringify({ is_available: false }),
    });
    expect(firstDisable).toMatchObject({
      changed: true,
      removed_wishlist_count: 2,
      notification_count: 2,
    });

    const repeatedDisable = await handleLocalMock<{
      changed: boolean;
      removed_wishlist_count: number;
    }>("/admin/menu/products/1/availability", {
      method: "PUT",
      body: JSON.stringify({ is_available: false }),
    });
    expect(repeatedDisable).toMatchObject({ changed: false, removed_wishlist_count: 0 });

    authenticateMockCustomer(10);
    expect(await handleLocalMock<WishlistItem[]>("/api/users/10/wishlist")).toEqual([]);
    const notifications = await handleLocalMock<{
      notifications: Array<{ type: string; title: string }>;
    }>("/api/users/10/notifications");
    expect(notifications.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "system",
          title: "Món yêu thích tạm ngưng phục vụ",
        }),
      ]),
    );
    await expect(
      handleLocalMock("/api/users/10/wishlist/1", { method: "PUT", body: "{}" }),
    ).rejects.toThrow("tạm ngưng");

    const publicCatalog = await handleLocalMock<Array<{ id: number }>>("/api/products");
    expect(publicCatalog.some((product) => product.id === 1)).toBe(false);
    const adminCatalog =
      await handleLocalMock<Array<{ id: number; is_available: boolean }>>("/admin/menu/products");
    expect(adminCatalog.find((product) => product.id === 1)?.is_available).toBe(false);

    const enable = await handleLocalMock<{ changed: boolean }>(
      "/admin/menu/products/1/availability",
      {
        method: "PUT",
        body: JSON.stringify({ is_available: true }),
      },
    );
    expect(enable.changed).toBe(true);
    expect(
      (await handleLocalMock<Array<{ id: number }>>("/api/products")).some(
        (product) => product.id === 1,
      ),
    ).toBe(true);
    expect(await handleLocalMock<WishlistItem[]>("/api/users/10/wishlist")).toEqual([]);
  });
});
