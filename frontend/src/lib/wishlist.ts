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
import type { CartItem } from "./cart";
import type { Product } from "./data";

export type WishlistItem = {
  id: number;
  user_id: number;
  product_id: number;
  product_name: string;
  product_slug: string;
  base_tea: string;
  price: number;
  image_url: string | null;
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
};

export function customerWishlistKey(userId: number) {
  return ["customer-wishlist", userId] as const;
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
    created_at: createdAt,
  };
}

export function buildWishlistQuickCartItem(item: WishlistItem): Omit<CartItem, "key"> | null {
  const productId = normalizeWishlistProductId(item.product_id);
  const name = item.product_name?.trim();
  const baseTea = item.base_tea?.trim();
  const price = Number(item.price);
  if (!productId || !name || !baseTea || !Number.isFinite(price) || price < 0) return null;

  return {
    productId: String(productId),
    name,
    image: item.image_url || "",
    size: "M",
    base: baseTea,
    sugar: "100%",
    ice: "100%",
    toppings: [],
    unitPrice: price,
    qty: 1,
  };
}

export async function fetchUserWishlist(userId: number): Promise<WishlistItem[]> {
  return apiGet<WishlistItem[]>(`/api/users/${userId}/wishlist`);
}

export async function ensureUserWishlist(
  userId: number,
  productId: number,
): Promise<WishlistEnsureResponse> {
  return apiPut<WishlistEnsureResponse>(`/api/users/${userId}/wishlist/${productId}`, {});
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

export function useWishlist() {
  const queryClient = useQueryClient();
  const { token, user } = useCustomerIdentity();
  const userId = Number(user?.id) || null;
  const previousUserId = useRef<number | null>(null);

  useEffect(() => {
    const previous = previousUserId.current;
    if (previous && previous !== userId) {
      queryClient.removeQueries({ queryKey: customerWishlistKey(previous), exact: true });
    }
    previousUserId.current = userId;
  }, [queryClient, userId]);

  const query = useQuery({
    queryKey: userId ? customerWishlistKey(userId) : ["customer-wishlist", "signed-out"],
    queryFn: () => fetchUserWishlist(userId as number),
    enabled: Boolean(token && userId),
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
      ensureUserWishlist(mutationUserId, productId),
    onMutate: async (variables) => {
      const key = customerWishlistKey(variables.userId);
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
      const key = customerWishlistKey(variables.userId);
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
      const key = customerWishlistKey(variables.userId);
      const currentItems = queryClient.getQueryData<WishlistItem[]>(key) ?? [];
      queryClient.setQueryData<WishlistItem[]>(key, upsertWishlistProduct(currentItems, data.item));
      if (data.created) toast.success(data.message || "Đã thêm vào danh sách yêu thích");
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: customerWishlistKey(variables.userId),
        exact: true,
      });
    },
  });

  const removeMutation = useMutation({
    mutationKey,
    mutationFn: ({ userId: mutationUserId, productId }: WishlistMutationVariables) =>
      removeUserWishlist(mutationUserId, productId),
    onMutate: async (variables) => {
      const key = customerWishlistKey(variables.userId);
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
      const key = customerWishlistKey(variables.userId);
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
        queryKey: customerWishlistKey(variables.userId),
        exact: true,
      });
    },
  });

  const items = query.data ?? [];
  const isFavorite = (productId: string | number): boolean => {
    const normalizedId = normalizeWishlistProductId(productId);
    return normalizedId !== null && items.some((item) => Number(item.product_id) === normalizedId);
  };
  const isPending = (productId: string | number): boolean => {
    const normalizedId = normalizeWishlistProductId(productId);
    return (
      normalizedId !== null &&
      pendingMutations.some((variables) => variables?.productId === normalizedId)
    );
  };

  const setFavorite = (product: ProductSnapshot, desiredState: boolean) => {
    if (!token || !userId) {
      toast.error("Vui lòng đăng nhập để lưu món yêu thích");
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
    if (!token || !userId) {
      toast.error("Vui lòng đăng nhập để thực hiện thao tác này");
      return;
    }
    const productId = normalizeWishlistProductId(productIdValue);
    if (!productId || hasPendingWishlistMutation(queryClient, userId, productId)) return;
    removeMutation.mutate({ userId, productId });
  };

  return {
    items,
    count: items.length,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFavorite,
    isPending,
    setFavorite,
    removeFavorite,
    user,
  };
}
