# 0025 industry-root restore: execution and forward-fix plan

Status: draft only. Do not apply to production until the owner explicitly approves production execution.

## Scope

Migration `0025_restore_industry_roots_from_legacy_menu.sql` restores only categories `1`, `14`, and `15` from `parent_id = 33, depth = 1` to root state (`parent_id = NULL, depth = 0`). It leaves `22`, `24`, `25`, all `Cat...` data, root `33`, all products, all orders, and all payment snapshots untouched.

The category-1 `DEFAULT_LONG` mapping row is retained but marked inactive. This is required because `DEFAULT_LONG` is legacy/historical and must not receive new direct P0 traffic after category 1 becomes a root. Categories `14` and `15` receive no payment mapping. `QUAN__O -> Nước Giải Khát` remains a future candidate only.

## Preflight

1. Run the existing root-33 restore proposal audit and retain its result with the release record.
2. Confirm categories `1`, `14`, and `15` are active direct children of root `33` at depth `1`.
3. Confirm `22 -> 15`, `24 -> 14`, and `25 -> 14`, each at depth `1`.
4. Confirm `14` and `15` have no `category_payment_profiles` row.
5. Confirm category `1` has exactly one active `DEFAULT_LONG` profile mapping with `purpose = industry` and `status = active`.
6. Run the production migration executor in dry-run mode targeting `0025`; do not use application startup for production migrations.

## Apply and verify

1. Take the normal production backup/snapshot.
2. Apply `0025` only through the approved production migration executor with manual approval.
3. Run `production-0025-restore-industry-roots-verify.sql`.
4. Verify roots `1`, `14`, and `15` have null parents and depth `0`; descendants remain `22 -> 15`, `24/25 -> 14`, at depth `1`.
5. Verify category `1` has only a disabled `DEFAULT_LONG` mapping, and `14`/`15` still have no mapping.
6. Smoke test catalog navigation and a checkout for each restored root. New direct checkout must use a separately approved active industry profile or the global fallback, never `DEFAULT_LONG`.

## Failure and forward-fix

- Before commit: the migration runner wraps the file in one transaction. A failed precondition or SQL error rolls back all changes from `0025`.
- After a successful commit: do not run the old 0015 rollback/backfill. It would reparent unrelated fixture data and reintroduce the known hierarchy drift.
- If the business decision must be reversed, create a new, explicitly approved forward migration. It must validate the then-current tree and move only `1`, `14`, and `15` back under `33`; it must not reactivate `DEFAULT_LONG` automatically.
- Do not delete root `33` in the forward-fix. Root cleanup is a separate operation after every remaining dependency has been audited.
