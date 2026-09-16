# Implementation Plan: Cổng thanh toán Sandbox cho toàn bộ luồng QA

Spec nguồn: `docs/superpowers/specs/2026-09-17-payment-sandbox-design.md`

## Mục tiêu triển khai

Thêm provider `sandbox` dùng trên môi trường Render hiện tại để tester đăng ký tài khoản mới, tạo checkout và nhập số tiền chuyển thử nghiệm. Chỉ số tiền khớp chính xác mới settlement. Đơn thường, Buy Now, checkout group và preorder phải tiếp tục qua toàn bộ lifecycle hiện có mà không phát sinh outbound call tới PayOS.

PayOS được giữ nguyên và hoạt động lại khi `PAYMENT_MODE=payos`. Không migration database, không thay đổi Auth/RBAC, pricing, voucher, catalog, fulfillment, review hoặc preorder state machine ngoài cầu nối settlement hiện hữu.

## Ranh giới bắt buộc

- Làm việc trên branch `feat/payment-sandbox-gateway`, bắt đầu từ commit chứa spec đã duyệt.
- Không merge/push `main` trước khi toàn bộ test, build và review hoàn tất.
- Không bật simulator cũ bằng `ENABLE_PAYOS_SIMULATOR` trên production.
- Không cập nhật trực tiếp `orders.payment_status` từ route sandbox.
- Không dùng query/body frontend để chọn provider.
- Không gọi PayOS trong `qa_sandbox`, kể cả create, lookup, reconciliation hoặc regeneration.
- Không thêm banner hay mã truy cập chung.
- Không sửa/xóa dữ liệu production trong giai đoạn code và automated test.

## Phase 1: Payment mode fail-closed

### 1.1. Tạo payment mode resolver

**Tạo:** `backend/config/payment-mode.js`

- Định nghĩa hai mode hợp lệ: `qa_sandbox`, `payos`.
- Hàm `resolvePaymentMode(env)` trả mode hợp lệ hoặc ném lỗi cấu hình.
- Hàm `isSandboxPaymentMode()` và `assertSandboxPaymentMode()` dùng ở service/route.
- Không mặc định sang sandbox nếu biến thiếu/sai.
- Automated tests và local development phải đặt `PAYMENT_MODE` tường minh trong test setup; không sửa resolver để âm thầm fallback chỉ nhằm làm test cũ pass.

### 1.2. Tích hợp startup validation

**Sửa:** `backend/config/env.js`

- Validate `PAYMENT_MODE` ở production.
- Trong `payos`, giữ kiểm tra profile/credential PayOS hiện có.
- Trong `qa_sandbox`, không yêu cầu gọi PayOS nhưng vẫn không xóa hoặc ghi đè credential.
- Export mode trong config immutable.

### 1.3. Test

**Tạo:** `backend/test/payment-mode.test.js`

- Nhận đúng hai mode.
- Missing/unknown mode fail closed ở production.
- Không bao giờ tự chuyển sang sandbox.

## Phase 2: Tách settlement canonical khỏi xác thực PayOS

### 2.1. Tạo settlement service trung lập provider

**Tạo:** `backend/services/payment-attempt-settlement-core.js`

- Nhận attempt đã được provider xác thực cùng `provider`, `providerPaymentIdentity`, `amount`, `reference`, `paymentLinkId`, `payload`.
- Gọi duy nhất `paymentAttemptsRepository.processSuccessfulAttemptEvent()`.
- Sau kết quả `paid`, `duplicate` hoặc `already_paid`, gọi idempotent `preorderService.onPaymentSettled()` với `orderId` hoặc `checkoutGroupId` và cờ late.
- Không chứa logic chữ ký PayOS hoặc logic UI sandbox.

### 2.2. Giữ PayOS compatibility

**Sửa:** `backend/services/payment-attempt-settlement.js`

- `resolveVerifiedPayOSAttempt()` vẫn xác minh chữ ký/profile như cũ.
- `settleVerifiedPayOSAttempt()` chuyển sang gọi settlement core với provider `payos`.
- `processPayOSWebhookWithAttempts()` không gọi preorder bridge lần thứ hai.
- Giữ nguyên response kinds và idempotency contract hiện tại.

### 2.3. Test

**Tạo:** `backend/test/payment-attempt-settlement-core.test.js`

- Settlement order và checkout group.
- Preorder bridge gọi đúng một lần.
- Duplicate/already-paid vẫn idempotent.
- Wrong provider/amount do repository canonical từ chối.

**Chạy lại:**

- `backend/test/payment-attempt-settlement.test.js`
- `backend/test/payos-lifecycle.test.js`
- `backend/test/payos-payment-attempt-recovery.test.js`
- `backend/test/payment-webhook-route.test.js`
- Các payment-attempt repository tests hiện có.

## Phase 3: Sandbox payment attempt service

### 3.1. Tạo service

**Tạo:** `backend/services/sandbox-payment-attempt.js`

Service hỗ trợ cả target `order` và `checkout_group`:

- Reserve bằng `paymentAttemptsRepository.reserveOrRecoverCreatingAttempt()` với `provider: 'sandbox'`.
- Dùng amount/profile snapshot trên target.
- Provider order code là safe integer duy nhất.
- Sinh raw token bằng crypto và lưu SHA-256 token vào `provider_payment_link_id` để lookup.
- `checkout_url` trỏ tới frontend `/thanh-toan/sandbox?token=<raw-token>`. URL snapshot này nằm trong DB giống checkout URL của provider hiện hữu, vì vậy implementation không được tuyên bố raw token hoàn toàn vắng khỏi DB.
- Không log raw token hoặc `checkout_url` đầy đủ. Khi recover một active attempt, phải tái sử dụng nguyên checkout URL đã snapshot; không sinh token mới làm lệch hash.
- Activate qua repository canonical; không tự cập nhật current pointer.
- TTL dùng biến `SANDBOX_PAYMENT_TIMEOUT_MINUTES`, mặc định bằng thời hạn PayOS hiện hành.
- Trả artifact tương thích gồm provider, URL, expiry, status và payment code.

### 3.2. Ownership và lookup

Service phải:

- Hash token nhận từ client và tìm attempt `provider='sandbox'` theo identity đã lưu.
- Order ownership phải tái sử dụng helper canonical đang dùng cho regeneration; checkout group phải tái sử dụng `verifyGroupOwnership()`. Không viết phép so sánh `user_id` giản lược riêng cho group.
- Chỉ chấp nhận customer đang đăng nhập và đúng owner canonical của order/group.
- Từ chối attempt không active, expired, cancelled hoặc superseded.
- Không hỗ trợ guest sandbox checkout; nếu luồng guest hiện hữu cần giữ, phải dùng cancel-token ownership canonical và bổ sung test riêng trước khi mở. Mặc định plan này yêu cầu đăng nhập theo spec.

### 3.3. Settlement số tiền

- Parse bằng `const parsedAmount = Number(amount)`; bắt buộc `Number.isSafeInteger(parsedAmount)` và `parsedAmount > 0`.
- Tuyệt đối không dùng `Math.round`, `parseInt` hoặc phép làm tròn nào có thể biến số lẻ thành amount hợp lệ.
- So sánh tuyệt đối `parsedAmount === Number(attempt.amount)`.
- Thiếu/dư/NaN không mutation.
- Đúng tiền gọi settlement core với identity deterministic `sandbox_transfer:<attempt-id>`.
- Double-submit trả kết quả idempotent, không tạo payment event thứ hai.

### 3.3.1. Quy tắc transaction và locking

- Không mở một outer transaction để khóa attempt/target rồi gọi `processSuccessfulAttemptEvent()` bằng transaction khác.
- Ownership/token có thể được kiểm tra trước bằng query canonical vì owner của target là immutable; settlement race được quyết định tại repository canonical.
- `processSuccessfulAttemptEvent()` là nguồn khóa và transaction duy nhất cho bước mutation; nó phải revalidate attempt id, provider `sandbox`, amount snapshot, trạng thái và current target dưới lock.
- Nếu implementation cần thêm query trong cùng transaction, mở rộng repository để nhận/truyền cùng `tx`; không tạo nested transaction hoặc giữ lock ở connection A rồi chờ connection B.

### 3.4. Regeneration và expiry

- Regeneration theo provider hiện hành, supersede attempt cũ qua repository canonical.
- Không reconcile PayOS trước khi regenerate trong mode sandbox.
- Status/detail request kiểm tra expiry theo thời gian; nếu đã quá hạn, dùng repository expiry canonical trước khi trả response.
- Khi chuyển sang PayOS, sandbox attempt cũ không được xử lý tiếp.

### 3.5. Tests

**Tạo:** `backend/test/sandbox-payment-attempt.test.js`

- Direct/group creation và activation.
- Token hash lookup đúng; raw token chỉ xuất hiện trong checkout URL snapshot cần thiết và không xuất hiện trong log.
- Ownership/cross-user denial.
- Exact amount, underpay, overpay, invalid amount.
- Số lẻ gần amount (ví dụ `49999.6` cho attempt `50000`) bị từ chối, chứng minh không có rounding.
- Double-submit và concurrent settlement.
- Expiry, cancel, supersede, regenerate.
- Preorder direct/group settlement.
- PayOS attempt không thể sandbox settlement; sandbox attempt không thể PayOS reconcile.
- Sau đổi mode, regeneration tạo attempt bằng provider mới; target đã paid giữ nguyên.
- Không có lời gọi mock PayOS nào.

## Phase 4: Provider dispatcher trong checkout

### 4.1. Tạo payment provider facade

**Tạo:** `backend/services/payment-provider.js`

- Chọn direct/group attempt service từ server-side payment mode.
- Expose `createForOrder`, `createForGroup`, `regenerateForCustomer`, `getStatus`.
- Trong PayOS mode, delegate sang direct/group PayOS service hiện tại.
- Trong sandbox mode, delegate sang sandbox service.
- Từ chối attempt/provider mismatch thay vì fallback ngầm.

### 4.2. Checkout đơn đơn lẻ

**Sửa:** `backend/services/online-payos-order.js`

- Giữ export cũ tạm thời để không phá callers/tests.
- Bên trong nhận provider facade và ghi `paymentProvider` theo mode thay vì hardcode `payos`.
- Đơn voucher phủ 100% tiếp tục `promotion`, không tạo attempt.
- Chuẩn hóa response thêm `payment_provider` và artifact trung lập.

Nếu tên file PayOS gây hiểu nhầm, tạo `online-payment-order.js` và để file cũ re-export compatibility; không bulk rename ngoài phạm vi.

### 4.3. Checkout group và preorder

**Sửa:** `backend/services/orders/customer-order-service.js`

- Thay dependency `createGroupPayOSAttempt` bằng provider facade.
- Chỉ kiểm tra `isPayOSConfigured()` khi mode là `payos`.
- Dùng provider hiện hành cho group snapshot và child order response.
- Giữ nguyên idempotency, pricing, allocation, preorder linkage và rollback compensation.

**Kiểm tra:** `backend/services/preorders/preorder-service.js`

- Không sửa state machine.
- Chỉ xác nhận bridge nhận settlement từ core cho direct và grouped preorder.

## Phase 5: API payment trung lập và route sandbox

### 5.1. Endpoint canonical

**Sửa:** `backend/routes/payments.js`

Thêm:

- `GET /api/payments/status?code=...`
- `POST /api/payments/regenerate`
- `GET /api/payments/sandbox/session?token=...`
- `POST /api/payments/sandbox/transfer`

Quy tắc:

- Status/regenerate dispatch theo mode và provider snapshot.
- Sandbox session/transfer bắt buộc Bearer customer token và `qa_sandbox`; mode khác trả 404.
- Transfer body chỉ nhận token và amount; không nhận provider/target/status từ client.
- Giữ endpoint PayOS status/regenerate cũ làm alias compatibility trong một chu kỳ, nhưng alias phải đi qua facade và không được gọi PayOS trong sandbox.
- Retire simulator cũ `/payos/simulate-success`: luôn 404 hoặc xóa route sau khi contract tests được cập nhật.

### 5.2. Webhook và reconciliation guards

**Sửa:**

- `backend/routes/payments.js`
- `backend/services/payos-reconciliation.js`
- Các scheduler/job gọi reconciliation nếu có.

Trong `qa_sandbox`:

- Không outbound lookup/reconcile PayOS.
- Webhook PayOS trả HTTP 200 với kết quả ignored-by-mode để tránh provider retry vô hạn, không mutation target.
- Không bao giờ áp webhook PayOS lên attempt sandbox.

Trong `payos`, giữ nguyên hành vi hiện tại.

### 5.3. API contract tests

**Tạo:** `backend/test/sandbox-payment-routes.test.js`

- Auth bắt buộc, owner đúng/sai.
- 404 ngoài sandbox mode.
- Status/regenerate không cross provider.
- PayOS outbound call count bằng 0 trong sandbox.
- Webhook ignored an toàn trong sandbox và hoạt động cũ trong PayOS.

## Phase 6: Frontend cổng Sandbox

### 6.1. Route mới

**Tạo:** `frontend/src/routes/thanh-toan.sandbox.tsx`

Trang hiển thị:

- Mã thanh toán, số tiền cần trả, countdown.
- Input số tiền VND.
- Nút `Xác nhận chuyển khoản`.
- Loading, sai tiền, hết hạn, đã hủy và đã thanh toán.

Không có banner môi trường và không có các nút mô phỏng trạng thái.

Trang gọi session API để lấy dữ liệu từ token; không đọc amount chuẩn từ query string. Khi thanh toán thành công, chuyển về tracking/profile phù hợp bằng dữ liệu response an toàn.

### 6.2. Checkout hiện tại

**Sửa:** `frontend/src/routes/thanh-toan.tsx`

- Pending payment model lưu `payment_provider`.
- Dùng endpoint trung lập `/api/payments/status` và `/api/payments/regenerate`.
- Khi response có `checkout_url`, điều hướng như hiện tại; sandbox URL sẽ dẫn tới route mới.
- Xóa `simulatePaymentDev()` và UI gọi simulator cũ.
- Giữ nguyên Buy Now isolation, cart cleanup và item editing.

### 6.3. API types/tests

**Sửa/Tạo:**

- `frontend/src/lib/api.ts` nếu cần type helper.
- `frontend/src/lib/pending-payment.ts` để preserve `payment_provider`, payment code/group code, `checkout_url` và expiry qua refresh.
- `frontend/src/lib/__tests__/sandbox-payment.test.tsx`
- Cập nhật checkout/payment contract tests liên quan.

Test:

- Session loading và authentication error.
- Amount format, thiếu/dư và đúng tiền.
- Disable double-submit.
- Expiry countdown và regeneration path.
- Sandbox UI không được render từ PayOS artifact.
- Refresh trang vẫn khôi phục đúng sandbox pending payment; không rơi về endpoint PayOS.
- Buy Now và cart không regression.

Sau khi thêm route, chạy generator chuẩn của TanStack Router; chỉ commit `routeTree.gen.ts` nếu build tạo thay đổi canonical.

## Phase 7: Full regression và chứng minh không gọi PayOS

### 7.1. Backend focused suites

Chạy tối thiểu:

```powershell
node --test backend/test/payment-mode.test.js backend/test/payment-attempt-settlement-core.test.js backend/test/sandbox-payment-attempt.test.js backend/test/sandbox-payment-routes.test.js
node --test backend/test/payment-attempts-repository.test.js backend/test/payment-attempt-settlement.test.js backend/test/payos-lifecycle.test.js backend/test/payos-payment-attempt-recovery.test.js backend/test/payment-webhook-route.test.js backend/test/direct-payos-attempt-service.test.js backend/test/grouped-payos-attempt-service.test.js
node --test backend/test/preorder-service.test.js backend/test/preorder-customer-checkin-contract.test.js backend/test/checkout-voucher-stability.test.js
```

Điều chỉnh tên file theo test thực tế nếu suite hiện hữu có tên khác; không bỏ coverage tương đương.

### 7.2. Frontend

```powershell
npm.cmd --prefix frontend run test -- --run
npm.cmd --prefix frontend run build
git diff --check
```

### 7.3. Test invariant

Trong test sandbox, inject mock PayOS functions ném lỗi ngay nếu bị gọi. Toàn bộ sandbox suite phải pass với call count PayOS bằng 0.

Mỗi suite phải đặt `PAYMENT_MODE` tường minh và khôi phục environment sau test; không phụ thuộc mode còn sót từ shell hoặc `.env` cá nhân.

## Phase 8: Git, Render và browser smoke

### 8.1. Git

- Commit theo nhóm nhỏ: config/core, sandbox service/API, frontend, tests/docs.
- Push feature branch để review.
- Không merge main khi còn failure hoặc diff ngoài phạm vi.

### 8.2. Thứ tự Render an toàn

Render đang auto-deploy từ `main`, vì vậy:

1. Hoàn tất review feature branch.
2. Đặt `PAYMENT_MODE=qa_sandbox` trên backend Render trước khi merge. Code cũ chưa đọc biến này nên không đổi hành vi ngay.
3. Merge/push `main` sau khi biến đã tồn tại.
4. Chờ backend và frontend deploy thành công.
5. Kiểm tra health/ready và xác nhận không có outbound PayOS call.

Không thay build/start command, database URL, PayOS credential, scheduler hoặc domain trong bước này.

### 8.3. Browser E2E

Dùng tài khoản QA và một tài khoản đăng ký mới để chạy:

1. Sai số tiền rồi nhập đúng cho đơn thường.
2. Buy Now, xác nhận giỏ thường không đổi.
3. Checkout group có món Bếp và Đóng gói.
4. Preorder từ thanh toán tới manager confirmation/check-in/handover.
5. Realtime giữa customer, Admin, Bếp và Đóng gói.
6. Hoàn thành và đánh giá sản phẩm.

Không chạy mutation test trên dữ liệu khách thật. Ghi lại mã các order/preorder QA để phục vụ cleanup có kiểm soát.

## Phase 9: Kế hoạch chuyển lại PayOS sau QA

Không thực hiện cho đến khi chủ dự án yêu cầu:

1. Dừng tester và lập inventory dữ liệu QA.
2. Tạo logical backup, kiểm tra archive/checksum.
3. Trình danh sách dữ liệu dự kiến xóa để phê duyệt riêng.
4. Cleanup trong transaction và verify counts.
5. Đặt `PAYMENT_MODE=payos`, redeploy.
6. Xác nhận sandbox route trả 404.
7. Chạy regression và một giao dịch PayOS thật giá trị thấp.

## Tiêu chí bàn giao implementation

- Không migration.
- Sandbox exact-amount hoạt động cho direct/group/preorder.
- Tài khoản đăng ký mới sử dụng được.
- Không PayOS outbound call trong sandbox.
- PayOS regression không đổi trong mode PayOS.
- Realtime và fulfillment chạy hết lifecycle.
- Frontend full suite, backend targeted suites, production build và `git diff --check` đều pass.
- Chỉ feature branch được push trước review; `main` chưa đổi cho đến khi có phê duyệt triển khai.
