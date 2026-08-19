import { buildPublicLookupDto } from '../services/public-dto.js';

export function toAdminOrderListItemDto(order) {
  if (!order) return null;
  const dto = { ...order };
  if (dto.id != null) dto.id = Number(dto.id);
  if (dto.store_id != null) dto.store_id = Number(dto.store_id);
  if (dto.user_id != null) dto.user_id = Number(dto.user_id);
  if (dto.table_id != null) dto.table_id = Number(dto.table_id);
  if (dto.subtotal != null) dto.subtotal = Number(dto.subtotal);
  if (dto.discount_amount != null) dto.discount_amount = Number(dto.discount_amount);
  if (dto.total != null) dto.total = Number(dto.total);
  if (dto.is_printed != null) dto.is_printed = Boolean(dto.is_printed);
  delete dto.cancel_token_hash;
  return dto;
}

export function toAdminOrderDetailDto(order) {
  if (!order) return null;
  const base = toAdminOrderListItemDto(order);
  if (Array.isArray(base.items)) {
    base.items = base.items.map((item) => ({
      ...item,
      id: item.id != null ? Number(item.id) : undefined,
      order_id: item.order_id != null ? Number(item.order_id) : base.id,
      qty: item.qty != null ? Number(item.qty) : 1,
      unit_price: item.unit_price != null ? Number(item.unit_price) : 0,
      line_total: item.line_total != null ? Number(item.line_total) : 0,
      toppings: Array.isArray(item.toppings) ? item.toppings.map((top) => ({
        name: top.name || top.topping_name,
        price: Number(top.price || top.topping_price || 0),
      })) : [],
    }));
  }
  if (Array.isArray(base.status_history)) {
    base.status_history = base.status_history.map((h) => ({
      ...h,
      id: h.id != null ? Number(h.id) : undefined,
      order_id: h.order_id != null ? Number(h.order_id) : base.id,
      changed_by: h.changed_by != null ? Number(h.changed_by) : null,
    }));
  }
  return base;
}

export function toKitchenOrderDto(order) {
  if (!order) return null;
  const dto = { ...order };
  if (dto.id != null) dto.id = Number(dto.id);
  if (dto.store_id != null) dto.store_id = Number(dto.store_id);
  if (dto.table_id != null) dto.table_id = Number(dto.table_id);
  if (dto.subtotal != null) dto.subtotal = Number(dto.subtotal);
  if (dto.discount_amount != null) dto.discount_amount = Number(dto.discount_amount);
  if (dto.total != null) dto.total = Number(dto.total);
  delete dto.cancel_token_hash;
  delete dto.voucher_code;
  if (Array.isArray(dto.items)) {
    dto.items = dto.items.map((item) => ({
      ...item,
      id: item.id != null ? Number(item.id) : undefined,
      qty: item.qty != null ? Number(item.qty) : 1,
      toppings: Array.isArray(item.toppings) ? item.toppings.map((top) => ({
        name: top.name || top.topping_name,
        price: Number(top.price || top.topping_price || 0),
      })) : [],
    }));
  }
  return dto;
}

export function toCustomerOrderListItemDto(order) {
  if (!order) return null;
  const dto = { ...order };
  if (dto.id != null) dto.id = Number(dto.id);
  if (dto.user_id != null) dto.user_id = Number(dto.user_id);
  if (dto.store_id != null) dto.store_id = Number(dto.store_id);
  if (dto.table_id != null) dto.table_id = Number(dto.table_id);
  if (dto.subtotal != null) dto.subtotal = Number(dto.subtotal);
  if (dto.discount_amount != null) dto.discount_amount = Number(dto.discount_amount);
  if (dto.total != null) dto.total = Number(dto.total);
  delete dto.cancel_token_hash;
  return dto;
}

export { buildPublicLookupDto as toPublicOrderLookupDto };
