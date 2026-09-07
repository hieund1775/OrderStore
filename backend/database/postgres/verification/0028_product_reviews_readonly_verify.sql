-- 0028_product_reviews_readonly_verify.sql
-- Read-only verification for 0028_product_reviews.sql.
-- Run after 0028 has been applied. This file contains SELECT/CTE only.

-- 1. Verify additive columns exist on reviews
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'reviews'
  AND column_name IN (
    'purchase_verified_at', 'current_revision_id', 'visibility_status',
    'hidden_at', 'hidden_by', 'hidden_reason',
    'edit_window_expires_at', 'customer_edit_used_at', 'updated_at'
  )
ORDER BY column_name;

-- 2. Verify new tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_name IN (
    'review_revisions', 'review_replies', 'review_media', 'review_media_uploads'
)
ORDER BY table_name;

-- 3. Verify all legacy reviews have at least one revision
SELECT
    COUNT(*) AS total_legacy_reviews,
    COUNT(*) FILTER (WHERE current_revision_id IS NOT NULL) AS with_revision,
    COUNT(*) FILTER (WHERE current_revision_id IS NULL) AS missing_revision
FROM reviews;

-- 4. Verify backfill: legacy reviews that should be verified
SELECT
    COUNT(*) AS reviews_eligible_for_verification,
    COUNT(*) FILTER (WHERE purchase_verified_at IS NOT NULL) AS verified,
    COUNT(*) FILTER (WHERE purchase_verified_at IS NULL) AS not_verified
FROM reviews rev
WHERE rev.order_item_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.id = rev.order_item_id
      AND o.user_id = rev.user_id
      AND EXISTS (
        SELECT 1 FROM order_status_history osh
        WHERE osh.order_id = o.id
          AND osh.status = 'Hoàn thành'
      )
  );

-- 5. Verify unique constraint on verified order_item_id
SELECT
    order_item_id,
    COUNT(*) AS duplicate_count
FROM reviews
WHERE purchase_verified_at IS NOT NULL
  AND order_item_id IS NOT NULL
GROUP BY order_item_id
HAVING COUNT(*) > 1;

-- 6. Verify at most one customer_edit per review
SELECT
    review_id,
    COUNT(*) AS edit_count
FROM review_revisions
WHERE revision_type = 'customer_edit'
GROUP BY review_id
HAVING COUNT(*) > 1;

-- 7. Verify products.rating/review_count are computed
SELECT
    COUNT(*) AS total_products,
    COUNT(*) FILTER (WHERE rating >= 0 AND rating <= 5) AS valid_rating,
    COUNT(*) FILTER (WHERE review_count >= 0) AS valid_count
FROM products;

-- 8. Verify no payment tables were modified
SELECT
    table_name,
    'UNEXPECTED CHANGE' AS warning
FROM information_schema.columns
WHERE table_name IN ('payment_attempts', 'payment_events', 'checkout_groups', 'payos_orders')
  AND column_name IN ('purchase_verified_at', 'current_revision_id', 'visibility_status')
LIMIT 1;