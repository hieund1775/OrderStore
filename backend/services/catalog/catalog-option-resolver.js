export function resolveProductOptions({
  categoryAssignments = [],
  productOverrides = [],
  categoryPresets = [],
  productPresets = [],
} = {}) {
  // 1. Process category assignments in topological order (root -> leaf)
  const effectiveMap = new Map();

  for (const assign of categoryAssignments) {
    const attrId = Number(assign.attribute_definition_id);
    effectiveMap.set(attrId, {
      attribute_definition_id: attrId,
      attribute_code: assign.attribute_code,
      attribute_name: assign.attribute_name,
      attribute_role: assign.attribute_role,
      input_type: assign.input_type,
      is_enabled: Boolean(assign.is_enabled),
      sort_order: Number(assign.sort_order) || 0,
      is_required: assign.is_required,
      min_selected: assign.min_selected,
      max_selected: assign.max_selected,
      source_type: 'category',
      source_id: assign.category_id,
      source_name: assign.category_name || 'Category',
      is_overridden: false,
      preset_value_ids: [],
      is_locked: false,
    });
  }

  // 2. Apply category presets
  for (const preset of categoryPresets) {
    const attrId = Number(preset.attribute_definition_id);
    const existing = effectiveMap.get(attrId);
    if (existing) {
      existing.preset_value_ids = Array.isArray(preset.attribute_value_ids)
        ? preset.attribute_value_ids.map(Number)
        : [];
      existing.is_locked = Boolean(preset.is_locked);
    }
  }

  // 3. Apply product-level overrides
  for (const override of productOverrides) {
    const attrId = Number(override.attribute_definition_id);
    const existing = effectiveMap.get(attrId);

    effectiveMap.set(attrId, {
      ...(existing || {}),
      attribute_definition_id: attrId,
      attribute_code: override.attribute_code || existing?.attribute_code,
      attribute_name: override.attribute_name || existing?.attribute_name,
      attribute_role: override.attribute_role || existing?.attribute_role,
      input_type: override.input_type || existing?.input_type,
      is_enabled: Boolean(override.is_enabled),
      sort_order: override.sort_order !== null && override.sort_order !== undefined
        ? Number(override.sort_order)
        : (existing?.sort_order || 0),
      is_required: override.is_required !== null && override.is_required !== undefined
        ? Boolean(override.is_required)
        : existing?.is_required,
      min_selected: override.min_selected !== null && override.min_selected !== undefined
        ? Number(override.min_selected)
        : existing?.min_selected,
      max_selected: override.max_selected !== null && override.max_selected !== undefined
        ? Number(override.max_selected)
        : existing?.max_selected,
      source_type: 'product',
      source_id: override.product_id,
      source_name: 'Sản phẩm',
      is_overridden: true,
      preset_value_ids: existing?.preset_value_ids || [],
      is_locked: existing?.is_locked || false,
    });
  }

  // 4. Apply product-level presets (Product preset wins over category preset for configured groups)
  for (const preset of productPresets) {
    const attrId = Number(preset.attribute_definition_id);
    const existing = effectiveMap.get(attrId);
    if (existing) {
      existing.preset_value_ids = Array.isArray(preset.attribute_value_ids)
        ? preset.attribute_value_ids.map(Number)
        : [];
      existing.is_locked = Boolean(preset.is_locked);
    }
  }

  // 5. Filter only enabled attributes and sort by sort_order
  const resolved = Array.from(effectiveMap.values())
    .filter((item) => item.is_enabled)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  return resolved;
}
