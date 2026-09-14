-- Read-only production preflight for 0033_preorder_customer_checkin.sql.
-- Every row must be PASS/0 before the executor may apply 0033.
-- An existing 0033 object is accepted only when its complete canonical shape
-- is present in current_schema(); partial or look-alike objects fail closed.
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
    ('users', 'id', 'bigint'), ('stores', 'id', 'bigint')
),
object_state AS (
  SELECT
    to_regclass(format('%I.%I', current_schema(), 'preorder_checkin_requests')) AS checkin_rel,
    to_regclass(format('%I.%I', current_schema(), 'preorder_slot_strike_events')) AS strike_rel
),
object_mode AS (
  SELECT
    checkin_rel IS NOT NULL AS checkin_exists,
    strike_rel IS NOT NULL AS strike_exists,
    checkin_rel IS NOT NULL AND strike_rel IS NOT NULL AS both_exist
  FROM object_state
),
table_checks AS (
  SELECT 'required_base_tables'::text AS check_name,
    COUNT(*) FILTER (WHERE t.table_name IS NULL)::bigint AS issue_count
  FROM required_base_tables r
  LEFT JOIN information_schema.tables t
    ON t.table_schema = current_schema() AND t.table_name = r.table_name
),
column_checks AS (
  SELECT 'preorders_required_columns'::text AS check_name,
    COUNT(*) FILTER (WHERE c.column_name IS NULL OR c.data_type <> r.expected_type)::bigint AS issue_count
  FROM required_base_columns r
  LEFT JOIN information_schema.columns c
    ON c.table_schema = current_schema() AND c.table_name = r.table_name AND c.column_name = r.column_name
),
partial_installation_checks AS (
  SELECT 'partial_0033_installation'::text AS check_name,
    CASE WHEN checkin_exists <> strike_exists THEN 1 ELSE 0 END::bigint AS issue_count
  FROM object_mode
),
expected_columns(table_name, column_name, expected_type, nullable, max_length, identity_required, default_kind) AS (
  VALUES
    ('preorder_checkin_requests', 'id', 'bigint', 'NO', NULL::integer, TRUE, 'none'),
    ('preorder_checkin_requests', 'preorder_id', 'bigint', 'NO', NULL::integer, FALSE, 'none'),
    ('preorder_checkin_requests', 'store_id', 'bigint', 'NO', NULL::integer, FALSE, 'none'),
    ('preorder_checkin_requests', 'customer_user_id', 'bigint', 'NO', NULL::integer, FALSE, 'none'),
    ('preorder_checkin_requests', 'scheduled_start_at', 'timestamp with time zone', 'NO', NULL::integer, FALSE, 'none'),
    ('preorder_checkin_requests', 'scheduled_end_at', 'timestamp with time zone', 'NO', NULL::integer, FALSE, 'none'),
    ('preorder_checkin_requests', 'requested_at', 'timestamp with time zone', 'NO', NULL::integer, FALSE, 'current_timestamp'),
    ('preorder_checkin_requests', 'status', 'character varying', 'NO', 40, FALSE, 'none'),
    ('preorder_checkin_requests', 'resolved_by', 'bigint', 'YES', NULL::integer, FALSE, 'none'),
    ('preorder_checkin_requests', 'resolved_at', 'timestamp with time zone', 'YES', NULL::integer, FALSE, 'none'),
    ('preorder_checkin_requests', 'rejection_reason', 'character varying', 'YES', 500, FALSE, 'none'),
    ('preorder_checkin_requests', 'late_confirmation_reason', 'character varying', 'YES', 500, FALSE, 'none'),
    ('preorder_checkin_requests', 'manager_breach_recorded_at', 'timestamp with time zone', 'YES', NULL::integer, FALSE, 'none'),
    ('preorder_checkin_requests', 'created_at', 'timestamp with time zone', 'NO', NULL::integer, FALSE, 'current_timestamp'),
    ('preorder_checkin_requests', 'updated_at', 'timestamp with time zone', 'NO', NULL::integer, FALSE, 'current_timestamp'),
    ('preorder_slot_strike_events', 'id', 'bigint', 'NO', NULL::integer, TRUE, 'none'),
    ('preorder_slot_strike_events', 'preorder_id', 'bigint', 'NO', NULL::integer, FALSE, 'none'),
    ('preorder_slot_strike_events', 'scheduled_start_at', 'timestamp with time zone', 'NO', NULL::integer, FALSE, 'none'),
    ('preorder_slot_strike_events', 'manager_id', 'bigint', 'NO', NULL::integer, FALSE, 'none'),
    ('preorder_slot_strike_events', 'strike_source', 'character varying', 'NO', 40, FALSE, 'none'),
    ('preorder_slot_strike_events', 'created_at', 'timestamp with time zone', 'NO', NULL::integer, FALSE, 'current_timestamp')
),
existing_column_shape_checks AS (
  SELECT 'existing_0033_column_shape_compatible'::text AS check_name,
    CASE WHEN NOT m.both_exist THEN 0 ELSE COUNT(*) FILTER (WHERE
      c.column_name IS NULL
      OR c.data_type <> e.expected_type
      OR c.is_nullable <> e.nullable
      OR (e.max_length IS NOT NULL AND c.character_maximum_length <> e.max_length)
      OR (e.identity_required AND c.is_identity <> 'YES')
      OR (NOT e.identity_required AND c.is_identity <> 'NO')
      OR (e.default_kind = 'none' AND c.column_default IS NOT NULL)
      OR (e.default_kind = 'current_timestamp' AND regexp_replace(lower(coalesce(c.column_default, '')), '[[:space:]]+', '', 'g') NOT IN ('current_timestamp', 'now()'))
    ) END::bigint AS issue_count
  FROM expected_columns e
  CROSS JOIN object_mode m
  LEFT JOIN information_schema.columns c
    ON c.table_schema = current_schema() AND c.table_name = e.table_name AND c.column_name = e.column_name
  GROUP BY m.both_exist
),
unique_constraint_checks AS (
  SELECT 'existing_0033_unique_constraints_exact'::text AS check_name,
    CASE WHEN NOT m.both_exist THEN 0 ELSE
      (CASE WHEN EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = s.checkin_rel AND c.conname = 'uq_preorder_checkin_slot' AND c.contype = 'u'
          AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = s.checkin_rel AND attname = 'preorder_id'), (SELECT attnum FROM pg_attribute WHERE attrelid = s.checkin_rel AND attname = 'scheduled_start_at')]::smallint[]
      ) THEN 0 ELSE 1 END)
      + (CASE WHEN EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = s.strike_rel AND c.conname = 'uq_preorder_slot_strike' AND c.contype = 'u'
          AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = s.strike_rel AND attname = 'preorder_id'), (SELECT attnum FROM pg_attribute WHERE attrelid = s.strike_rel AND attname = 'scheduled_start_at')]::smallint[]
      ) THEN 0 ELSE 1 END)
    END::bigint AS issue_count
  FROM object_state s CROSS JOIN object_mode m
),
check_constraint_checks AS (
  SELECT 'existing_0033_check_constraints_exact'::text AS check_name,
    CASE WHEN NOT m.both_exist THEN 0 ELSE
      (CASE WHEN EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = s.checkin_rel AND c.conname = 'chk_preorder_checkin_schedule' AND c.contype = 'c'
          AND regexp_replace(lower(pg_get_constraintdef(c.oid)), '[[:space:]()]', '', 'g') = 'checkscheduled_end_at>scheduled_start_at'
      ) THEN 0 ELSE 1 END)
      + (CASE WHEN EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = s.checkin_rel AND c.conname = 'chk_preorder_checkin_status_resolution' AND c.contype = 'c'
          AND regexp_replace(regexp_replace(lower(pg_get_constraintdef(c.oid)), '::[a-z_ ]+', '', 'g'), '[[:space:]()]', '', 'g') LIKE '%status=''pending''andresolved_byisnullandresolved_atisnullandrejection_reasonisnullandlate_confirmation_reasonisnull%'
          AND regexp_replace(regexp_replace(lower(pg_get_constraintdef(c.oid)), '::[a-z_ ]+', '', 'g'), '[[:space:]()]', '', 'g') LIKE '%status=''confirmed''andresolved_byisnotnullandresolved_atisnotnull%'
          AND regexp_replace(regexp_replace(lower(pg_get_constraintdef(c.oid)), '::[a-z_ ]+', '', 'g'), '[[:space:]()]', '', 'g') LIKE '%status=''rejected''andresolved_byisnotnullandresolved_atisnotnullandrejection_reasonisnotnullandtrimrejection_reason<>''''%'
          AND regexp_replace(regexp_replace(lower(pg_get_constraintdef(c.oid)), '::[a-z_ ]+', '', 'g'), '[[:space:]()]', '', 'g') LIKE '%status=''rescheduled''andresolved_byisnotnullandresolved_atisnotnull%'
          AND (SELECT array_agg(DISTINCT labels.value[1] ORDER BY labels.value[1]) FROM regexp_matches(pg_get_constraintdef(c.oid), '''([A-Z_]+)''', 'g') AS labels(value)) = ARRAY['CONFIRMED', 'PENDING', 'REJECTED', 'RESCHEDULED']::text[]
      ) THEN 0 ELSE 1 END)
      + (CASE WHEN EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = s.strike_rel AND c.contype = 'c'
          AND (SELECT array_agg(DISTINCT labels.value[1] ORDER BY labels.value[1]) FROM regexp_matches(pg_get_constraintdef(c.oid), '''([A-Z_]+)''', 'g') AS labels(value)) = ARRAY['CHECKIN_BREACH', 'CONFIRMATION_BREACH']::text[]
      ) THEN 0 ELSE 1 END)
    END::bigint AS issue_count
  FROM object_state s CROSS JOIN object_mode m
),
expected_fks(table_name, column_name, referenced_table, referenced_column) AS (
  VALUES
    ('preorder_checkin_requests', 'preorder_id', 'preorders', 'id'),
    ('preorder_checkin_requests', 'store_id', 'stores', 'id'),
    ('preorder_checkin_requests', 'customer_user_id', 'users', 'id'),
    ('preorder_checkin_requests', 'resolved_by', 'users', 'id'),
    ('preorder_slot_strike_events', 'preorder_id', 'preorders', 'id'),
    ('preorder_slot_strike_events', 'manager_id', 'users', 'id')
),
foreign_key_checks AS (
  SELECT 'existing_0033_foreign_keys_exact'::text AS check_name,
    CASE WHEN NOT m.both_exist THEN 0 ELSE COUNT(*) FILTER (WHERE NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.contype = 'f'
        AND c.conrelid = to_regclass(format('%I.%I', current_schema(), f.table_name))
        AND c.confrelid = to_regclass(format('%I.%I', current_schema(), f.referenced_table))
        AND c.convalidated AND c.confdeltype = 'r'
        AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = c.conrelid AND attname = f.column_name)]::smallint[]
        AND c.confkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = c.confrelid AND attname = f.referenced_column)]::smallint[]
    )) END::bigint AS issue_count
  FROM expected_fks f CROSS JOIN object_mode m
  GROUP BY m.both_exist
),
index_checks AS (
  SELECT 'existing_0033_indexes_exact'::text AS check_name,
    CASE WHEN NOT m.both_exist THEN 0 ELSE
      (CASE WHEN EXISTS (
        SELECT 1 FROM pg_index i JOIN pg_class ix ON ix.oid = i.indexrelid
        WHERE i.indrelid = s.checkin_rel AND ix.relname = 'idx_preorder_checkin_requests_due'
          AND i.indisvalid AND i.indisready AND NOT i.indisunique
          AND i.indkey::smallint[] = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = s.checkin_rel AND attname = 'status'), (SELECT attnum FROM pg_attribute WHERE attrelid = s.checkin_rel AND attname = 'scheduled_start_at')]::smallint[]
          AND regexp_replace(regexp_replace(lower(pg_get_expr(i.indpred, i.indrelid)), '::[a-z_ ]+', '', 'g'), '[[:space:]()]', '', 'g') = 'status=''pending'''
      ) THEN 0 ELSE 1 END)
      + (CASE WHEN EXISTS (
        SELECT 1 FROM pg_index i JOIN pg_class ix ON ix.oid = i.indexrelid
        WHERE i.indrelid = s.checkin_rel AND ix.relname = 'idx_preorder_checkin_requests_preorder'
          AND i.indisvalid AND i.indisready AND NOT i.indisunique
          AND i.indkey::smallint[] = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = s.checkin_rel AND attname = 'preorder_id'), (SELECT attnum FROM pg_attribute WHERE attrelid = s.checkin_rel AND attname = 'created_at')]::smallint[]
          AND i.indoption::smallint[] = ARRAY[0::smallint, 1::smallint] AND i.indpred IS NULL
      ) THEN 0 ELSE 1 END)
      + (CASE WHEN EXISTS (
        SELECT 1 FROM pg_index i JOIN pg_class ix ON ix.oid = i.indexrelid
        WHERE i.indrelid = s.strike_rel AND ix.relname = 'idx_preorder_slot_strike_manager'
          AND i.indisvalid AND i.indisready AND NOT i.indisunique
          AND i.indkey::smallint[] = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = s.strike_rel AND attname = 'manager_id'), (SELECT attnum FROM pg_attribute WHERE attrelid = s.strike_rel AND attname = 'created_at')]::smallint[]
          AND i.indoption::smallint[] = ARRAY[0::smallint, 1::smallint] AND i.indpred IS NULL
      ) THEN 0 ELSE 1 END)
    END::bigint AS issue_count
  FROM object_state s CROSS JOIN object_mode m
),
trigger_checks AS (
  SELECT 'existing_0033_trigger_function_exact'::text AS check_name,
    CASE WHEN NOT m.both_exist THEN 0 ELSE CASE WHEN EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE t.tgrelid = s.checkin_rel
        AND t.tgname = 'trg_preorder_checkin_parent_snapshot'
        AND t.tgenabled = 'O'
        AND t.tgtype = 23
        AND p.proname = 'trg_verify_preorder_checkin_parent_snapshot'
        AND p.pronamespace = current_schema()::regnamespace
        AND p.prorettype = 'trigger'::regtype
    ) THEN 0 ELSE 1 END END::bigint AS issue_count
  FROM object_state s CROSS JOIN object_mode m
),
tracker_checks AS (
  SELECT 'unexpected_0033_tracker_row'::text AS check_name,
    CASE WHEN to_regclass(format('%I.%I', current_schema(), 'schema_migrations')) IS NOT NULL
              AND EXISTS (SELECT 1 FROM schema_migrations WHERE version = '0033')
         THEN 1 ELSE 0 END::bigint AS issue_count
),
checks AS (
  SELECT * FROM table_checks
  UNION ALL SELECT * FROM column_checks
  UNION ALL SELECT * FROM partial_installation_checks
  UNION ALL SELECT * FROM existing_column_shape_checks
  UNION ALL SELECT * FROM unique_constraint_checks
  UNION ALL SELECT * FROM check_constraint_checks
  UNION ALL SELECT * FROM foreign_key_checks
  UNION ALL SELECT * FROM index_checks
  UNION ALL SELECT * FROM trigger_checks
  UNION ALL SELECT * FROM tracker_checks
)
SELECT check_name, issue_count, CASE WHEN issue_count = 0 THEN 'PASS' ELSE 'BLOCK' END AS status
FROM checks
ORDER BY check_name;
