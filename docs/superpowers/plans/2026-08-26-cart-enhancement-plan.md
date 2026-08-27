# Kế hoạch triển khai giỏ hàng DB và checkout đa chi nhánh

**Ngày cập nhật:** 27/08/2026

**Trạng thái:** TẠM DỪNG — chờ tích hợp Catalog V2 vào plan

> **Không giao AGY code theo plan này lúc này.** Thiết kế mới mở rộng hệ thống sang catalog đa ngành hàng, SKU, thuộc tính động và branch inventory. Các task cart dùng option đồ uống cố định bên dưới cần được viết lại sau khi duyệt `docs/superpowers/specs/2026-08-27-general-commerce-catalog-admin-design.md`.

**Spec bắt buộc:** `docs/superpowers/specs/2026-08-26-cart-enhancement-design.md`

## Nguyên tắc thực hiện

- Thực hiện tuần tự Phase 1 → Phase 2 → Phase 3; mỗi phase phải qua verification gate trước khi làm phase tiếp theo.
- Backend/PostgreSQL là nguồn sự thật cho cart, giá, phí, voucher, payment và refund.
- Không nhận giá/tổng tiền từ frontend làm dữ liệu tin cậy.
- Không phá luồng POS, COD và order cũ có `checkout_group_id IS NULL`.
- Không dùng customer `CartItem` thay cho `PosCartItem`; POS giữ flow chỉnh món hiện tại.
- Mọi mutation quan trọng phải có ownership/RBAC, branch scope, transaction và test concurrency/idempotency tương ứng.
- Không sửa migration đã được áp dụng. Chỉ thêm migration mới sau `0010`.

## Phase 0 — Characterization và khóa hành vi cũ

### Task 0.1 — Bổ sung test bảo vệ luồng hiện tại

**Modify/Add:**

- `backend/test/postgres-orders.integration.test.js`
- `backend/test/postgres-payment.integration.test.js`
- `backend/test/payos-lifecycle.test.js`
- `backend/test/order-idempotency.test.js`
- `backend/test/kds-integration.test.js`
- `frontend/src/lib/__tests__/api-idempotency.test.ts`

**Yêu cầu:**

- Khóa behavior order đơn chi nhánh hiện tại, POS paid ngay, COD/legacy và PayOS một đơn.
- Khóa KDS chỉ thấy order hợp lệ theo payment và branch.
- Khóa webhook duplicate, amount mismatch, regenerate QR và active reconciliation.
- Chạy baseline trước khi sửa production code; nếu baseline đang đỏ phải ghi rõ lỗi có sẵn.

**Gate:** Không sang Phase 1 nếu không có baseline rõ ràng.

## Phase 1 — Cart lưu PostgreSQL và UI giỏ hàng

### Task 1.1 — Migration cart

**Create:**

- `backend/database/postgres/migrations/0011_database_cart.sql`
- Tài liệu rollback SQL riêng, không đặt trong thư mục `migrations` để runner không tự chạy.

**Modify:**

- `backend/test/postgres-schema-contract.test.js`
- `backend/test/postgres-schema.integration.test.js`

**Schema:**

- Tạo `carts`, `cart_items`, `cart_item_toppings` đúng spec.
- `carts.user_id` unique; cascade hợp lý khi xóa user/cart.
- `cart_items.version >= 1`, `qty BETWEEN 1 AND 50`.
- FK store/product/options/topping và index cho `cart_id`, `store_id`, `updated_at`.
- Không lưu checkbox `selected` trong DB.
- Không lưu client price làm nguồn sự thật.

**Tests:** schema, constraints, cascade, duplicate topping và version mặc định.

### Task 1.2 — Cart repository/service/validation/API

**Create:**

- `backend/repositories/postgres/cart.js`
- `backend/services/cart/cart-service.js`
- `backend/validation/cart-schemas.js`
- `backend/dto/cart-dto.js`
- `backend/routes/public/cart.js`
- `backend/test/cart-service.test.js`
- `backend/test/postgres-cart.integration.test.js`

**Modify:**

- `backend/routes/public.js`
- `backend/package.json` để thêm integration test mới vào `test:postgres`.

**API:**

- `GET /api/cart`
- `POST /api/cart/items`
- `PATCH /api/cart/items/:id`
- `DELETE /api/cart/items/:id`
- `POST /api/cart/items/bulk-delete`
- `POST /api/cart/re-add-from-order`

**Business rules:**

- Chỉ customer đã đăng nhập được dùng DB cart; không nhận `user_id` từ body.
- Repository khóa cart khi add/update có khả năng gộp dòng.
- Configuration fingerprint gồm `store_id`, `product_id`, toàn bộ option ID, topping ID canonical/sorted và note normalized.
- Không gộp khác chi nhánh hoặc khác ghi chú.
- `PATCH` yêu cầu expected `version`; version cũ trả `409 CART_ITEM_VERSION_CONFLICT`.
- Mọi product/option/topping phải được kiểm tra tồn tại và còn hợp lệ.
- DTO trả giá hiện hành và trạng thái `available`, `price_changed`, `option_unavailable`; server vẫn tính lại lúc checkout.
- `re-add-from-order` tạo lại cart item từ snapshot nhưng revalidate theo menu hiện tại, không chép giá order cũ.

### Task 1.3 — Refactor frontend cart sang server state

**Modify:**

- `frontend/src/lib/api.ts`
- `frontend/src/lib/cart.tsx`
- `frontend/src/components/site/Header.tsx`
- `frontend/src/components/menu/ProductCard.tsx`
- Các điểm quick-add từ wishlist/menu tìm thấy bằng `rg "addItem" frontend/src`.

**Create:**

- `frontend/src/components/cart/EditCartItemModal.tsx`
- `frontend/src/components/cart/BranchCartSection.tsx`
- `frontend/src/lib/__tests__/cart-selection.test.tsx`
- `frontend/src/lib/__tests__/cart-api-conflict.test.tsx`

**Yêu cầu:**

- React Query/cache hoặc provider hiện hữu chỉ là client projection của API cart.
- Checkbox selection lưu cục bộ theo `cart_item_id`; mặc định có thể chọn tất cả nhưng không đồng bộ selection giữa thiết bị.
- Nhóm item theo chi nhánh; chọn tất cả, chọn theo chi nhánh, chọn dòng và xóa đã chọn.
- Modal tải menu/options hợp lệ cho `store_id` của chính dòng cart; không dùng `products.find()` trên dữ liệu tĩnh.
- Hiển thị conflict rõ ràng và refetch cart thay vì ghi đè thay đổi thiết bị khác.
- Giữ loading/error/empty state và responsive drawer.

### Task 1.4 — Tích hợp checkout tạm thời an toàn

**Modify:**

- `frontend/src/routes/thanh-toan.tsx`

**Yêu cầu:**

- Trang lấy các `cart_item_id/version` đã chọn, không dùng toàn bộ cart mặc định.
- Trước Phase 2, vẫn khóa checkout ở một chi nhánh và thông báo nhiều chi nhánh sẽ được hỗ trợ ở phase tiếp theo.
- Không gọi `clear()` toàn cart; chỉ xóa selected rows sau response order thành công theo behavior tạm thời.
- Không thay đổi POS cart.

### Gate Phase 1

```powershell
Set-Location backend
npm.cmd test
npm.cmd run test:postgres

Set-Location ../frontend
npm.cmd test
npm.cmd run build
```

Manual QA: đăng nhập cùng tài khoản trên hai trình duyệt, add/edit/delete/conflict, khác chi nhánh/ghi chú không gộp, unselected item không mất.

## Phase 2 — Checkout group, PayOS, voucher và phí giao hàng

### Task 2.1 — Migration checkout/payment/voucher

**Create:**

- `backend/database/postgres/migrations/0012_checkout_groups.sql`
- Tài liệu rollback SQL riêng ngoài thư mục migration.

**Modify:**

- `backend/test/postgres-schema-contract.test.js`
- `backend/test/postgres-schema.integration.test.js`

**Schema:**

- Tạo `checkout_groups`, `checkout_group_vouchers` và các index/idempotency constraints theo spec.
- Thêm `orders.checkout_group_id`, `delivery_fee`, `shipping_discount_amount`, `shipping_paid_amount`.
- Thêm `order_items.discount_amount`, `paid_amount`, `item_status`.
- Thêm `stores.delivery_fee NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0)`.
- Thêm `promotions.benefit_type` độc lập với `voucher_type` usage policy; dữ liệu cũ backfill `merchandise_discount` trước khi đặt NOT NULL/CHECK.
- Cho `voucher_usage_history` tham chiếu group mà vẫn tương thích row legacy theo order.
- Bổ sung `payment_events.checkout_group_id`; không chọn một order con làm payment owner giả.
- Existing order/PayOS rows vẫn hợp lệ với `checkout_group_id IS NULL`.

### Task 2.2 — Price engine đa chi nhánh và preview

**Create:**

- `backend/services/checkouts/checkout-price-engine.js`
- `backend/services/checkouts/discount-allocation.js`
- `backend/test/checkout-price-engine.test.js`
- `backend/test/discount-allocation.test.js`

**Modify:**

- `backend/repositories/postgres/promotions.js`
- `backend/services/promotions/promotion-service.js`
- `backend/validation/promotion-schemas.js`

**Yêu cầu:**

- Một hàm tính giá dùng chung cho preview và create.
- Server load product/size/topping từ DB; kiểm tra store và option.
- Validate loại nhận hàng: multi-branch chỉ Delivery/PayOS; Take-away một branch; table khóa branch.
- Tính một delivery fee cố định cho mỗi branch order.
- Tối đa một merchandise voucher và một freeship voucher.
- Global/branch eligibility, `min_order`, `max_discount` tính trên eligible aggregate đúng một lần.
- Phân bổ discount bằng largest remainder, tie-break ổn định, tổng tuyệt đối không lệch.
- Trả breakdown checkout → branch → item cho frontend.

### Task 2.3 — Checkout repository và saga idempotent

**Create:**

- `backend/repositories/postgres/checkouts.js`
- `backend/services/checkouts/checkout-service.js`
- `backend/validation/checkout-schemas.js`
- `backend/dto/checkout-dto.js`
- `backend/routes/public/checkouts.js`
- `backend/test/checkout-service.test.js`
- `backend/test/postgres-checkout-concurrency.integration.test.js`

**Modify:**

- `backend/routes/public.js`
- `backend/services/order-idempotency.js` nếu cần abstraction dùng chung.
- `backend/package.json`.

**Yêu cầu:**

- `POST /api/checkouts/preview` và `POST /api/checkouts`.
- Prepare transaction tạo group `creating`, reserve voucher và snapshot order con nhưng không hiện ra history/admin/KDS, chưa xóa cart.
- PayOS call nằm ngoài DB transaction.
- Finalize transaction gắn link, chuyển `unpaid`, consume voucher một lần và xóa đúng selected cart rows/version.
- Failure giữ cart, release reservation, ẩn draft và cleanup an toàn.
- Retry cùng key/hash trả group cũ; key trùng payload khác trả 409.
- Mỗi branch đúng một order con và mã riêng; response trả checkout URL cùng danh sách order code.
- Customer/address chung được snapshot vào group và các order cần thiết cho compatibility.

### Task 2.4 — Chuyển PayOS lifecycle sang group level

**Modify:**

- `backend/repositories/postgres/payments.js`
- `backend/routes/payments.js`
- `backend/services/payos.js`
- `backend/services/payos-reconciliation.js`
- `backend/services/online-payos-order.js`
- `backend/commands/expire-payos-orders.js`
- `backend/services/payment-state.js`
- `backend/test/payments-repository.test.js`
- `backend/test/payos-lifecycle.test.js`
- `backend/test/payos-cron.test.js`
- `backend/test/webhook-and-payment.test.js`

**Yêu cầu:**

- Webhook/reconcile tìm group bằng PayOS code/link ID, dedupe event và kiểm amount với `grand_total`.
- Một transaction chuyển group `paid` và tất cả order con `paid`; chỉ sau commit mới fan-out notification/KDS.
- Regenerate QR từ bất kỳ order code con nào nhưng tạo link cho toàn group.
- QR còn hạn phải reuse; QR hết hạn mới tạo lại.
- Cancel/expire unpaid cập nhật toàn group và mọi order con; không để query legacy coi là active.
- Không giả định `orders.current_status` là cột thật: schema hiện lấy latest status từ `order_status_history`. Sửa các query chạm payment theo nguồn trạng thái hợp lệ hoặc bổ sung migration rõ ràng, không để SQL chỉ pass mock rồi lỗi runtime.
- Service PayOS hiện chưa có abstraction hủy link. Phải kiểm tra SDK chính thức trước khi gọi; nếu provider/SDK không hỗ trợ thì đánh dấu draft failed, lưu dấu vết orphan link và để cleanup/reconcile xử lý, không tự bịa method.
- Legacy PayOS order không có group tiếp tục dùng code path cũ có test bảo vệ.

### Task 2.5 — Admin cấu hình phí và voucher freeship

**Modify:**

- `backend/repositories/postgres/admin-stores.js`
- `backend/services/stores/admin-store-service.js`
- `backend/validation/store-schemas.js`
- `backend/dto/store-dto.js`
- `backend/repositories/postgres/admin-promotions.js`
- `backend/services/promotions/admin-promotion-service.js`
- `backend/dto/promotion-dto.js`
- `frontend/src/routes/admin.chi-nhanh.tsx`
- `frontend/src/routes/admin.khuyen-mai.tsx`

**Yêu cầu:**

- Admin sửa phí cố định theo chi nhánh; validate integer VND không âm.
- Promotion editor tách rõ **Chính sách lượt dùng** và **Loại quyền lợi**.
- Freeship chỉ áp dụng trên shipping fee, không giảm tiền hàng.
- RBAC và manager branch scope giữ nguyên.

### Task 2.6 — Checkout/history/tracking frontend

**Modify:**

- `frontend/src/lib/api.ts`
- `frontend/src/routes/thanh-toan.tsx`
- `frontend/src/routes/ho-so.tsx`
- `frontend/src/routes/theo-doi-don.tsx`
- `frontend/src/lib/order-access.ts`

**Create khi cần:**

- `frontend/src/components/checkout/BranchOrderSummary.tsx`
- `frontend/src/components/checkout/VoucherSelectors.tsx`
- Frontend tests cho breakdown và payment group.

**Yêu cầu:**

- Preview breakdown từng branch: subtotal, merchandise discount, fee, shipping discount và total.
- Hai selector voucher riêng.
- Chặn/giải thích multi-branch Take-away/table/COD trước submit; backend vẫn là authority.
- Submit selected cart IDs/version bằng idempotency key.
- Sau create mở PayOS; history hiển thị các order con ở `Chờ thanh toán`.
- Khách theo dõi từng order code; payment action từ order con resolve về group.
- Không hiển thị internal checkout group code cho khách.

### Gate Phase 2

- Chạy toàn bộ lệnh Gate Phase 1.
- Thêm integration QA cho hai chi nhánh, một QR, webhook duplicate, QR hết hạn, lỗi PayOS và cart/voucher concurrency.
- Đối chiếu tổng: `group grand_total = SUM(order.total)` và mọi allocation sum tuyệt đối bằng discount tương ứng.

## Phase 3 — Hủy dòng, duyệt theo Shopee và refund thủ công

### Task 3.1 — Migration cancellation/refund ledger

**Create:**

- `backend/database/postgres/migrations/0013_item_cancellation_refunds.sql`
- Tài liệu rollback SQL riêng ngoài thư mục migration.

**Schema:**

- Tạo `order_item_cancellation_requests` và `refunds` đúng spec.
- Partial unique index bảo đảm một pending request trên mỗi item.
- Constraints amount không âm, total đúng thành phần và FK group/order/item nhất quán.
- Refund/audit giữ lịch sử; không cascade xóa dữ liệu tài chính ngoài ý muốn.

### Task 3.2 — Cancellation/refund domain service

**Create:**

- `backend/services/orders/item-cancellation-service.js`
- `backend/repositories/postgres/refunds.js`
- `backend/validation/refund-schemas.js`
- `backend/test/item-cancellation-service.test.js`
- `backend/test/postgres-refund.integration.test.js`

**Modify:**

- `backend/routes/public/orders.js`
- `backend/routes/admin/orders.js`
- `backend/repositories/postgres/orders.js`
- `backend/repositories/postgres/admin-orders.js`
- `backend/services/orders/customer-order-service.js`
- `backend/services/orders/admin-order-service.js`
- `backend/services/order-transition-policy.js`

**Business rules:**

- Unpaid chỉ cancel toàn payment group, không tạo item request.
- Paid + `Chờ xác nhận`: auto approve nguyên item line/qty.
- Paid + `Đã xác nhận`/`Đang chuẩn bị`: pending chờ đúng branch duyệt.
- Pending theo Shopee: chưa phải cancelled, không tự pause; KDS cảnh báo nổi bật.
- `Đang giao`/`Hoàn thành`/`Đã hủy`: reject mutation.
- Approve dùng frozen `order_items.paid_amount`; không reprice/reallocate.
- Còn active item thì shipping refund 0.
- Hủy hết item trước giao thì refund đúng `shipping_paid_amount`; freeship không đổi thành tiền.
- Hủy hết item thì thêm order status `Đã hủy`; order khác trong group không đổi.
- Phase này tạo refund `pending`; admin complete thủ công, ghi provider reference và audit.
- Mọi quyết định phải transaction + row lock + idempotent; duplicate approve không tạo hai refund.

### Task 3.3 — Customer/admin/KDS UI và notification

**Modify:**

- `frontend/src/routes/theo-doi-don.tsx`
- `frontend/src/routes/ho-so.tsx`
- `frontend/src/routes/admin.don-hang.tsx`
- `frontend/src/routes/admin.bep.tsx`
- `backend/repositories/postgres/notifications.js`
- `backend/services/notifications/notification-service.js`

**Yêu cầu:**

- Customer hủy theo dòng, modal ghi rõ toàn bộ qty và bắt buộc lý do.
- Trạng thái: chờ duyệt, chấp nhận, từ chối, refund pending/completed.
- KDS giữ pending item trong order nhưng có cảnh báo ưu tiên và nút đi tới duyệt.
- Manager/kitchen chỉ xử lý request của branch mình; super theo RBAC hiện có.
- Notification cho branch khi có request; cho customer khi approve/reject/refund completed.
- Nút **Thêm lại vào giỏ** sau cancel/expired phải revalidate menu hiện tại.

### Task 3.4 — Reports, points và verification toàn hệ thống

**Modify:**

- `backend/repositories/postgres/admin-reports.js`.
- `backend/services/reports/report-service.js`
- Repository/service points hiện hữu tìm bằng `rg "point_transactions|points_earned" backend`.
- Các test report/customer history tương ứng.

**Yêu cầu:**

- Revenue branch dùng order child total, không nhân group total.
- Refund completed trừ đúng branch/item; pending hiển thị liability nhưng chưa giả là đã hoàn.
- Points ghi sau paid trên tiền hàng thực trả, không tính shipping; refund completed tạo transaction điều chỉnh append-only.
- Kiểm tra query count/index cho cart, checkout, KDS và history.

### Gate Phase 3

- Chạy toàn bộ backend unit/integration và frontend test/build.
- Manual flow: hai branch, một payment, theo dõi riêng, hủy một item line qty > 1, branch reject/approve, hủy hết một branch, shipping refund và branch khác không đổi.
- Kiểm tra admin branch scope, webhook retry, double-click cancellation/refund và audit log.

## Điều AGY không được làm

- Không triển khai lại plan frontend-only cũ.
- Không thêm `selected` vào DB cart.
- Không dùng `branchName`, product name hoặc client price làm authority.
- Không gộp cart key thiếu branch/note/canonical toppings.
- Không tạo một PayOS link cho từng order con.
- Không consume voucher theo từng order con.
- Không clear toàn bộ cart khi chỉ checkout một phần.
- Không gửi order unpaid vào KDS.
- Không tự động xem `cancel_requested` là `cancelled` hoặc tự pause món.
- Không hoàn shipping khi branch order vẫn còn item hoạt động.
- Không sửa POS cart để ép dùng customer cart modal/model.
- Không commit/push khi chưa có review code, test output và xác nhận của chủ dự án.
