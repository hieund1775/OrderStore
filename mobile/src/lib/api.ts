import axios, { AxiosError } from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Default development API host (10.0.2.2 for Android emulator, localhost for iOS)
const DEFAULT_HOST = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || `${DEFAULT_HOST}`;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Bearer token from SecureStore
apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // SecureStore unavailable
  }
  return config;
});

// Response interceptor: handle 401/403/network errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error?: string; message?: string }>) => {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      const message = data?.error || data?.message || `Lỗi ${status}`;

      // 401: clear session and force re-login
      if (status === 401) {
        try {
          await SecureStore.deleteItemAsync('auth_token');
        } catch { /* ignore */ }
      }

      return Promise.reject({ status, message, data });
    }

    // Network error or timeout
    const netMsg = error.message?.includes('timeout')
      ? 'Kết nối máy chủ bị timeout, vui lòng thử lại'
      : 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.';
    return Promise.reject({ status: 0, message: netMsg, data: null });
  }
);
/* Removed demo staff records: authentication is server-authoritative. */
/*

  '0909000001': { id: 1, fullname: 'Super Administrator', phone: '0909000001', email: 'superadmin@teaplus.vn', role: 'super', branch_id: null, branch_name: 'Toàn hệ thống' },
  '0900000001': { id: 1, fullname: 'Super Administrator', phone: '0900000001', email: 'superadmin@teaplus.vn', role: 'super', branch_id: null, branch_name: 'Toàn hệ thống' },
  '0909000002': { id: 2, fullname: 'Quản lý Chi nhánh 1', phone: '0909000002', email: 'manager1@teaplus.vn', role: 'manager', branch_id: 1, branch_name: 'TeaPlus Quận 1 - Nguyễn Huệ' },
  '0900000002': { id: 2, fullname: 'Quản lý Chi nhánh 1', phone: '0900000002', email: 'manager1@teaplus.vn', role: 'manager', branch_id: 1, branch_name: 'TeaPlus Quận 1 - Nguyễn Huệ' },
  '0909000003': { id: 3, fullname: 'Thu ngân Chi nhánh 1', phone: '0909000003', email: 'cashier1@teaplus.vn', role: 'cashier', branch_id: 1, branch_name: 'TeaPlus Quận 1 - Nguyễn Huệ' },
  '0900000003': { id: 3, fullname: 'Thu ngân Chi nhánh 1', phone: '0900000003', email: 'cashier1@teaplus.vn', role: 'cashier', branch_id: 1, branch_name: 'TeaPlus Quận 1 - Nguyễn Huệ' },
  '0909000004': { id: 4, fullname: 'Đầu bếp Chi nhánh 1', phone: '0909000004', email: 'kitchen1@teaplus.vn', role: 'kitchen', branch_id: 1, branch_name: 'TeaPlus Quận 1 - Nguyễn Huệ' },
  '0900000004': { id: 4, fullname: 'Đầu bếp Chi nhánh 1', phone: '0900000004', email: 'kitchen1@teaplus.vn', role: 'kitchen', branch_id: 1, branch_name: 'TeaPlus Quận 1 - Nguyễn Huệ' },
  '0909000006': { id: 6, fullname: 'Nhân viên Soạn hàng Chi nhánh 1', phone: '0909000006', email: 'packing1@teaplus.vn', role: 'packing', branch_id: 1, branch_name: 'TeaPlus Quận 1 - Nguyễn Huệ' },
  '0900000005': { id: 6, fullname: 'Nhân viên Soạn hàng Chi nhánh 1', phone: '0900000005', email: 'packing1@teaplus.vn', role: 'packing', branch_id: 1, branch_name: 'TeaPlus Quận 1 - Nguyễn Huệ' },
*/
/** Staff login */
export async function staffLogin(phone: string, password: string) {
  const { data } = await apiClient.post('/admin/login', { phone, password });
  return data;
}

/** Get current staff profile */
export async function fetchStaffProfile() {
  const { data } = await apiClient.get('/admin/me');
  return data;
}

/** Forgot password: send OTP */
export async function sendForgotPasswordOtp(email: string): Promise<{ success: boolean; message: string; dev_code?: string }> {
  const { data } = await apiClient.post('/api/auth/forgot-password/send-otp', { email });
  return data;
}

/** Forgot password: reset with OTP */
export async function resetPassword(email: string, code: string, newPassword: string): Promise<{ success: boolean; message: string }> {
  const { data } = await apiClient.post('/api/auth/forgot-password/reset', { email, code, newPassword });
  return data;
}

// ═══════════ STAFF ACCOUNT MANAGEMENT API ═══════════

/** List staff accounts */
export async function fetchStaffAccounts() {
  const { data } = await apiClient.get('/admin/settings/accounts');
  return data;
}

/** Create a new staff account and send invitation */
export async function createStaffAccount(payload: {
  fullname: string;
  email: string;
  role: string;
  branch_id?: number | null;
}) {
  const { data } = await apiClient.post('/admin/settings/accounts', payload);
  return data;
}

/** Resend invitation to a pending staff account */
export async function resendStaffInvitation(id: number) {
  const { data } = await apiClient.post(`/admin/settings/accounts/${id}/resend-invitation`, {});
  return data;
}

/** Enable or disable a staff account */
export async function updateStaffStatus(id: number, isActive: boolean) {
  const { data } = await apiClient.patch(`/admin/settings/accounts/${id}/status`, { is_active: isActive });
  return data;
}

// ───────── PREORDER OPERATIONS ─────────
export async function fetchOperationalPreorders(params?: { view?: 'pending' | 'today' | 'upcoming'; store_id?: number | null }) {
  const query = new URLSearchParams();
  if (params?.view) query.set('view', params.view);
  if (params?.store_id) query.set('store_id', String(params.store_id));
  const { data } = await apiClient.get(`/admin/preorders${query.size ? `?${query}` : ''}`);
  return Array.isArray(data) ? data : [];
}

export async function fetchKitchenPreorders(storeId?: number | null) {
  const query = storeId ? `?store_id=${storeId}` : '';
  const { data } = await apiClient.get(`/admin/preorders/kitchen/confirmed${query}`);
  return Array.isArray(data) ? data : [];
}

export async function confirmPreorder(id: number) {
  const { data } = await apiClient.post(`/admin/preorders/${id}/confirm`, {});
  return data;
}

export async function checkInPreorder(id: number) {
  const { data } = await apiClient.post(`/admin/preorders/${id}/check-in`, {});
  return data;
}

export async function reschedulePreorder(id: number, payload: { scheduled_date: string; scheduled_hour: number; reason: string; table_id?: number | null }) {
  const { data } = await apiClient.post(`/admin/preorders/${id}/reschedule`, payload);
  return data;
}

/** Fetch branches list */
export async function fetchBranches() {
  try {
    const { data } = await apiClient.get('/admin/branches');
    if (Array.isArray(data) && data.length > 0) return data;
  } catch { /* ignore */ }
  return fetchStores();
}

// ═══════════ STAFF OPERATIONS API (KDS, ORDERS, POS) ═══════════

/** Fetch Kitchen KDS orders */
export async function fetchKitchenOrders(storeId?: number | null) {
  const query = storeId ? `?store_id=${storeId}` : '';
  const { data } = await apiClient.get(`/admin/kitchen/orders${query}`);
  return Array.isArray(data) ? data : [];
}

/** Fetch All Admin Orders */
export async function fetchAdminOrders(params?: { status?: string; search?: string; store_id?: number | null }) {
  const q = new URLSearchParams();
  if (params?.status && params.status !== 'all') {
    const statusMap: Record<string, string> = {
      preparing: 'Đang chuẩn bị',
      delivering: 'Đang giao',
      completed: 'Hoàn thành',
      cancelled: 'Đã hủy',
      confirmed: 'Đã xác nhận',
      pending: 'Chờ xác nhận',
    };
    const mapped = statusMap[params.status] || params.status;
    q.set('status', mapped);
  }
  if (params?.search) q.set('search', params.search);
  if (params?.store_id) q.set('store_id', String(params.store_id));
  const query = q.toString() ? `?${q.toString()}` : '';
  const { data } = await apiClient.get(`/admin/orders${query}`);
  return Array.isArray(data) ? data : data?.orders || [];
}

/** Fetch Admin Order Detail */
export async function fetchAdminOrderDetail(id: number | string) {
  const { data } = await apiClient.get(`/admin/orders/${id}`);
  return data;
}

/** Update Order Status */
export async function updateAdminOrderStatus(id: number | string, status: string, extra?: { driver_name?: string; driver_phone?: string; note?: string }) {
  const statusMap: Record<string, string> = {
    preparing: 'Đang chuẩn bị',
    delivering: 'Đang giao',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy',
    confirmed: 'Đã xác nhận',
    pending: 'Chờ xác nhận',
  };
  const mapped = statusMap[status] || status;
  const { data } = await apiClient.patch(`/admin/orders/${id}/status`, { status: mapped, ...extra });
  return data;
}

/** Cancel Admin Order */
export async function cancelAdminOrder(id: number | string, reason: string) {
  const { data } = await apiClient.put(`/admin/orders/${id}/cancel`, { reason });
  return data;
}

/** Confirm Admin Order Payment */
export async function confirmAdminOrderPayment(id: number | string) {
  const { data } = await apiClient.put(`/admin/orders/${id}/payment/confirm`, {});
  return data;
}

// ═══════════ CUSTOMER & PUBLIC ORDERING API ═══════════

export const FALLBACK_CATEGORIES = [
  { id: 1, name: 'Trà Trái Cây Tươi', slug: 'tra-trai-cay-tuoi', icon: '🍊' },
  { id: 2, name: 'Trà Đậm Vị', slug: 'tra-dam-vi', icon: '🍃' },
  { id: 3, name: 'Trà Sữa Đậm Đà', slug: 'tra-sua-dam-da', icon: '🧋' },
  { id: 4, name: 'Trà Trái Cây Tuyết', slug: 'tra-trai-cay-tuyet', icon: '🍧' },
  { id: 5, name: 'Hi-Tea Detox', slug: 'hi-tea-detox', icon: '✨' },
];

export const FALLBACK_PRODUCTS = [
  {
    id: 1,
    category_id: 1,
    category_name: 'Trà Trái Cây Tươi',
    name: 'Trà Cam Sả Mật Ong',
    slug: 'tra-cam-sa',
    price: 45000,
    base_tea: 'Cốt Lục Trà Lài',
    description: 'Vị chua dịu của cam vàng hòa cùng sả thơm và mật ong rừng, hậu trà thanh mát.',
    image_url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&q=80',
    tags: ['best-seller', 'seasonal'],
    is_available: true,
  },
  {
    id: 2,
    category_id: 1,
    category_name: 'Trà Trái Cây Tươi',
    name: 'Trà Dâu Tây Lài Thơm',
    slug: 'tra-dau-tay',
    price: 55000,
    base_tea: 'Cốt Lục Trà Lài',
    description: 'Dâu tây Đà Lạt dầm tươi quyện lục trà nhài thơm ngát, chua ngọt cân bằng.',
    image_url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80',
    tags: ['best-seller'],
    is_available: true,
  },
  {
    id: 3,
    category_id: 1,
    category_name: 'Trà Trái Cây Tươi',
    name: 'Trà Xoài Chanh Dây',
    slug: 'tra-xoai-chanh-day',
    price: 52000,
    base_tea: 'Trà Đen Đậm Vị',
    description: 'Xoài chín cắt khúc, chanh dây nguyên hạt, vị nhiệt đới rực rỡ.',
    image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&q=80',
    tags: ['new'],
    is_available: true,
  },
  {
    id: 4,
    category_id: 2,
    category_name: 'Trà Đậm Vị',
    name: 'Ô Long Đào Vải',
    slug: 'tra-dao-vai',
    price: 49000,
    base_tea: 'Trà Ô Long',
    description: 'Đào ngâm giòn ngọt cùng vải thiều, nền ô long nướng nhẹ thơm sữa.',
    image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&q=80',
    tags: ['seasonal'],
    is_available: true,
  },
  {
    id: 5,
    category_id: 2,
    category_name: 'Trà Đậm Vị',
    name: 'Trà Lài Hoàng Kim',
    slug: 'tra-lai-hoang-kim',
    price: 38000,
    base_tea: 'Lục Trà Lài',
    description: 'Lục trà ướp hoa lài tươi tự nhiên, chát thanh hậu ngọt đậm sâu.',
    image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&q=80',
    tags: [],
    is_available: true,
  },
  {
    id: 6,
    category_id: 3,
    category_name: 'Trà Sữa Đậm Đà',
    name: 'Trà Sữa Ô Long Nướng',
    slug: 'tra-sua-o-long-nuong',
    price: 48000,
    base_tea: 'Trà Ô Long Nướng',
    description: 'Ô long rang thơm lừng kết hợp sữa tươi nguyên kem béo ngậy.',
    image_url: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400&q=80',
    tags: ['best-seller'],
    is_available: true,
  },
  {
    id: 7,
    category_id: 3,
    category_name: 'Trà Sữa Đậm Đà',
    name: 'Trà Sữa Thái Xanh Macchiato',
    slug: 'tra-sua-thai-xanh-macchiato',
    price: 52000,
    base_tea: 'Trà Thái Xanh',
    description: 'Trà thái xanh thanh mát phủ lớp kem cheese macchiato sánh mịn béo ngậy.',
    image_url: 'https://images.unsplash.com/photo-1558857563-b37fc9a1e0ee?w=400&q=80',
    tags: ['new'],
    is_available: true,
  },
  {
    id: 8,
    category_id: 4,
    category_name: 'Trà Trái Cây Tuyết',
    name: 'Trà Tuyết Dưa Hấu Táo',
    slug: 'tuyet-dua-hau',
    price: 58000,
    base_tea: 'Lục Trà',
    description: 'Dưa hấu xay tuyết mát lạnh, thêm táo giòn – giải nhiệt tức thì.',
    image_url: 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=400&q=80',
    tags: ['new', 'seasonal'],
    is_available: true,
  },
  {
    id: 9,
    category_id: 5,
    category_name: 'Hi-Tea Detox',
    name: 'Hi-Tea Nho Nha Đam',
    slug: 'detox-nho-nha-dam',
    price: 54000,
    base_tea: 'Lục Trà Không Đường',
    description: 'Nho mọng cùng nha đam giòn, ít ngọt, giàu vitamin và chất xơ tự nhiên.',
    image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&q=80',
    tags: ['best-seller'],
    is_available: true,
  },
  {
    id: 10,
    category_id: 5,
    category_name: 'Hi-Tea Detox',
    name: 'Hi-Tea Bưởi Hồng Hạt Chia',
    slug: 'hi-tea-buoi-hong',
    price: 56000,
    base_tea: 'Cốt Lục Trà',
    description: 'Tép bưởi hồng tươi mọng nước kết hợp hạt chia hữu cơ thanh lọc cơ thể.',
    image_url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&q=80',
    tags: [],
    is_available: false,
  },
];

/** Fetch categories */
export async function fetchCategories() {
  const { data } = await apiClient.get('/api/categories');
  return data;
}

/** Fetch products */
export async function fetchProducts(categoryId?: number | string) {
  const query = categoryId ? `?category_id=${categoryId}` : '';
  const { data } = await apiClient.get(`/api/products${query}`);
  return Array.isArray(data) ? data.map((p: any) => ({
    ...p,
    category_id: Number(p.category_id || p.root_category_id || 1),
    price: Number(p.price || 0),
    is_available: p.is_available !== false,
  })) : [];
}

/** Fetch stores */
export async function fetchStores() {
  const { data } = await apiClient.get('/api/stores');
  return data;
}

/** Create order */
export async function createOrder(payload: any) {
  const idempotencyKey = `pos_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  const cleanPayload = {
    ...payload,
    payment_method: payload.payment_method === 'QR' ? 'VietQR' : (payload.payment_method || 'COD'),
    order_type: payload.order_type || 'POS',
    source: payload.source || 'pos',
    store_id: Number(payload.store_id || 1),
    customer_name: payload.customer_name?.trim() || 'Khách Tại Quầy',
    customer_phone: payload.customer_phone?.trim() || '0000000000',
  };

  try {
    const { data } = await apiClient.post('/api/orders', cleanPayload, {
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    });
    return data;
  } catch (err) {
    throw err;
  }
}

/** Fetch sizes */
export async function fetchSizes() {
  const { data } = await apiClient.get('/api/options/sizes');
  return data;
}

/** Fetch toppings */
export async function fetchToppings() {
  const { data } = await apiClient.get('/api/options/toppings');
  return data;
}

/** Fetch tables for store */
export async function fetchTables(storeId: number | string) {
  const { data } = await apiClient.get(`/api/tables?store_id=${storeId}`);
  return data;
}

/** Lookup order */
export async function lookupOrder(codeOrPhone: string) {
  const isPhone = /^[0-9+]{9,15}$/.test(codeOrPhone.trim());
  const param = isPhone ? `phone=${encodeURIComponent(codeOrPhone.trim())}` : `code=${encodeURIComponent(codeOrPhone.trim())}`;
  const { data } = await apiClient.get(`/api/orders/lookup?${param}`);
  return data;
}

/** Apply voucher */
export async function applyVoucher(code: string, subtotal: number) {
  const { data } = await apiClient.post('/api/vouchers/apply', { code, subtotal });
  return data;
}

// ═══════════ FULFILLMENT PACKING API ═══════════

/** Fetch fulfillment tasks for packing or kitchen lane */
export async function fetchFulfillmentTasks(params?: {
  lane?: string;
  branch_id?: number | null;
  status?: string;
}) {
  const q = new URLSearchParams();
  if (params?.lane) q.set('lane', params.lane);
  if (params?.branch_id) q.set('branch_id', String(params.branch_id));
  if (params?.status) q.set('status', params.status);
  const query = q.toString() ? `?${q.toString()}` : '';
  const { data } = await apiClient.get(`/admin/fulfillment/tasks${query}`);
  return data?.tasks || [];
}

/** Update fulfillment task status */
export async function updateFulfillmentTaskStatus(taskId: number | string, status: string, notes?: string) {
  const { data } = await apiClient.patch(`/admin/fulfillment/tasks/${taskId}/status`, {
    status,
    notes,
  });
  return data;
}

// ═══════════ BRANCH STOCK / AVAILABILITY API ═══════════

/** Fetch branch offers (stock/availability list) */
export async function fetchBranchOffers(storeId?: number | string | null, search?: string) {
  const q = new URLSearchParams();
  if (storeId) q.set('store_id', String(storeId));
  if (search) q.set('search', search);
  const query = q.toString() ? `?${q.toString()}` : '';
  const { data } = await apiClient.get(`/admin/branch-offers${query}`);
  return Array.isArray(data) ? data : [];
}

/** Update product/variant availability (bật/tắt hết hàng) */
export async function updateBranchOfferAvailability(variantId: number | string, storeId: number | string, isAvailable: boolean) {
  const { data } = await apiClient.put(`/admin/branch-offers/${variantId}`, {
    store_id: Number(storeId),
    is_available: isAvailable,
  });
  return data;
}

export default apiClient;
