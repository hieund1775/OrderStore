# Implementation Plan — Render Production Hardening và PostgreSQL/Supabase Migration

> Ngày: 17/08/2026  
> Spec: `docs/superpowers/specs/2026-08-17-render-supabase-postgres-migration-design.md`  
> Người thực hiện: AGY  
> Người nghiệm thu: Codex  
> Ưu tiên: Tạm dừng Phase 3 cho đến khi PostgreSQL staging PASS

## 0. Kết quả cuối

- Express backend chạy trên Render với PostgreSQL Supabase qua `pg`.
- Không còn SQL Server driver/T-SQL trong production paths.
- Database dựng mới hoàn toàn bằng PostgreSQL migrations.
- SQL Server data được import, đối soát và cutover có rollback runbook.
- OTP production an toàn; raw infrastructure errors không lộ ra client.
- PayOS webhook/expiry idempotent; scheduler tách khỏi web process.
- Backend contract không regression và PostgreSQL integration tests xanh.

## 1. Quy tắc bắt buộc

1. Không tiếp tục implement Phase 3 trong plan này. File `backend/test/phase3-orders-characterization.test.js` đang untracked là work-in-progress của người dùng/AGY; không xóa, sửa hoặc đưa vào commit migration nếu chưa được yêu cầu riêng.
2. Làm task theo thứ tự, mỗi task một commit có phạm vi rõ.
3. Dừng gửi Codex review tại cuối mỗi checkpoint; chỉ tiếp tục khi checkpoint PASS.
4. Không dùng Supabase Auth/REST/anon client cho bảng nghiệp vụ.
5. Không dual-write SQL Server/PostgreSQL.
6. Không dùng regex runtime để dịch SQL.
7. Không chạy integration/migration test trên database production.
8. Mọi database test bắt buộc `TEST_DATABASE_URL` trỏ DB dedicated và có explicit flag.
9. Không commit `.env`, connection string, password, Supabase service key hoặc dữ liệu PII export.
10. Không xóa SQL Server schema/scripts/data trong migration; chỉ loại khỏi production runtime ở checkpoint cuối.
11. Không claim hoàn tất bằng unit mocks; checkpoint database cần PostgreSQL integration artifact thật.
12. Mọi cleanup/rollback/finally bắt buộc propagate lỗi nếu trạng thái an toàn không được xác nhận.

## 2. Checkpoint A — Baseline và production hardening không phụ thuộc DB

### Task 1 — Khóa deploy/security contract hiện tại

**Files:**

- Create: `backend/test/deploy-security-contract.test.js`
- Modify: test helpers nếu cần, không sửa expected business contract hiện có

**Tests phải fail trước khi sửa:**

- Import Express app không tự `listen` hoặc tạo scheduler.
- Production unknown error trả safe message/error code, không chứa raw SQL text.
- Reverse proxy configuration tạo đúng client IP behavior.
- Swagger production disabled/protected.
- `/live` không truy cập DB; `/ready` dùng injected DB probe và timeout.
- Production OTP không chấp nhận fixed/demo code.
- Production startup fail nếu thiếu OTP provider configuration khi phone OTP được bật.

**Verify:**

```powershell
cd backend
node --test test/deploy-security-contract.test.js test/env.test.js
npm.cmd test
```

**Commit:** `test(deploy): lock production security and health contracts`

### Task 2 — Tách app/server, safe errors và Render runtime

**Files:**

- Create: `backend/app.js`
- Create: `backend/server.js`
- Create: `backend/middleware/error-handler.js`
- Create: `backend/middleware/request-context.js`
- Modify: `backend/index.js` hoặc thay bằng compatibility entrypoint nhỏ
- Modify: `backend/config/env.js`
- Modify: `backend/config/swagger.js`
- Modify: `backend/package.json`
- Modify: `backend/.env.example`
- Modify: `backend/test/deploy-security-contract.test.js`

**Implementation:**

- `app.js` chỉ build/export Express app.
- `server.js` validate env, listen, handle SIGTERM/SIGINT và đóng DB pool.
- Loại `setInterval` khỏi web process.
- Cấu hình `trust proxy` theo env với production default tương thích một Render proxy hop.
- Central error middleware dùng stable code và safe production message; structured log redact secrets/PII.
- `/live` và `/ready` theo spec.
- Swagger chỉ bật khi `ENABLE_API_DOCS=true`, production mặc định false.
- Pin Node 22 trong `engines`; start script chạy `server.js`.
- Thêm body-size limit hợp lý và request ID.

Không sửa business response 4xx đã được contract tests khóa trong task này.

**Verify:**

```powershell
cd backend
node --check app.js
node --check server.js
node --test test/deploy-security-contract.test.js test/env.test.js
npm.cmd test
npm.cmd audit --omit=dev
```

High/critical production advisory phải được sửa hoặc ghi exception cụ thể có phạm vi và ngày hết hạn; không bỏ qua output.

**Commit:** `fix(deploy): harden Express runtime for Render`

### Task 3 — OTP provider abstraction, không còn fixed OTP

**Files:**

- Create: `backend/services/otp-provider.js`
- Create: `backend/services/otp-service.js`
- Create: `backend/test/otp-security.test.js`
- Modify: `backend/routes/customerAuth.js`
- Modify: `backend/config/env.js`
- Modify: `backend/.env.example`

**Implementation:**

- Secure random OTP, hash bằng HMAC/crypto với server secret, TTL/attempt/resend limits.
- Provider interface có production implementation cấu hình bằng env và test fake.
- Không log/trả OTP ở production; development fake chỉ bật bằng explicit non-production flag.
- Persistence interface được inject; ở Checkpoint A có thể dùng test adapter, nhưng production phone OTP phải fail closed cho đến khi PostgreSQL `otp_codes` hoàn thành tại Task 7.
- Normalize phone duy nhất trước rate-limit/storage.

**Verify:**

```powershell
cd backend
node --test test/otp-security.test.js test/deploy-security-contract.test.js
npm.cmd test
```

**Commit:** `fix(auth): replace fixed OTP with secure provider flow`

### Checkpoint A gate

- Full backend suite xanh.
- `npm audit --omit=dev` không còn finding high/critical chưa được ghi nhận rõ.
- App import không bind port/scheduler.
- Không fixed OTP hoặc raw unknown error trong production response.
- AGY gửi `docs/reviews/postgres-migration-agy-handoff-checkpoint-a.md`, rồi dừng chờ Codex.

## 3. Checkpoint B — PostgreSQL foundation và schema

### Task 4 — Thêm PostgreSQL adapter và dedicated integration guard

**Files:**

- Create: `backend/config/db-postgres.js`
- Create: `backend/config/db-factory.js`
- Create: `backend/test/postgres-adapter.integration.test.js`
- Create: `backend/test/postgres-test-guard.test.js`
- Modify: `backend/package.json`, `backend/package-lock.json`
- Modify: `backend/config/env.js`, `backend/.env.example`

**Adapter:**

- Dùng `pg.Pool`, SSL/pool/timeouts từ env.
- Contract `[rows, affected]`, transaction cùng client, rollback/release chắc chắn.
- Parameterized `$1...$n`; cấm inline escape compatibility.
- `close()` idempotent phục vụ graceful shutdown.
- Startup production dùng `DATABASE_URL`; SQL Server adapter chỉ là migration fallback tạm thời và không được bundle/import khi `DB_DIALECT=postgres`.

**Integration guard:**

- Chỉ chạy khi `POSTGRES_INTEGRATION=1`.
- Bắt buộc URL/database có marker `_test` hoặc Supabase staging project allowlist explicit.
- Cấm production project ref/database URL fingerprint.
- Không in credential trong log/failure.

**Verify:**

```powershell
cd backend
node --test test/postgres-test-guard.test.js
$env:POSTGRES_INTEGRATION='1'; npm.cmd run test:postgres
Remove-Item Env:POSTGRES_INTEGRATION
npm.cmd test
```

**Commit:** `feat(db): add guarded PostgreSQL adapter`

### Task 5 — Viết migration runner và schema PostgreSQL zero-to-current

**Files:**

- Create: `backend/database/postgres/migrations/0001_core.sql`
- Create: `backend/database/postgres/migrations/0002_auth_operations.sql`
- Create: `backend/database/postgres/migrations/0003_indexes.sql`
- Create: `backend/database/postgres/migrate.js`
- Create: `backend/database/postgres/verify-schema.js`
- Create: `backend/test/postgres-schema.integration.test.js`
- Modify: `backend/package.json`
- Modify: `.gitignore` để track `backend/database/postgres/**/*.sql` nhưng vẫn ignore SQL dump/export

**Schema:**

- Tạo các bảng giữ lại theo spec.
- Bổ sung `user_identities`, secure `otp_codes`, `payment_events`, `idempotency_keys`, `schema_migrations`, `background_jobs`.
- Types/check/unique partial indexes/FKs/delete policy/indexes theo spec.
- `promotions.scope` legacy không được dùng làm eligibility authority.
- Migration runner checksum mỗi file, lock migration, transaction khi hợp lệ và từ chối file đã sửa sau apply.
- Không `DROP DATABASE`; migration production không destructive mặc định.
- Do repo đang ignore `*.sql`, thêm exception hẹp cho migration SQL trong `backend/database/postgres/migrations/`; không mở allowlist cho dump.

**Test:**

- Fresh database apply 2 lần idempotently ở runner level.
- Introspect tables/columns/constraints/indexes.
- Invalid qty/money/role/date/duplicate provider identity bị DB reject.
- Rollback transaction khi migration lỗi mô phỏng.

**Verify:**

```powershell
cd backend
$env:POSTGRES_INTEGRATION='1'; npm.cmd run db:pg:migrate:test
$env:POSTGRES_INTEGRATION='1'; node --test test/postgres-schema.integration.test.js
Remove-Item Env:POSTGRES_INTEGRATION
npm.cmd test
```

**Commit:** `feat(db): add PostgreSQL schema migrations`

### Task 6 — PostgreSQL demo seed tách biệt production

**Files:**

- Create: `backend/database/postgres/seed-demo.js`
- Create: `backend/test/postgres-seed.integration.test.js`
- Modify: `backend/package.json`

- Seed deterministic, idempotent qua namespace/reset explicit.
- Chỉ dedicated dev/test DB; cấm production/staging thật nếu không có one-time explicit migration mode.
- Không chứa credential thật, PII thật hoặc password mặc định dùng được production.
- Kiểm tra FK, row counts và rerun behavior.

**Commit:** `feat(db): add guarded PostgreSQL demo seed`

### Checkpoint B gate

- Fresh PostgreSQL dedicated DB dựng được chỉ từ migrations.
- Adapter transaction/query integration xanh.
- Schema verification artifact đầy đủ.
- Chưa đổi production routes sang PostgreSQL ở checkpoint này.
- AGY gửi handoff checkpoint B và dừng chờ Codex.

## 4. Checkpoint C — Auth, catalog và public reads

### Task 7 — Chuyển users/auth/OTP/Google identity

**Files:**

- Modify: `backend/routes/auth.js`, `backend/routes/customerAuth.js`
- Modify: `backend/services/otp-service.js`
- Create: `backend/repositories/postgres/users.js`
- Create: `backend/repositories/postgres/otp.js`
- Create: `backend/test/postgres-auth.integration.test.js`
- Modify: auth/JWT tests

**Requirements:**

- Admin login/me, phone OTP và Google signup/login chạy PostgreSQL.
- Google mapping dùng provider subject trong `user_identities`, email chỉ là profile/contact.
- OTP verify lock/attempt/consume atomic; cleanup expired rows có command riêng.
- JWT checks current user active state và `token_version` ở protected session boundary phù hợp.
- Không raw DB error; uniqueness race được phân loại business response.

**Commit:** `feat(auth): move identity and OTP flows to PostgreSQL`

### Task 8 — Chuyển catalog, stores và public read domains

**Files:**

- Create: `backend/repositories/postgres/catalog.js`
- Create: `backend/repositories/postgres/stores.js`
- Modify: `backend/routes/public.js` hoặc service liên quan, không refactor Phase 3 ngoài nhu cầu query conversion
- Create: `backend/test/postgres-public-read.integration.test.js`

Chuyển products/categories/options/stores/search/jobs/tiers/rewards/reviews/wishlist read paths. Thay JSON/TOP/T-SQL đúng PostgreSQL, giữ response contract.

**Commit:** `feat(api): move public read domains to PostgreSQL`

### Checkpoint C gate

- Auth/OTP/Google và public reads chạy PostgreSQL staging thật.
- Contract HTTP hiện có xanh.
- Không SQL Server query còn lại trong các domain đã chuyển.
- Handoff checkpoint C và dừng Codex review.

## 5. Checkpoint D — Promotions, orders và payments

### Task 9 — Chuyển promotions/voucher concurrency

**Files:**

- Create: `backend/repositories/postgres/promotions.js`
- Modify: `backend/services/price-engine.js`
- Create: `backend/test/postgres-voucher-concurrency.integration.test.js`

- Eligibility theo `promotion_stores` và rule hiện hành; không parse `scope` text để authorize.
- Consume usage limit và single-use atomically bằng conditional update/unique constraint/transaction.
- Hai request cạnh tranh chỉ một request thắng khi còn một lượt.

**Commit:** `feat(db): move voucher concurrency to PostgreSQL`

### Task 10 — Chuyển create/lookup/history/cancel order và idempotency

**Files:**

- Create: `backend/repositories/postgres/orders.js`
- Create: `backend/services/order-idempotency.js`
- Modify: order paths trong `backend/routes/public.js`
- Modify: `backend/services/order-batch-loader.js`
- Create: `backend/test/postgres-orders.integration.test.js`
- Create: `backend/test/postgres-order-concurrency.integration.test.js`

- Create order dùng `Idempotency-Key`, request hash và stored result.
- Insert dùng `RETURNING`; transaction cùng client.
- Guest cancel token/JWT ownership giữ nguyên.
- Cancel/status latest dùng `FOR UPDATE`, lock ordering nhất quán và idempotent.
- History cursor/query count/DTO contract giữ nguyên.
- Hai create retry không tạo hai order; hai cancel cạnh tranh chỉ một transition.

**Commit:** `feat(orders): move public order flows to PostgreSQL`

### Task 11 — Chuyển PayOS webhook, payment state và cron command

**Files:**

- Create: `backend/repositories/postgres/payments.js`
- Create: `backend/commands/expire-payos-orders.js`
- Modify: `backend/routes/payments.js`
- Modify: `backend/services/payment-state.js`
- Modify: `backend/services/webhook-classifier.js`
- Create: `backend/test/postgres-payment.integration.test.js`
- Create: `backend/test/payos-cron.test.js`

- Webhook insert/upsert `payment_events`, CAS amount/provider/status và mark event result trong transaction.
- Duplicate event idempotent.
- Cron command advisory lock, batch update `RETURNING`, exit code đúng và không chứa timer.
- Render cron command được document nhưng không tạo external service trước khi user cấu hình project.

**Commit:** `feat(payments): move PayOS state and cron to PostgreSQL`

### Checkpoint D gate

- PostgreSQL concurrency integration tests xanh trên dedicated DB.
- Không T-SQL còn trong public order/promotion/payment paths.
- PayOS fake/provider tests và contract suite xanh.
- Handoff checkpoint D và dừng Codex review.

## 6. Checkpoint E — Admin/KDS và production runtime PostgreSQL-only

### Task 12 — Chuyển admin/KDS/reports/settings còn lại

**Files:**

- Create repositories PostgreSQL theo domain tối thiểu cần thiết
- Modify: `backend/routes/admin.js`
- Modify: `backend/services/audit.js`
- Create: `backend/test/postgres-admin.integration.test.js`

Chuyển toàn bộ admin orders/status/payment/print, KDS, dashboard, reports, menu CRUD, branches, promotions, inventory, settings, notifications và tables. Giữ RBAC/branch scope trước query/mutation. Không kết hợp tách route Phase 3 trong task này.

**Commit:** `feat(admin): move admin and KDS flows to PostgreSQL`

### Task 13 — Loại SQL Server khỏi production runtime và chuyển perf tooling

**Files:**

- Modify: `backend/package.json`, lockfile
- Remove khỏi production imports/dependencies: `mssql`, `msnodesqlv8`
- Archive/retain SQL Server migration tools dưới thư mục migration legacy không được import production
- Rewrite: perf runner/index verification cho PostgreSQL `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`
- Create: `backend/test/no-sql-server-production.test.js`

Static test fail nếu production paths có `TOP`, `GETDATE`, `OUTPUT INSERTED`, lock hints, `FOR JSON PATH`, `sys.*` hoặc import SQL Server driver. Legacy export/import scripts được allowlist rõ.

**Verify:**

```powershell
cd backend
npm.cmd test
$env:POSTGRES_INTEGRATION='1'; npm.cmd run test:postgres
Remove-Item Env:POSTGRES_INTEGRATION
npm.cmd audit --omit=dev
```

**Commit:** `refactor(db): make PostgreSQL the only production runtime`

### Checkpoint E gate

- Full application chạy PostgreSQL staging.
- Không SQL Server driver/T-SQL production path.
- Backend full + PostgreSQL suite xanh.
- Frontend test/build xanh với staging API contract.
- Handoff checkpoint E và dừng Codex review.

## 7. Checkpoint F — Data migration, Render staging và cutover runbook

### Task 14 — Export/transform/import pipeline và reconciliation

**Files:**

- Create: `backend/database/postgres/migration/export-sqlserver.js`
- Create: `backend/database/postgres/migration/import-postgres.js`
- Create: `backend/database/postgres/migration/reconcile.js`
- Create: `backend/test/data-transform.test.js`
- Create: `docs/reviews/postgres-migration-rehearsal.md`

**Rules:**

- Export directory ignored; không commit data dump.
- Preserve IDs, normalize types/phones/emails, map user identities, validate JSON.
- Import dependency order và transaction/batches phù hợp.
- Reset sequences.
- Reconcile every table plus core aggregates/totals/latest status/payment references.
- Output machine-readable report không chứa PII.
- Any core mismatch exits non-zero.

**Commit:** `feat(migration): add SQL Server to PostgreSQL data pipeline`

### Task 15 — Render config, smoke tests và operational runbooks

**Files:**

- Create: `render.yaml` hoặc documented Render configuration phù hợp repo
- Create: `backend/test/render-staging-smoke.js`
- Create: `docs/deploy/render-supabase-runbook.md`
- Create: `docs/deploy/postgres-cutover-runbook.md`
- Create: `docs/deploy/postgres-rollback-runbook.md`
- Update: `backend/.env.example`

Không commit real service IDs/secrets. Runbook ghi root directory, build/start/cron commands, env inventory, pool size, SSL, health paths, maintenance toggle, backup, cutover, rollback và owner/check boxes.

Smoke suite dùng staging base URL và synthetic account/order namespace; cleanup chắc chắn và không chạy production nếu không explicit allowlist.

**Commit:** `docs(deploy): add Render Supabase cutover runbooks`

### Task 16 — Staging rehearsal và final handoff

**Artifacts:**

- Migration timings/counts.
- Reconciliation JSON và summary.
- PostgreSQL schema verification.
- Backend/PostgreSQL/frontend test outputs.
- Render `/live`/`/ready` và smoke output.
- Dependency audit.
- Cron/webhook idempotency evidence.
- Cutover/rollback rehearsal notes.

AGY không được tự cutover production. Sau staging rehearsal, dừng và gửi `docs/reviews/postgres-migration-agy-handoff-final.md` cho Codex và chủ dự án phê duyệt cửa sổ bảo trì.

**Commit:** `docs: hand off PostgreSQL migration for production cutover`

## 8. Final acceptance checklist

- [ ] Checkpoint A–F đều có Codex acceptance.
- [ ] Không fixed/demo OTP production.
- [ ] Không raw infrastructure errors/secret/PII trong response hoặc logs.
- [ ] PostgreSQL fresh migration và upgrade/reapply tests xanh.
- [ ] Auth/catalog/order/admin/payment production paths đều PostgreSQL.
- [ ] Không SQL Server dependency/T-SQL trong production paths.
- [ ] Real PostgreSQL concurrency tests xanh.
- [ ] Reconciliation 100% core rows/totals, không orphan.
- [ ] Render staging `/live`, `/ready`, smoke và cron xanh.
- [ ] Dependency audit không có high/critical chưa được phê duyệt.
- [ ] Backup, cutover và rollback rehearsal hoàn tất.
- [ ] Production cutover được chủ dự án phê duyệt riêng.

Sau final acceptance và production stabilization, mới resume Phase 3 bằng repository PostgreSQL.
