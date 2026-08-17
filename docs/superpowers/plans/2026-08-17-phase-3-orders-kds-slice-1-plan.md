# Implementation Plan Phase 3 — Lát 1 Orders và KDS

> Ngày: 17/08/2026  
> Spec: `docs/superpowers/specs/2026-08-17-phase-3-domain-architecture-design.md`  
> Người thực hiện: AGY  
> Người nghiệm thu: Codex  
> Phạm vi: chỉ Orders/KDS, không tự chuyển sang Catalog/Menu

## 0. Kết quả cần đạt

- Toàn bộ admin order/KDS và public order routes được mount từ domain routers nhưng giữ nguyên URL/contract.
- SQL nằm trong order repositories; transaction và nghiệp vụ nằm trong order services.
- Route chỉ middleware, validation, gọi service và map HTTP.
- Không regression RBAC, branch scope, cursor, transition, cancellation token, concurrency, price engine hoặc PayOS mapping.
- Không trả SQL/internal error trực tiếp cho client ở production.
- Backend test xanh; frontend test/build xanh nếu file frontend liên quan bị sửa.

## 1. Nguyên tắc bắt buộc cho AGY

1. Làm task theo thứ tự và commit riêng đúng điểm dừng.
2. Viết/siết characterization test trước khi di chuyển handler.
3. Test phải import/mount production module; không copy implementation vào test.
4. Không đổi URL, status code, response field hoặc nghiệp vụ để “dễ refactor”.
5. Không sửa Catalog/Menu, Stores, Promotions, Reports hoặc Settings.
6. Không tạo generic/base repository hoặc DI framework.
7. Không xóa handler cũ trước khi router mới có integration test xanh.
8. Không nuốt lỗi transaction/cleanup; không trả `err.message` SQL ở production.
9. Sau mỗi task chạy test mục tiêu và `npm.cmd test` trong `backend`.
10. Dừng sau Task 8 và gửi Codex nghiệm thu; không bắt đầu Lát 2.

## 2. Cấu trúc file mục tiêu của Lát 1

```text
backend/
  routes/
    admin/orders.js
    admin/kitchen.js
    public/orders.js
  services/orders/
    admin-order-service.js
    customer-order-service.js
    order-errors.js
  repositories/
    orders.js
  validation/
    order-schemas.js
  dto/
    order-dto.js
  middleware/
    async-handler.js
  test/
    phase3-orders-characterization.test.js
    phase3-orders-service.test.js
    phase3-orders-error-contract.test.js
```

Chỉ tạo file thực sự cần. Có thể dùng tên khác nếu ý nghĩa tương đương và handoff ghi rõ mapping.

## Task 1 — Khóa contract Orders/KDS hiện tại

**Files:**

- Create: `backend/test/phase3-orders-characterization.test.js`
- Modify nếu cần tái sử dụng fixture: test helpers hiện có, không sửa expectation để hợp thức hóa regression

**Yêu cầu test production HTTP:**

- `GET /admin/orders`: legacy array mode và cursor mode.
- `GET /admin/orders/:id`: success, not found và branch isolation.
- `PATCH` và `PUT /admin/orders/:id/status`: role matrix, valid/invalid/idempotent transition.
- `PUT /admin/orders/:id/cancel`: manager/super, cashier paid/unpaid, kitchen forbidden.
- `PUT /admin/orders/:id/payment/confirm`: CAS/idempotency và branch scope.
- `GET /admin/kitchen/orders`: paid/active filter, branch isolation, constant batch query count.
- `GET /api/orders/lookup`: guest masking và customer ownership DTO.
- `POST /api/orders/:id/cancel` và `/api/orders/cancel`: guest token, customer ownership, concurrent duplicate.
- `POST /api/orders`: online/POS mapping, server-side price, delivery validation, PayOS configured/unconfigured.
- `GET /api/users/:id/orders`: legacy và cursor response contract.

Ưu tiên mở rộng test hiện có thay vì tạo fixture trùng. Mỗi test phải gửi HTTP vào Express app/router production.

**Verify:**

```powershell
cd backend
node --test test/phase3-orders-characterization.test.js test/admin-orders-pagination.test.js test/customer-history-pagination.test.js test/kds-integration.test.js test/order-security.test.js
npm.cmd test
```

**Commit:** `test(phase-3): lock orders and KDS HTTP contracts`

## Task 2 — Thêm error taxonomy, async boundary và order validation

**Files:**

- Create: `backend/services/orders/order-errors.js`
- Create: `backend/middleware/async-handler.js`
- Create: `backend/validation/order-schemas.js`
- Create: `backend/test/phase3-orders-error-contract.test.js`
- Modify: `backend/index.js` chỉ nếu cần global error middleware

**Thiết kế:**

- Error có stable `code`, HTTP `status` và `expose` flag.
- Validation cho positive integer id/store/table, pagination/filter, status/note/reason, create-order allowlists và required fields.
- Production 500 response dùng message chung và request/error code; log giữ chi tiết nội bộ.
- Không đổi message 4xx đã là public contract nếu characterization test khóa nó.
- Async handler phải forward rejection đúng một lần, không double-send.

**Test:** invalid input không gọi repository; SQL error text không xuất hiện trong response; known business error giữ đúng status/code.

**Verify:**

```powershell
cd backend
node --test test/phase3-orders-error-contract.test.js test/public-dto-and-validation.test.js test/env.test.js
npm.cmd test
```

**Commit:** `refactor(phase-3): add order validation and safe error boundary`

## Task 3 — Tách read repository và admin query services

**Files:**

- Create: `backend/repositories/orders.js`
- Create: `backend/services/orders/admin-order-service.js`
- Create: `backend/test/phase3-orders-service.test.js`
- Modify: `backend/routes/admin.js` chỉ để dùng service trong handler cũ ở giai đoạn này

**Repository methods tối thiểu:**

- List admin orders theo resolved store scope/filter/cursor.
- Get admin order detail, items và history.
- List KDS paid/active orders và batch details.
- Get order/payment rows cần cho mutation với lock hints được giữ nguyên.

**Service responsibilities:**

- Resolve query intent từ input đã validate; nhận `storeId` đã resolve, không nhận `req.user`.
- Ghép page info và DTO; bảo toàn legacy array mode.
- KDS dùng query count cố định và `batchLoadOrderDetails` hiện có.

Không đổi SQL semantics hoặc index hints trong task extraction.

**Verify:**

```powershell
cd backend
node --test test/phase3-orders-service.test.js test/admin-orders-pagination.test.js test/kds-query-count.test.js
npm.cmd test
```

**Commit:** `refactor(phase-3): extract order read repository and services`

## Task 4 — Tách admin order mutation services

**Files:**

- Modify: `backend/services/orders/admin-order-service.js`
- Modify: `backend/repositories/orders.js`
- Modify: `backend/routes/admin.js`
- Modify: `backend/test/phase3-orders-service.test.js`

Tách status update, admin cancel, payment confirm và print acknowledgement. Giữ nguyên:

- `UPDLOCK`, `ROWLOCK`, `HOLDLOCK` và transaction boundary.
- `evaluateOrderTransition` và role/payment rules.
- Idempotency/CAS behavior.
- Audit log và shipping/kitchen side effects.
- Branch scope trước mutation.

Service nhận actor/scope/input thuần, không nhận Express `req`/`res`. Repository không quyết định role.

**Verify:**

```powershell
cd backend
node --test test/phase3-orders-service.test.js test/kds-integration.test.js test/admin-role-and-transition.test.js test/webhook-and-payment.test.js
npm.cmd test
```

**Commit:** `refactor(phase-3): extract admin order mutation services`

## Task 5 — Tách customer order services/repository

**Files:**

- Create: `backend/services/orders/customer-order-service.js`
- Modify: `backend/repositories/orders.js`
- Modify: `backend/routes/public.js` để handler cũ gọi service
- Modify: `backend/test/phase3-orders-service.test.js`

Tách create, lookup, cancel và customer history. Giữ nguyên:

- JWT customer identity và guest cancellation token hash/timing-safe compare.
- Concurrent cancellation tạo đúng một history transition.
- Server-side price, voucher consumption và transaction atomicity.
- Order/payment provider mapping và PayOS post-commit flow.
- DTO masking theo anonymous/customer owner.
- Legacy/cursor history contract và constant query count.

PayOS adapter phải được inject/mock ở service boundary trong unit test; HTTP characterization vẫn mount production route.

**Verify:**

```powershell
cd backend
node --test test/phase3-orders-service.test.js test/order-security.test.js test/customer-history-pagination.test.js test/price-engine-query-count.test.js test/public-dto-and-validation.test.js test/webhook-and-payment.test.js
npm.cmd test
```

**Commit:** `refactor(phase-3): extract customer order services`

## Task 6 — Mount domain routers và xóa duplicate handlers

**Files:**

- Create: `backend/routes/admin/orders.js`
- Create: `backend/routes/admin/kitchen.js`
- Create: `backend/routes/public/orders.js`
- Modify: `backend/routes/admin.js`
- Modify: `backend/routes/public.js`

**Mount contract:**

- Router admin được mount sao cho URL vẫn là `/admin/orders/*`.
- Router kitchen giữ `/admin/kitchen/orders`.
- Router public giữ `/api/orders/*`.
- Customer history `/api/users/:id/orders` có thể nằm trong public orders router của Lát 1 nhưng URL không đổi.
- Authentication/RBAC middleware chỉ chạy một lần theo đúng thứ tự hiện tại.
- Sau khi test router mới xanh, xóa handler duplicate khỏi file cũ trong cùng commit.
- Di chuyển Swagger block liên quan cùng router hoặc giữ một nguồn duy nhất; không duplicate operation.

`admin.js`/`public.js` tiếp tục composition cho domain chưa tách.

**Verify:**

```powershell
cd backend
node --test test/phase3-orders-characterization.test.js test/admin-orders-pagination.test.js test/customer-history-pagination.test.js test/kds-integration.test.js test/order-security.test.js
npm.cmd test
```

Thêm static assertion hoặc review command chứng minh không còn duplicate method/path và order SQL không còn trong route mới.

**Commit:** `refactor(phase-3): mount orders and KDS domain routers`

## Task 7 — Chuẩn hóa DTO và error mapping trên production routes

**Files:**

- Create/Modify: `backend/dto/order-dto.js`
- Modify: ba domain routers và hai order services
- Modify: `backend/test/phase3-orders-error-contract.test.js`
- Modify: `backend/test/public-dto-and-validation.test.js`

- DTO admin detail/list, KDS và public lookup/history có mapper có tên.
- Repository rows không trả thẳng ra response nếu chứa internal fields.
- Unknown DB/provider errors trở thành safe 500/502; known validation/business errors giữ 4xx.
- PayOS error response không nối trực tiếp provider `message` trong production.
- Không làm đổi JSON snapshot/field hiện hành ngoài việc loại field đã được xác định là nhạy cảm.

**Verify:**

```powershell
cd backend
node --test test/phase3-orders-error-contract.test.js test/public-dto-and-validation.test.js test/phase3-orders-characterization.test.js
npm.cmd test
```

**Commit:** `refactor(phase-3): normalize order DTO and error mapping`

## Task 8 — Regression, static boundary checks và handoff

**Files:**

- Create: `backend/test/phase3-orders-boundaries.test.js`
- Create: `docs/reviews/phase-3-agy-handoff-slice-1.md`
- Modify documentation only where commands/contracts changed

Boundary tests/static checks phải chứng minh:

- Domain route files không import DB trực tiếp.
- Repository không import Express hoặc auth middleware.
- Service không nhận/use `req`/`res`.
- Không duplicate Orders/KDS method/path trong legacy router.
- Production order routes không trả raw SQL error.

**Full verification:**

```powershell
cd backend
node --check routes/admin/orders.js
node --check routes/admin/kitchen.js
node --check routes/public/orders.js
node --check services/orders/admin-order-service.js
node --check services/orders/customer-order-service.js
node --check repositories/orders.js
npm.cmd test

cd ../frontend
npm.cmd test -- --run
npm.cmd run build
```

Handoff phải ghi từng commit, mapping route cũ → module mới, test counts, skipped tests/warnings và giới hạn. Không dùng từ “100%” hoặc “không còn gap” nếu chưa có bằng chứng.

**Commit:** `docs: hand off phase 3 orders and KDS slice 1`

## 3. Checklist nghiệm thu Codex cho Lát 1

- [ ] Characterization tests được commit trước extraction.
- [ ] Public URL/status/response không đổi.
- [ ] RBAC và branch isolation không regression.
- [ ] Cursor và legacy array modes không regression.
- [ ] Status/cancel/payment concurrency và idempotency giữ nguyên.
- [ ] Price/voucher/PayOS flow giữ nguyên.
- [ ] Route không import DB; service không phụ thuộc Express; repository không quyết định quyền.
- [ ] Không lộ SQL/provider error ở production.
- [ ] Không duplicate routes/Swagger operations.
- [ ] Backend full suite pass.
- [ ] Frontend tests/build pass.
- [ ] Handoff trung thực, có commit/test provenance.

Khi hoàn tất, AGY dừng để Codex audit. Lát 2 Catalog/Menu chỉ được lập hoặc thực hiện sau khi Lát 1 PASS.
