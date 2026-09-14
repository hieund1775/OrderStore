-- Read-only production preflight for 0033_preorder_customer_checkin.sql.
-- Every row must be PASS/0 for the production executor to proceed.
WITH required_base_tables(table_name) AS (
    VALUES
      ('users'), ('preorders'), ('stores'),
      ('preorder_confirmation_incidents'),
      ('manager_preorder_strikes'),
      ('preorder_notification_deliveries')
),
required_base_columns(table_name, column_name, expected_type) AS (
    VALUES
      ('preorders', 'id', 'bigint'),
      ('preorders', 'preorder_code', 'character varying'),
      ('preorders', 'store_id', 'bigint'),
      ('preorders', 'customer_user_id', 'bigint'),
      ('preorders', 'scheduled_start_at', 'timestamp with time zone'),
      ('preorders', 'scheduled_end_at', 'timestamp with time zone'),
      ('preorders', 'status', 'character varying'),
      ('preorders', 'responsible_manager_id', 'bigint'),
      ('users', 'id', 'bigint'),
      ('stores', 'id', 'bigint')
),
table_checks AS (
    SELECT
      'required_base_tables'::text AS check_name,
      COUNT(*) FILTER (WHERE t.table_name IS NULL)::bigint AS issue_count
    FROM required_base_tables r
    LEFT JOIN information_schema.tables t
      ON t.table_schema = current_schema() AND t.table_name = r.table_name
),
column_checks AS (
    SELECT
      'preorders_required_columns'::text AS check_name,
      COUNT(*) FILTER (WHERE c.column_name IS NULL OR c.data_type <> r.expected_type)::bigint AS issue_count
    FROM required_base_columns r
    LEFT JOIN information_schema.columns c
      ON c.table_schema = current_schema()
     AND c.table_name = r.table_name
     AND c.column_name = r.column_name
),
partial_installation_checks AS (
    SELECT
      'partial_0033_installation'::text AS check_name,
      CASE
        WHEN (to_regclass('preorder_checkin_requests') IS NOT NULL) <> (to_regclass('preorder_slot_strike_events') IS NOT NULL)
        THEN 1
        ELSE 0
      END::bigint AS issue_count
),
expected_checkin_columns(table_name, column_name, expected_type, is_nullable, char_max_length) AS (
    VALUES
      ('preorder_checkin_requests', 'id', 'bigint', 'NO', NULL::integer),
      ('preorder_checkin_requests', 'preorder_id', 'bigint', 'NO', NULL::integer),
      ('preorder_checkin_requests', 'store_id', 'bigint', 'NO', NULL::integer),
      ('preorder_checkin_requests', 'customer_user_id', 'bigint', 'NO', NULL::integer),
      ('preorder_checkin_requests', 'scheduled_start_at', 'timestamp with time zone', 'NO', NULL::integer),
      ('preorder_checkin_requests', 'scheduled_end_at', 'timestamp with time zone', 'NO', NULL::integer),
      ('preorder_checkin_requests', 'requested_at', 'timestamp with time zone', 'NO', NULL::integer),
      ('preorder_checkin_requests', 'status', 'character varying', 'NO', 40),
      ('preorder_checkin_requests', 'resolved_by', 'bigint', 'YES', NULL::integer),
      ('preorder_checkin_requests', 'resolved_at', 'timestamp with time zone', 'YES', NULL::integer),
      ('preorder_checkin_requests', 'rejection_reason', 'character varying', 'YES', 500),
      ('preorder_checkin_requests', 'late_confirmation_reason', 'character varying', 'YES', 500),
      ('preorder_checkin_requests', 'manager_breach_recorded_at', 'timestamp with time zone', 'YES', NULL::integer),
      ('preorder_checkin_requests', 'created_at', 'timestamp with time zone', 'NO', NULL::integer),
      ('preorder_checkin_requests', 'updated_at', 'timestamp with time zone', 'NO', NULL::integer),
      ('preorder_slot_strike_events', 'id', 'bigint', 'NO', NULL::integer),
      ('preorder_slot_strike_events', 'preorder_id', 'bigint', 'NO', NULL::integer),
      ('preorder_slot_strike_events', 'scheduled_start_at', 'timestamp with time zone', 'NO', NULL::integer),
      ('preorder_slot_strike_events', 'manager_id', 'bigint', 'NO', NULL::integer),
      ('preorder_slot_strike_events', 'strike_source', 'character varying', 'NO', 40),
      ('preorder_slot_strike_events', 'created_at', 'timestamp with time zone', 'NO', NULL::integer)
),
existing_column_shape_checks AS (
    SELECT
      'existing_0033_column_shape_compatible'::text AS check_name,
      COUNT(*) FILTER (
        WHERE t.table_name IS NOT NULL
          AND (c.column_name IS NULL
               OR c.data_type <> exp.expected_type
               OR c.is_nullable <> exp.is_nullable
               OR (exp.char_max_length IS NOT NULL AND c.character_maximum_length <> exp.char_max_length))
      )::bigint AS issue_count
    FROM expected_checkin_columns exp
    LEFT JOIN information_schema.tables t
      ON t.table_schema = current_schema() AND t.table_name = exp.table_name
    LEFT JOIN information_schema.columns c
      ON c.table_schema = current_schema()
     AND c.table_name = exp.table_name
     AND c.column_name = exp.column_name
),
preexisting_object_checks AS (
    SELECT
      'checkin_objects_absent_or_compatible'::text AS check_name,
      CASE
        -- If neither table exists, it is clean for creation -> PASS
        WHEN to_regclass('preorder_checkin_requests') IS NULL AND to_regclass('preorder_slot_strike_events') IS NULL THEN 0
        -- If both exist, verify constraints, foreign keys (with ON DELETE RESTRICT), indexes and triggers
        WHEN to_regclass('preorder_checkin_requests') IS NOT NULL AND to_regclass('preorder_slot_strike_events') IS NOT NULL THEN
          (
            SELECT COUNT(*)::bigint FROM (
              -- Unique constraints
              SELECT 1 WHERE NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_preorder_checkin_slot' AND conrelid = 'preorder_checkin_requests'::regclass
              )
              UNION ALL
              SELECT 1 WHERE NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_preorder_slot_strike' AND conrelid = 'preorder_slot_strike_events'::regclass
              )
              -- Check constraints
              UNION ALL
              SELECT 1 WHERE NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'chk_preorder_checkin_schedule'
                  AND conrelid = 'preorder_checkin_requests'::regclass
                  AND pg_get_constraintdef(oid) ILIKE '%scheduled_end_at%scheduled_start_at%'
              )
              UNION ALL
              SELECT 1 WHERE NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'chk_preorder_checkin_status_resolution'
                  AND conrelid = 'preorder_checkin_requests'::regclass
                  AND pg_get_constraintdef(oid) ILIKE '%PENDING%'
                  AND pg_get_constraintdef(oid) ILIKE '%CONFIRMED%'
                  AND pg_get_constraintdef(oid) ILIKE '%REJECTED%'
                  AND pg_get_constraintdef(oid) ILIKE '%RESCHEDULED%'
                  AND pg_get_constraintdef(oid) ILIKE '%resolved_by IS NOT NULL%'
                  AND pg_get_constraintdef(oid) ILIKE '%resolved_at IS NOT NULL%'
              )
              UNION ALL
              SELECT 1 WHERE NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'preorder_slot_strike_events'::regclass
                  AND contype = 'c'
                  AND pg_get_constraintdef(oid) ILIKE '%CONFIRMATION_BREACH%'
                  AND pg_get_constraintdef(oid) ILIKE '%CHECKIN_BREACH%'
              )
              -- Foreign keys with exact source/target column and confdeltype = 'r' (RESTRICT)
              UNION ALL
              SELECT 1 WHERE NOT EXISTS (
                SELECT 1 FROM pg_constraint c
                JOIN pg_attribute sa ON sa.attrelid = c.conrelid AND sa.attnum = ANY(c.conkey)
                JOIN pg_attribute ta ON ta.attrelid = c.confrelid AND ta.attnum = ANY(c.confkey)
                WHERE c.conrelid = 'preorder_checkin_requests'::regclass
                  AND c.confrelid = 'preorders'::regclass
                  AND c.contype = 'f'
                  AND c.confdeltype = 'r'
                  AND sa.attname = 'preorder_id'
                  AND ta.attname = 'id'
              )
              UNION ALL
              SELECT 1 WHERE NOT EXISTS (
                SELECT 1 FROM pg_constraint c
                JOIN pg_attribute sa ON sa.attrelid = c.conrelid AND sa.attnum = ANY(c.conkey)
                JOIN pg_attribute ta ON ta.attrelid = c.confrelid AND ta.attnum = ANY(c.confkey)
                WHERE c.conrelid = 'preorder_checkin_requests'::regclass
                  AND c.confrelid = 'stores'::regclass
                  AND c.contype = 'f'
                  AND c.confdeltype = 'r'
                  AND sa.attname = 'store_id'
                  AND ta.attname = 'id'
              )
              UNION ALL
              SELECT 1 WHERE NOT EXISTS (
                SELECT 1 FROM pg_constraint c
                JOIN pg_attribute sa ON sa.attrelid = c.conrelid AND sa.attnum = ANY(c.conkey)
                JOIN pg_attribute ta ON ta.attrelid = c.confrelid AND ta.attnum = ANY(c.confkey)
                WHERE c.conrelid = 'preorder_checkin_requests'::regclass
                  AND c.confrelid = 'users'::regclass
                  AND c.contype = 'f'
                  AND c.confdeltype = 'r'
                  AND sa.attname = 'customer_user_id'
                  AND ta.attname = 'id'
              )
              UNION ALL
              SELECT 1 WHERE NOT EXISTS (
                SELECT 1 FROM pg_constraint c
                JOIN pg_attribute sa ON sa.attrelid = c.conrelid AND sa.attnum = ANY(c.conkey)
                JOIN pg_attribute ta ON ta.attrelid = c.confrelid AND ta.attnum = ANY(c.confkey)
                WHERE c.conrelid = 'preorder_checkin_requests'::regclass
                  AND c.confrelid = 'users'::regclass
                  AND c.contype = 'f'
                  AND c.confdeltype = 'r'
                  AND sa.attname = 'resolved_by'
                  AND ta.attname = 'id'
              )
              UNION ALL
              SELECT 1 WHERE NOT EXISTS (
                SELECT 1 FROM pg_constraint c
                JOIN pg_attribute sa ON sa.attrelid = c.conrelid AND sa.attnum = ANY(c.conkey)
                JOIN pg_attribute ta ON ta.attrelid = c.confrelid AND ta.attnum = ANY(c.confkey)
                WHERE c.conrelid = 'preorder_slot_strike_events'::regclass
                  AND c.confrelid = 'preorders'::regclass
                  AND c.contype = 'f'
                  AND c.confdeltype = 'r'
                  AND sa.attname = 'preorder_id'
                  AND ta.attname = 'id'
              )
              UNION ALL
              SELECT 1 WHERE NOT EXISTS (
                SELECT 1 FROM pg_constraint c
                JOIN pg_attribute sa ON sa.attrelid = c.conrelid AND sa.attnum = ANY(c.conkey)
                JOIN pg_attribute ta ON ta.attrelid = c.confrelid AND ta.attnum = ANY(c.confkey)
                WHERE c.conrelid = 'preorder_slot_strike_events'::regclass
                  AND c.confrelid = 'users'::regclass
                  AND c.contype = 'f'
                  AND c.confdeltype = 'r'
                  AND sa.attname = 'manager_id'
                  AND ta.attname = 'id'
              )
              -- Trigger and function
              UNION ALL
              SELECT 1 WHERE NOT EXISTS (
                SELECT 1 FROM pg_trigger t
                JOIN pg_proc p ON p.oid = t.tgfoid
                WHERE t.tgname = 'trg_preorder_checkin_parent_snapshot'
                  AND t.tgrelid = 'preorder_checkin_requests'::regclass
                  AND p.proname = 'trg_verify_preorder_checkin_parent_snapshot'
                  AND t.tgenabled = 'O'
              )
              UNION ALL
              SELECT 1 WHERE NOT EXISTS (
                SELECT 1 FROM pg_proc
                WHERE proname = 'trg_verify_preorder_checkin_parent_snapshot'
                  AND prorettype = 'trigger'::regtype
              )
              -- Required indexes
              UNION ALL
              SELECT 1 WHERE NOT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE tablename = 'preorder_checkin_requests'
                  AND indexname = 'idx_preorder_checkin_requests_due'
              )
              UNION ALL
              SELECT 1 WHERE NOT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE tablename = 'preorder_checkin_requests'
                  AND indexname = 'idx_preorder_checkin_requests_preorder'
              )
              UNION ALL
              SELECT 1 WHERE NOT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE tablename = 'preorder_slot_strike_events'
                  AND indexname = 'idx_preorder_slot_strike_manager'
              )
            ) sub
          )
        ELSE 1
      END::bigint AS issue_count
),
tracker_checks AS (
    SELECT
      'unexpected_0033_tracker_row'::text AS check_name,
      CASE
        WHEN to_regclass('schema_migrations') IS NOT NULL AND EXISTS (
          SELECT 1 FROM schema_migrations WHERE version = '0033'
        ) THEN 1
        ELSE 0
      END::bigint AS issue_count
),
checks AS (
    SELECT * FROM table_checks
    UNION ALL SELECT * FROM column_checks
    UNION ALL SELECT * FROM partial_installation_checks
    UNION ALL SELECT * FROM existing_column_shape_checks
    UNION ALL SELECT * FROM preexisting_object_checks
    UNION ALL SELECT * FROM tracker_checks
)
SELECT check_name, issue_count, CASE WHEN issue_count = 0 THEN 'PASS' ELSE 'BLOCK' END AS status
FROM checks
ORDER BY check_name;
