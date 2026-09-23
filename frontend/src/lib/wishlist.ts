import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { ApiError, apiDelete, apiGet, apiPut, clearCustomerToken } from "./api";
import { useCustomerIdentity } from "./notifications";
import { getCustomerSession, openCustomerLoginModal } from "./customer-session";
import type { CartItem } from "./cart";
import type { Product } from "./data";

export type WishlistItem = {
  id: number;
  user_id: number;
  product_id: number;
  product_name: string;
  product_slug: string;
  base_tea: string;
  price: number | null;
  image_url: string | null;
  is_available?: boolean;
  has_options?: boolean;
  sku?: string | null;
  variant_id?: number | null;
  variant_name?: string | null;
  fulfillment_lane?: 'kitchen' | 'packing' | null;
  stock_mode?: 'tracked' | 'made_to_order' | null;
  created_at: string;
};

export type WishlistEnsureResponse = {
  present: true;
  created: boolean;
  item: WishlistItem;
  message: string;
};

export type WishlistDeleteResponse = {
  present: false;
  removed: boolean;
  message: string;
};

export type ProductSnapshot = Pick<Product, "id" | "name" | "slug" | "base" | "price" | "image">;

type WishlistMutationVariables = {
  userId: number;
  productId: number;
  product?: ProductSnapshot;
  storeId?: number | string | null;
};

export function customerWishlistKey(userId: number, storeId?: number | string | null) {
  return storeId ? (["customer-wishlist", userId, String(storeId)] as const) : (["customer-wishlist", userId] as const);
}

export function customerWishlistMutationKey(userId: number) {
  return ["customer-wishlist-mutation", userId] as const;
}

export function normalizeWishlistProductId(value: string | number): number | null {
  const productId = Number(value);
  return Number.isInteger(productId) && productId > 0 ? productId : null;
}

export function removeWishlistProduct(items: WishlistItem[], productId: number): WishlistItem[] {
  return items.filter((item) => Number(item.product_id) !== productId);
}

export function upsertWishlistProduct(items: WishlistItem[], item: WishlistItem): WishlistItem[] {
  return [item, ...removeWishlistProduct(items, Number(item.product_id))];
}

export function restoreWishlistMembership(
  currentItems: WishlistItem[],
  productId: number,
  previousItem: WishlistItem | null,
): WishlistItem[] {
  return previousItem
    ? upsertWishlistProduct(currentItems, previousItem)
    : removeWishlistProduct(currentItems, productId);
}

export function createOptimisticWishlistItem(
  userId: number,
  product: ProductSnapshot,
  createdAt = new Date().toISOString(),
): WishlistItem | null {
  const productId = normalizeWishlistProductId(product.id);
  const name = product.name?.trim();
  const slug = product.slug?.trim();
  const baseTea = product.base?.trim();
  const price = Number(product.price);
  if (!productId || !name || !slug || !baseTea || !Number.isFinite(price) || price < 0) return null;

  return {
    id: -productId,
    user_id: userId,
    product_id: productId,
    product_name: name,
    product_slug: slug,
    base_tea: baseTea,
    price,
    image_url: product.image || null,
    is_available: true,
    has_options: undefined,
    sku: null,
    variant_id: null,
    variant_name: null,
    fulfillment_lane: undefined,
    stock_mode: undefined,
    created_at: createdAt,
  };
}

export function buildWishlistQuickCartItem(
  item: WishlistItem,
  storeInfo?: { id?: number | string; name?: string; district?: string } | null,
  resolvedVariant?: {
    sku?: string | null;
    variantId?: number | null;
    variantName?: string | null;
    price?: number | null;
    fulfillmentLane?: 'kitchen' | 'packing';
    stockMode?: 'tracked' | 'made_to_order';
  } | null,
): Omit<CartItem, "key"> | null {
  const productId = normalizeWishlistProductId(item.product_id);
  const name = item.product_name?.trim();
  const baseTea = item.base_tea?.trim();
  const rawPrice = resolvedVariant?.price ?? item.price;
  const price = Number(rawPrice);
  if (!productId || !name || !baseTea || !Number.isFinite(price) || price <= 0) return null;
  if (item.is_available !== true) return null;

  // Strict store check: must have valid storeId
  const rawStoreId = storeInfo?.id;
  if (!rawStoreId) return null;

  // Strict SKU and variantId check: must have valid sku and variantId
  const sku = resolvedVariant?.sku || item.sku;
  const variantId = resolvedVariant?.variantId ?? item.variant_id;
  if (!sku || !variantId || !Number.isInteger(Number(variantId)) || Number(variantId) <= 0) return null;

  // Strict fulfillmentLane and stockMode check: no fabricated fallback
  const fulfillmentLane = resolvedVariant?.fulfillmentLane || item.fulfillment_lane;
  const stockMode = resolvedVariant?.stockMode || item.stock_mode;
  if (!fulfillmentLane || !stockMode) return null;

  const variantName = resolvedVariant?.variantName ?? item.variant_name ?? undefined;
  const size = variantName ? (variantName.toLowerCase().startsWith('size ') ? variantName.slice(5) : variantName) : undefined;

  return {
    storeId: String(rawStoreId),
    storeName: storeInfo?.name,
    storeDistrict: storeInfo?.district,
    productId: String(productId),
    productSlug: item.product_slug?.trim() || String(productId),
    name,
    image: item.image_url || "",
    size,
    base: baseTea || undefined,
    sugar: undefined,
    ice: undefined,
    toppings: [],
    unitPrice: price,
    qty: 1,
    sku,
    variantId: Number(variantId),
    variantName: variantName || undefined,
    fulfillmentLane,
    stockMode,
  };
}

export async function fetchUserWishlist(
  userId: number,
  storeId?: number | string | null,
): Promise<WishlistItem[]> {
  const query = storeId ? `?store_id=${encodeURIComponent(String(storeId))}` : '';
  const res = await apiGet<WishlistItem[]>(`/api/users/${userId}/wishlist${query}`);
  const currentSession = getCustomerSession();
  if (currentSession && currentSession.userId !== userId) {
    return [];
  }
  return res;
}

export async function ensureUserWishlist(
  userId: number,
  productId: number,
  storeId?: number | string | null,
): Promise<WishlistEnsureResponse> {
  const query = storeId ? `?store_id=${encodeURIComponent(String(storeId))}` : '';
  return apiPut<WishlistEnsureResponse>(`/api/users/${userId}/wishlist/${productId}${query}`, {});
}

export async function removeUserWishlist(
  userId: number,
  productId: number,
): Promise<WishlistDeleteResponse> {
  return apiDelete<WishlistDeleteResponse>(`/api/users/${userId}/wishlist/${productId}`);
}

function isUnauthorized(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 401;
}

export function hasPendingWishlistMutation(
  queryClient: QueryClient,
  userId: number,
  productId: number,
): boolean {
  return queryClient
    .getMutationCache()
    .findAll({ mutationKey: customerWishlistMutationKey(userId), status: "pending" })
    .some((mutation) => {
      const variables = mutation.state.variables as WishlistMutationVariables | undefined;
      return variables?.userId === userId && variables.productId === productId;
    });
}

export function useWishlist(storeId?: number | string | null) {
  const queryClient = useQueryClient();
  const { token, user } = useCustomerIdentity();
  const userId = Number(user?.id) || null;
  const previousUserId = useRef<number | null>(null);

  useEffect(() => {
    const previous = previousUserId.current;
    if (previous && previous !== userId) {
      void queryClient.cancelQueries({ queryKey: ["customer-wishlist", previous] });
      queryClient.removeQueries({ queryKey: ["customer-wishlist", previous] });
    }
    if (!userId) {
      void queryClient.cancelQueries({ queryKey: ["customer-wishlist", "signed-out"] });
      queryClient.removeQueries({ queryKey: ["customer-wishlist", "signed-out"] });
    }
    previousUserId.current = userId;
  }, [queryClient, userId]);

  const hasValidStore = Boolean(storeId && Number.isInteger(Number(storeId)) && Number(storeId) > 0);

  const queryKey = userId
    ? customerWishlistKey(userId, storeId)
    : (["customer-wishlist", "signed-out", storeId ? String(storeId) : "no-store"] as const);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchUserWishlist(userId as number, storeId),
    enabled: Boolean(token && userId && hasValidStore),
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 10_000,
    retry: (failureCount, error) =>
      !(error instanceof ApiError && [401, 403].includes(error.status)) && failureCount < 2,
  });

  useEffect(() => {
    if (isUnauthorized(query.error)) clearCustomerToken();
  }, [query.error]);

  const mutationKey = userId
    ? customerWishlistMutationKey(userId)
    : (["customer-wishlist-mutation", "signed-out"] as const);
  const pendingMutations = useMutationState<WishlistMutationVariables | null>({
    filters: { mutationKey, status: "pending" },
    select: (mutation) =>
      (mutation.state.variables as WishlistMutationVariables | undefined) ?? null,
  });

  const addMutation = useMutation({
    mutationKey,
    mutationFn: ({ userId: mutationUserId, productId }: WishlistMutationVariables) =>
      ensureUserWishlist(mutationUserId, productId, storeId),
    onMutate: async (variables) => {
      const key = customerWishlistKey(variables.userId, storeId);
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const currentItems = queryClient.getQueryData<WishlistItem[]>(key) ?? [];
      const previousItem =
        currentItems.find((item) => Number(item.product_id) === variables.productId) ?? null;
      const optimisticItem = variables.product
        ? createOptimisticWishlistItem(variables.userId, variables.product)
        : null;
      if (optimisticItem)
        queryClient.setQueryData<WishlistItem[]>(
          key,
          upsertWishlistProduct(currentItems, optimisticItem),
        );
      return { previousItem };
    },
    onError: (error, variables, context) => {
      const key = customerWishlistKey(variables.userId, storeId);
      const currentItems = queryClient.getQueryData<WishlistItem[]>(key) ?? [];
      queryClient.setQueryData<WishlistItem[]>(
        key,
        restoreWishlistMembership(currentItems, variables.productId, context?.previousItem ?? null),
      );
      if (isUnauthorized(error)) clearCustomerToken();
      toast.error(
        isUnauthorized(error)
          ? "Phiên đăng nhập đã hết hạn"
          : error instanceof Error
            ? error.message
            : "Không thể lưu món yêu thích lúc này",
      );
    },
    onSuccess: (data, variables) => {
      const key = customerWishlistKey(variables.userId, storeId);
      const currentItems = queryClient.getQueryData<WishlistItem[]>(key) ?? [];
      queryClient.setQueryData<WishlistItem[]>(key, upsertWishlistProduct(currentItems, data.item));
      if (data.created) toast.success(data.message || "Đã thêm vào danh sách yêu thích");
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["customer-wishlist", variables.userId],
      });
    },
  });

  const removeMutation = useMutation({
    mutationKey,
    mutationFn: ({ userId: mutationUserId, productId }: WishlistMutationVariables) =>
      removeUserWishlist(mutationUserId, productId),
    onMutate: async (variables) => {
      const key = customerWishlistKey(variables.userId, storeId);
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const currentItems = queryClient.getQueryData<WishlistItem[]>(key) ?? [];
      const previousItem =
        currentItems.find((item) => Number(item.product_id) === variables.productId) ?? null;
      queryClient.setQueryData<WishlistItem[]>(
        key,
        removeWishlistProduct(currentItems, variables.productId),
      );
      return { previousItem };
    },
    onError: (error, variables, context) => {
      const key = customerWishlistKey(variables.userId, storeId);
      const currentItems = queryClient.getQueryData<WishlistItem[]>(key) ?? [];
      queryClient.setQueryData<WishlistItem[]>(
        key,
        restoreWishlistMembership(currentItems, variables.productId, context?.previousItem ?? null),
      );
      if (isUnauthorized(error)) clearCustomerToken();
      toast.error(
        isUnauthorized(error)
          ? "Phiên đăng nhập đã hết hạn"
          : error instanceof Error
            ? error.message
            : "Không thể xóa món khỏi danh sách yêu thích lúc này",
      );
    },
    onSuccess: (data) => {
      if (data.removed) toast.success(data.message || "Đã xóa khỏi danh sách yêu thích");
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["customer-wishlist", variables.userId],
      });
    },
  });

  const isGuest = !token || !userId;
  const items = isGuest ? [] : (query.data ?? []);
  const isFavorite = (productId: string | number): boolean => {
    if (isGuest) return false;
    const normalizedId = normalizeWishlistProductId(productId);
    return normalizedId !== null && items.some((item) => Number(item.product_id) === normalizedId);
  };
  const isPending = (productId: string | number): boolean => {
    if (isGuest) return false;
    const normalizedId = normalizeWishlistProductId(productId);
    return (
      normalizedId !== null &&
      pendingMutations.some((variables) => variables?.productId === normalizedId)
    );
  };

  const setFavorite = (product: ProductSnapshot, desiredState: boolean) => {
    if (isGuest) {
      toast.error("Vui lòng đăng nhập để lưu món yêu thích");
      openCustomerLoginModal();
      return;
    }
    const productId = normalizeWishlistProductId(product.id);
    if (!productId) {
      toast.error("Mã sản phẩm không hợp lệ");
      return;
    }
    if (desiredState === isFavorite(productId)) return;
    if (hasPendingWishlistMutation(queryClient, userId, productId)) return;
    if (desiredState && !createOptimisticWishlistItem(userId, product)) {
      toast.error("Thông tin món chưa đầy đủ để lưu yêu thích");
      return;
    }

    const variables = { userId, productId, product };
    if (desiredState) addMutation.mutate(variables);
    else removeMutation.mutate(variables);
  };

  const removeFavorite = (productIdValue: string | number) => {
    if (isGuest) {
      toast.error("Vui lòng đăng nhập để thực hiện thao tác này");
      openCustomerLoginModal();
      return;
    }
    const productId = normalizeWishlistProductId(productIdValue);
    if (!productId || hasPendingWishlistMutation(queryClient, userId, productId)) return;
    removeMutation.mutate({ userId, productId });
  };

  return {
    items,
    count: items.length,
    isLoading: isGuest ? false : query.isLoading,
    isError: isGuest ? false : query.isError,
    error: isGuest ? null : query.error,
    refetch: query.refetch,
    isFavorite,
    isPending,
    setFavorite,
    removeFavorite,
    user: isGuest ? null : user,
  };
}
