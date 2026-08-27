/**
 * Catalog V2 DTO Mappers
 */

export function toCategoryTreeDto(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
    parent_id: row.parent_id == null ? null : Number(row.parent_id),
    depth: Number(row.depth || 0),
    product_type_id: row.product_type_id == null ? null : Number(row.product_type_id),
    product_type_name: row.product_type_name || null,
    product_type_code: row.product_type_code || null,
    sort_order: Number(row.sort_order || 0),
    is_visible: Boolean(row.is_visible),
    archived_at: row.archived_at || null,
    children_count: Number(row.children_count || 0),
    products_count: Number(row.products_count || 0),
    created_at: row.created_at,
  };
}

export function toProductTypeDto(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    description: row.description || null,
    default_stock_mode: row.default_stock_mode,
    default_fulfillment_lane: row.default_fulfillment_lane,
    published_version: row.published_version == null ? null : Number(row.published_version),
    published_schema_id: row.published_schema_id == null ? null : Number(row.published_schema_id),
    products_count: Number(row.products_count || 0),
    archived_at: row.archived_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function toSchemaDetailsDto(schema) {
  if (!schema) return null;
  return {
    id: Number(schema.id),
    product_type_id: Number(schema.product_type_id),
    product_type_code: schema.product_type_code,
    product_type_name: schema.product_type_name,
    version: Number(schema.version),
    status: schema.status,
    published_at: schema.published_at || null,
    created_at: schema.created_at,
    attributes: (schema.attributes || []).map((attr) => ({
      id: Number(attr.id),
      code: attr.code,
      name: attr.name,
      role: attr.role,
      input_type: attr.input_type,
      is_required: Boolean(attr.is_required),
      is_filterable: Boolean(attr.is_filterable),
      sort_order: Number(attr.sort_order || 0),
      min_selections: Number(attr.min_selections || 0),
      max_selections: attr.max_selections == null ? null : Number(attr.max_selections),
      validation_rules: attr.validation_rules || {},
      values: (attr.values || []).map((val) => ({
        id: Number(val.id),
        code: val.code,
        label: val.label,
        sort_order: Number(val.sort_order || 0),
        is_active: Boolean(val.is_active),
        price_adjustment: Number(val.price_adjustment || 0),
      })),
    })),
  };
}

export function toProductV2Dto(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    category_id: Number(row.category_id),
    category_name: row.category_name || undefined,
    category_slug: row.category_slug || undefined,
    product_type_schema_id: row.product_type_schema_id == null ? null : Number(row.product_type_schema_id),
    product_type_name: row.product_type_name || undefined,
    product_type_code: row.product_type_code || undefined,
    name: row.name,
    slug: row.slug,
    description: row.description || null,
    price: Number(row.price || 0),
    image_url: row.image_url || null,
    status: row.status,
    fulfillment_lane: row.fulfillment_lane,
    stock_mode: row.stock_mode,
    variants_count: Number(row.variants_count || 0),
    media: row.media || [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function toVariantDto(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    product_id: Number(row.product_id),
    sku: row.sku,
    variant_signature: row.variant_signature,
    name_suffix: row.name_suffix || null,
    barcode: row.barcode || null,
    status: row.status,
    attribute_values: row.attribute_values || [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
