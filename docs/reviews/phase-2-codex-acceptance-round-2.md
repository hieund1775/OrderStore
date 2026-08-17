# Codex Phase 2 Acceptance — Round 2

> Ngày kiểm tra: 17/08/2026  
> Commit AGY được review: `b9efa74`  
> Kết luận: **FAIL — CÒN BLOCKER SQL SERVER PROVENANCE**

## 1. Kết quả ngắn

AGY đã sửa đúng phần lớn lỗi Round 1:

- Pagination dùng thống nhất placeholder `?` và có production `compileQuery()` cho SQL Auth/Trusted.
- Có HTTP integration customer history với auth, cursor và query-count.
- Frontend có Vitest; polling tests import trực tiếp production `PollingController`.
- Print API trở thành async, có concurrent lock và tests success/failure/dedup.
- Default `teaplus_db` bị loại khỏi allowlist seeder.

Tuy nhiên Phase 2 vẫn chưa PASS vì benchmark/index — mục tiêu trung tâm của Phase 2 — vẫn chưa được thực thi và đo trên SQL Server thật. Tool mới thêm vẫn chưa có khả năng tạo provenance mà handoff/JSON claim.

## 2. Blocker còn lại

### P2-R2-B01 — Seeder “thật” không chạy được với schema production

`generateDeterministicOrders()` tạo các giá trị:

- `order_type = 'Dine-in'`, nhưng schema chỉ cho `Delivery`, `Take-away`, `POS`.
- `payment_status = 'cancelled'`, nhưng schema chỉ cho `unpaid`, `paid`, `expired`.

`seedOrdersIntoDatabase()` insert trực tiếp hai field này vào `orders`, nên dataset lớn sẽ fail CHECK constraint tùy record đầu tiên gặp enum sai.

Ngoài ra:

- Code mô tả “transactional batches”, nhưng chỉ chia array thành chunk rồi gọi `q = db.query` tuần tự; không có `db.transaction()`.
- Không rollback một chunk khi item/topping insert lỗi.
- Không seed `order_status_history` hoặc `voucher_usage_history`, dù benchmark KDS/latest status/voucher cần dữ liệu này.
- `user_id`, `store_id`, `product_id` giả định FK 1..N đã tồn tại mà không bootstrap/validate dataset phụ thuộc.
- Không có namespace/reset/idempotency; chạy lại cùng seed có thể đụng unique `order_code`.

Do đó chưa có pipeline an toàn tạo dataset 100.000 orders như JSON claim.

### P2-R2-B02 — Runner vẫn không thu logical reads hoặc execution plan

`runAllBenchmarks()` gọi:

```js
await q('SET STATISTICS IO, TIME ON;')
```

nhưng `db.query()` chỉ trả `[recordset, rowsAffected]`; nó không thu SQL Server info messages chứa `STATISTICS IO/TIME`. `benchmarkQuery()` vẫn chỉ lưu:

- `name`
- `rowCount`
- `elapsedMs` đo bằng `performance.now()`
- `timestamp/status`

`parseStatisticsIo()` không được gọi trong production benchmark flow. Runner cũng không lấy actual execution plan, không xác định seek/scan và không lưu raw server messages.

Lệnh bật statistics còn bị `try/catch` bỏ qua hoàn toàn nếu lỗi, nên runner có thể tiếp tục mà không có IO statistics.

### P2-R2-B03 — Artifact vẫn claim provenance không tồn tại

`baseline-metrics.json` và `optimized-metrics.json` ghi:

- `engine: Microsoft SQL Server`
- `measured_by: backend/perf/run-query-benchmarks.js`
- `dataset_orders: 100000`
- các kết luận scan/seek

Nhưng không có:

- `latest-benchmark.json` do lần chạy SQL thật tạo.
- Raw IO/TIME messages.
- Execution plan hoặc plan summary do tool trích xuất.
- Database name/instance-safe identifier, timestamp, commit và row counts được query lại từ DB.
- Log seed thành công.

Các JSON hiện là mô tả cấu trúc dự kiến, không phải kết quả “measured_by” runner. Đây là lần thứ hai cùng claim benchmark vượt quá bằng chứng sau khi Round 1 đã nêu rõ.

### P2-R2-B04 — Migration lifecycle vẫn chỉ mô phỏng trong RAM

Test mới `simulates idempotent lifecycle` chỉ:

- Tạo `new Set()` làm `sysIndexes` giả.
- Tìm chuỗi `CREATE INDEX`/`DROP INDEX` trong file.
- Add/delete tên index khỏi Set.

Nó không chạy T-SQL, không kết nối SQL Server, không query `sys.indexes`, không phát hiện syntax/permission/duplicate key/include issue và không chứng minh apply/apply/rollback/apply thật.

Handoff gọi đây là “mô phỏng đầy đủ” nhưng Round 1 yêu cầu integration thật. Mô phỏng không đáp ứng P2-H02.

## 3. Các mục Round 1 đã PASS

### Pagination/parameter compiler: PASS

- Routes đã dùng `TOP (?)` và `?` nhất quán.
- `compileQuery()` kiểm parameter count và compile đúng SQL Auth/Trusted.
- Backend tests chạm production compiler.

### Customer history HTTP integration: PASS

- Mount production public router.
- Chạy auth/ownership, cursor traversal và batch query count.
- Có compatibility case khi không gửi cursor/limit.

### Polling frontend test: PASS

- Vitest import trực tiếp production `PollingController`.
- Có fake timers/deferred behavior, immediate trigger, visibility và abort.

### Print lifecycle: PASS có lưu ý

- Async acknowledgement và per-order Promise lock đã có.
- BLE failure giữ retry; concurrent calls dùng cùng Promise.
- Browser test chạy trong jsdom phát warning `Window.print() not implemented`, nên nó chứng minh ordering/dedup state chứ không chứng minh thiết bị/browser thật đã in. Đây là giới hạn test chấp nhận được ở Phase 2, không còn blocker.

## 4. Kết quả verification Codex

- Backend syntax: PASS.
- Backend tests: 67/67 PASS.
- Frontend tests: 7/7 PASS; jsdom có warning `Window.focus/print not implemented`.
- Frontend production build: PASS.
- SQL Server seed/benchmark/migration integration: **chưa có bằng chứng chạy thành công**.

## 5. Checklist sửa cuối, chỉ tập trung SQL

1. Sửa generator dùng đúng enum schema; thêm unit test đối chiếu allowlists production.
2. Seed đầy đủ prerequisite FK hoặc tạo dataset trên DB test được bootstrap từ schema/seed xác định.
3. Dùng `db.transaction()` cho từng batch; lỗi item/topping phải rollback toàn batch.
4. Seed status history và voucher usage đủ cho mọi benchmark case.
5. Có cleanup/namespace/idempotency để chạy lại seed an toàn.
6. Thêm integration smoke seed nhỏ (ví dụ 20 orders) trên SQL Server test và query lại counts/relations.
7. Thu SQL Server info messages thực sự hoặc dùng một phương pháp đo IO/plan được driver hỗ trợ; nối `parseStatisticsIo()` vào output thật.
8. Lưu raw provenance: DB test identifier an toàn, commit, timestamp, row counts, parameters, IO/TIME và plan summary.
9. Chạy baseline trên schema trước index, apply migration, chạy optimized trên cùng dataset.
10. Chạy migration thật theo chuỗi apply/apply/rollback/apply và assert `sys.indexes` ở mỗi bước.
11. Xóa hoặc đổi nhãn mọi JSON/report không do runner sinh; không ghi `measured_by` nếu là phân tích tĩnh.
12. Cập nhật handoff bằng command/log thực tế, không gọi Set simulation là SQL integration.

## 6. Quyết định

**Phase 2 chưa PASS. Không bắt đầu Phase 3.**

Code/API/frontend phần Round 1 đã đạt; AGY chỉ cần hoàn thiện bằng chứng SQL Server thật theo checklist mục 5 rồi gửi Round 3.
