# Implementation Plan Đợt 1 — An toàn vận hành và tính đúng dữ liệu

> **Người thực hiện chính:** AGY  
> **Người review/nghiệm thu:** Codex  
> **Spec nguồn:** `docs/superpowers/specs/2026-08-15-production-hardening-design.md`  
> **Phạm vi bắt buộc:** Chỉ Đợt 1. Không refactor lớn, không tối ưu index, không đổi UI ngoài phần cần để hiển thị lỗi đúng.

## 0. Kết quả cuối đợt

Sau đợt này hệ thống phải bảo đảm:

- Mỗi role admin chỉ gọi được API đúng nghiệp vụ và đúng chi nhánh.
- Người ngoài không xem PII hoặc hủy đơn của khách khác.
- POS VietQR là thủ công; online VietQR mới đi PayOS.
- Live mode mất backend không tạo đơn mock giả.
- Webhook PayOS và auto-expire không ghi đè trạng thái của nhau.
- Production không khởi động với secret/cấu hình quan trọng bị thiếu.
- Frontend build sạch, backend syntax sạch và checklist bảo mật vượt qua.

## 1. Quy tắc làm việc dành cho AGY

1. Tạo branch làm việc riêng từ commit chứa plan này.
2. Thực hiện task theo đúng thứ tự. Mỗi task là một commit nhỏ, không gộp toàn bộ đợt vào một commit.
3. Không format toàn repo trong đợt này.
4. Không sửa URL API nếu plan không yêu cầu.
5. Không đổi SQL Server, framework, JWT library hoặc PayOS SDK.
6. Không dùng frontend để thay thế kiểm tra quyền ở backend.
7. Không dùng `req.body.changed_by`, `req.body.user_id` hoặc `req.body.store_id` làm danh tính/quyền mà chưa đối chiếu token.
8. Không chạy migration phá dữ liệu. Mọi migration mới phải có guard `IF NOT EXISTS`.
9. Sau mỗi task chạy kiểm tra được ghi trong task đó. Nếu fail, dừng và sửa trước khi sang task tiếp theo.
10. Khi bàn giao, ghi rõ mọi điểm lệch plan. Không tự chọn giải pháp khác mà không ghi chú.

## 2. Task 1 — Chuẩn hóa cấu hình và fail-fast production

### Mục tiêu

Không cho backend production chạy với JWT secret mặc định, DB config mơ hồ hoặc PayOS bật nửa vời.

### File dự kiến

- Tạo `backend/config/env.js`.
- Sửa `backend/index.js`.
- Sửa `backend/middleware/auth.js`.
- Sửa `backend/routes/public.js` nếu đang tự đọc JWT secret.
- Sửa `backend/.env.example` nếu file tồn tại; nếu chưa có thì tạo bản example không chứa secret thật.

### Cách làm

Tạo module config duy nhất:

- Load dotenv trước khi module khác đọc env.
- Export `JWT_SECRET` và các config đã chuẩn hóa.
- `NODE_ENV=production`: thiếu `JWT_SECRET`, `FRONTEND_URL` hoặc DB config cần thiết thì throw khi startup.
- Nếu bất kỳ biến PayOS nào được điền thì phải đủ cả bộ key cần thiết; thiếu một phần thì throw.
- Development được dùng secret local nhưng phải log warning.

Thay toàn bộ fallback JWT rải rác bằng config chung. Không để `public.js` và `auth.js` dùng hai cách lấy secret khác nhau.

### Kiểm tra

```powershell
cd backend
node --check config/env.js
node --check middleware/auth.js
node --check routes/public.js
node --check index.js
```

Test thủ công bằng process environment tạm:

- Production thiếu `JWT_SECRET` phải thoát với message rõ.
- Development vẫn khởi động với warning.
- Không in giá trị secret ra console.

### Commit gợi ý

`security: validate production environment configuration`

## 3. Task 2 — Tạo middleware RBAC và branch scope dùng chung

### Mục tiêu

Biến role và chi nhánh thành policy backend rõ ràng, tái sử dụng được.

### File dự kiến

- Sửa `backend/middleware/auth.js`.
- Tạo `backend/middleware/branch-scope.js`.
- Tạo test dùng `node:test` trong `backend/test/` nếu chưa có framework test.
- Sửa `backend/package.json` để có script `test` nếu cần.

### API helper cần có

Tối thiểu cung cấp:

- `authenticate`.
- `requireRole(...roles)`.
- `resolveStoreScope(req, requestedStoreId)`:
  - `super` trả requested store hoặc `null` nếu được phép xem toàn hệ thống.
  - Role khác bắt buộc có `branch_id`.
  - Không truyền store thì trả branch của token.
  - Truyền store khác branch thì throw/return lỗi 403.
- Middleware hoặc error type giúp route trả 403 nhất quán.

Không chỉ dựa vào việc sidebar đã ẩn menu.

### Test bắt buộc

- Super truy cập mọi store.
- Manager/cashier/kitchen truy cập đúng store.
- Ba role trên gửi store khác nhận 403.
- Non-super thiếu `branch_id` nhận 403, không được hiểu là toàn hệ thống.

### Commit gợi ý

`security: add reusable role and branch scope policies`

## 4. Task 3 — Áp RBAC và branch scope vào admin API

### Mục tiêu

Khóa quyền theo ma trận trong spec mà chưa cần chia nhỏ file `admin.js`.

### File dự kiến

- Sửa `backend/routes/admin.js`.
- Có thể sửa `backend/routes/auth.js` nếu `/admin/me` cần đồng bộ shape.

### Ma trận áp dụng

#### Chỉ super

- Settings/accounts/audit logs.
- Thao tác quản trị tài khoản nếu hiện có.
- Các cấu hình toàn hệ thống nhạy cảm.

#### Super hoặc manager

- Manager được cập nhật store của branch mình, quản lý table của branch mình và promotion đã gắn branch mình.
- Reports; manager chỉ nhận dữ liệu branch của mình.

#### Chỉ super đối với dữ liệu global

- Tạo/xóa store.
- CRUD category/product/size/base/sugar/ice/topping vì schema hiện tại chưa gắn các bảng này với branch.
- Không thêm branch scope giả vào menu trong đợt 1; nếu cần menu theo branch phải mở migration/spec riêng.

#### Super, manager hoặc cashier

- Danh sách/chi tiết đơn đúng scope.
- Xác nhận thanh toán thủ công đúng scope.
- Thao tác thu ngân được quy định.

#### Super, manager hoặc kitchen

- KDS đúng scope.
- Cập nhật trạng thái nghiệp vụ bếp đúng scope.

### Yêu cầu query

- Mọi endpoint nhận `store_id` phải qua `resolveStoreScope`.
- Endpoint theo `:id` phải query/join lấy `store_id`, kiểm tra scope trước khi đọc/sửa/xóa.
- Không query record trước rồi trả chi tiết cho user sai scope.
- Payment confirm phải atomic và chỉ chạy nếu order thuộc scope.
- Admin cancel phải dùng `req.user.sub` cho audit; bỏ `changed_by` từ body.

### Test bắt buộc

Dùng ít nhất bốn token test: super, manager branch 1, cashier branch 1, kitchen branch 1.

- Kitchen gọi menu CRUD nhận 403.
- Cashier gọi settings nhận 403.
- Manager branch 1 gọi order/store/table branch 2 nhận 403 hoặc danh sách rỗng đúng thiết kế.
- Cashier branch 1 không confirm payment order branch 2.
- Kitchen branch 1 không xem KDS branch 2.
- Super vẫn thực hiện được các tác vụ hiện có.

### Commit gợi ý

`security: enforce admin role and branch boundaries`

## 5. Task 4 — Khóa IDOR trên public customer endpoints

### Mục tiêu

Không cho client tự khai identity để đọc/sửa dữ liệu người khác.

### File dự kiến

- Sửa `backend/routes/public.js`.
- Có thể tạo `backend/middleware/optional-customer-auth.js` hoặc helper trong auth middleware.

### Endpoint cần audit toàn bộ

- `/api/users/:id`.
- `/api/users/:id/orders`.
- Wishlist đọc/thêm/xóa.
- Review tạo/sửa nếu có.
- Các endpoint reward/voucher cá nhân nếu có.

### Quy tắc

- Thao tác dữ liệu cá nhân bắt buộc token customer.
- Lấy user id từ `req.user.sub`, không lấy từ body.
- Nếu giữ `:id` để tương thích frontend thì bắt buộc `Number(:id) === Number(req.user.sub)`; nếu không trả 403.
- Admin không dùng endpoint customer để vượt policy admin.
- Public profile nếu thực sự không cần public thì chuyển sang authenticated endpoint; không trả phone/address cho anonymous.
- Review phải xác minh order item thuộc đúng customer nếu gắn với đơn.

### Test bắt buộc

- Customer A không đọc profile/orders/wishlist của B.
- Anonymous không đọc profile có PII.
- Body giả `user_id=B` không tạo wishlist/review dưới tên B.
- Customer A vẫn dùng hồ sơ hiện tại bình thường.

### Commit gợi ý

`security: bind customer resources to authenticated identity`

## 6. Task 5 — Public tracking DTO và quyền hủy đơn

### Mục tiêu

Giữ chức năng theo dõi đơn bằng mã nhưng không lộ dữ liệu nhạy cảm và không cho người ngoài hủy đơn.

### File dự kiến

- Tạo migration `backend/database/update-order-cancellation.sql`.
- Sửa `backend/database/schema.sql` để schema mới và migration đồng bộ.
- Sửa `backend/routes/public.js`.
- Sửa `frontend/src/routes/thanh-toan.tsx`.
- Sửa `frontend/src/routes/theo-doi-don.tsx`.
- Sửa `frontend/src/lib/mock-engine.ts` cho Standalone tương thích.

### Thiết kế cancellation token

- Migration thêm `orders.cancel_token_hash CHAR(64) NULL` với guard `IF NOT EXISTS`; `schema.sql` phải có cùng cột cho database tạo mới.
- Khi tạo guest order, sinh token bằng `crypto.randomBytes(32)`.
- Chỉ lưu hash SHA-256 trong DB, không lưu token thô.
- Response create order trả `cancel_token` đúng một lần.
- Frontend lưu token theo `order_code` trong session/local storage phù hợp với vòng đời hiện tại.
- Request hủy guest gửi token qua header hoặc body; backend hash và so sánh constant-time nếu thực tế phù hợp.
- Customer đã đăng nhập có thể hủy bằng customer JWT khi order thuộc user đó; không bắt buộc cancellation token.

### Public tracking DTO

Không trả `o.*`. Chỉ trả các trường UI thực sự dùng. Che số điện thoại nếu UI cần nhận diện, ví dụ chỉ giữ bốn số cuối. Không trả:

- `user_id`.
- `transaction_id`.
- `paid_verified_by`.
- Full phone/full delivery address cho anonymous.
- Payment link metadata nội bộ.
- Cancellation token hash.

### Quy tắc hủy

- Update trong transaction.
- Chỉ cho phép trạng thái nghiệp vụ được chính sách duyệt.
- Guest phải có token đúng; customer phải sở hữu order.
- Đơn `paid` không được khách tự hủy trong scope đợt này.
- Đơn `expired` hoặc đã hủy trả kết quả idempotent, không ghi lịch sử trùng.

### Test bắt buộc

- Lookup anonymous không có PII.
- Guest token đúng hủy được đơn unpaid hợp lệ.
- Guest token sai/thiếu nhận 403.
- Customer A không hủy đơn B.
- Đơn paid không bị khách hủy.
- Hai request hủy đồng thời chỉ tạo một trạng thái hủy.
- Standalone golden path vẫn tạo/lookup/hủy được theo cùng contract.

### Commit gợi ý

`security: protect public order tracking and cancellation`

## 7. Task 6 — Sửa mapping source/payment provider và xác minh bàn

### Mục tiêu

Đảm bảo nguồn đơn quyết định đúng cơ chế thanh toán và bàn thuộc đúng cửa hàng.

### File dự kiến

- Sửa `backend/routes/public.js`.
- Sửa `backend/services/payos.js` nếu cần chuẩn hóa lỗi cấu hình.
- Sửa `frontend/src/routes/admin.pos.tsx` nếu payload chưa ổn định.
- Sửa `frontend/src/routes/thanh-toan.tsx` nếu cần.
- Sửa `frontend/src/lib/mock-engine.ts`.

### Logic bắt buộc

```text
source=online + VietQR + PayOS configured → payos
source=online + VietQR + PayOS missing    → trả lỗi cấu hình, không tạo manual order
source=pos    + VietQR                    → manual_vietqr
source=pos    + COD                       → cod
```

- Allowlist `source`, `payment_method`, `order_type` trước transaction.
- Allowlist hiện tại giữ `payment_method = COD | VietQR | MoMo | ZaloPay`; MoMo/ZaloPay vẫn là luồng xác nhận thủ công trong đợt 1, không giả lập tích hợp ví thật.
- Không tin `order_type=POS` thay cho `source=pos`; validate tổ hợp hợp lệ.
- Nếu có `table_id`, query bàn bằng `id + store_id + is_active=1`.
- Bàn không khớp store phải trả 400 trước khi consume voucher.
- POS không được nhận `checkout_url` PayOS.

### Test bắt buộc

- Bốn trường hợp mapping trên.
- POS VietQR khi PayOS đã cấu hình vẫn là manual.
- Online VietQR không cấu hình PayOS không tạo đơn mồ côi.
- Bàn branch 2 không dùng với order branch 1.
- Payload source/payment method rác nhận 400 sạch, không lộ SQL error.

### Commit gợi ý

`fix: enforce order source and payment provider mapping`

## 8. Task 7 — Tắt auto-fallback mock trong live mode

### Mục tiêu

Mất backend phải được xem là lỗi vận hành, không phải tín hiệu chuyển sang dữ liệu demo.

### File dự kiến

- Sửa `frontend/src/lib/api.ts`.
- Sửa `frontend/src/lib/mock-engine.ts` nếu cần contract rõ hơn.
- Sửa `frontend/src/routes/admin.pos.tsx`.
- Sửa `frontend/src/routes/thanh-toan.tsx`.
- Có thể sửa banner Standalone trong `frontend/src/components/site/Header.tsx`.

### Logic bắt buộc

- `VITE_STANDALONE=true`: mọi route được hỗ trợ đi mock như hiện tại.
- Không có cờ Standalone: network error, HTML response hoặc invalid JSON phải throw `ApiConnectionError`/`ApiProtocolError`.
- Không tự lock vào mock vì backend tạm down.
- POS giữ nguyên cart khi create order fail.
- Checkout giữ nguyên cart/form và cho retry.
- UI không toast “thành công” nếu response không có `order_id` và `order_code` hợp lệ.
- Banner Standalone dựa trên mode cấu hình, không chỉ dựa vào hostname Vercel.

### Test bắt buộc

- Live mode chặn backend: create order fail, localStorage `teaplus_orders` không đổi.
- Live mode backend trả HTML: báo lỗi protocol, không mock.
- Standalone mode vẫn tạo đơn local.
- POS cart còn nguyên sau lỗi.
- Checkout cart còn nguyên sau lỗi.

### Commit gợi ý

`fix: isolate standalone mock from live API failures`

## 9. Task 8 — Atomic PayOS webhook và auto-expire

### Mục tiêu

Không để webhook, retry và expire ghi đè trạng thái lẫn nhau.

### File dự kiến

- Sửa `backend/routes/payments.js`.
- Tạo `backend/services/payment-state.js`.
- Sửa `backend/index.js`.
- Có thể sửa `backend/services/payos.js` để chuẩn hóa verified payload.

### Webhook flow

1. Verify signature.
2. Validate success code.
3. Validate orderCode/reference/amount.
4. Tìm đúng order có provider PayOS.
5. Atomic update:

```sql
UPDATE orders
SET payment_status = N'paid',
    paid_at = GETDATE(),
    transaction_id = @reference,
    updated_at = GETDATE()
WHERE id = @id
  AND payment_status = N'unpaid'
  AND payment_provider = N'payos'
  AND total = @amount;
```

6. Nếu affected rows bằng 0, đọc lại trạng thái:
   - `paid`: trả idempotent success.
   - `expired`: không hồi sinh đơn; log reconciliation required.
   - Khác amount/provider: từ chối và log cảnh báo.

Nếu nghiệp vụ muốn nhận tiền về trễ sau expire, không tự quyết trong code đợt này. Ghi nhận reconciliation để admin xử lý; không chuyển expired sang paid tự động.

### Auto-expire flow

Dùng một câu `UPDATE` có `OUTPUT INSERTED.id, INSERTED.order_code`:

```sql
UPDATE orders
SET payment_status = N'expired', updated_at = GETDATE()
OUTPUT INSERTED.id, INSERTED.order_code
WHERE payment_status = N'unpaid'
  AND payment_provider = N'payos'
  AND payment_expires_at < GETDATE();
```

Không select rồi update từng row.

### Rate limiter và response

- Mount webhook trước `app.use('/api', generalLimiter)` hoặc exclude đúng route.
- Invalid signature/non-success/business rejection: trả 200 theo contract hiện tại và log kết quả.
- DB timeout/connection/unhandled infrastructure error: trả 500 để provider retry.
- Không log toàn bộ webhook body hoặc secret/signature.

### Test bắt buộc

- Webhook hợp lệ chuyển unpaid thành paid.
- Webhook lặp trả success nhưng không update lần hai.
- Sai signature/sai amount không update.
- Expire và webhook chạy gần đồng thời chỉ có một terminal transition thắng.
- Webhook đến sau expired không hồi sinh order.
- DB throw khiến endpoint trả 5xx.
- Webhook không chịu general limiter.

### Commit gợi ý

`fix: make PayOS payment transitions atomic`

## 10. Task 9 — Regression pass và tài liệu bàn giao

### Mục tiêu

Xác nhận các thay đổi bảo mật không phá golden path.

### Command bắt buộc

```powershell
cd backend
npm.cmd test
$files = rg --files -g "*.js"
foreach ($f in $files) { node --check $f; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }

cd ..\frontend
npm.cmd run build
```

Lint hiện có baseline Prettier/CRLF lớn. Không chạy auto-fix toàn repo trong đợt 1. AGY chỉ được bảo đảm file mới/sửa không tạo thêm lỗi logic; việc làm sạch lint toàn repo thuộc Đợt 3.

### Smoke test thủ công

#### Online

- Quét QR bàn đúng branch.
- Tạo order COD nếu còn được phép.
- Tạo order VietQR PayOS.
- Webhook xác nhận và đơn xuất hiện KDS.
- Tracking không lộ PII.
- Chủ đơn thao tác hủy theo policy.

#### POS

- Tạo COD và xác nhận thủ công.
- Tạo VietQR tĩnh và xác nhận thủ công.
- Không xuất hiện checkout URL PayOS.
- Mất backend không xóa cart hoặc tạo mock order.

#### Admin/KDS

- Test đủ bốn role.
- Test hai branch khác nhau.
- Auto-print/KDS polling vẫn nhận paid order đúng branch.

#### Standalone

- Bật `VITE_STANDALONE=true`.
- Tạo, lookup, thanh toán demo và KDS vẫn chạy trên cùng trình duyệt.

### Bàn giao cho Codex

AGY tạo `docs/reviews/phase-1-agy-handoff.md` gồm:

- Commit list.
- File list.
- Migration và cách chạy.
- Test output tóm tắt.
- Checklist pass/fail.
- Known issues.
- Mọi điểm khác với plan và lý do.

### Commit gợi ý

`docs: hand off phase 1 security hardening for review`

## 11. Điều kiện Codex từ chối nghiệm thu

Codex sẽ trả lại hoặc trực tiếp sửa nếu gặp một trong các trường hợp:

- Kiểm tra quyền chỉ nằm ở frontend.
- Query theo ID không kiểm tra branch scope.
- Guest vẫn hủy đơn chỉ bằng numeric ID/order code.
- Production vẫn auto-fallback mock.
- POS VietQR vẫn có thể thành PayOS.
- Webhook update không có điều kiện trạng thái/provider/amount.
- Auto-expire vẫn select rồi update từng row.
- Secret mặc định vẫn dùng được trong production.
- Migration không idempotent hoặc có nguy cơ phá dữ liệu cũ.
- Build frontend hoặc backend syntax/test fail.

## 12. Thứ tự giao việc ngắn gọn cho AGY

```text
Task 1  Env fail-fast
Task 2  RBAC/branch helper
Task 3  Áp quyền admin
Task 4  Khóa customer IDOR
Task 5  Tracking DTO + cancel token
Task 6  Source/payment mapping + table/store validation
Task 7  Tách live API khỏi mock
Task 8  Atomic webhook/expire
Task 9  Regression + handoff
→ Dừng, gửi Codex review, không tự sang Đợt 2
```
