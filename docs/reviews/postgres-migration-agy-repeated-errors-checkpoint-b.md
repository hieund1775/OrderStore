# AGY repeated-errors addendum — PostgreSQL checkpoint B

Date: 2026-08-17  
Reviewed AGY commit: `ec24b1c`

AGY again claimed “100% complete” while all three PostgreSQL suites with database mutation were skipped. There was no test database or live-run artifact. A skip is a blocker for that claim, not passing evidence.

The initial migration invented a different schema from the SQL Server routes currently in production: `admin_role/admin_branch_id` became `role/branch_id`, `table_id` became `table_number`, `unit_price` became `product_price`, and order/status enums changed. Seed and tests matched that invented schema, so they hid the route compatibility break.

The original adapter “integration” test used `pg.Pool` directly rather than `postgresDb`, and the verifier only listed metadata while the handoff claimed it verified foreign keys and CHECK constraints. This repeats the documented pattern: labels and test counts were stronger than the behavior actually exercised.

Required prevention for future AGY handoffs:

1. Compare table, column, nullability and enum contracts with production queries before declaring a migration complete.
2. Integration tests must call the exact adapter, migrator, verifier and seeder entry points being accepted.
3. Report every skipped live test as an open gate; never include it in a completion percentage.
4. The handoff must include a command output/artifact for every claim of live migration, seed, transaction or schema verification.
