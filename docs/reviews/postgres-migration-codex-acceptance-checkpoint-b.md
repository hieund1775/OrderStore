# Checkpoint B — Codex acceptance and remediation

Date: 2026-08-17
Reviewed AGY commit: `ec24b1c`

## Decision

**Code acceptance: CONDITIONAL PASS after Codex remediation.** The PostgreSQL foundation is now suitable to continue to Checkpoint C, but it is **not approved to point production traffic at Supabase yet**. The three live PostgreSQL suites have not run because this workspace has no `TEST_DATABASE_URL` and `POSTGRES_INTEGRATION=1` confirmation.

The active application still executes SQL Server syntax. Do not set `DB_DIALECT=postgres` or replace the production `DATABASE_URL` until the route/query conversion checkpoint and an isolated PostgreSQL verification run both pass.

## AGY assessment

AGY supplied useful adapter, migrations, seed scaffolding and guarded test entry points. However its `100% complete` claim was not supportable. Severity was high because the original PostgreSQL baseline invented a different application schema: for example `role` instead of `admin_role`, `branch_id` instead of `admin_branch_id`, `table_number` instead of `table_id`, `product_price` instead of `unit_price`, and different order/status enums. Existing routes would have failed immediately after a database switch.

Assessment: **5/10 before remediation; 8/10 code quality after remediation, pending live evidence.**

## Findings fixed by Codex

| Finding | Impact | Remediation |
|---|---|---|
| Migration `0001_core.sql` did not preserve active backend columns and enum values. | Production route breakage on PostgreSQL cutover. | Rebuilt it as a PostgreSQL baseline of the current SQL Server contract; added a non-live regression contract test. |
| Demo seed used the invented schema. | Seed could not validate real route contract. | Rewrote seed for the restored columns and reset identity sequences safely. |
| Localhost test guard allowed any database name. | A mistaken local production-like database could be mutated. | Requires `_test`, `_perf`, `_dev`, or an explicit `POSTGRES_TEST_ALLOWED_HOSTS` allowlist. |
| Migration runner had no cross-process lock. | Concurrent Render deploys could race. | Added a PostgreSQL advisory lock, unique numeric version validation, and guaranteed unlock. |
| Rollback failure was logged then discarded. | Unsafe transaction state could be hidden. | Propagates an `AggregateError` when rollback cannot be confirmed. |
| Adapter integration test bypassed `postgresDb`. | The claimed adapter test did not test the adapter. | Uses `postgresDb.query`, `postgresDb.transaction`, commit and rollback behavior. |
| Schema verifier only checked table presence. | Missing route-critical columns/indexes could be accepted. | Verifies required tables, route-critical columns, and required indexes. |

## Verification evidence

- `npm.cmd test -- --test-reporter=spec`: **89 passed, 0 failed, 5 skipped**.
- `npm.cmd run test:postgres -- --test-reporter=spec`: **6 passed, 0 failed, 3 skipped**.
- `node --check` passed for all changed PostgreSQL JavaScript files.
- `git diff --check` passed.

The skipped tests are deliberately protected live tests: adapter/transaction, zero-to-current migration/schema, and demo seed integrity. There is no fabricated success artifact.

## Required gate before Supabase / Render database cutover

1. Create an isolated PostgreSQL test database or separate Supabase test project. It must not be the production project.
2. Set `TEST_DATABASE_URL`, `POSTGRES_INTEGRATION=1`, and, for a Supabase database named `postgres`, set `POSTGRES_TEST_ALLOWED_HOSTS` to that exact test-project host.
3. Run `npm.cmd run test:postgres` and require all three live suites to pass.
4. Keep production on SQL Server through Checkpoint C/D query conversion and data-migration verification; only then perform staged Render cutover with backups and rollback.
