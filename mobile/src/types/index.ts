/**
 * Staff & Store Operations types for the Mobile Store Operations App
 * Replaces the customer-facing types from the previous prototype.
 */

/** Staff roles in the system */
export type StaffRole = 'super' | 'manager' | 'cashier' | 'kitchen' | 'packing';

/** Staff account status */
export type StaffStatus = 'active' | 'disabled' | 'invitation_pending' | 'invitation_expired';

/** Internal staff user profile */
export interface StaffProfile {
  id: number;
  fullname: string;
  phone: string;
  email: string | null;
  role: StaffRole;
  branch_id: number | null;
  branch_name: string | null;
  email_verified_at: string | null;
}

/** Staff account row from the API */
export interface StaffAccount {
  id: number;
  fullname: string;
  email: string | null;
  role: string;
  branch: string;
  branch_id: number | null;
  active: boolean;
  email_verified_at: string | null;
  created_at: string;
}

/** Branch data */
export interface Branch {
  id: number;
  name: string;
  address?: string;
}

/** Create staff payload */
export interface CreateStaffPayload {
  fullname: string;
  email: string;
  role: string;
  branch_id?: number | null;
}

/** API error response */
export interface ApiErrorResponse {
  error: string;
  message?: string;
}

/** Login response */
export interface LoginResponse {
  token: string;
  user: {
    id: number;
    fullname: string;
    phone: string;
    role: StaffRole;
    branch_id: number | null;
  };
}

/** Forgot password send OTP response */
export interface SendOtpResponse {
  success: boolean;
  message: string;
  demo_otp?: string;
}

/** Forgot password reset response */
export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

/** Staff invitation accept response */
export interface AcceptInvitationResponse {
  success: boolean;
  message: string;
}

/** Create staff response */
export interface CreateStaffResponse {
  id: number;
  fullname: string;
  email: string;
  role: string;
  branch_id: number | null;
  message: string;
}

/** Resend invitation response */
export interface ResendInvitationResponse {
  success: boolean;
  message: string;
}

/** Update staff status response */
export interface UpdateStaffStatusResponse {
  id: number;
  fullname: string;
  email: string;
  role: string;
  is_active: boolean;
  message: string;
}

/** Me response */
export interface MeResponse {
  id: number;
  fullname: string;
  phone: string;
  email: string | null;
  admin_role: StaffRole;
  admin_branch_id: number | null;
  email_verified_at: string | null;
}

// ═══════════ CUSTOMER & CATALOG TYPES ═══════════

export interface Product {
  id: number | string;
  name: string;
  slug?: string;
  category_id?: number;
  category_name?: string;
  base_tea?: string;
  description?: string;
  price: number;
  image_url?: string;
  tags?: string[];
  is_available?: boolean;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  sort_order?: number;
  is_visible?: boolean;
}

export interface Store {
  id: number;
  name: string;
  city?: string;
  district?: string;
  address: string;
  phone?: string;
  hours?: string;
  amenities?: string[];
}

export interface TableInfo {
  id: number;
  name: string;
  store_id: number;
  qr_code_token?: string;
}

export interface Voucher {
  id?: number;
  code: string;
  title: string;
  description?: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_order: number;
}

export interface CartItem {
  id: string;
  product_id: number | string;
  name: string;
  image_url?: string;
  unit_price: number;
  size_label: string;
  size_price: number;
  sugar_level: string;
  ice_level: string;
  base_tea?: string;
  toppings: Array<{ name: string; price: number }>;
  quantity: number;
  note?: string;
  item_total: number;
}

export interface OrderItem {
  id?: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  item_total: number;
  size_label?: string;
  sugar_level?: string;
  ice_level?: string;
  toppings?: Array<{ name: string; price: number }>;
  note?: string;
}

export interface Order {
  id: number;
  order_code: string;
  customer_name: string;
  customer_phone: string;
  order_type: 'Delivery' | 'Takeaway' | 'DineIn';
  status: 'pending' | 'preparing' | 'delivering' | 'completed' | 'cancelled';
  payment_status: 'unpaid' | 'paid' | 'refunded';
  payment_method: string;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  items: OrderItem[];
  shipping_address?: string;
  shipping_driver_name?: string;
  shipping_driver_phone?: string;
  shipping_tracking_url?: string;
  created_at: string;
  store_name?: string;
}

export interface CreateOrderPayload {
  customer_name: string;
  customer_phone: string;
  order_type: 'Delivery' | 'Takeaway' | 'DineIn';
  payment_method: 'COD' | 'vietqr' | 'banking';
  store_id: number;
  table_id?: number | null;
  shipping_address?: string;
  voucher_code?: string | null;
  note?: string;
  items: Array<{
    product_id: number;
    quantity: number;
    size_label?: string;
    sugar_level?: string;
    ice_level?: string;
    toppings?: Array<{ name: string; price: number }>;
    note?: string;
  }>;
}