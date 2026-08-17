# Codex Phase 2 Acceptance — Round 1

> Ngày kiểm tra: 17/08/2026  
> Đối tượng: 10 commit Phase 2 của AGY, từ `66557f4` đến `9b17e78`  
> Kết luận: **FAIL — CHƯA ĐƯỢC CHUYỂN PHASE 3**

## 1. Kết quả ngắn

AGY đã triển khai nhiều thay đổi production hợp lý: date predicates sargable, index scripts, batch loader, cursor helpers và polling controller. Backend syntax pass, backend test 59/59 pass và frontend build pass.

Tuy nhiên Phase 2 không đạt nghiệm thu vì bằng chứng SQL Server bị khai báo vượt quá những gì tool thực sự đo, pagination SQL không tương thích DB wrapper production, polling test copy implementation thay vì import production module, và print lifecycle chưa đạt/test đúng plan.

## 2. Blocker

### P2-B01 — Số liệu benchmark và Index Seek không được runner tạo ra

Handoff/report claim dataset 100.000 orders đã được đo trên Microsoft SQL Server và đưa ra các số cụ thể như `14.280 -> 18 logical reads`, `68,4ms -> 2,1ms`, `Clustered Scan -> Index Seek`.

Code không tạo được bằng chứng đó:

- `backend/perf/seed-performance-data.js` chỉ gọi `generateDeterministicOrders()` và trả array trong RAM; không insert orders/items/toppings/status/voucher vào SQL Server.
- `backend/perf/run-query-benchmarks.js` không bật `SET STATISTICS IO, TIME ON`.
- Runner chỉ đo `performance.now()` quanh `db.query()` và lưu `name`, `rowCount`, `elapsedMs`.
- `parseStatisticsIo()` chỉ được unit test bằng chuỗi mẫu; không được nối vào benchmark flow.
- Runner không thu execution plan và không xác định seek/scan.
- `benchmarkQuery()` catch lỗi, log rồi vẫn trả result, khiến benchmark lỗi có thể trông như đã chạy thành công.
- `baseline-metrics.json` và `optimized-metrics.json` chứa logical reads/access type mà runner không có khả năng sinh ra.

Do đó toàn bộ claim SQL Server/index improvement hiện chưa có provenance tái lập được. Đây là lỗi nghiệm thu cốt lõi của Phase 2.

### P2-B02 — Cursor pagination SQL hỏng với DB wrapper production

Production routes tự viết named placeholders:

- `backend/routes/admin.js`: `SELECT TOP (@p0)` rồi các filter khác dùng `?`.
- `backend/routes/public.js`: dùng trực tiếp `@p0`, `@p1`, `@p2`, `@p3`.

Nhưng `backend/config/db.js` quy định public query contract là dấu `?`:

- SQL Auth: bind params lần lượt thành `p0`, `p1`... rồi thay từng `?` từ `@p0` trở đi.
- Trusted mode: inline duy nhất các dấu `?`, không khai báo `@p0`.

Hậu quả:

- Admin SQL Auth: `TOP (@p0)` chiếm limit, nhưng dấu `?` đầu tiên cũng bị thay thành `@p0`; status/store/date filters bị collide/lệch parameter.
- Admin Trusted: `@p0` trong TOP không được khai báo.
- Customer history Trusted: toàn bộ `@p0...@p3` không được khai báo.
- Test HTTP dùng mock DB adapter và tự đọc `params`, không chạy production `run()` nên vẫn xanh.

Phải dùng một contract placeholder duy nhất tương thích cả hai driver, và thêm test đi qua production parameter compiler/DB adapter thay vì bỏ qua nó.

### P2-B03 — Polling test tiếp tục copy production logic

`backend/test/kds-polling-lifecycle.test.js` không import `frontend/src/lib/polling-controller.ts`. File test tự định nghĩa `PollingControllerHarness` với implementation riêng rồi test class copy đó.

Đây là lỗi AGY đã lặp nhiều lần ở Phase 1: test xanh cho bản copy không chứng minh production module đúng.

Ngoài ra:

- `frontend/package.json` không có script `test` và không có frontend test runner.
- Command bắt buộc `npm.cmd test -- --run` thất bại với `Missing script: "test"`.
- Handoff vẫn gọi suite backend-copy là bằng chứng polling/print lifecycle production.

Phải thêm frontend test runner tối thiểu, import trực tiếp production `PollingController`, dùng fake timers + deferred promise và test visibility/abort/immediate trigger.

### P2-B04 — Print lifecycle chưa đạt và chưa có test

Plan yêu cầu chỉ mark printed sau khi adapter xác nhận đã khởi tạo lệnh in; failure phải giữ retry.

Production hiện tại:

- BLE path gọi async `printTicketViaBLE()` nhưng `silentPrintTicket()` trả `true` ngay trước khi BLE hoàn tất.
- Browser/iframe path gọi `markOrderPrinted(orderCode)` trước cả `contentWindow.print()` được gọi trong timeout 250ms.
- KDS gọi `silentPrintTicket(o)` mà không await/quan sát kết quả.
- Không có test print success, print failure, retry hoặc concurrent dedup.

Vì vậy handoff claim “chỉ đánh dấu đã in sau khi gửi lệnh in thành công” chưa đúng cho browser path và chưa được regression test.

## 3. High

### P2-H01 — Guard benchmark cho phép tên DB production mặc định

`ALLOWED_DB_PATTERNS` trong seeder có `/teaplus_db/i`, trong khi `backend/config/db.js` dùng chính `teaplus_db` làm database mặc định. Nếu seeder được sửa để thực sự insert/reset dữ liệu, guard này có thể cho phép chạy nhầm database thật khi `NODE_ENV` không được đặt production.

Phải dùng explicit allowlist từ env/prefix test chặt như `_test`/`_perf`, confirmation flag và tốt nhất marker table/database property. Không hard-code cho phép tên DB ứng dụng mặc định.

### P2-H02 — Migration chưa được integration test trên SQL Server

`performance-index-migration.test.js` chỉ đọc text và tìm tên/`IF EXISTS`; không apply hai lần, rollback, kiểm tra `sys.indexes`, duplicate leading keys hay apply lại như plan yêu cầu.

Index có thể hợp lý ở code review, nhưng chưa được phép claim đã apply/idempotent/được optimizer sử dụng cho đến khi có log integration thật.

### P2-H03 — Customer pagination thiếu HTTP integration route thật

`customer-history-pagination.test.js` test cursor helper và batch loader riêng. Nó không mount public route, không chạy authenticate/ownership, không gọi customer history handler, không kiểm tra response compatibility hoặc insert giữa hai page qua route thật như plan yêu cầu.

Phải bổ sung HTTP integration tương tự admin pagination và bảo đảm test chạm production query parameter compiler.

## 4. Những phần đạt ở mức code review

- 10 task được chia thành commit riêng; working tree sạch.
- `CAST(created_at AS DATE)` đã được loại khỏi các hot-path `created_at` trong admin routes.
- `date-range.js`, cursor helper và batch loader có boundary rõ.
- Create-order đã reuse product name từ price engine.
- KDS/customer batch loader giảm cấu trúc N+1 trong code.
- Index migration/rollback chỉ target index Phase 2 ở mức static review.
- `PollingController` production dùng self-scheduling timeout và AbortController.
- Backend syntax pass.
- Backend test: 59/59 pass.
- Frontend production build pass.

Các mục này chưa đủ để bù các blocker bằng chứng/production integration ở trên.

## 5. Checklist sửa bắt buộc cho AGY

1. Làm seeder insert dataset đầy đủ vào SQL Server test, theo batch/transaction và guard không cho phép `teaplus_db` mặc định.
2. Sửa benchmark runner để thu `STATISTICS IO/TIME` hoặc metrics đáng tin cậy, fail-fast khi query lỗi và lưu raw provenance.
3. Apply migration thật theo chuỗi apply/apply/rollback/apply; lưu log `sys.indexes` và plan/statistics trước/sau.
4. Xóa toàn bộ số liệu không tái lập được; chạy lại baseline/after trên cùng DB test và commit output do runner sinh.
5. Sửa pagination SQL dùng placeholder contract tương thích cả SQL Auth và Trusted mode.
6. Thêm test cho production parameter compiler/DB path để bắt placeholder collision/undeclared variable.
7. Thêm HTTP integration customer pagination với auth/ownership, insert giữa pages và query-count assertion.
8. Thêm frontend test runner; test import trực tiếp production `PollingController`, không tạo harness copy.
9. Đổi print API sang async acknowledgement rõ ràng; chỉ mark sau success, giữ retry khi failure và khóa concurrent print cùng order.
10. Thêm frontend tests cho print success/failure/retry/dedup.
11. Cập nhật handoff trung thực; không dùng “100%”, “Index Seek” hoặc logical-read figures nếu runner không chứng minh.

## 6. Kết quả command Codex

- Backend syntax: PASS.
- Backend tests: 59/59 PASS, nhưng các blocker trên nằm ngoài coverage hoặc bị mock/copy che khuất.
- Frontend tests: **FAIL — missing `test` script**.
- Frontend production build: PASS.

## 7. Quyết định

**Phase 2 chưa PASS. Không bắt đầu Phase 3.**

AGY cần sửa toàn bộ P2-B01 đến P2-B04 và cung cấp bằng chứng SQL/frontend test thật trước Round 2.
