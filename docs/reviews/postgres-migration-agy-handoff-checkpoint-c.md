# Handoff Checkpoint C — PostgreSQL Identity và Public Reads

Ngày: 18/08/2026
Phạm vi: Checkpoint C trong `docs/superpowers/plans/2026-08-17-render-supabase-postgres-migration-plan.md`

## Kết quả

- Admin login và `/admin/me` dùng PostgreSQL repository `users`.
- OTP khách hàng dùng bảng `otp_codes`, transaction, advisory lock, TTL, cooldown, attempt limit và consume một lần.
- Google identity dùng `user_identities` với `provider_subject` làm định danh bền vững.
- Catalog, options, stores, jobs, tiers, rewards, reviews read, search suggestions và wishlist read dùng repository PostgreSQL.
- Các write path, promotion/voucher, order, PayOS, KDS, admin và reports vẫn giữ SQL Server, không dual-write.

## Bằng chứng kiểm thử

- `npm.cmd test`: **89 pass, 0 fail, 7 live-only skip có chủ đích**.
- Live Checkpoint C với `POSTGRES_INTEGRATION=1`: **2 pass, 0 fail** (`postgres-auth.integration.test.js`, `postgres-public-read.integration.test.js`).
- HTTP smoke trên PostgreSQL staging: `POST /admin/login` rồi `GET /admin/me` với `AUTH_IDENTITY_POSTGRES=1`: **pass**.
- `git diff --check` và `node --check` cho repositories/script mới: **pass**.

## Vận hành staging

- Chỉ bật `AUTH_IDENTITY_POSTGRES=1` ở môi trường staging đã có PostgreSQL seed/migration và cấu hình identity tương ứng.
- `POSTGRES_INTEGRATION=1` chỉ bật tạm thời tại lệnh kiểm thử; không lưu cờ này trong `.env` để tránh `npm test` vô tình truy cập database từ xa.
- Không đặt `DATABASE_URL` production hoặc `DB_DIALECT=postgres` ở Checkpoint C.

## Ngoài phạm vi và bước kế tiếp

Checkpoint C chưa chuyển orders, promotions/vouchers, payment PayOS, Admin/KDS hoặc data migration. Bước tiếp theo là Checkpoint D: tách repository PostgreSQL cho promotion, order và payment; giữ idempotency, concurrency và webhook invariants.
