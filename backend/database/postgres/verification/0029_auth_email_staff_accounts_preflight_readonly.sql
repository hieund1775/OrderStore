-- 0029 Auth/Staff production preflight. Read-only only.
WITH required_columns(table_name, column_name) AS (
    VALUES
      ('users', 'id'), ('users', 'email'), ('users', 'is_active'),
      ('users', 'is_admin'), ('users', 'admin_role'), ('users', 'admin_branch_id'),
      ('users', 'token_version')
),
column_checks AS (
    SELECT 'required_auth_base_columns'::text AS check_name,
           COUNT(*) FILTER (WHERE c.column_name IS NULL)::int AS issue_count
    FROM required_columns r
    LEFT JOIN information_schema.columns c
      ON c.table_schema = current_schema()
     AND c.table_name = r.table_name
     AND c.column_name = r.column_name
),
verified_at_check AS (
    SELECT 'email_verified_at_shape'::text AS check_name,
           CASE WHEN c.column_name IS NULL OR c.data_type = 'timestamp with time zone' THEN 0 ELSE 1 END::int AS issue_count
    FROM (SELECT 'users'::text AS table_name) expected
    LEFT JOIN information_schema.columns c
      ON c.table_schema = current_schema() AND c.table_name = expected.table_name
     AND c.column_name = 'email_verified_at'
),
challenge_shape AS (
    SELECT 'auth_email_challenges_shape'::text AS check_name,
           CASE WHEN EXISTS (
             SELECT 1 FROM information_schema.tables
             WHERE table_schema = current_schema() AND table_name = 'auth_email_challenges'
           ) THEN COUNT(*) FILTER (WHERE c.column_name IS NULL)::int ELSE 0 END AS issue_count
    FROM (VALUES
      ('id'), ('user_id'), ('email'), ('purpose'), ('secret_hash'), ('expires_at'),
      ('attempts'), ('max_attempts'), ('sent_at'), ('consumed_at'), ('revoked_at'),
      ('created_at'), ('metadata')
    ) AS expected(column_name)
    LEFT JOIN information_schema.columns c
      ON c.table_schema = current_schema()
     AND c.table_name = 'auth_email_challenges'
     AND c.column_name = expected.column_name
),
challenge_conflicts AS (
    SELECT 'auth_email_challenges_conflicting_objects'::text AS check_name,
           CASE WHEN EXISTS (
             SELECT 1 FROM pg_class cls
             JOIN pg_namespace ns ON ns.oid = cls.relnamespace
             WHERE ns.nspname = current_schema() AND cls.relname = 'auth_email_challenges'
               AND cls.relkind NOT IN ('r', 'p')
           ) THEN 1 ELSE 0 END::int AS issue_count
),
role_branch_check AS (
    SELECT 'invalid_existing_staff_role_branch_state'::text AS check_name,
           COUNT(*) FILTER (WHERE COALESCE(is_admin, false) = true
             AND COALESCE(admin_role, '') NOT IN ('super', 'manager', 'cashier', 'kitchen', 'packing'))::int AS issue_count
    FROM users
),
email_check AS (
    SELECT 'duplicate_normalized_emails'::text AS check_name,
           COUNT(*)::int AS issue_count
    FROM (
      SELECT lower(btrim(email)) AS normalized_email
      FROM users WHERE email IS NOT NULL AND btrim(email) <> ''
      GROUP BY lower(btrim(email)) HAVING COUNT(*) > 1
    ) duplicates
),
checks AS (
    SELECT * FROM column_checks
    UNION ALL SELECT * FROM verified_at_check
    UNION ALL SELECT * FROM challenge_shape
    UNION ALL SELECT * FROM challenge_conflicts
    UNION ALL SELECT * FROM role_branch_check
    UNION ALL SELECT * FROM email_check
)
SELECT check_name, issue_count,
       CASE WHEN issue_count = 0 THEN 'PASS' ELSE 'BLOCK' END AS status
FROM checks
ORDER BY check_name;
