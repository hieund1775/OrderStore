import { handleLocalMock } from './mock-engine';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOKEN_KEY = 'teaplus_admin_token';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem('admin_user');
}

export function getUser() {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem('admin_user');
  if (stored) {
    try { return JSON.parse(stored); } catch { return null; }
  }
  return null;
}

export function setUser(u: { id: number; fullname: string; phone: string; role: string; branch_id: number | null } | null) {
  if (u) {
    window.localStorage.setItem('admin_user', JSON.stringify(u));
  } else {
    window.localStorage.removeItem('admin_user');
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  const customerToken = typeof window !== 'undefined' ? getCustomerToken() : null;
  const adminToken = typeof window !== 'undefined' ? getToken() : null;
  const token = path.startsWith('/admin') ? adminToken : customerToken || adminToken;
  if (token) headers.Authorization = `Bearer ${token}`;

  const isStandalone = import.meta.env.VITE_STANDALONE === 'true';

  // Kích hoạt mode Standalone nếu được cấu hình VITE_STANDALONE=true
  if (isStandalone && typeof window !== 'undefined') {
    return handleLocalMock<T>(path, options);
  }

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      cache: options?.cache ?? 'no-store',
      headers,
    });
    const contentType = res.headers.get('content-type') || '';
    
    // Nếu server trả HTML thay vì JSON (sai URL / Vercel SPA routing)
    if (contentType.includes('text/html')) {
      if (isStandalone && typeof window !== 'undefined') {
        return handleLocalMock<T>(path, options);
      }
      throw new ApiError(res.status, `Phản hồi máy chủ không hợp lệ (${res.status} HTML)`, null);
    }

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      if (res.status === 401 && path.startsWith('/admin') && path !== '/admin/login' && typeof window !== "undefined") {
        clearToken();
        if (window.location.pathname !== "/admin/login") {
          window.location.href = "/admin/login";
        }
      }
      const message = data?.error || data?.message || `Lỗi ${res.status}`;
      throw new ApiError(res.status, message, data);
    }
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (isStandalone && typeof window !== 'undefined') {
      return handleLocalMock<T>(path, options);
    }
    throw new Error(err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ backend');
  }
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export const apiGet = <T>(path: string, options?: RequestInit) => apiFetch<T>(path, options);
export const apiPost = <T>(path: string, body: unknown, options?: RequestInit) =>
  apiFetch<T>(path, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body),
    headers: options?.headers,
  });

/** Create a client-side key for POST /api/orders idempotency. */
export function createIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `order-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
export const apiPatch = <T>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const apiPut = <T>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) });
export const apiDelete = <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' });

export async function login(phone: string, password: string) {
  const data = await apiPost<{ token: string; user: { id: number; fullname: string; phone: string; role: string; branch_id: number | null } }>('/admin/login', { phone, password });
  if (data.token) {
    setToken(data.token);
    setUser(data.user);
  }
  return data;
}

export function logout() {
  clearToken();
  if (typeof window !== 'undefined') {
    window.location.href = '/admin/login';
  }
}

// ─── Customer auth helpers ───
const CUSTOMER_TOKEN_KEY = 'teaplus_customer_token';
const CUSTOMER_USER_KEY = 'teaplus_customer_user';

export function getCustomerToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(CUSTOMER_TOKEN_KEY);
}

export function setCustomerToken(token: string) {
  window.localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('teaplus:customer-auth-changed'));
  }
}

export function clearCustomerToken() {
  window.localStorage.removeItem(CUSTOMER_TOKEN_KEY);
  window.localStorage.removeItem(CUSTOMER_USER_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('teaplus:customer-auth-changed'));
  }
}

export function getCustomerUser() {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(CUSTOMER_USER_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { return null; }
  }
  return null;
}

export function setCustomerUser(u: { id: number; fullname: string; phone: string; tier: string; points: number } | null) {
  if (u) {
    window.localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(u));
  } else {
    window.localStorage.removeItem(CUSTOMER_USER_KEY);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('teaplus:customer-auth-changed'));
  }
}

// ═══════════ CATALOG V2 ADMIN APIS ═══════════

export async function fetchCatalogCategories(options?: { includeArchived?: boolean }) {
  const query = options?.includeArchived ? '?include_archived=true' : '';
  return apiFetch<any[]>(`/admin/catalog/categories${query}`);
}

export async function createCatalogCategory(data: any) {
  return apiFetch<any>('/admin/catalog/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCatalogCategory(id: number | string, data: any) {
  return apiFetch<any>(`/admin/catalog/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function archiveCatalogCategory(id: number | string) {
  return apiFetch<any>(`/admin/catalog/categories/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchProductTypes() {
  return apiFetch<any[]>('/admin/catalog/product-types');
}

export async function createProductType(data: any) {
  return apiFetch<any>('/admin/catalog/product-types', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createProductTypeSchema(productTypeId: number | string) {
  return apiFetch<unknown>(`/admin/catalog/product-types/${productTypeId}/schemas`, {
    method: 'POST',
  });
}

export async function fetchSchemaDetails(schemaId: number | string) {
  return apiFetch<any>(`/admin/catalog/product-type-schemas/${schemaId}`);
}

export async function publishSchema(schemaId: number | string) {
  return apiFetch<any>(`/admin/catalog/product-type-schemas/${schemaId}/publish`, {
    method: 'POST',
  });
}

export async function addAttributeToSchema(schemaId: number | string, data: any) {
  return apiFetch<any>(`/admin/catalog/product-type-schemas/${schemaId}/attributes`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function addAttributeValue(attrDefId: number | string, data: any) {
  return apiFetch<any>(`/admin/catalog/attributes/${attrDefId}/values`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchCatalogProducts(params?: { category_id?: number | string; status?: string; search?: string }) {
  const q = new URLSearchParams();
  if (params?.category_id) q.set('category_id', String(params.category_id));
  if (params?.status) q.set('status', params.status);
  if (params?.search) q.set('search', params.search);
  const query = q.toString() ? `?${q.toString()}` : '';
  return apiFetch<any[]>(`/admin/catalog/products${query}`);
}

export async function fetchCatalogProductDetails(id: number | string) {
  return apiFetch<any>(`/admin/catalog/products/${id}`);
}

export async function createCatalogProduct(data: any) {
  return apiFetch<any>('/admin/catalog/products', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCatalogProduct(id: number | string, data: any) {
  return apiFetch<any>(`/admin/catalog/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function archiveCatalogProduct(id: number | string) {
  return apiFetch<any>(`/admin/catalog/products/${id}`, {
    method: 'DELETE',
  });
}

export async function previewVariants(data: { attributes: any[]; product_slug: string }) {
  return apiFetch<any[]>('/admin/catalog/products/preview-variants', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createVariant(productId: number | string, data: any) {
  return apiFetch<any>(`/admin/catalog/products/${productId}/variants`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ═══════════ BRANCH COMMERCE & INVENTORY APIS ═══════════

export async function fetchBranchOffers(params?: { store_id?: number | string; category_id?: number | string; is_available?: boolean; search?: string }) {
  const q = new URLSearchParams();
  if (params?.store_id) q.set('store_id', String(params.store_id));
  if (params?.category_id) q.set('category_id', String(params.category_id));
  if (params?.is_available !== undefined) q.set('is_available', String(params.is_available));
  if (params?.search) q.set('search', params.search);
  const query = q.toString() ? `?${q.toString()}` : '';
  return apiFetch<any[]>(`/admin/branch-offers${query}`);
}

export async function updateBranchOffer(variantId: number | string, data: { store_id?: number | string; price: number; compare_at_price?: number | null; is_available?: boolean }) {
  return apiFetch<any>(`/admin/branch-offers/${variantId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function batchSetBranchAvailability(data: { store_id?: number | string; variant_ids: number[]; is_available: boolean }) {
  return apiFetch<any[]>('/admin/branch-offers/batch-availability', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchVariantInventory(variantId: number | string, storeId?: number | string) {
  const query = storeId ? `?store_id=${storeId}` : '';
  return apiFetch<any>(`/admin/variant-inventory/${variantId}${query}`);
}

export async function adjustVariantStock(data: { store_id?: number | string; variant_id: number | string; movement_type?: string; quantity: number; reason: string; reference_type?: string; reference_id?: string }) {
  return apiFetch<any>('/admin/variant-inventory/adjust', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchInventoryMovements(params?: { store_id?: number | string; variant_id?: number | string; limit?: number; offset?: number }) {
  const q = new URLSearchParams();
  if (params?.store_id) q.set('store_id', String(params.store_id));
  if (params?.variant_id) q.set('variant_id', String(params.variant_id));
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.offset) q.set('offset', String(params.offset));
  const query = q.toString() ? `?${q.toString()}` : '';
  return apiFetch<any[]>(`/admin/variant-inventory/movements${query}`);
}

// ═══════════ PUBLIC CATALOG V2 APIS ═══════════

export type PublicCategoryNode = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  depth: number;
  sort_order: number;
  children?: PublicCategoryNode[];
};

export type PublicCatalogSection = {
  root_id: number;
  root_name: string;
  root_slug: string;
  total_products: number;
  children: Array<{ id: number; name: string; slug: string }>;
  products: PublicCatalogProduct[];
};

export type PublicCatalogProduct = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category_id: number;
  category_name?: string;
  category_slug?: string;
  fulfillment_lane?: string;
  stock_mode?: string;
  variants_count?: number;
  is_available?: boolean;
  available_stock?: number | null;
};

export type PublicCatalogProductsResponse = {
  products: PublicCatalogProduct[];
  total: number;
};

export async function fetchPublicCategoryTree(): Promise<PublicCategoryNode[]> {
  return apiFetch<PublicCategoryNode[]>('/catalog/categories/tree');
}

export async function fetchPublicCatalogSections(storeId: number | string, limitPerRoot = 12): Promise<{ sections: PublicCatalogSection[] }> {
  return apiFetch<{ sections: PublicCatalogSection[] }>(`/catalog/sections?store_id=${storeId}&limit_per_root=${limitPerRoot}`);
}

export async function fetchPublicProducts(params?: { store_id?: number | string; category?: string; search?: string; limit?: number; offset?: number }): Promise<PublicCatalogProductsResponse> {
  const q = new URLSearchParams();
  if (params?.store_id) q.set('store_id', String(params.store_id));
  if (params?.category) q.set('category', params.category);
  if (params?.search) q.set('search', params.search);
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.offset) q.set('offset', String(params.offset));
  const query = q.toString() ? `?${q.toString()}` : '';
  return apiFetch<PublicCatalogProductsResponse>(`/catalog/products${query}`);
}

export async function fetchPublicProductDetails(slug: string, storeId?: number | string) {
  const query = storeId ? `?store_id=${storeId}` : '';
  return apiFetch<any>(`/catalog/products/${slug}${query}`);
}

export async function resolveProductConfiguration(data: {
  store_id?: number | string;
  product_slug: string;
  variant_value_ids?: number[];
  modifier_value_ids?: number[];
}) {
  return apiFetch<any>('/catalog/resolve-configuration', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchBranchCapabilities(storeId: number | string): Promise<{ data: Array<{ lane_code: string; display_name: string; is_enabled: boolean }> }> {
  return apiFetch<{ data: Array<{ lane_code: string; display_name: string; is_enabled: boolean }> }>(`/branches/${storeId}/capabilities`);
}

export async function updateBranchCapability(
  storeId: number | string,
  data: { lane_code: string; is_enabled: boolean },
) {
  return apiFetch<any>(`/branches/${storeId}/capabilities`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
