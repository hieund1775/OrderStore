export function toPromotionDto(promo) {
  if (!promo) return null;
  let parsedRule = promo.rule;
  if (typeof promo.rule === 'string') {
    try {
      parsedRule = JSON.parse(promo.rule);
    } catch {
      parsedRule = promo.rule;
    }
  }

  return {
    id: Number(promo.id),
    title: promo.title,
    description: promo.description || null,
    code: promo.code,
    discount_type: promo.discount_type,
    discount_value: Number(promo.discount_value || 0),
    min_order: promo.min_order == null ? null : Number(promo.min_order),
    max_discount: promo.max_discount == null ? null : Number(promo.max_discount),
    voucher_type: promo.voucher_type || 'shared',
    usage_limit: promo.usage_limit == null ? null : Number(promo.usage_limit),
    used_count: Number(promo.used_count || 0),
    status: promo.status || 'Đang diễn ra',
    start_date: promo.start_date,
    end_date: promo.end_date,
    is_active: promo.is_active !== false,
    store_id: promo.store_id == null ? null : Number(promo.store_id),
    stores: Array.isArray(promo.stores) ? promo.stores : [],
    rule: parsedRule || null,
    created_at: promo.created_at,
    updated_at: promo.updated_at,
  };
}
