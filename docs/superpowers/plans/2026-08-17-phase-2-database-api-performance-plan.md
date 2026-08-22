# Implementation Plan Phase 2 — Hiệu năng Database và API

> **Người thực hiện chính:** AGY  
> **Người review/nghiệm thu:** Codex  
> **Design đã duyệt:** `docs/superpowers/specs/2026-08-17-phase-2-database-api-performance-design.md`  
> **Tiền điều kiện:** Phase 1 PASS tại `docs/reviews/phase-1-codex-acceptance-round-6-final.md`  
> **Phạm vi:** Chỉ Phase 2. Không tự mở rộng sang refactor kiến trúc Phase 3.

## 0. Kết quả cuối Phase 2

Sau đợt này hệ thống phải bảo đảm:

- Có dataset benchmark tái lập được và báo cáo trước/sau trên cùng SQL Server test.
- Dashboard, orders list, KDS, customer history, auto-expire và voucher lookup có index/query plan phù hợp.
- Không còn `CAST(created_at AS DATE)` trên các đường query nóng thuộc Phase 2.
- Customer history 50 orders và KDS list dùng số query cố định, không tăng theo số order.
- Admin orders và customer history có cursor pagination ổn định.
- KDS polling không gửi request chồng nhau; tab ẩn giảm tần suất, tab active refetch ngay.
- Auto-print không đánh dấu printed trước khi adapter xác nhận khởi tạo lệnh in thành công.
- Kết quả KPI, RBAC, branch scope, payment và order workflow không đổi.
- Backend syntax/test, SQL benchmark và frontend production build đều pass.

## 1. Quy tắc làm việc bắt buộc dành cho AGY

1. Tạo branch riêng từ commit chứa plan này.
2. Mỗi task là một commit nhỏ theo đúng thứ tự; không gom toàn Phase 2 vào một commit.
3. Không format/rewrite toàn bộ `admin.js`, `public.js` hoặc component KDS.
4. Trước mỗi tối ưu SQL phải lưu baseline. Không tạo index theo cảm tính.
5. Không đổi URL API, framework, database engine, driver hoặc công thức KPI.
6. Không giảm bảo mật/branch scope để làm query nhanh hơn.
7. Không dùng mock để claim SQL Server đã dùng index. Phải có execution plan hoặc `STATISTICS IO/TIME` trên DB test thật.
8. Không gọi test là integration nếu không chạy production entry point tương ứng.
9. Không claim loại N+1 nếu chưa instrument và assert query count.
10. Không claim polling không overlap nếu test không giữ request đầu pending.
11. Migration phải có guard, không chạy tự động khi app startup và có rollback riêng.
12. Benchmark/seed script phải từ chối chạy production và không chứa dữ liệu thật.
13. Sau mỗi task chạy đúng verification của task; fail thì sửa trước khi chuyển tiếp.
14. Mọi lệch plan phải ghi trong handoff, không tự chọn giải pháp khác mà không giải thích.
15. Trước giao Codex, đối chiếu retrospective tại `docs/reviews/phase-1-agy-repeated-errors-addendum.md`.

## 2. Chuẩn bằng chứng và cấu trúc artifact

Tạo thư mục:

```text
backend/perf/
  README.md
  seed-performance-data.js
  run-query-benchmarks.js
  queries/
    dashboard.sql
    admin-orders.sql
    kds-orders.sql
    customer-history.sql
    payos-expiry.sql
    voucher-usage.sql
  results/
    .gitkeep

backend/database/
  phase-2-performance-indexes.sql
  phase-2-performance-indexes-rollback.sql

docs/reviews/
  phase-2-agy-handoff.md
```

Không commit file execution plan/báo cáo chứa PII hoặc connection string. Nếu `.sqlplan` quá lớn, commit summary Markdown/JSON và ghi vị trí artifact nội bộ trong handoff.

Mỗi benchmark record tối thiểu:

- Case và production entry point.
- Dataset size/seed.
- Parameters và số rows trả về.
- Duration.
- Logical reads.
- Seek/scan chính.
- Query count nếu là API flow.
- Kết quả trước và sau.

## 3. Task 1 — Benchmark harness và dataset có guard

### Mục tiêu

Tạo môi trường đo lường tái lập được trước khi tối ưu.

### File dự kiến

- Tạo `backend/perf/README.md`.
- Tạo `backend/perf/seed-performance-data.js`.
- Tạo `backend/perf/run-query-benchmarks.js`.
- Tạo `backend/perf/queries/*.sql`.
- Sửa `backend/package.json` để thêm scripts có tên rõ ràng.
- Tạo test guard trong `backend/test/performance-harness.test.js`.

### Cách làm

- Seed deterministic bằng seed number cố định.
- Mục tiêu tối thiểu: 100.000 orders/90 ngày/nhiều branch, trung bình 3 items/order, 1-2 toppings/item và nhiều status/order.
- Có paid/unpaid/expired/cancelled, PayOS expiration candidates, customer có hơn 50 orders và voucher usages.
- Chỉ chạy khi `NODE_ENV !== 'production'`, database name khớp allowlist/prefix test và có cờ xác nhận như `PERF_SEED_CONFIRM=1`.
- In database name và row targets trước khi chạy; không in password/secret.
- Seed theo batch và transaction hợp lý; chạy lại phải có chế độ reset dataset do script tạo hoặc dùng namespace marker riêng.
- Benchmark runner bật `SET STATISTICS IO, TIME ON` hoặc thu thập metrics tương đương; lưu output có timestamp và git commit.
- Query count instrumentation phải nằm ở DB adapter/test harness, không thay đổi response production.

### Test bắt buộc

- Production mode bị từ chối.
- Database không thuộc allowlist bị từ chối.
- Thiếu confirmation flag bị từ chối.
- Seed generator cùng seed tạo cùng phân bố/count.
- Benchmark parser không nhầm elapsed time/logical reads.

### Verification

```powershell
cd backend
node --check perf/seed-performance-data.js
node --check perf/run-query-benchmarks.js
npm.cmd test -- --test-name-pattern="performance harness"
```

Chạy seed/benchmark DB thật chỉ trên SQL Server test đã xác nhận.

### Commit gợi ý

`perf: add reproducible SQL Server benchmark harness`

## 4. Task 2 — Ghi baseline trước tối ưu

### Mục tiêu

Chốt bằng chứng before để mọi thay đổi sau có điểm so sánh.

### File dự kiến

- Tạo `docs/reviews/phase-2-performance-baseline.md`.
- Thêm artifact tóm tắt trong `backend/perf/results/` nếu an toàn và kích thước hợp lý.

### Case bắt buộc

1. Dashboard today theo branch và super/global.
2. Dashboard/report date range.
3. Admin orders list với store/status/date.
4. KDS active paid orders kèm items/toppings.
5. Customer history 50 orders kèm items/toppings.
6. Auto-expire PayOS.
7. Voucher usage lookup.

Với KDS/customer history, ghi cả query count production hiện tại. Không chỉ benchmark câu SQL tách rời.

### Acceptance nội bộ

- Report ghi rõ scan/seek và logical reads.
- Có query text/entry point khớp code production.
- Có dataset counts và parameters.
- Không có secret/PII.

### Verification

```powershell
git diff --check -- docs/reviews/phase-2-performance-baseline.md backend/perf/results
```

### Commit gợi ý

`perf: record phase 2 query baseline`

## 5. Task 3 — Date boundary production helper và sargable predicates

### Mục tiêu

Loại function trên `created_at` ở đường nóng để SQL Server có thể seek theo index.

### File dự kiến

- Tạo `backend/services/date-range.js`.
- Tạo `backend/test/date-range.test.js`.
- Sửa có mục tiêu `backend/routes/admin.js`.
- Sửa query benchmark tương ứng.

### Cách làm

- Helper nhận ngày `YYYY-MM-DD`, validate nghiêm ngặt và tạo `[startInclusive, endExclusive)` theo timezone `Asia/Saigon`.
- Một ngày: đầu ngày đến đầu ngày kế tiếp.
- Range: đầu ngày `from` đến đầu ngày sau `to`.
- Invalid date, `from > to` hoặc range vượt giới hạn hợp lý trả 400.
- Thay các predicate Phase 2 như:

```sql
CAST(o.created_at AS DATE) = ?
CAST(o.created_at AS DATE) BETWEEN ? AND ?
CAST(o.created_at AS DATE) >= ?
CAST(o.created_at AS DATE) <= ?
```

bằng `>= ? AND < ?`.

- Không sửa công thức KPI hoặc cách loại cancelled orders.
- Reuse cùng helper cho dashboard, branch summary, analytics và list filter.

### Test bắt buộc

- Ngày thường, cuối tháng, cuối năm và leap day.
- Boundary đúng tại 00:00 Asia/Saigon.
- Invalid date/range trả lỗi.
- Test route/service production chứng minh parameter truyền vào là start/end exclusive.
- KPI fixture trước/sau giống nhau, gồm order đúng 00:00 và sát cuối ngày.
- Static regression test không còn `CAST(...created_at AS DATE)` trong các query Phase 2 đã liệt kê.

### Verification

```powershell
cd backend
node --check services/date-range.js
node --check routes/admin.js
npm.cmd test -- --test-name-pattern="date range|KPI boundary|sargable"
```

### Commit gợi ý

`perf: make admin date filters index friendly`

## 6. Task 4 — Migration index dựa trên execution plan

### Mục tiêu

Tạo đúng index cần thiết, idempotent và rollback được.

### File dự kiến

- Tạo `backend/database/phase-2-performance-indexes.sql`.
- Tạo `backend/database/phase-2-performance-indexes-rollback.sql`.
- Sửa `backend/database/schema.sql` để fresh install nhận cùng index sau khi migration được xác nhận.
- Tạo `backend/test/performance-index-migration.test.js` cho static/adapter checks.

### Index ứng viên

- Orders theo store/payment/created/id.
- Orders theo payment provider/status/expiry.
- Orders theo user/created/id.
- Status history theo order/created/id include status.
- Items theo order.
- Toppings theo item.
- Voucher usage theo promotion/phone.

### Cách làm

- Trước khi chốt tên/key/include, đối chiếu `sys.indexes`, `sys.index_columns` và baseline plan.
- Mỗi `CREATE INDEX` có guard `IF NOT EXISTS` theo tên và kiểm tra tránh duplicate leading keys.
- Chỉ INCLUDE cột được query plan chứng minh có ích; không include `NVARCHAR(MAX)` hoặc payload rộng theo cảm tính.
- Rollback chỉ drop index Phase 2 bằng tên chính xác và guard.
- Không dùng `DROP_EXISTING` với index không thuộc Phase 2.
- Không apply migration khi server startup.

### Test/đo bắt buộc

- Apply lần 1 thành công.
- Apply lần 2 thành công/no-op.
- Không tạo index trùng PK/unique/index hiện hữu.
- Rollback thành công và không xóa index ngoài Phase 2.
- Apply lại sau rollback thành công.
- Chạy benchmark cases trước/sau và lưu logical reads/plan.

### Verification

```powershell
cd backend
npm.cmd test -- --test-name-pattern="performance index"
```

Kèm log apply/apply/rollback/apply trên SQL Server test trong handoff.

### Commit gợi ý

`perf: add measured SQL Server indexes`

## 7. Task 5 — Loại product lookup lặp khi tạo order

### Mục tiêu

Price engine trả đủ dữ liệu insert để create-order không query product lần hai cho từng item.

### File dự kiến

- Sửa `backend/services/price-engine.js`.
- Sửa `backend/routes/public.js`.
- Tạo hoặc mở rộng `backend/test/price-engine-query-count.test.js`.

### Cách làm

- `calcLineTotals()` trả `product_name` từ chính product query đã dùng xác thực/tính giá.
- Route sử dụng `line.product_name` khi insert `order_items`.
- Xóa query `SELECT name FROM products WHERE id = ?` trong vòng insert.
- Không tin tên/giá từ client.
- Giữ nguyên subtotal, topping, voucher và transaction behavior.

### Test bắt buộc

- N items không sinh thêm N product-name queries.
- Product name lưu từ production price engine, không từ request.
- Giá/tổng/DTO trước sau giống fixture Phase 1.
- Invalid product/topping vẫn rollback.

### Verification

```powershell
cd backend
node --check services/price-engine.js
node --check routes/public.js
npm.cmd test -- --test-name-pattern="price engine|query count|create order"
```

### Commit gợi ý

`perf: reuse priced product data when creating orders`

## 8. Task 6 — Customer history batch loading và cursor pagination

### Mục tiêu

50 orders không tạo 50 item queries và pagination không trùng/mất khi có order mới.

### File dự kiến

- Tạo `backend/services/cursor-pagination.js`.
- Tạo `backend/services/order-batch-loader.js` nếu boundary này dùng chung được với KDS.
- Sửa customer history route trong `backend/routes/public.js`.
- Sửa consumer tại `frontend/src/routes/ho-so.tsx` nếu cần load-more.
- Tạo `backend/test/customer-history-pagination.test.js`.

### API contract

Request hỗ trợ:

```text
GET /api/customer/orders?limit=50&cursor=<opaque>
```

Response giữ danh sách/fields hiện hữu và bổ sung:

```json
{
  "orders": [],
  "page_info": {
    "next_cursor": null,
    "has_more": false,
    "limit": 50
  }
}
```

Nếu response hiện tại là array, cần kiểm tra consumer trước khi đổi. Ưu tiên compatibility wrapper hoặc cập nhật tất cả consumer trong cùng task và ghi breaking shape rõ trong plan/handoff; không để frontend/backend lệch contract.

### Cách làm

- Order query dùng `ORDER BY created_at DESC, id DESC` và fetch `limit + 1`.
- Cursor opaque chứa version, created_at, id; validate và trả 400 khi malformed.
- Items load một query cho toàn page.
- Toppings load một query cho toàn bộ item IDs hoặc JSON aggregation batch.
- Group bằng production helper, giữ đúng thứ tự orders/items.
- Scope customer lấy từ JWT, không lấy user id từ cursor/body.

### Test bắt buộc

- Route thật với customer auth.
- 50 orders dùng query count cố định, có assertion cụ thể.
- Empty/single/full/has-more pages.
- Equal `created_at` được tie-break bằng id.
- Chèn order mới giữa page 1 và 2; không duplicate/missing trong traversal.
- Cursor malformed, limit 0/âm/>100 trả 400.
- Cursor không bypass ownership.
- DTO và item/topping grouping chính xác.

### Verification

```powershell
cd backend
node --check services/cursor-pagination.js
node --check services/order-batch-loader.js
node --check routes/public.js
npm.cmd test -- --test-name-pattern="customer history|cursor|batch loader"

cd ..\frontend
npm.cmd run build
```

### Commit gợi ý

`perf: batch and paginate customer order history`

## 9. Task 7 — Admin orders cursor pagination

### Mục tiêu

Thay `TOP 100` không có pagination bằng traversal ổn định và giữ nguyên branch/filter policy.

### File dự kiến

- Sửa `backend/routes/admin.js`.
- Reuse `backend/services/cursor-pagination.js`.
- Sửa `frontend/src/routes/admin.don-hang.tsx`.
- Tạo `backend/test/admin-orders-pagination.test.js`.

### Cách làm

- `limit` mặc định 50, tối đa 100.
- Cursor `(created_at, id)`; `ORDER BY created_at DESC, id DESC`.
- Store scope luôn lấy từ `resolveStoreScope`; cursor không chứa authority.
- Status/store/date/search filters giữ nguyên giữa pages.
- Current status lookup phải dùng indexed status history path.
- Frontend reset cursor chain khi filter thay đổi và không trộn response cũ.
- Không prefetch detail/items cho từng row; detail chỉ fetch khi mở dialog như behavior hiện tại.

### Test bắt buộc

- Super và branch roles qua HTTP route thật.
- Branch user không dùng cursor/filter để xem branch khác.
- Insert mới giữa pages không tạo duplicate/missing.
- Equal timestamps ổn định nhờ id.
- Filter thay đổi + cursor cũ bị frontend reset.
- Invalid cursor/limit trả 400.

### Verification

```powershell
cd backend
node --check routes/admin.js
npm.cmd test -- --test-name-pattern="admin orders pagination|cursor"

cd ..\frontend
npm.cmd run build
```

### Commit gợi ý

`perf: add stable admin order pagination`

## 10. Task 8 — KDS batch query loại N+1

### Mục tiêu

KDS list dùng query count cố định và giữ đúng contract Phase 1.

### File dự kiến

- Sửa KDS route trong `backend/routes/admin.js`.
- Reuse/mở rộng `backend/services/order-batch-loader.js`.
- Mở rộng `backend/test/kds-integration.test.js` hoặc tạo `backend/test/kds-query-count.test.js`.

### Cách làm

- Query active orders một lần với store scope và deterministic order.
- Batch items cho toàn bộ order IDs.
- Batch toppings cho toàn bộ item IDs hoặc JSON aggregation trong batch.
- Không gọi item query trong `for/map` từng order.
- Chỉ select fields KDS cần; không trả token/payment internals ngoài contract.
- Giữ trạng thái `paid` và active status logic đúng Phase 1.

### Test bắt buộc

- HTTP KDS route với kitchen JWT production middleware.
- 0, 1 và 50 orders đều có cùng số query theo từng loại batch.
- Items/toppings group đúng order.
- Branch isolation vẫn pass.
- Kitchen completion contract Round 6 vẫn pass.
- Query plan common KDS case dùng index phù hợp hoặc có giải thích selectivity.

### Verification

```powershell
cd backend
node --check routes/admin.js
npm.cmd test -- --test-name-pattern="KDS|query count|batch"
```

### Commit gợi ý

`perf: batch load KDS order details`

## 11. Task 9 — KDS non-overlapping polling và print lifecycle

### Mục tiêu

Không có hai request KDS đồng thời và không đánh dấu printed trước khi in được khởi tạo thành công.

### File dự kiến

- Tạo `frontend/src/lib/polling-controller.ts` hoặc hook nhỏ có boundary rõ.
- Tạo test production module phù hợp với test runner frontend hiện có; nếu chưa có test runner, thêm cấu hình tối thiểu và ghi rõ dependency.
- Sửa có mục tiêu `frontend/src/routes/admin.bep.tsx`.
- Sửa `frontend/src/lib/auto-print.ts` nếu contract adapter chưa trả xác nhận rõ.

### Polling behavior

- Không dùng `setInterval(fetchOrders, POLL_MS)`.
- Self-schedule sau khi request settle.
- Visible 10 giây; hidden 60 giây.
- `visibilitychange` visible và storage event liên quan refetch ngay nếu idle.
- Unmount/store/filter change abort request và clear timeout.
- Network error không tạo tight loop; manual retry vẫn hoạt động.
- Response cũ sau filter/store change không được overwrite state mới.

### Printing behavior

- Dedup hiện tại được giữ.
- Adapter phải resolve/return acknowledgement khi lệnh in đã được khởi tạo.
- Chỉ sau acknowledgement mới gọi mark-printed backend/local dedup tương ứng.
- Throw/reject/no acknowledgement: không mark printed, hiển thị lỗi và giữ retry.
- Hai polling responses cùng order không tạo hai lệnh in đồng thời.

### Test bắt buộc

- Dùng fake timers và deferred promise: request đầu pending thì timer/event không bắt đầu request thứ hai.
- Request settle mới schedule tiếp.
- Visible/hidden intervals đúng.
- Visible event refetch ngay khi idle.
- Abort/unmount không update state.
- Print success đánh dấu đúng một lần.
- Print failure không đánh dấu và retry thành công.
- Dedup chống hai print đồng thời.

Không được chỉ grep rằng `setInterval` đã biến mất; test phải chứng minh lifecycle.

### Verification

```powershell
cd frontend
npm.cmd test -- --run
npm.cmd run build
```

Nếu frontend chưa có `test` script, AGY phải thêm runner tối thiểu và ghi command thực tế trong handoff; không bỏ test vì thiếu runner.

### Commit gợi ý

`perf: prevent overlapping KDS polling and printing`

## 12. Task 10 — Benchmark sau tối ưu và regression toàn hệ thống

### Mục tiêu

Chứng minh tối ưu có hiệu quả và không đổi nghiệp vụ.

### File dự kiến

- Tạo `docs/reviews/phase-2-performance-after.md`.
- Tạo `docs/reviews/phase-2-agy-handoff.md`.
- Cập nhật artifact an toàn trong `backend/perf/results/`.

### Benchmark after

Chạy cùng:

- Database/test machine.
- Dataset seed và row counts.
- Parameters.
- Production commit/config.
- Danh sách case của baseline.

Report có bảng before/after cho duration, logical reads, scan/seek và query count. Nếu case chậm hơn hoặc optimizer vẫn scan, giải thích bằng plan; không giấu số liệu.

### Regression bắt buộc

- Phase 1 backend tests vẫn pass.
- HTTP KDS/role/branch tests vẫn pass.
- KPI fixture before/after giống nhau.
- Customer/admin pagination không duplicate/missing.
- KDS query count cố định.
- Polling/printing frontend tests pass.
- Migration apply/apply/rollback/apply pass trên DB test.
- Backend syntax và frontend production build pass.

### Commands cuối

```powershell
cd backend
npm.cmd test

$files = @(
  'config/db.js',
  'routes/admin.js',
  'routes/public.js',
  'services/date-range.js',
  'services/cursor-pagination.js',
  'services/order-batch-loader.js',
  'services/price-engine.js',
  'perf/seed-performance-data.js',
  'perf/run-query-benchmarks.js'
)
foreach ($file in $files) {
  node --check $file
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

cd ..\frontend
npm.cmd test -- --run
npm.cmd run build
```

Nếu file/helper cuối cùng có tên khác do design được duyệt lại, handoff phải nêu mapping; không được bỏ syntax check.

### Commit gợi ý

`docs: report phase 2 performance results`

## 13. Mẫu handoff AGY bắt buộc

`docs/reviews/phase-2-agy-handoff.md` phải có:

| Yêu cầu | Production entry point | Before | After | Test/plan thật | Commit | Known gap |
|---|---|---:|---:|---|---|---|
| Dashboard date filter | `/admin/dashboard/*` | reads/time/scan | reads/time/seek | SQL plan + route regression | hash | ... |
| Customer 50 orders | Customer history route | query count | query count | HTTP + instrumented DB adapter | hash | ... |
| KDS batch | `/admin/kitchen/orders` | query count | query count | HTTP + adapter + SQL plan | hash | ... |
| KDS polling | `admin.bep.tsx` | overlap behavior | no overlap | deferred promise + fake timers | hash | ... |

Ngoài bảng:

- Liệt kê index đã tạo: name, keys, include, query phục vụ.
- Liệt kê migration apply/rollback logs.
- Liệt kê mọi thay đổi API response/query params.
- Ghi rõ warning, regression hoặc case chưa cải thiện.
- Không dùng “100%/production-ready” nếu còn known gap.

## 14. Checklist Codex nghiệm thu Phase 2

Codex sẽ không chỉ nhìn tổng số test xanh. Review gồm:

1. Đối chiếu từng task với diff và commit.
2. Kiểm tra baseline được tạo trước index/tối ưu.
3. Đọc migration và so với index hiện có.
4. Xem SQL Server plan/statistics thật cho đường nóng.
5. Instrument query count production flow cho customer history/KDS.
6. Gọi HTTP pagination route với auth/branch scope.
7. Test insert giữa pages.
8. Giữ request polling đầu pending để thử overlap.
9. Ép print adapter fail để thử retry/mark behavior.
10. Chạy backend tests/syntax và frontend tests/build độc lập.

## 15. Điều kiện PASS/FAIL

### PASS

- Tất cả tiêu chí mục 0 và design spec đạt bằng bằng chứng đúng tầng.
- Không có regression Blocker/High từ Phase 1.
- Benchmark before/after trung thực, tái lập được.
- Không còn known blocker/high.

### FAIL

- Có index nhưng không có baseline/plan.
- Test copy/mô phỏng thay vì production entry point.
- Query count vẫn tăng theo số order.
- Cursor pagination có duplicate/missing hoặc bypass scope.
- Polling test không thực sự giữ request pending.
- Print failure vẫn đánh dấu printed.
- KPI/DTO/permission thay đổi ngoài thiết kế.
- Handoff claim vượt quá bằng chứng.

Khi hoàn tất Task 10, AGY dừng và gửi Codex review. Không tự bắt đầu Phase 3.
