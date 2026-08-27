-- Catalog V2 integrity hardening added after the initial Gate 1-4 review.

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_type_one_published_schema
    ON product_type_schemas(product_type_id)
    WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_product_modifier_values_product
    ON product_modifier_values(product_id, attribute_definition_id);

CREATE INDEX IF NOT EXISTS idx_product_variant_values_value
    ON product_variant_values(attribute_value_id);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_checkout_group
    ON inventory_reservations(checkout_group_id)
    WHERE checkout_group_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS catalog_v2_backfill_runs (
    name VARCHAR(100) PRIMARY KEY,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb
);
