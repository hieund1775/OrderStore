# Codex Audit Phase 1 — Vòng 2 sau khi AGY sửa lại

> **Ngày audit:** 15/08/2026  
> **Đối chiếu:** `phase-1-codex-audit-and-agy-retrospective.md` và working tree hiện tại  
> **Kết luận:** ❌ **CHƯA NGHIỆM THU — blocker PayOS cũ đã sửa, nhưng còn regression KDS và test chưa kiểm chứng code thật**

## 1. Những phần đã sửa đúng

Codex xác nhận các điểm sau đã được khắc phục trong code:

- Webhook không còn ghi `Đã thanh toán` vào `order_status_history`.
- Auto-expire không còn ghi `Hết hạn thanh toán` sai CHECK constraint.
- Webhook CAS chỉ update order `unpaid + payos + đúng amount`.
- Webhook không hồi sinh order `expired`.
- Lỗi hạ tầng webhook trả HTTP 500; lỗi chữ ký trả 200.
- Auto-expire đã dùng một câu `UPDATE ... OUTPUT`.
- Webhook được mount trước general limiter.
- Optional customer identity khi create order chỉ nhận role `customer`.
- Invalid `source/order_type/payment_method` trả 400.
- Public lookup đã bỏ admin-owner bypass và thu hẹp DTO đáng kể.
- Cancel token dùng `timingSafeEqual`.
- Manual payment confirm đã chuyển sang CAS và kiểm tra affected rows.
- Live API không tự fallback mock; cancel token mới lưu trong sessionStorage.
- Dashboard urgent, customer list/detail và một số admin route đã được bổ sung branch filtering.

Các blocker B-01 đến B-05 của vòng 1 về cơ bản đã được xử lý đúng hướng.

## 2. Blocker mới — regression nghiệp vụ KDS

### R2-B01 — Kitchen không thể hoàn thành đơn từ màn KDS hiện tại

**Code frontend thật:** `frontend/src/routes/admin.bep.tsx` gọi:

```text
Đang chuẩn bị → Hoàn thành
```

khi nhân viên bếp bấm hoàn thành trên Kanban.

**Backend mới:** `ROLE_ALLOWED_TARGET_STATUS.kitchen` chỉ cho:

```text
Đang chuẩn bị, Đang giao
```

và từ chối target `Hoàn thành`.

**Hậu quả:** UI vẫn build nhưng thao tác cốt lõi của KDS nhận HTTP 403. Đây là regression vận hành, không thể nghiệm thu Phase 1.

**Nguyên nhân:** AGY tự thiết kế state machine theo giả định “bếp báo Đang giao”, không đối chiếu flow 3 bước và frontend hiện tại. Test cũng sao chép giả định này nên vẫn xanh.

**Cách sửa:** Chọn một contract thống nhất với dự án hiện tại. Với UI KDS 2 cột hiện tại, role kitchen phải được phép chuyển `Đang chuẩn bị → Hoàn thành`. Nếu muốn đổi sang `Đang giao`, phải có design/UI change riêng; không tự thay behavior trong security phase.

**Test bắt buộc:** Test production transition helper/HTTP endpoint và test contract với payload frontend KDS `{ status: 'Hoàn thành' }`.

## 3. High — vẫn chưa đạt yêu cầu vòng 1

### R2-H01 — Các test mới vẫn copy logic, không test production

Ba suite mới định nghĩa lại logic bên trong file test:

- `admin-role-and-transition.test.js` copy `VALID_TRANSITIONS`, `ROLE_ALLOWED_TARGET_STATUS`, `evaluateTransition`.
- `public-dto-and-validation.test.js` copy validation và DTO builder.
- `webhook-and-payment.test.js` mô phỏng CAS và error classifier.

Các test này không import route/service/helper production và không gửi HTTP request. Vì vậy chúng vẫn pass khi frontend/backend lệch contract như lỗi KDS ở trên.

Handoff ghi “kiểm thử trực tiếp logic CAS, State Transition, DTO” là không chính xác. Đây vẫn là test mô phỏng.

**Cách sửa:**

- Tách transition policy, order validation và DTO builder thành module production có export; unit test import đúng module đó.
- Tạo HTTP integration test cho auth/role/branch và create/lookup/cancel/payment routes.
- Webhook test phải gọi handler/router với DB adapter mock có kiểm soát hoặc database test, không mô phỏng lại SQL bằng object JS.

### R2-H02 — Customer cancel và status transition vẫn có race condition

Bọc transaction không đủ. Cả hai flow vẫn:

1. SELECT current status.
2. Kiểm tra ở JavaScript.
3. INSERT history.

Hai transaction đồng thời dưới isolation mặc định có thể cùng đọc một current state và cùng insert transition/hủy trùng.

**Cách sửa:** Dùng locking phù hợp (`UPDLOCK`, `HOLDLOCK`) trên logical order transition hoặc một cơ chế version/current-status atomic. Thêm test concurrency thật, assert chỉ một transition thắng.

### R2-H03 — Cashier vẫn được dùng generic status endpoint cho gần như mọi trạng thái

`ROLE_ALLOWED_TARGET_STATUS.cashier` vẫn gồm `Đã xác nhận`, `Đang chuẩn bị`, `Đang giao`, `Hoàn thành`, `Đã hủy`.

Audit vòng 1 yêu cầu cashier không dùng generic state endpoint nếu không có nghiệp vụ rõ. Hiện cashier vẫn có thể hoàn thành đơn, chuyển giao hoặc bắt đầu bếp.

**Cách sửa:** Chốt ma trận thao tác thật của cashier. Tối thiểu tách payment confirm khỏi order workflow; chỉ cấp các target thực sự cần. Không cấp “tất cả trừ một vài trường hợp”.

### R2-H04 — Promotion read vẫn global cho manager

`GET /admin/promotions` cho `manager` và trả toàn bộ bảng promotions, không join/filter `promotion_stores` theo branch. Handoff nói đã xử lý promotion scope nhưng thực tế chỉ khóa POST/PUT cho super.

**Cách sửa:** Hoặc chỉ super được đọc admin promotion global trong Phase 1, hoặc manager chỉ nhận promotions gắn branch của mình qua `promotion_stores`.

## 4. Medium — cần sửa trước khi chốt production

### R2-M01 — Scheduler có thể tạo unhandled rejection

`expireUnpaidPayOSOrders()` đã đúng khi throw lỗi DB, nhưng callback `setInterval(async () => { await ... })` không có try/catch. Khi DB lỗi, promise của interval bị reject mà không được xử lý; tùy runtime có thể gây cảnh báo hoặc dừng process.

**Cách sửa:** Scheduler catch và log/monitor lỗi, nhưng không biến lỗi thành success count. Có thể dùng wrapper `void run().catch(...)`.

### R2-M02 — Bypass limiter đang áp cho toàn bộ payment router

Mount `/api/payments` trước limiter làm cả endpoint `GET /payos/status` bypass, không chỉ webhook. Endpoint status có thể bị spam/guess code.

**Cách sửa:** Mount riêng webhook trước limiter hoặc gắn limiter riêng cho status endpoint.

### R2-M03 — Public lookup vẫn dùng order code ngắn làm access key

PII đã được mask, đây là cải thiện tốt. Tuy nhiên endpoint vẫn trả chi tiết món, tổng tiền và lịch sử chỉ bằng order code. Chấp nhận được cho tracking demo, nhưng production nên rate-limit lookup và cân nhắc opaque tracking token.

### R2-M04 — Customer detail còn lộ dữ liệu toàn chuỗi cho branch staff

Sau khi xác nhận khách từng mua tại branch, response vẫn trả `address`, `points`, `total_spent` toàn hệ thống. Recent orders và LTV đã filter branch, nhưng profile global chưa có DTO role-specific.

**Cách sửa:** Cashier/manager branch chỉ nhận field cần phục vụ tại branch; cân nhắc ẩn address và total_spent global.

### R2-M05 — Cancel token frontend còn đọc fallback localStorage cũ

Tracking đọc sessionStorage trước rồi vẫn đọc localStorage. Đây có thể là migration compatibility, nhưng token cũ chỉ bị xóa khi hủy thành công; terminal paid/expired/completed chưa thấy cleanup đồng bộ ở mọi path.

Không phải blocker nhưng cần ghi rõ lifecycle và dọn key cũ có giới hạn.

## 5. Đánh giá lại các mục vòng 1

| Nhóm | Vòng 2 |
|---|---|
| B-01 invalid webhook history | ✅ Đã sửa |
| B-02 invalid expire history | ✅ Đã sửa |
| B-03 webhook CAS | ✅ Đã sửa |
| B-04 infra error HTTP 500 | ✅ Đã sửa |
| B-05 webhook limiter order | ✅ Cơ bản sửa, còn scope router |
| H-01 admin branch scope | ⚠️ Cải thiện, promotion GET còn global |
| H-02 role transition policy | ❌ Regression KDS; cashier quá rộng |
| H-03/H-04 public DTO | ✅ Cải thiện rõ |
| H-05 input allowlist | ✅ Đã sửa |
| H-06 customer-only identity | ✅ Đã sửa |
| H-07 cancel concurrency | ❌ Chưa sửa atomic concurrency |
| H-08 admin cancel | ⚠️ Có transaction/policy, vẫn cùng mẫu read-then-insert |
| H-09 manual confirm CAS | ✅ Đã sửa |
| M-02/M-03 test quality | ❌ Vẫn test logic copy |

## 6. Kết quả command Codex chạy lại

- `npm.cmd test`: ✅ 13/13 pass.
- Backend `node --check`: ✅ pass.
- Frontend `npm.cmd run build`: ✅ pass.

Các kết quả trên không thay đổi verdict vì test suite chưa gọi code production cho ba nhóm quan trọng, và build không phát hiện contract mismatch KDS/API.

## 7. Checklist sửa vòng 3 cho AGY

Thứ tự bắt buộc:

1. Sửa transition kitchen khớp KDS thật: `Đang chuẩn bị → Hoàn thành`.
2. Thu hẹp target status của cashier theo nghiệp vụ được duyệt.
3. Tách transition/validation/DTO thành module production và import trong test; xóa logic copy trong test.
4. Thêm HTTP integration test cho KDS status endpoint với token kitchen.
5. Thêm concurrency guard và test song song cho customer cancel/status transition.
6. Scope `GET /admin/promotions` theo branch hoặc khóa super-only.
7. Catch scheduler rejection có logging/monitoring rõ.
8. Chỉ bypass limiter cho webhook; rate-limit payment status/lookup.
9. Cập nhật handoff: không dùng từ “test trực tiếp” nếu vẫn là simulation.

## 8. Điều kiện nghiệm thu tiếp theo

Phase 1 chỉ được pass khi:

- KDS UI có thể hoàn thành đơn bằng token kitchen.
- Test gọi production policy/endpoint, không copy logic.
- Hai request cancel/transition đồng thời chỉ một request tạo state mới.
- Cashier không có quyền workflow dư thừa.
- Manager không đọc promotion ngoài scope.
- Scheduler DB error không thành unhandled rejection.

Cho đến lúc đó: **không chuyển Phase 2**.
