export function toIngredientDto(ing) {
  if (!ing) return null;
  return {
    id: Number(ing.id),
    name: ing.name,
    unit: ing.unit,
    stock_quantity: Number(ing.stock_quantity || 0),
    min_threshold: Number(ing.min_threshold || 0),
    cost_per_unit: Number(ing.cost_per_unit || 0),
    created_at: ing.created_at,
    updated_at: ing.updated_at,
  };
}

export function toStockLogDto(log) {
  if (!log) return null;
  return {
    id: Number(log.id),
    ingredient_id: Number(log.ingredient_id),
    change_amount: Number(log.change_amount || 0),
    reason: log.reason || null,
    created_at: log.created_at,
    ingredient_name: log.ingredient_name || undefined,
    unit: log.unit || undefined,
  };
}
