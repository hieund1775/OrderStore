/**
 * Catalog V2 Validation Schemas
 * Pure input validation and normalization rules for categories, product types, schemas, and attributes.
 */

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export function validateSectionsQuery(query) {
  const storeId = Number(query?.store_id);
  if (!Number.isInteger(storeId) || storeId <= 0) {
    throw badRequest('store_id phải là số nguyên dương hợp lệ');
  }

  let limitPerRoot = query?.limit_per_root ? Number(query.limit_per_root) : 12;
  if (!Number.isInteger(limitPerRoot) || limitPerRoot <= 0) {
    limitPerRoot = 12;
  }
  if (limitPerRoot > 12) {
    limitPerRoot = 12;
  }

  return { storeId, limitPerRoot };
}

export function validateSubtreeProductsQuery(query) {
  const storeId = Number(query?.store_id);
  if (!Number.isInteger(storeId) || storeId <= 0) {
    throw badRequest('store_id phải là số nguyên dương hợp lệ');
  }

  const categorySlug = query?.category ? String(query.category).trim().toLowerCase() : null;
  if (categorySlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(categorySlug)) {
    throw badRequest('Category slug không hợp lệ');
  }

  const limit = query?.limit ? Math.min(Math.max(1, Number(query.limit)), 100) : 50;
  const offset = query?.offset ? Math.max(0, Number(query.offset)) : 0;
  const search = query?.search ? String(query.search).trim() : null;

  return { storeId, categorySlug, limit, offset, search };
}

export function validateCategoryInput(input) {
  if (!input || typeof input !== 'object') {
    throw badRequest('Category payload must be an object');
  }

  const name = String(input.name || '').trim();
  if (!name || name.length < 2 || name.length > 150) {
    throw badRequest('Category name must be between 2 and 150 characters');
  }

  const slug = String(input.slug || '')
    .trim()
    .toLowerCase();
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw badRequest('Category slug must be kebab-case (e.g. "tra-trai-cay", "ao-thun-nam")');
  }

  const parentId = input.parent_id !== undefined && input.parent_id !== null ? Number(input.parent_id) : null;
  if (parentId !== null && (!Number.isInteger(parentId) || parentId <= 0)) {
    throw badRequest('parent_id must be a positive integer or null');
  }

  const productTypeId =
    input.product_type_id !== undefined && input.product_type_id !== null ? Number(input.product_type_id) : null;
  if (productTypeId !== null && (!Number.isInteger(productTypeId) || productTypeId <= 0)) {
    throw badRequest('product_type_id must be a positive integer or null');
  }

  const sortOrder = input.sort_order !== undefined ? Number(input.sort_order) : 0;
  if (!Number.isInteger(sortOrder)) {
    throw badRequest('sort_order must be an integer');
  }

  if (input.is_visible !== undefined && typeof input.is_visible !== 'boolean') {
    throw badRequest('is_visible must be a boolean');
  }
  const isVisible = input.is_visible ?? true;

  return {
    name,
    slug,
    parent_id: parentId,
    product_type_id: productTypeId,
    sort_order: sortOrder,
    is_visible: isVisible,
  };
}

export function validateProductTypeInput(input) {
  if (!input || typeof input !== 'object') {
    throw badRequest('Product type payload must be an object');
  }

  const code = String(input.code || '')
    .trim()
    .toLowerCase();
  if (!code || !/^[a-z0-9_]+$/.test(code)) {
    throw badRequest('Product type code must be snake_case alphanumeric (e.g. "beverage", "fashion_apparel")');
  }

  const name = String(input.name || '').trim();
  if (!name || name.length < 2 || name.length > 200) {
    throw badRequest('Product type name must be between 2 and 200 characters');
  }

  const description = input.description ? String(input.description).trim() : null;

  const defaultStockMode = input.default_stock_mode || 'made_to_order';
  if (!['tracked', 'made_to_order'].includes(defaultStockMode)) {
    throw badRequest('default_stock_mode must be "tracked" or "made_to_order"');
  }

  const defaultFulfillmentLane = input.default_fulfillment_lane || 'kitchen';
  if (!['kitchen', 'packing'].includes(defaultFulfillmentLane)) {
    throw badRequest('default_fulfillment_lane must be "kitchen" or "packing"');
  }

  return {
    code,
    name,
    description,
    default_stock_mode: defaultStockMode,
    default_fulfillment_lane: defaultFulfillmentLane,
  };
}

export function validateAttributeDefinitionInput(input) {
  if (!input || typeof input !== 'object') {
    throw badRequest('Attribute definition payload must be an object');
  }

  const code = String(input.code || '')
    .trim()
    .toLowerCase();
  if (!code || !/^[a-z0-9_]+$/.test(code)) {
    throw badRequest('Attribute code must be snake_case alphanumeric (e.g. "size", "sugar", "color")');
  }

  const name = String(input.name || '').trim();
  if (!name || name.length < 1 || name.length > 200) {
    throw badRequest('Attribute name must be between 1 and 200 characters');
  }

  const role = String(input.role || '').trim();
  if (!['variant', 'modifier'].includes(role)) {
    throw badRequest('Attribute role must be "variant" or "modifier"');
  }

  const inputType = String(input.input_type || 'single_select').trim();
  if (!['single_select', 'multi_select', 'text', 'number'].includes(inputType)) {
    throw badRequest('input_type must be "single_select", "multi_select", "text", or "number"');
  }

  if (role === 'variant' && inputType !== 'single_select') {
    throw badRequest('Variant attributes must have input_type = "single_select"');
  }

  if (input.is_required !== undefined && typeof input.is_required !== 'boolean') {
    throw badRequest('is_required must be a boolean');
  }
  if (input.is_filterable !== undefined && typeof input.is_filterable !== 'boolean') {
    throw badRequest('is_filterable must be a boolean');
  }
  const isRequired = input.is_required ?? false;
  const isFilterable = input.is_filterable ?? false;
  const sortOrder = Number.isInteger(Number(input.sort_order)) ? Number(input.sort_order) : 0;
  const minSelections = input.min_selections !== undefined ? Number(input.min_selections) : (isRequired ? 1 : 0);
  const maxSelections = input.max_selections !== undefined && input.max_selections !== null ? Number(input.max_selections) : null;

  if (minSelections < 0) {
    throw badRequest('min_selections must be >= 0');
  }
  if (maxSelections !== null && maxSelections < minSelections) {
    throw badRequest('max_selections must be greater than or equal to min_selections');
  }

  const validationRules = input.validation_rules && typeof input.validation_rules === 'object' ? input.validation_rules : {};

  return {
    code,
    name,
    role,
    input_type: inputType,
    is_required: isRequired,
    is_filterable: isFilterable,
    sort_order: sortOrder,
    min_selections: minSelections,
    max_selections: maxSelections,
    validation_rules: validationRules,
  };
}

export function validateAttributeValueInput(input) {
  if (!input || typeof input !== 'object') {
    throw badRequest('Attribute value payload must be an object');
  }

  const code = String(input.code || '')
    .trim()
    .toLowerCase();
  if (!code || !/^[a-z0-9_-]+$/.test(code)) {
    throw badRequest('Attribute value code must be alphanumeric with dashes or underscores');
  }

  const label = String(input.label || '').trim();
  if (!label || label.length < 1 || label.length > 200) {
    throw badRequest('Attribute value label must be between 1 and 200 characters');
  }

  const sortOrder = Number.isInteger(Number(input.sort_order)) ? Number(input.sort_order) : 0;
  if (input.is_active !== undefined && typeof input.is_active !== 'boolean') {
    throw badRequest('is_active must be a boolean');
  }
  const isActive = input.is_active ?? true;
  const priceAdjustment = Number.isInteger(Number(input.price_adjustment)) ? Number(input.price_adjustment) : 0;

  if (priceAdjustment < 0) {
    throw badRequest('price_adjustment must be non-negative');
  }

  return {
    code,
    label,
    sort_order: sortOrder,
    is_active: isActive,
    price_adjustment: priceAdjustment,
  };
}

/**
 * Generates a deterministic canonical variant signature from an array of attribute-value pairs.
 * Signature format: "[attr_def_id_1:val_id_1]__[attr_def_id_2:val_id_2]" sorted by attr_def_id.
 */
export function generateCanonicalVariantSignature(values = []) {
  if (!Array.isArray(values) || values.length === 0) {
    return 'default';
  }

  const sorted = [...values].sort((a, b) => Number(a.attribute_definition_id) - Number(b.attribute_definition_id));
  return sorted.map((v) => `${v.attribute_definition_id}:${v.attribute_value_id}`).join('__');
}
