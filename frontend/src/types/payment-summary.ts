export type PaymentIndustryItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type PaymentIndustrySummary = {
  root_category_id: string | null;
  root_category_name: string; // fallback: "Chưa phân loại"
  order_id: string;
  order_code: string;
  subtotal: number;
  discount_amount: number;
  shipping_fee: number;
  total_amount: number;
  status: string;
  payment_status: string;
  items: PaymentIndustryItem[];
};

export type PaymentSummary = {
  is_grouped: boolean;
  group_code: string | null;
  subtotal: number;
  discount_amount: number;
  shipping_fee: number;
  total_amount: number;
  industries: PaymentIndustrySummary[];
};
