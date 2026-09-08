# P1 PostgreSQL test-infrastructure debt

The combined PostgreSQL 56/56 run is not a release signal. Some suites share the
singleton `postgresDb`, migration tracker, and TeaPlus-Test public schema; suites
that replay migration chains can therefore observe state left by another suite.

P1 release evidence is the isolated gate set: fresh post-0025 → 0026 → runtime →
0027 rehearsal, payment unit/contract tests, guard tests, production executor
tests, and 0026/0027 schema verification. No test is skipped to hide a P1 failure.

Follow-up: give migration-replay suites dedicated schema/context and teardown,
without resetting or mutating shared TeaPlus-Test public state.
