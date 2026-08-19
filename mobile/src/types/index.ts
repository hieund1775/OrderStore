export interface Product {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  price: number;
  description: string | null;
  image_url: string;
  tags: string[];
  is_available: boolean;
  category_name?: string;
  category_slug?: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  emoji: string | null;
  sort_order: number;
}

export interface Store {
  id: number;
  name: string;
  city: string;
  district: string;
  address: string;
  phone: string;
  hours: string;
  lat?: number | null;
  lng?: number | null;
  amenities?: string[];
  is_active: boolean;
}

export interface ProductOption {
  id: number;
  kind: 'size' | 'topping' | 'base' | 'sugar' | 'ice';
  code: string;
  label: string;
  extra_price: number;
  is_active: boolean;
}

export interface CartItem {
  id: string; // unique item id in cart (product_id + custom options hash)
  product_id: number;
  product_name: string;
  image_url: string;
  unit_price: number;
  size_label: string;
  size_price: number;
  sugar_level: string;
  ice_level: string;
  base_tea?: string;
  toppings: Array<{ name: string; price: number }>;
  note?: string;
  quantity: number;
  item_total: number;
}

export interface TableInfo {
  id: number;
  store_id: number;
  name: string;
  store_name?: string;
  store_address?: string;
}

export interface Voucher {
  id: number;
  code: string;
  title: string;
  description?: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_order: number;
  max_discount?: number | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface OrderItem {
  id: number;
  product_name: string;
  qty: number;
  size_label?: string;
  line_total: number;
  toppings?: Array<{ name: string }>;
  note?: string;
}

export interface OrderSummary {
  id: number;
  order_code: string;
  store_id: number;
  store_name: string;
  table_id?: number | null;
  table_name?: string | null;
  order_type: 'DineIn' | 'Takeaway' | 'Delivery';
  status: 'received' | 'preparing' | 'ready' | 'delivering' | 'completed' | 'cancelled';
  payment_status: 'unpaid' | 'paid' | 'failed';
  payment_method: 'VietQR' | 'COD' | 'Cash';
  subtotal: number;
  discount_amount: number;
  total: number;
  created_at: string;
  items: OrderItem[];
}

export interface CustomerProfile {
  id: number;
  fullname: string;
  phone: string;
  email?: string;
  avatar_url?: string | null;
  address?: string | null;
  tier: 'member' | 'silver' | 'gold' | 'diamond';
  points: number;
  total_spent: number;
}
