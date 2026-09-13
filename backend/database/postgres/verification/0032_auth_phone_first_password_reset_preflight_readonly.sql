-- Read-only production preflight for 0032_auth_phone_first_password_reset.sql.
WITH checks AS (
  SELECT
    'auth_email_challenges_exists'::text AS check_name,
    CASE WHEN to_regclass('auth_email_challenges') IS NOT NULL THEN 0 ELSE 1 END::bigint AS issue_count
  UNION ALL
  SELECT
    'users_exists',
    CASE WHEN to_regclass('users') IS NOT NULL THEN 0 ELSE 1 END::bigint
  UNION ALL
  SELECT
    'auth_email_challenges_columns_compatible',
    CASE WHEN to_regclass('auth_email_challenges') IS NULL THEN 1
      ELSE (
        SELECT COUNT(*)::bigint
        FROM (
          VALUES
            ('id'), ('user_id'), ('email'), ('purpose'), ('secret_hash'),
            ('expires_at'), ('attempts'), ('max_attempts'), ('sent_at'),
            ('consumed_at'), ('revoked_at'), ('created_at'), ('metadata')
        ) AS expected(col)
        LEFT JOIN information_schema.columns c
          ON c.table_schema = current_schema()
         AND c.table_name = 'auth_email_challenges'
         AND c.column_name = expected.col
        WHERE c.column_name IS NULL
      )
    END::bigint
  UNION ALL
  SELECT
    'users_required_columns_compatible',
    CASE WHEN to_regclass('users') IS NULL THEN 1
      ELSE (
        SELECT COUNT(*)::bigint
        FROM (
          VALUES
            ('id'), ('phone'), ('email'), ('password_hash'), ('is_active'), ('token_version')
        ) AS expected(col)
        LEFT JOIN information_schema.columns c
          ON c.table_schema = current_schema()
         AND c.table_name = 'users'
         AND c.column_name = expected.col
        WHERE c.column_name IS NULL
      )
    END::bigint
  UNION ALL
  SELECT
    'auth_email_challenges_purpose_values_valid',
    CASE WHEN to_regclass('auth_email_challenges') IS NULL THEN 1
      ELSE (
        SELECT COUNT(*)::bigint
        FROM auth_email_challenges
        WHERE purpose IS NULL
           OR purpose NOT IN ('PASSWORD_RESET', 'EMAIL_VERIFICATION', 'STAFF_INVITE', 'PASSWORD_RESET_PHONE_PROOF')
      )
    END::bigint
)
SELECT check_name, issue_count, CASE WHEN issue_count = 0 THEN 'PASS' ELSE 'BLOCK' END AS status
FROM checks
ORDER BY check_name;
