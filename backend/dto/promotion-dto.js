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
    min_order: Number(promo.min_order || 0),
    max_discount: promo.max_discount == null ? null : Number(promo.max_discount),
    start_date: promo.start_date,
    end_date: promo.end_date,
    is_active: promo.is_active !== false,
    store_id: promo.store_id == null ? null : Number(promo.store_id),
    rule: parsedRule || null,
    created_at: promo.created_at,
    updated_at: promo.updated_at,
  };
}
