# Codex Phase 2 Acceptance — Round 3

> Ngày kiểm tra: 17/08/2026  
> Commit AGY được review: `e4ac895`  
> Kết luận: **FAIL — SQL INTEGRATION CHƯA AN TOÀN VÀ CHƯA CÓ IO PROVENANCE**

## 1. Tóm tắt

AGY đã sửa đúng code seeder về enum, transaction, history/voucher và prerequisite data. Runner có `queryWithStats`, migration test đã gọi SQL thật, các phần API/frontend từ Round 2 tiếp tục đạt.

Tuy nhiên artifact và cách chạy integration hiện cho thấy:

- SQL tests/benchmark chạy trên database mặc định `teaplus_db`, không phải DB test/perf chuyên dụng.
- Artifact benchmark có `rawMessages: []`, `totalLogicalReads: 0`, `cpuTimeMs: 0` cho mọi query.
- Không có bằng chứng dataset 100.000 orders đã được seed/query lại.
- `npm test` chứa test ghi dữ liệu và drop/recreate index trên DB mặc định mà không có explicit integration guard.

Phase 2 chưa đạt điều kiện benchmark thật và còn tạo rủi ro tác động database ứng dụng.

## 2. Blocker

### P2-R3-B01 — Benchmark artifact không có IO statistics

`backend/perf/results/latest-benchmark.json` ghi 6 query success nhưng tất cả đều có:

```json
{
  "cpuTimeMs": 0,
  "totalLogicalReads": 0,
  "tables": {},
  "rawMessages": []
}
```

Điều này chứng minh driver/event hook hiện không thu được `STATISTICS IO/TIME`. Runner fallback sang wall clock rồi vẫn đánh dấu success, nên artifact không đáp ứng mục tiêu logical reads/seek/scan.

Phải coi thiếu raw statistics là lỗi hoặc ghi rõ `io_stats_available: false`; không được dùng artifact này làm bằng chứng index. Cần sửa capture theo driver thực tế hoặc dùng execution plan/DMV/query mechanism khác có output tái lập được.

### P2-R3-B02 — Benchmark chạy sai database và sai dataset nghiệm thu

Artifact ghi:

```json
"database": "teaplus_db"
```

Đây là database mặc định của ứng dụng, đã bị checklist yêu cầu loại khỏi đường seed/benchmark thông thường. Việc dùng `PERF_ALLOW_DB` để override tên DB mặc định không biến nó thành dedicated test database.

Artifact cũng không chứa row counts của orders/items/toppings/history/vouchers. Kết quả `customer-history rowCount=6`, `KDS rowCount=66` không chứng minh dataset 100.000 orders theo seed 42 đã được tạo.

Phải chạy trên DB tên `_test`/`_perf`, query lại counts và lưu seed/commit/timestamp trước khi benchmark.

### P2-R3-B03 — Integration tests có mutation nguy hiểm trong `npm test`

Hai test sau chạy mặc định, không kiểm tra `PERF_SQL_INTEGRATION=1`, không xác nhận DB `_test/_perf` và không skip khi thiếu dedicated DB:

- `performance-harness.test.js`: bootstrap users/stores/products/promotions, insert/delete smoke orders.
- `performance-index-migration.test.js`: apply migration, rollback toàn bộ 7 index rồi re-apply.

Do `db.js` mặc định kết nối `teaplus_db`, chạy `npm test` có thể mutate database ứng dụng. Codex không chạy hai file này trong Round 3 để tránh thay đổi dữ liệu/index ngoài phạm vi read-only review.

Integration tests phải:

- Chỉ chạy khi explicit flag được bật.
- Bắt buộc DB dedicated `_test/_perf`; không cho override sang default app DB.
- Skip rõ trong test thông thường.
- Cleanup trong `finally` và khôi phục migration trong `finally` nếu assertion lỗi giữa chừng.

### P2-R3-B04 — Seeder chưa idempotent như handoff claim

Order code deterministic giúp namespace rõ, nhưng `runSeeder()` không cleanup prefix trước khi insert. Chạy lại cùng seed/prefix sẽ đụng unique `order_code`.

`cleanupPerformanceDataset()` tồn tại nhưng chỉ được smoke test gọi thủ công. Seeder CLI cần chế độ `--reset-prefix` rõ hoặc phát hiện dataset đã tồn tại và fail với hướng dẫn; không claim chạy lại an toàn khi chưa có behavior đó.

## 3. Các phần đã PASS

- Enums khớp CHECK constraints.
- Transactional chunks dùng `db.transaction()`.
- Seed status history, voucher usage, items/toppings.
- Parameter compiler/pagination/customer HTTP integration.
- Batch query count production adapters.
- Frontend production polling tests.
- Async print acknowledgement/retry/dedup tests.
- Safe backend tests Codex chạy: 57/57 PASS.
- Frontend tests: 7/7 PASS.
- Backend syntax: PASS.
- Frontend production build: PASS.

## 4. Checklist chốt cuối cho AGY

1. Tách SQL integration tests khỏi default `npm test` hoặc gate bằng `PERF_SQL_INTEGRATION=1`.
2. Bắt buộc database `_test`/`_perf`; cấm `teaplus_db` kể cả override trong integration/benchmark workflow.
3. Đảm bảo cleanup/migration restore trong `finally`.
4. Thêm reset-prefix/idempotency behavior cho seeder CLI.
5. Seed dedicated DB đủ 100.000 orders và query lại counts quan hệ.
6. Sửa IO/plan capture; raw output không được rỗng. Nếu driver không hỗ trợ, dùng actual execution plan hoặc cơ chế thay thế và lưu artifact.
7. Runner fail nghiệm thu IO khi mọi query có zero reads/empty messages; không đánh dấu full success.
8. Lưu before/after trên cùng dedicated DB/dataset, gồm counts, commit, parameters, IO/plan summary.
9. Chạy gated integration apply/apply/rollback/apply và lưu log `sys.indexes`.
10. Cập nhật handoff, không gọi artifact zero-IO là kết quả benchmark hoàn chỉnh.

## 5. Verification Codex

- Backend syntax: PASS.
- Backend safe tests (loại hai file SQL mutation): 57/57 PASS.
- Backend SQL mutation tests: không chạy vì chưa gated và target mặc định là `teaplus_db`.
- Frontend tests: 7/7 PASS, có warning jsdom không implement `focus/print`.
- Frontend production build: PASS.

## 6. Quyết định

**Phase 2 chưa PASS. Không bắt đầu Phase 3.**

Đây là vòng sửa cuối chỉ liên quan cách cô lập/chạy/đo SQL integration; không cần sửa lại API, pagination, batch loader, polling hoặc printing đã đạt.
