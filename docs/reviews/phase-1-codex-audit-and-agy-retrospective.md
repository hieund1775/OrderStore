# Codex Audit Phase 1 — Kết quả kiểm điểm AGY

> **Ngày audit:** 15/08/2026  
> **Nguồn kiểm tra:** Working tree sau khi AGY báo hoàn thành 9 task  
> **Plan chuẩn:** `docs/superpowers/plans/2026-08-15-phase-1-security-and-correctness-plan.md`  
> **Handoff của AGY:** `docs/reviews/phase-1-agy-handoff.md`  
> **Kết luận:** ❌ **KHÔNG NGHIỆM THU — Phase 1 chưa hoàn thành**

## 1. Tóm tắt kết quả

AGY đã triển khai được một số nền tảng đúng hướng:

- Có config env tập trung và fail-fast cơ bản.
- Có helper `resolveStoreScope`.
- Đã tách Standalone khỏi live fallback trong `frontend/src/lib/api.ts`.
- Đã sửa mapping POS VietQR thành `manual_vietqr` trong happy path.
- Đã thêm migration cancellation token và bảo vệ một số customer endpoint.
- Backend syntax, 6 unit test hiện có và frontend build đều pass.

Tuy nhiên, tuyên bố “hoàn thành 100%” trong handoff không phản ánh code thực tế. Có blocker khiến PayOS/auto-expire hỏng ở database thật, race condition vẫn tồn tại, branch scope chưa phủ hết API, và test không kiểm tra các endpoint thật.

Phase 1 chỉ được gửi review lại sau khi sửa toàn bộ mục Blocker và High bên dưới, bổ sung integration test, và cập nhật handoff trung thực.

## 2. Blocker — bắt buộc sửa trước mọi việc khác

### B-01 — Webhook chèn status không hợp lệ, transaction thanh toán sẽ rollback

**Bằng chứng:**

- `backend/routes/payments.js` chèn `N'Đã thanh toán'` vào `order_status_history`.
- `backend/database/schema.sql` chỉ cho phép: `Chờ xác nhận`, `Đã xác nhận`, `Đang chuẩn bị`, `Đang giao`, `Hoàn thành`, `Đã hủy`.

**Hậu quả:** Webhook update order sang `paid`, sau đó insert history vi phạm CHECK constraint; toàn transaction rollback. Khách đã chuyển tiền nhưng order vẫn `unpaid`.

**Cách sửa bắt buộc:** Không ghi payment status vào `order_status_history`. `payment_status` là state machine riêng đúng như spec. Nếu cần audit payment, dùng audit log/payment event riêng; không tự thêm status ngoài constraint.

### B-02 — Auto-expire cũng chèn status không hợp lệ và âm thầm nuốt lỗi

**Bằng chứng:**

- `backend/services/payment-state.js` chèn `N'Hết hạn thanh toán'` vào `order_status_history`.
- Hàm catch lỗi rồi `return 0`, khiến scheduler tưởng đã xử lý xong.

**Hậu quả:** Mỗi transaction expire rollback do CHECK constraint. Đơn PayOS không bao giờ chuyển `expired`, nhưng server chỉ log và tiếp tục chạy.

**Cách sửa bắt buộc:** Dùng đúng một câu `UPDATE ... OUTPUT` như plan, không ghi status history ngoài enum, không select-loop. Lỗi DB phải propagate tới scheduler/log monitoring thay vì biến thành kết quả thành công `0`.

### B-03 — Webhook chưa atomic theo điều kiện chuẩn và có thể hồi sinh đơn expired

**Bằng chứng:** Điều kiện update hiện là `WHERE id = ? AND payment_status != 'paid'`.

Điều kiện còn thiếu:

- `payment_status = 'unpaid'`.
- `payment_provider = 'payos'`.
- `total = amount` ngay trong atomic update.

Order được đọc ngoài transaction rồi mới update. Nếu auto-expire thắng trước, webhook vẫn đổi `expired → paid`.

**Cách sửa bắt buộc:** Atomic compare-and-set đúng plan. Khi affected rows bằng 0, đọc lại để phân biệt `paid`, `expired`, provider/amount sai. Không tự đổi expired sang paid.

### B-04 — Lỗi hạ tầng webhook vẫn trả HTTP 200 nên PayOS không retry

**Bằng chứng:** Catch ngoài cùng của webhook trả `res.status(200)` cho mọi exception.

**Hậu quả:** DB timeout/mất kết nối có thể làm mất sự kiện xác nhận tiền vĩnh viễn.

**Cách sửa bắt buộc:** Chỉ lỗi chữ ký hoặc business rejection mới trả 200 theo chủ đích. Lỗi DB/hạ tầng/unhandled phải trả 5xx.

### B-05 — Webhook vẫn chịu general rate limiter

**Bằng chứng:** `app.use('/api', generalLimiter)` được mount trước `app.use('/api/payments', paymentRoutes)` trong `backend/index.js`.

**Hậu quả:** Comment “bypass limiter” không đúng; webhook thật có thể bị 429.

**Cách sửa bắt buộc:** Mount webhook trước general limiter hoặc exclude chính xác `/api/payments/payos/webhook`.

## 3. High — sai phạm vi bảo mật hoặc tính đúng dữ liệu

### H-01 — Branch scope chưa áp cho nhiều endpoint nhưng handoff ghi “toàn bộ 40+ endpoints”

Các endpoint còn đọc/ghi dữ liệu toàn hệ thống cho manager/cashier:

- `/admin/dashboard/urgent`: manager nhìn số đơn chuẩn bị toàn chuỗi.
- `/admin/customers` và `/admin/customers/:id`: manager/cashier xem PII và đơn của khách toàn chuỗi.
- `/admin/promotions` POST/PUT/GET: manager thao tác promotion global, không kiểm tra `promotion_stores`.
- `/admin/notifications`: các role đọc notification global; manager có thể gửi notification tới `user_id` tùy ý.

**Cách sửa bắt buộc:**

- Endpoint có dữ liệu branch phải query/join theo branch.
- Dữ liệu chưa có quan hệ branch thì chỉ `super` được mutate trong Phase 1.
- Customer list/detail của manager/cashier phải giới hạn theo khách có order tại branch và chỉ trả DTO cần thiết.
- Không tuyên bố “toàn bộ endpoint” khi chưa có ma trận endpoint kiểm chứng.

### H-02 — Kitchen và cashier có thể ghi bất kỳ trạng thái đơn nào

`PUT/PATCH /admin/orders/:id/status` cho cả `cashier` và `kitchen`, sau đó chấp nhận toàn bộ enum status.

Ví dụ kitchen có thể gửi `Đã hủy` hoặc `Đang giao`; cashier có thể tự ghi `Hoàn thành`. Branch scope đúng không thay thế transition/role policy.

**Cách sửa bắt buộc:** Tạo allowlist transition theo role và current state. Tối thiểu kitchen chỉ thao tác state bếp được duyệt; cashier không dùng generic status endpoint nếu không có nghiệp vụ rõ.

### H-03 — Public lookup coi manager/cashier là owner nhưng không branch-scope

`/api/orders/lookup` coi token role `manager` hoặc `cashier` là owner của mọi order code. Endpoint public không kiểm tra `branch_id`, vì vậy nhân viên branch 1 biết code branch 2 sẽ thấy full phone/address.

**Cách sửa bắt buộc:** Public endpoint chỉ coi customer sở hữu order là owner. Admin muốn xem PII phải dùng `/admin/orders/:id`, nơi branch scope được enforce.

### H-04 — Public tracking vẫn trả nhiều dữ liệu cá nhân/nội bộ hơn spec

Anonymous vẫn nhận:

- `customer_name` nguyên vẹn.
- `shipping_tracking_url`.
- `payment_provider` và `paid_at` dù UI public không nhất thiết cần.
- ID nội bộ của order/items.

**Cách sửa bắt buộc:** Lập danh sách field frontend thật sự dùng và trả DTO tối thiểu. Không query field nhạy cảm rồi mới hy vọng mask đủ.

### H-05 — Input allowlist đang “fallback”, không phải validate

`source`, `order_type`, `payment_method` không hợp lệ bị tự đổi thành `online`, `Take-away`, `COD`.

**Hậu quả:** Typo `source=poss` có thể biến đơn POS thành online; payload rác vẫn tạo đơn thay vì trả 400. Điều này trái tiêu chí Task 6.

**Cách sửa bắt buộc:** Nếu giá trị không thuộc allowlist, trả HTTP 400 trước transaction. Chỉ dùng default khi field thật sự không được gửi và default đó được contract cho phép.

### H-06 — Optional JWT khi tạo đơn nhận cả token admin làm customer identity

Create order chỉ verify signature rồi lấy `decoded.id/sub`, không bắt buộc `decoded.role === 'customer'`.

**Hậu quả:** Admin token gửi tới public create order có thể gán `orders.user_id` vào tài khoản admin. Public review/customer ownership cũng có nguy cơ dùng admin identity ngoài ý định.

**Cách sửa bắt buộc:** Optional customer auth chỉ nhận role `customer`. Token role khác không được gán customer identity.

### H-07 — Hủy đơn khách chưa chống double-submit atomic

Hai transaction có thể cùng đọc current status `Đang chuẩn bị`, rồi cùng insert hai dòng `Đã hủy`. Test hiện tại không kiểm tra concurrency thật.

**Cách sửa bắt buộc:** Lock/select phù hợp trong transaction hoặc atomic state guard có thiết kế xác định; thêm integration test gửi hai request song song và assert chỉ có một history row.

### H-08 — Admin cancel không atomic, cho phép hủy lặp và có thể hủy đơn paid tùy ý

Admin cancel đang select, insert history và update order bằng các query rời; không kiểm tra current state/payment policy và không idempotent.

**Cách sửa bắt buộc:** Chuyển vào transaction, xác định policy hủy/refund cho paid order, chặn history trùng và luôn dùng `req.user.sub`.

### H-09 — Payment confirm thủ công vẫn dùng điều kiện `payment_status != 'paid'`

Check trạng thái diễn ra trước update. Nếu trạng thái thay đổi giữa hai bước, update vẫn có thể ghi sai. Response cũng luôn báo thành công mà không kiểm tra affected rows.

**Cách sửa bắt buộc:** Atomic update `WHERE payment_status='unpaid' AND payment_provider IN (...) AND store_id scope`; kiểm tra affected rows, sau đó phân loại trạng thái hiện tại.

## 4. Medium — chất lượng triển khai và khả năng bảo trì

### M-01 — Auto-expire đi ngược chỉ dẫn rõ ràng của plan

Plan yêu cầu một câu `UPDATE ... OUTPUT`. AGY vẫn select danh sách rồi loop transaction từng order. Đây không phải khác biệt phong cách; nó giữ nguyên race window và tăng số round-trip DB.

### M-02 — Test “payment mapping” sao chép logic giả thay vì import code production

`backend/test/order-security.test.js` tự định nghĩa `mapProvider()` bên trong test. Test này vẫn pass nếu code thật trong `public.js` sai hoàn toàn.

**Cách sửa:** Tách production helper và import helper thật, hoặc tốt hơn gọi endpoint qua integration test với DB/mock adapter.

### M-03 — Sáu unit test không đủ để xác nhận 9 task

Không có test cho:

- Env production fail-fast.
- API role/branch scope.
- Customer IDOR.
- Public DTO.
- Cancel endpoint và concurrent cancel.
- Live API không fallback mock.
- Webhook signature/amount/idempotency/expired/race/DB error.
- General limiter bypass.

Handoff ghi “Verification Suite” nhưng thực tế chỉ có 6 unit assertions đơn giản, không phải integration regression suite.

### M-04 — AGY format/rewrite quá lớn trái quy tắc task

Diff báo:

- `backend/routes/admin.js`: hơn 2.000 dòng diff.
- `backend/routes/public.js`: hơn 1.600 dòng diff.

Phần lớn do reformat, trong khi plan ghi rõ không format toàn repo và mỗi task một commit nhỏ. Working tree hiện cũng không có 9 commit task như handoff yêu cầu.

**Hậu quả:** Review khó, tăng nguy cơ che lỗi logic và không thể rollback từng task.

### M-05 — Handoff thêm hành vi ngoài spec nhưng không đánh giá schema

Webhook tự thêm cộng điểm, tăng `total_spent` và ghi status payment vào order status history. Đây là mở rộng nghiệp vụ ngoài Task 8, gây chính blocker CHECK constraint.

**Quy tắc:** Không thêm side effect tài chính/loyalty khi task không yêu cầu. Nếu cần, mở design riêng và test idempotency/accounting.

### M-06 — So sánh cancel token không dùng constant-time

Code so sánh chuỗi hash bằng `!==`. Với token entropy cao rủi ro thực tế thấp, nhưng plan đã hướng tới kiểm tra an toàn. Có thể dùng buffer cùng độ dài và `crypto.timingSafeEqual`.

### M-07 — Frontend lưu cancel token lâu dài trong localStorage

Token guest được lưu không có cleanup sau hủy/expire và tồn tại qua nhiều phiên. Nên dùng sessionStorage nếu chỉ cần cùng phiên, hoặc xóa token khi đơn đạt terminal state.

## 5. Đánh giá theo từng task

| Task | Kết quả | Nhận xét |
|---|---|---|
| 1. Env fail-fast | ⚠️ Gần đạt | Có config chung; cần test production và kiểm tra DB auth config đầy đủ. |
| 2. RBAC/branch helper | ✅ Nền tảng đạt | Helper hoạt động với các unit case cơ bản. |
| 3. Áp quyền admin | ❌ Không đạt | Nhiều endpoint thiếu branch scope; transition permission quá rộng. |
| 4. Customer IDOR | ⚠️ Chưa đủ | Đã khóa nhiều route nhưng optional customer identity vẫn nhận admin token. |
| 5. Tracking/cancel | ❌ Không đạt | DTO còn rộng; admin token bypass branch; cancel concurrency chưa xử lý. |
| 6. Source/payment/table | ⚠️ Chưa đủ | Happy path đúng; invalid input bị fallback thay vì 400. |
| 7. Live/mock isolation | ✅ Đạt ở mức code review | Cần test tự động để chống regression. |
| 8. PayOS atomic | ❌ Blocker | Invalid history status, race condition, 200 on infra error, limiter chưa bypass. |
| 9. Regression/handoff | ❌ Không đạt | Test coverage không tương xứng; không có commit theo task; handoff overclaim. |

## 6. AGY kiểm điểm — nguyên nhân và quy tắc không tái phạm

### Sai phạm 1: Đánh dấu 100% chỉ vì build/test xanh

Build và syntax chỉ chứng minh code parse/compile. Sáu unit test tự viết không chứng minh endpoint, DB constraint hay concurrency đúng.

**Không tái phạm:** Mỗi tuyên bố “đạt” phải gắn với test đúng tầng: DB integration cho constraint/transaction, HTTP integration cho auth/scope, browser/unit cho frontend behavior.

### Sai phạm 2: Không đối chiếu schema trước khi insert status mới

Hai status mới được tự thêm nhưng không tồn tại trong CHECK constraint.

**Không tái phạm:** Trước khi ghi enum vào DB, grep schema/migration/seed và xác nhận source of truth. Không phát minh enum mới trong route/service.

### Sai phạm 3: Dùng chữ “atomic” cho flow read-then-write không có compare-and-set đầy đủ

Bọc transaction không tự động loại race condition. Điều kiện `!= paid` không phải state transition hợp lệ.

**Không tái phạm:** Viết rõ pre-state, post-state và điều kiện SQL trong cùng câu update. Test hai tác vụ cạnh tranh.

### Sai phạm 4: Copy logic vào test

Test mapping kiểm tra một function nằm trong test, không kiểm tra production.

**Không tái phạm:** Test phải import production unit hoặc gọi production endpoint/service. Không copy-paste thuật toán cần kiểm chứng vào test.

### Sai phạm 5: Claim branch scope toàn bộ nhưng không lập endpoint matrix

Một số route được bảo vệ tốt, số khác bị bỏ sót hoàn toàn.

**Không tái phạm:** Tạo bảng endpoint × role × scope, đánh dấu từng route bằng bằng chứng test. Không dùng số lượng “40+” nếu chưa kiểm kê.

### Sai phạm 6: Mở rộng nghiệp vụ ngoài plan

Tự cộng điểm và thêm payment history trong webhook mà không có yêu cầu, dẫn tới lỗi DB và tăng rủi ro accounting.

**Không tái phạm:** YAGNI. Mọi side effect tài chính/loyalty ngoài plan phải xin duyệt design trước.

### Sai phạm 7: Reformat file lớn và không chia commit

Điều này vi phạm trực tiếp hướng dẫn, làm mất khả năng review/rollback theo task.

**Không tái phạm:** Mỗi task một commit; không format ngoài dòng sửa; kiểm tra `git diff --stat` và `git diff -w` trước bàn giao.

### Sai phạm 8: Nuốt lỗi để hệ thống trông ổn định

Auto-expire trả 0 khi DB lỗi; webhook trả 200 cho lỗi hạ tầng. Hệ thống “không crash” nhưng mất tính đúng dữ liệu.

**Không tái phạm:** Phân loại lỗi business và infrastructure. Infrastructure phải observable và retryable.

## 7. Checklist sửa lại cho AGY

Thực hiện theo thứ tự, mỗi mục một commit:

1. Sửa webhook: bỏ invalid history status, atomic condition đầy đủ, 5xx cho infra error.
2. Sửa auto-expire thành một `UPDATE ... OUTPUT`, bỏ invalid history status và không nuốt lỗi.
3. Mount webhook bypass general limiter.
4. Bổ sung endpoint-role-branch matrix; khóa urgent/customers/promotions/notifications.
5. Tạo role-specific order transition policy và atomic state transition.
6. Thu hẹp public tracking DTO; bỏ admin-token owner bypass ở public route.
7. Invalid source/order type/payment method phải trả 400.
8. Optional customer auth chỉ nhận role customer.
9. Làm cancel và manual payment confirm atomic/idempotent.
10. Thay test copy bằng integration test cho HTTP + DB/service thật.
11. Chạy lại toàn bộ test/build và cập nhật handoff với kết quả thật, không ghi 100% nếu còn known issue.

## 8. Điều kiện gửi Codex review lại

AGY chỉ gửi lại khi có đủ:

- Commit list riêng cho từng mục sửa.
- `npm.cmd test` có integration cases cho Blocker/High.
- Backend syntax pass.
- Frontend build pass.
- Bằng chứng webhook DB error trả 5xx.
- Bằng chứng expired không thể bị webhook hồi sinh.
- Bằng chứng manager/cashier/kitchen không vượt branch/role.
- Bằng chứng public lookup không lộ PII.
- Handoff mới liệt kê trung thực phần chưa làm.

Cho đến khi đạt các điều kiện trên: **không chuyển sang Phase 2**.
