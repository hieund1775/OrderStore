-- 0028 Product Reviews production preflight.
-- Read-only only: every row is a named check with issue_count/status.
WITH required_tables(table_name) AS (
    VALUES
      ('users'), ('products'), ('orders'), ('order_items'),
      ('order_status_history'), ('reviews')
),
required_columns(table_name, column_name) AS (
    VALUES
      ('users', 'id'),
      ('products', 'id'), ('products', 'rating'), ('products', 'review_count'),
      ('orders', 'id'), ('orders', 'user_id'),
      ('order_items', 'id'), ('order_items', 'order_id'), ('order_items', 'product_id'),
      ('order_status_history', 'order_id'), ('order_status_history', 'status'),
      ('reviews', 'id'), ('reviews', 'user_id'), ('reviews', 'product_id'),
      ('reviews', 'order_item_id'), ('reviews', 'rating'), ('reviews', 'comment'),
      ('reviews', 'created_at')
),
table_checks AS (
    SELECT
      'required_base_tables'::text AS check_name,
      COUNT(*) FILTER (WHERE t.table_name IS NULL)::int AS issue_count
    FROM required_tables r
    LEFT JOIN information_schema.tables t
      ON t.table_schema = current_schema() AND t.table_name = r.table_name
),
column_checks AS (
    SELECT
      'required_base_columns'::text AS check_name,
      COUNT(*) FILTER (WHERE c.column_name IS NULL)::int AS issue_count
    FROM required_columns r
    LEFT JOIN information_schema.columns c
      ON c.table_schema = current_schema()
     AND c.table_name = r.table_name
     AND c.column_name = r.column_name
),
existing_shape_checks AS (
    SELECT
      'existing_reviews_shape'::text AS check_name,
      COUNT(*) FILTER (WHERE t.table_name IS NOT NULL AND c.column_name IS NULL)::int AS issue_count
    FROM (VALUES
      ('review_revisions', 'id'), ('review_revisions', 'review_id'),
      ('review_revisions', 'sequence'), ('review_revisions', 'revision_type'),
      ('review_replies', 'id'), ('review_replies', 'review_id'),
      ('review_media', 'id'), ('review_media', 'review_revision_id'),
      ('review_media_uploads', 'id'), ('review_media_uploads', 'owner_user_id')
    ) AS expected(table_name, column_name)
    LEFT JOIN information_schema.tables t
      ON t.table_schema = current_schema() AND t.table_name = expected.table_name
    LEFT JOIN information_schema.columns c
      ON c.table_schema = current_schema()
     AND c.table_name = expected.table_name
     AND c.column_name = expected.column_name
),
pointer_shape_checks AS (
    SELECT
      'existing_review_pointer_shape'::text AS check_name,
      CASE
        WHEN c.table_name IS NULL THEN 0
        WHEN c.data_type = 'bigint' THEN 0
        ELSE 1
      END::int AS issue_count
    FROM (SELECT 'reviews'::text AS table_name) expected
    LEFT JOIN information_schema.columns c
      ON c.table_schema = current_schema()
     AND c.table_name = expected.table_name
     AND c.column_name = 'current_revision_id'
),
review_object_checks AS (
    SELECT
      'preexisting_reviews_indexes_or_constraints'::text AS check_name,
      COUNT(*)::int AS issue_count
    FROM (VALUES
      ('uq_review_revisions_one_edit'),
      ('uq_review_media_one_image'),
      ('uq_review_media_one_video'),
      ('uq_reviews_verified_order_item'),
      ('idx_reviews_public_list'),
      ('idx_reviews_admin_list'),
      ('idx_review_revisions_current'),
      ('uq_review_upload_intent'),
      ('fk_reviews_current_revision')
    ) AS expected(object_name)
    WHERE EXISTS (
      SELECT 1
      FROM pg_class cls
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
      WHERE ns.nspname = current_schema()
        AND cls.relname = expected.object_name
        AND cls.relkind IN ('i', 'r', 'S')
    ) OR EXISTS (
      SELECT 1
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
      WHERE ns.nspname = current_schema()
        AND con.conname = expected.object_name
    )
),
checks AS (
    SELECT * FROM table_checks
    UNION ALL SELECT * FROM column_checks
    UNION ALL SELECT * FROM existing_shape_checks
    UNION ALL SELECT * FROM pointer_shape_checks
    UNION ALL SELECT * FROM review_object_checks
)
SELECT check_name, issue_count, CASE WHEN issue_count = 0 THEN 'PASS' ELSE 'BLOCK' END AS status
FROM checks
ORDER BY check_name;
