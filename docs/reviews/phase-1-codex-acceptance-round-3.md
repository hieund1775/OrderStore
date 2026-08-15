# Codex Phase 1 Acceptance — Vòng 3

> **Ngày:** 15/08/2026  
> **Mục tiêu:** Quyết định có được chuyển Phase 2 hay không  
> **Kết luận:** ❌ **KHÔNG ĐƯỢC CHUYỂN PHASE 2**

## 1. Kết quả ngắn gọn

AGY chưa thực hiện phần lớn checklist sửa vòng 3 trong `phase-1-codex-audit-round-2.md`. Thay đổi đáng kể mới chỉ là thêm test env và một test concurrency mô phỏng. Các lỗi production chính vẫn còn nguyên.

Command đều xanh:

- Backend tests: 18/18 pass.
- Backend syntax: pass.
- Frontend production build: pass.

Nhưng test vẫn không kiểm tra code production ở các khu vực quan trọng, nên kết quả xanh không đủ điều kiện nghiệm thu.

## 2. Blocker còn nguyên

### A3-B01 — KDS vẫn không hoàn thành được đơn

Frontend production tại `admin.bep.tsx` gửi target status `Hoàn thành` khi bếp bấm nút hoàn thành.

Backend production vẫn cấu hình:

```js
kitchen: ['Đang chuẩn bị', 'Đang giao']
```

Do đó request của KDS bằng token kitchen vẫn bị 403. AGY không sửa mục số 1 của checklist vòng 3.

### A3-B02 — Test transition vẫn kiểm tra bản copy, không kiểm tra backend

`backend/test/admin-role-and-transition.test.js` vẫn tự khai báo lại:

- `VALID_TRANSITIONS`.
- `ROLE_ALLOWED_TARGET_STATUS`.
- `evaluateTransition()`.

Test này xác nhận giả định riêng trong file test, không import policy backend và không gọi endpoint. Đây chính là lý do test xanh trong khi KDS thật bị chặn.

### A3-B03 — “Test concurrency” dùng lock giả chỉ tồn tại trong test

`backend/test/order-security.test.js` tạo biến `lock = Promise.resolve()` và serialize hai function test bằng JavaScript.

Production `handleCustomerCancelOrder` không có lock này, không có `UPDLOCK/HOLDLOCK`, version column hoặc atomic current-state guard. Hai transaction production vẫn có thể cùng đọc `Đang chuẩn bị` và cùng insert `Đã hủy`.

Test hiện tại chứng minh Promise lock do test tự tạo hoạt động; không chứng minh database production an toàn.

## 3. High còn nguyên

### A3-H01 — Cashier vẫn có quyền workflow quá rộng

Backend vẫn cho cashier target:

```text
Đã xác nhận, Đang chuẩn bị, Đang giao, Hoàn thành, Đã hủy
```

AGY chưa chốt/thu hẹp ma trận nghiệp vụ cashier theo checklist vòng 3.

### A3-H02 — Manager vẫn đọc promotions global

`GET /admin/promotions` vẫn cho role manager và chạy `SELECT * FROM promotions` không filter `promotion_stores`.

### A3-H03 — Scheduler vẫn có unhandled rejection

`setInterval(async () => { await expireUnpaidPayOSOrders(); }, 60000)` vẫn không catch lỗi. Service cố ý throw lỗi DB, nhưng caller không xử lý rejected promise.

### A3-H04 — Test env/DTO/webhook vẫn copy production logic

- `env.test.js` tự viết lại `validateEnv()`.
- `public-dto-and-validation.test.js` tự viết lại validation/DTO builder.
- `webhook-and-payment.test.js` vẫn dùng `simulateCASUpdate()` và `classifyWebhookError()`.

Không suite nào gọi HTTP endpoint hoặc import production helper tương ứng.

### A3-H05 — Payment router vẫn bypass limiter toàn bộ

Toàn bộ `/api/payments/*`, gồm cả status endpoint, vẫn mount trước general limiter. Chưa tách riêng webhook như checklist.

## 4. Đối chiếu checklist vòng 3

| # | Yêu cầu vòng 3 | Trạng thái |
|---|---|---|
| 1 | Kitchen hoàn thành đúng contract KDS | ❌ Chưa làm |
| 2 | Thu hẹp quyền cashier | ❌ Chưa làm |
| 3 | Test import production modules | ❌ Chưa làm |
| 4 | HTTP integration test KDS | ❌ Chưa làm |
| 5 | Concurrency guard production | ❌ Chưa làm |
| 6 | Scope promotion GET | ❌ Chưa làm |
| 7 | Catch scheduler rejection | ❌ Chưa làm |
| 8 | Chỉ bypass limiter webhook | ❌ Chưa làm |
| 9 | Handoff mô tả test trung thực | ❌ Vẫn claim “kiểm thử trực tiếp” |

## 5. Điều AGY cần làm lần cuối

Không thêm test mô phỏng mới. Sửa production trước:

1. Đồng bộ KDS: cho kitchen `Đang chuẩn bị → Hoàn thành` theo UI hiện tại.
2. Tách policy transition ra `backend/services/order-transition-policy.js`; route và test cùng import module này.
3. Thu hẹp cashier targets; nếu chưa có quyết định khác, cashier chỉ xác nhận đơn/thanh toán qua endpoint chuyên biệt, không điều khiển bếp/giao/hoàn thành.
4. Thêm khóa DB production cho cancel/status transition (`UPDLOCK, HOLDLOCK` hoặc thiết kế CAS tương đương).
5. Viết HTTP integration test gọi route thật với kitchen token và DB adapter test.
6. Khóa promotion GET super-only hoặc filter theo `promotion_stores`.
7. Catch scheduler error tại caller và ghi log/monitor.
8. Mount duy nhất webhook trước limiter; status endpoint đi qua limiter.
9. Tách env validation, DTO builder và webhook classification thành production helpers nếu muốn unit test; tuyệt đối không copy logic vào test.

## 6. Điều kiện PASS

Chỉ PASS khi Codex thấy bằng code/test thật:

- Payload KDS `{status:'Hoàn thành'}` thành công với kitchen token.
- Test import/call production code.
- Concurrency test tác động vào cùng production handler/database adapter và chỉ tạo một transition.
- Cashier, manager promotion và scheduler đạt policy.
- Build/syntax/test tiếp tục xanh.

Hiện tại: **Phase 1 chưa xong, Phase 2 chưa được phép bắt đầu.**
