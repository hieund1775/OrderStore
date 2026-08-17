# Thiết kế Phase 2 — Hiệu năng Database và API

> Ngày: 17/08/2026  
> Người triển khai dự kiến: AGY  
> Người review/nghiệm thu: Codex  
> Nguồn: `2026-08-15-production-hardening-design.md`, mục Đợt 2  
> Tiền điều kiện: Phase 1 đã PASS tại `docs/reviews/phase-1-codex-acceptance-round-6-final.md`

## 1. Mục tiêu

Phase 2 giảm chi phí query và độ trễ ở dashboard, danh sách đơn, lịch sử khách hàng và KDS mà không thay đổi nghiệp vụ, URL công khai, quyền truy cập hoặc kết quả KPI đã được bảo vệ ở Phase 1.

Kết quả phải được chứng minh ở hai tầng:

1. Benchmark tái lập được bằng dataset/script trong repo.
2. Đo trên SQL Server test thật bằng execution plan hoặc tối thiểu `SET STATISTICS IO, TIME ON` trước và sau tối ưu.

Test mock đơn thuần không được dùng làm bằng chứng rằng SQL Server sử dụng index.

## 2. Phạm vi

### Trong phạm vi

- Dataset benchmark đủ lớn và có phân bố dữ liệu gần thực tế.
- Baseline query count, thời gian, logical reads và execution plan cho các đường nóng.
- Migration index có guard, không trùng index hiện có và có rollback riêng.
- Thay date predicate không sargable bằng khoảng `[start, nextDay)`.
- Loại N+1 ở customer order history và KDS; bỏ product lookup lặp khi tạo đơn.
- Pagination ổn định cho admin order list và customer history.
- KDS polling không chồng request, giảm tần suất khi tab ẩn và refetch ngay khi active.
- Giữ nguyên auto-print dedup và khả năng retry khi in thất bại.
- Test hồi quy kết quả nghiệp vụ, query count, pagination và polling.
- Báo cáo benchmark trước/sau cùng dataset.

### Ngoài phạm vi

- Không đổi SQL Server, Express, React/TanStack hoặc driver DB.
- Không đổi URL API hiện có; chỉ được thêm query parameters và metadata pagination tương thích ngược.
- Không chuyển sang WebSocket/SSE trong Phase 2.
- Không cache Redis, message queue hoặc read replica.
- Không refactor toàn bộ `admin.js`/`public.js`; việc chia route lớn thuộc Phase 3.
- Không tối ưu các màn hình không có baseline hoặc không nằm trên đường nóng đã xác định.
- Không thay đổi công thức KPI, RBAC, branch scope, payment state hoặc order transition.

## 3. Kiến trúc đo lường

### 3.1 Dataset benchmark

Tạo script seed benchmark idempotent hoặc script tạo database test riêng. Dataset mục tiêu tối thiểu:

- 100.000 orders trải trên ít nhất 90 ngày và nhiều branch.
- Trung bình 3 order items/order.
- Trung bình 1-2 toppings/item.
- Status history có nhiều transition/order.
- Có paid, unpaid, expired, cancelled và PayOS expiration candidates.
- Có customer history tối thiểu 50 orders/customer cho nhóm kiểm thử.
- Có voucher usage đủ để kiểm tra composite lookup.

Script phải hỗ trợ seed cố định để kết quả trước/sau so sánh được, không chứa dữ liệu khách hàng thật và không chạy nhầm production. Mặc định yêu cầu biến xác nhận database test.

### 3.2 Baseline bắt buộc

Đo ít nhất các query:

- Dashboard today/range theo branch và toàn hệ thống.
- Admin orders list có date/status/store filter.
- KDS paid active orders và items/toppings.
- Customer order history 50 orders.
- Auto-expire PayOS.
- Voucher lookup theo promotion + phone.

Mỗi case lưu:

- SQL hoặc production entry point.
- Dataset size và parameters.
- Duration, logical reads, returned rows.
- Loại access chính: seek/scan.
- Execution plan `.sqlplan` nếu môi trường cho phép; nếu không, lưu output thống kê và giải thích.

Không đặt một ngưỡng millisecond tuyệt đối cho mọi máy. Acceptance dựa trên giảm logical reads/scan, query count cố định và không hồi quy đáng kể trên cùng máy/dataset.

## 4. Thiết kế index

Migration index Phase 2 phải kiểm tra `sys.indexes` theo tên và cấu trúc trước khi tạo. Bộ index ứng viên ban đầu:

- `orders(store_id, payment_status, created_at DESC, id DESC)` với INCLUDE tối thiểu cho dashboard/list sau khi xem plan.
- `orders(payment_provider, payment_status, payment_expires_at)` phục vụ auto-expire.
- `orders(user_id, created_at DESC, id DESC)` phục vụ customer history.
- `order_status_history(order_id, created_at DESC, id DESC) INCLUDE(status)`.
- `order_items(order_id)` với INCLUDE chỉ khi plan chứng minh cần.
- `order_item_toppings(order_item_id)`.
- `voucher_usage_history(promotion_id, user_phone)`; cân nhắc unique chỉ khi nghiệp vụ và dữ liệu hiện hữu cho phép, không tự áp đặt trong Phase 2.

Tên và INCLUDE cuối cùng phải dựa trên execution plan, không copy mù danh sách trên. Không tạo index trùng PK/unique index hoặc index có cùng leading keys. Migration rollback chỉ drop các index do Phase 2 tạo, có guard tương ứng.

Index script không được chạy tự động khi app startup.

## 5. Query và data flow

### 5.1 Date predicates

Mọi filter kiểu `CAST(created_at AS DATE)` trên đường nóng được thay bằng:

```sql
created_at >= @startInclusive AND created_at < @endExclusive
```

Backend chuẩn hóa ngày theo timezone nghiệp vụ `Asia/Saigon`, chuyển thành boundary rõ ràng trước khi query. Range nhiều ngày dùng start của ngày đầu và start của ngày sau ngày cuối. Không dùng `BETWEEN` cho timestamp cuối ngày.

Kết quả KPI trước và sau phải giống nhau trên cùng dataset, gồm boundary 00:00 và cuối ngày.

### 5.2 Loại N+1

- `price-engine` trả `product_name` cùng dữ liệu giá để create-order không query sản phẩm lần hai.
- Customer history query orders một lần, query toàn bộ items của page bằng tập `order_id` một lần, query/group toppings theo tập item IDs hoặc JSON aggregation một lần. Không query từng order.
- KDS query orders một lần và lấy toàn bộ items/toppings của các order đó theo batch. Query count phải cố định theo page, không tăng tuyến tính theo số orders.
- List endpoint không lấy detail nặng nếu UI chưa mở dialog.

Batch query phải dùng parameters an toàn. Nếu DB wrapper chưa hỗ trợ table-valued parameter, được tạo danh sách placeholder theo số ID với từng giá trị vẫn bind parameter; không nối ID chưa kiểm chứng trực tiếp vào SQL.

### 5.3 Pagination

Admin order list và customer history dùng cursor ổn định theo `(created_at DESC, id DESC)`.

Cursor chứa cả `created_at` và `id`, được encode opaque cho client. Query page tiếp theo dùng điều kiện:

```sql
created_at < @cursorCreatedAt
OR (created_at = @cursorCreatedAt AND id < @cursorId)
```

Response bổ sung metadata `page_info: { next_cursor, has_more, limit }`. Request không có cursor vẫn trả page đầu. Giới hạn mặc định 50, tối đa 100. Filter được giữ nguyên giữa các page; cursor sai/malformed trả 400.

Không dùng offset cho hai endpoint này vì đơn mới chèn vào có thể gây trùng/bỏ sót. Test phải chèn một order mới giữa hai lần fetch và chứng minh các order thuộc snapshot traversal không lặp hoặc mất.

## 6. KDS polling và printing

Thay `setInterval(fetchOrders, POLL_MS)` bằng self-scheduling timeout hoặc polling controller:

1. Chỉ schedule lần tiếp theo sau khi request hiện tại resolve/reject.
2. Có `AbortController` khi component unmount hoặc đổi filter/store.
3. Tab visible dùng chu kỳ 10 giây; tab hidden dùng 60 giây.
4. Khi `visibilitychange` về visible hoặc nhận storage event liên quan order/print, cancel timeout cũ và refetch ngay nếu không có request đang chạy.
5. Lỗi mạng không tạo vòng lặp nóng; dùng chu kỳ thường hoặc backoff có trần, nhưng UI vẫn cho retry thủ công.

Auto-print giữ nguyên dedup key hiện có. Chỉ gọi endpoint/đánh dấu printed sau khi adapter xác nhận đã khởi tạo lệnh in thành công. Nếu adapter throw hoặc không xác nhận, order không được đánh dấu printed và nút retry vẫn khả dụng.

## 7. Error handling và tính tương thích

- Invalid cursor/limit/date trả 400 với message rõ, không fallback âm thầm.
- Query timeout/DB error giữ semantics 5xx hiện có và được log; không trả dữ liệu rỗng giả.
- Migration thất bại phải dừng và báo index nào lỗi; không nuốt lỗi.
- API fields hiện hữu được giữ nguyên. Pagination metadata là additive.
- Phase 1 RBAC/branch scope phải chạy trước mọi query và cursor không được chứa/ghi đè store scope.
- Benchmark scripts từ chối chạy khi `NODE_ENV=production` hoặc database không khớp allowlist test được cấu hình.

## 8. Chiến lược test

### Unit test

- Date boundary builder, cursor encode/decode và validation.
- Group items/toppings theo order.
- Polling controller: không overlap, visible/hidden interval, abort và immediate refetch.

Các test phải import production module, không copy logic.

### HTTP/service integration

- Admin/customer pagination qua route thật với auth và DB adapter.
- Chèn order mới giữa page 1/page 2; không duplicate/missing trong traversal đã xác định.
- Customer history 50 orders có query count cố định.
- KDS batch endpoint có query count cố định và đúng DTO.
- Branch scope không bị cursor/query parameters bypass.
- Printing failure không đánh dấu printed; success chỉ đánh dấu một lần.

### SQL Server integration/benchmark

- Apply migration hai lần không lỗi.
- Rollback chỉ xóa index Phase 2; apply lại thành công.
- Query plans cho đường nóng dùng index phù hợp hoặc có giải thích nếu optimizer chọn scan vì dataset/selectivity.
- KPI trước/sau giống nhau.
- Logical reads và elapsed time được lưu trước/sau trên cùng dataset.

## 9. Tiêu chí nghiệm thu

Phase 2 chỉ PASS khi:

- Có baseline và after-report tái lập được.
- Dashboard/KDS common filters không full-scan `orders` trên dataset benchmark lớn, trừ case selectivity cao được giải thích bằng plan.
- Customer history 50 orders và KDS list không phát sinh N query theo số order.
- Pagination route thật không lặp/bỏ sót khi có order mới chèn giữa page.
- Hai KDS polls không overlap; test dùng deferred promise để chứng minh request thứ hai chưa bắt đầu trước khi request đầu kết thúc.
- Auto-print không đánh dấu printed trước xác nhận adapter và vẫn retry được khi lỗi.
- Migration idempotent, rollback an toàn và không trùng index.
- Backend test/syntax và frontend production build đều pass.
- Kết quả KPI/DTO nghiệp vụ không đổi ngoài pagination metadata đã thiết kế.

## 10. Quy tắc bàn giao dành cho AGY

- Mỗi task một commit nhỏ; không format toàn file ngoài vùng sửa.
- Trước mỗi tối ưu phải có baseline; không tạo index theo cảm tính.
- Handoff dùng bảng: yêu cầu → production entry point → SQL/query count trước → sau → test/plan chứng minh → known gap.
- Không gọi unit mock là SQL integration benchmark.
- Không claim “không N+1” nếu query count chưa được instrument/assert.
- Không claim “index được dùng” chỉ vì migration tạo thành công; phải có execution plan/statistics.
- Không claim “polling không overlap” nếu test không giữ request đầu pending.
- Mọi lệch thiết kế phải ghi rõ trước review; không tự mở rộng sang Phase 3.

## 11. Trình tự triển khai cấp cao

1. Tạo benchmark harness/dataset và ghi baseline.
2. Chuẩn hóa date boundary và thay predicates.
3. Tạo migration index dựa trên baseline/plan.
4. Loại create-order/customer-history/KDS N+1.
5. Thêm cursor pagination và cập nhật consumers.
6. Sửa KDS polling/printing lifecycle.
7. Chạy regression, benchmark after, build và viết handoff.

Implementation plan sẽ chia các bước này thành task có file, test, command kiểm tra và commit cụ thể sau khi design spec được duyệt.
