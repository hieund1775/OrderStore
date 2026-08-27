# Thiết kế giỏ hàng DB và checkout đa chi nhánh

**Ngày cập nhật:** 27/08/2026

**Trạng thái:** Đã duyệt nghiệp vụ; phần schema cart chờ đồng bộ Catalog V2

> **Tạm dừng triển khai schema cart trong file này.** Catalog V2 đã được thiết kế để hỗ trợ SKU và modifier động. Các cột option đồ uống cố định ở phần Cart phải được thay bằng `variant_id` và modifier selections theo `docs/superpowers/specs/2026-08-27-general-commerce-catalog-admin-design.md` trước khi AGY code.

**Phạm vi:** Giỏ hàng khách hàng, checkout đa chi nhánh, PayOS, voucher, phí giao hàng, hủy dòng món và hoàn tiền thủ công

## 1. Mục tiêu

Hệ thống cần cung cấp trải nghiệm tương tự Shopee nhưng phù hợp mô hình đồ uống nhiều chi nhánh:

- Giỏ hàng của tài khoản được lưu trong PostgreSQL và đồng bộ giữa các thiết bị.
- Khách có thể chọn món từ nhiều chi nhánh và thanh toán một lần bằng một PayOS QR.
- Backend tạo một đơn riêng cho mỗi chi nhánh; mỗi đơn có mã, KDS, shipper và hành trình riêng.
- Khách theo dõi từng đơn chi nhánh, không theo dõi mã thanh toán tổng.
- Có thể dùng tối đa một voucher giảm tiền hàng và một voucher freeship trong cùng checkout.
- Khách có thể hủy nguyên một dòng cấu hình món cùng toàn bộ số lượng của dòng đó; các dòng và đơn chi nhánh khác không bị ảnh hưởng.
- Mọi giá, phí, phân bổ giảm giá và số tiền hoàn được đóng băng để đối soát chính xác.

## 2. Các quyết định đã chốt

### 2.1. Ranh giới đơn hàng

- `checkout_group` là cha thanh toán nội bộ: một lần checkout, một PayOS payment và một tổng tiền.
- Mỗi chi nhánh sinh đúng một `order` con trong checkout đó.
- Một `order` chứa nhiều `order_items`. Hai cấu hình khác nhau của cùng sản phẩm là hai dòng riêng.
- Khách chỉ thấy và theo dõi các `order_code` của đơn chi nhánh. Mã nhóm thanh toán chỉ dùng cho API nội bộ, PayOS và đối soát.
- Thông tin người nhận gồm tên, số điện thoại và địa chỉ dùng chung cho tất cả đơn con.

### 2.2. Loại nhận hàng

- `Delivery`: được checkout nhiều chi nhánh.
- `Take-away`: mỗi checkout chỉ được có một chi nhánh.
- Đơn QR tại bàn: khóa theo chi nhánh của bàn, không được trộn chi nhánh.
- Checkout nhiều chi nhánh trong phase này dùng VietQR/PayOS. COD và POS hiện hữu tiếp tục theo luồng một chi nhánh.
- Frontend phải thông báo rõ giới hạn trước khi khách bấm thanh toán; backend vẫn bắt buộc kiểm tra lại.

### 2.3. Giỏ hàng và chọn món

- Cart tồn tại theo tài khoản trong DB; không dùng React memory làm nguồn dữ liệu chính.
- Trạng thái checkbox `selected` chỉ là trạng thái UI cục bộ của từng thiết bị, không lưu vào DB. Điều này tránh điện thoại tự thay đổi lựa chọn đang thao tác trên laptop.
- Checkout gửi danh sách `cart_item_id` đã chọn kèm `version` hiện tại.
- Khi checkout chuyển thành công sang `Chờ thanh toán`, chỉ các dòng đã chọn mới bị xóa khỏi DB cart. Dòng không chọn được giữ nguyên.
- Nếu hủy nhóm đang chờ thanh toán, hệ thống không tự khôi phục cart cũ. Khách có nút **Thêm lại vào giỏ**; backend kiểm tra lại chi nhánh, sản phẩm, tùy chọn, giá và tình trạng còn bán.

### 2.4. Hủy món

- Đơn vị hủy là toàn bộ một `order_item`, bao gồm toàn bộ `qty` của cấu hình đó; không hủy một phần số lượng.
- Ví dụ: cam ×1 và đào ×2 là hai dòng. Hủy dòng đào nghĩa là hủy cả hai ly đào, dòng cam tiếp tục.
- Hủy khi nhóm còn `unpaid`: không hủy riêng dòng hoặc riêng đơn con; hủy toàn bộ nhóm thanh toán và tất cả đơn con chưa thanh toán.
- Sau khi đã thanh toán:
  - `Chờ xác nhận`: tự động chấp nhận yêu cầu hủy dòng.
  - `Đã xác nhận` hoặc `Đang chuẩn bị`: tạo yêu cầu chờ chi nhánh duyệt.
  - `Đang giao`, `Hoàn thành` hoặc `Đã hủy`: không cho hủy thông thường.
- Yêu cầu từ khách luôn phải có lý do.
- Theo cách Shopee xử lý yêu cầu hủy, trạng thái `pending` chưa làm dòng món trở thành đã hủy và không tự động dừng nghiệp vụ. KDS phải cảnh báo nổi bật để chi nhánh quyết định sớm; các dòng khác vẫn tiếp tục bình thường.
- Nếu chi nhánh từ chối, dòng món tiếp tục được xử lý và không phát sinh hoàn tiền.
- Nếu mọi dòng của một đơn chi nhánh đã hủy, đơn đó chuyển `Đã hủy`; các đơn chi nhánh khác không đổi.

### 2.5. Hoàn tiền và phí giao hàng

- Phase đầu chưa gọi API hoàn tiền PayOS tự động. Hệ thống tạo khoản hoàn `pending` để admin xử lý thủ công và xác nhận `completed` sau khi hoàn.
- Tiền hoàn của dòng món là số tiền thực trả đã đóng băng cho dòng đó, không phải giá niêm yết.
- Hủy một dòng nhưng đơn chi nhánh vẫn còn dòng hoạt động: không hoàn phí giao hàng.
- Hủy toàn bộ dòng của đơn chi nhánh trước khi giao: hoàn phí giao hàng thực tế đã trả của chi nhánh đó.
- Voucher freeship không quy đổi thành tiền mặt. Nếu phí thực trả bằng 0 thì tiền hoàn phí cũng bằng 0.
- Không tính lại voucher hay phân bổ lại tiền cho các dòng còn lại sau khi checkout.

## 3. Kiến trúc dữ liệu

Tên cột dưới đây là hợp đồng thiết kế; implementation plan có thể chia migration nhưng không được thay đổi ý nghĩa nghiệp vụ.

### 3.1. Cart

#### `carts`

- `id`
- `user_id` — duy nhất, một cart hoạt động cho mỗi tài khoản
- `created_at`, `updated_at`

#### `cart_items`

- `id`, `cart_id`
- `store_id`, `product_id`
- `size_option_id`, `base_option_id`, `sugar_option_id`, `ice_option_id`
- `note`
- `qty`
- `version` — tăng sau mỗi lần cập nhật để chống ghi đè giữa nhiều thiết bị
- `added_at`, `updated_at`

#### `cart_item_toppings`

- `cart_item_id`, `topping_id`
- Unique `(cart_item_id, topping_id)`.

Cart không lưu `unit_price`, tên món, tên chi nhánh hay giá topping làm nguồn tin cậy. API đọc dữ liệu hiện hành từ menu để hiển thị; server tính lại toàn bộ khi checkout.

Hai lần thêm chỉ được gộp khi cùng `store_id`, `product_id`, toàn bộ option ID, danh sách topping ID đã sắp xếp và `note` đã chuẩn hóa. `branchId` và `note` bắt buộc nằm trong khóa cấu hình; nếu thiếu sẽ gộp sai món giữa chi nhánh hoặc ghi chú khác nhau.

### 3.2. Nhóm checkout và payment

#### `checkout_groups`

- `id`, `internal_code`, `user_id`
- `status`: `creating | unpaid | paid | expired | cancelled | failed`
- `fulfillment_type`: `Delivery | Take-away`
- `customer_name`, `customer_phone`, `delivery_addr`
- `merchandise_subtotal`
- `merchandise_discount_amount`
- `delivery_fee_total`
- `shipping_discount_amount`
- `grand_total`
- Các trường PayOS hiện đang nằm trên `orders`: provider, link ID, PayOS order code, checkout URL, QR, created/expires/paid time, transaction reference
- `idempotency_key`, `request_hash`
- `created_at`, `updated_at`

Một idempotency key chỉ được dùng với đúng một request hash. Gửi lại cùng key và cùng payload trả lại nhóm cũ; cùng key nhưng payload khác trả `409`.

#### Thay đổi `orders`

- Thêm `checkout_group_id` nullable để không phá POS/legacy order.
- Thêm `delivery_fee`, `shipping_discount_amount`, `shipping_paid_amount`.
- `subtotal` là tổng tiền hàng gốc của riêng chi nhánh.
- `discount_amount` là giảm tiền hàng được phân bổ cho chi nhánh.
- `total = subtotal - discount_amount + shipping_paid_amount`.
- PayOS fields không tiếp tục được nhân bản vào từng đơn con mới. Luồng legacy một đơn có thể được hỗ trợ tạm trong giai đoạn chuyển đổi.

#### Thay đổi `order_items`

- `line_total` tiếp tục là tổng tiền hàng gốc của cả dòng.
- Thêm `discount_amount` và `paid_amount`.
- `paid_amount = line_total - discount_amount`.
- Thêm trạng thái dòng: `active | cancel_requested | cancelled`.
- Giá, tên sản phẩm, cấu hình và topping trong order là snapshot bất biến.

### 3.3. Voucher

`promotions.voucher_type` hiện biểu diễn chính sách lượt dùng (`single_use`/dùng chung), không được tái sử dụng để biểu diễn loại quyền lợi. Bổ sung trường độc lập:

- `benefit_type`: `merchandise_discount | free_shipping`.

#### `checkout_group_vouchers`

- `checkout_group_id`, `promotion_id`, `benefit_type`, `code`
- `user_phone`, snapshot usage policy/rule, phạm vi chi nhánh đủ điều kiện, eligible subtotal/fee và discount thực tế
- `reservation_status`: `reserved | consumed | released`, cùng thời điểm hết hạn reservation
- Unique `(checkout_group_id, benefit_type)` để bảo đảm tối đa một mã mỗi loại.

`voucher_usage_history` phải tham chiếu được `checkout_group_id` và chỉ ghi một lần cho cả checkout. Không được consume voucher một lần trên mỗi order con. Với single-use, partial unique index trên claim `reserved/consumed` theo `(promotion_id, user_phone)` ngăn cùng số điện thoại giữ hai claim. Với usage limit dùng chung, transaction khóa promotion row rồi tính cả claim `reserved/consumed` chưa giải phóng trước khi tạo reservation.

### 3.4. Hủy và hoàn tiền

#### `order_item_cancellation_requests`

- `id`, `order_item_id`, `requested_by`, `reason`
- `status`: `pending | auto_approved | approved | rejected`
- `decided_by`, `decision_reason`, timestamps
- Một dòng chỉ được có tối đa một yêu cầu đang `pending`.

#### `refunds`

- `id`, `checkout_group_id`, `order_id`, `order_item_id` nullable
- `merchandise_amount`, `shipping_amount`, `total_amount`
- `status`: `pending | completed | rejected`
- `reason`, `processed_by`, `provider_reference`, timestamps

Refund là ledger append-only. Không sửa ngược snapshot giá của order. Việc đổi trạng thái refund phải ghi audit log.

## 4. Tính giá và phân bổ

Backend là nguồn sự thật duy nhất. Client chỉ gửi ID, số lượng, voucher code và loại nhận hàng.

### 4.1. Voucher tiền hàng

- Cho phép tối đa một voucher `merchandise_discount`.
- Voucher toàn hệ thống áp dụng trên tổng tiền hàng của mọi chi nhánh đủ điều kiện.
- Voucher theo chi nhánh chỉ tính các đơn chi nhánh thuộc phạm vi; đơn khác vẫn thanh toán đủ.
- `min_order` và `max_discount` được tính đúng một lần trên tổng tiền hàng đủ điều kiện của cả checkout.
- Tổng discount được phân bổ xuống các order đủ điều kiện theo tỷ lệ subtotal, sau đó xuống từng dòng theo tỷ lệ `line_total`.

### 4.2. Voucher freeship

- Bổ sung `stores.delivery_fee` là phí cố định do admin cấu hình, mặc định 0 và không âm; phase này chưa tích hợp API khoảng cách.
- Tổng phí giao hàng là tổng phí của các đơn chi nhánh.
- Cho phép tối đa một voucher `free_shipping`; chỉ các chi nhánh thuộc phạm vi voucher mới được giảm.
- Nếu freeship có trần giảm, phân bổ trên các phí đủ điều kiện theo tỷ lệ.

### 4.3. Làm tròn

Tất cả số tiền lưu bằng VND integer. Phân bổ dùng phương pháp largest remainder với tie-break ổn định theo `order_id`, rồi `order_item_id`, để:

- Tổng phân bổ dòng bằng chính xác discount của order.
- Tổng phân bổ order bằng chính xác discount của checkout.
- Không có chênh lệch do làm tròn trong báo cáo hoặc hoàn tiền.

## 5. Luồng checkout an toàn

Không thể tạo một ACID transaction bao trùm PostgreSQL và API PayOS. Hệ thống dùng saga idempotent nhưng bảo đảm khách không nhìn thấy trạng thái tạo dở.

1. Client gửi `Idempotency-Key`, các `cart_item_id/version`, fulfillment, thông tin nhận hàng và tối đa hai voucher code.
2. Transaction chuẩn bị:
   - Khóa và kiểm tra cart rows/version.
   - Kiểm tra store hoạt động, bàn, loại nhận hàng, sản phẩm, option, topping và số lượng.
   - Tính giá từ DB, tính phí, kiểm tra và reserve voucher.
   - Tạo `checkout_group` trạng thái `creating` cùng các order/order item snapshot. Các bản ghi này chưa xuất hiện trong lịch sử khách, admin hoặc KDS.
   - Cart chưa bị xóa và voucher chưa được consume chính thức.
3. Sau khi commit, service gọi PayOS bằng mã thanh toán xác định từ checkout group.
4. Transaction hoàn tất:
   - Khóa lại group và cart rows, xác nhận version chưa đổi.
   - Gắn payment link, chuyển group sang `unpaid`.
   - Consume voucher đúng một lần.
   - Xóa đúng các cart rows đã chọn.
   - Kích hoạt các order con ở trạng thái nghiệp vụ `Chờ xác nhận`, nhưng KDS vẫn lọc vì payment chưa `paid`.
5. Chỉ sau bước 4 API mới trả checkout URL và danh sách mã đơn chi nhánh.

Nếu PayOS lỗi, group chuyển `failed`, reservation được giải phóng và cart giữ nguyên. Nếu PayOS đã tạo link nhưng transaction hoàn tất thất bại, service hủy link theo best effort và job nền tiếp tục cleanup/reconcile. Retry cùng idempotency key không được tạo thêm group hoặc thêm link thanh toán.

## 6. Luồng thanh toán

- Một PayOS link thanh toán `checkout_groups.grand_total`.
- Webhook được dedupe qua `payment_events` và tìm checkout group bằng PayOS order code/link ID.
- `payment_events` bổ sung `checkout_group_id`; event của luồng mới không gắn tùy tiện vào một order con đại diện.
- Trong một DB transaction, kiểm tra đúng amount, khóa group, chuyển group `paid`, đánh dấu tất cả order con đã trả và ghi `paid_at`.
- Chỉ sau commit mới gửi notification/outbox cho từng chi nhánh và để order xuất hiện trên KDS tương ứng.
- Polling/active reconciliation và regenerate QR hoạt động ở group level. Khách có thể bắt đầu từ bất kỳ mã đơn con nào; backend resolve về group nhưng UI không cần hiện mã nhóm.
- QR còn hạn được tái sử dụng. QR hết hạn tạo lại cho toàn nhóm, không tạo riêng từng đơn.
- Hủy hoặc hết hạn nhóm `unpaid` áp dụng cho toàn bộ order con; trạng thái payment/order con cũng phải được cập nhật nhất quán để query legacy không hiểu nhầm là đơn đang hoạt động.

## 7. API dự kiến

### Cart

- `GET /api/cart`
- `POST /api/cart/items`
- `PATCH /api/cart/items/:id` với expected `version`
- `DELETE /api/cart/items/:id`
- `POST /api/cart/items/bulk-delete`
- `POST /api/cart/re-add-from-order`

Mutation trả `409 CART_ITEM_VERSION_CONFLICT` khi phiên bản cũ. Response cart trả thêm trạng thái hiện hành như `available`, `price_changed`, `option_unavailable` để UI yêu cầu khách sửa trước checkout.

### Checkout/payment

- `POST /api/checkouts/preview` — server tính lại subtotal, fee, voucher và allocation để UI hiển thị.
- `POST /api/checkouts` — tạo saga checkout bằng idempotency key.
- `GET /api/checkouts/by-order/:orderCode/payment` — lấy trạng thái/link thanh toán với kiểm tra quyền sở hữu.
- `POST /api/checkouts/by-order/:orderCode/regenerate-qr`.
- `POST /api/checkouts/by-order/:orderCode/cancel-unpaid`.

Không nhận `unit_price`, `line_total`, `discount_amount`, `delivery_fee` hoặc `grand_total` từ client làm dữ liệu tin cậy.

### Hủy/refund

- `POST /api/orders/:orderCode/items/:itemId/cancellation-request`.
- `POST /admin/orders/:orderId/items/:itemId/cancellation/:requestId/approve`.
- `POST /admin/orders/:orderId/items/:itemId/cancellation/:requestId/reject`.
- `POST /admin/refunds/:refundId/complete`.

Mọi endpoint kiểm tra ownership/RBAC và branch scope ở server.

## 8. UI/UX

### Giỏ hàng

- Nhóm theo chi nhánh, có checkbox toàn cart, theo chi nhánh và từng dòng.
- Hiển thị thời gian thêm, trạng thái món, số lượng, cấu hình và giá hiện hành.
- Sửa cấu hình gọi cart API; modal phải tải option hợp lệ của sản phẩm tại chính chi nhánh của dòng cart, không dựa vào mảng sản phẩm tĩnh frontend.
- Nếu sửa thành cấu hình trùng, backend gộp dòng an toàn trong transaction.
- POS giữ model và edit flow riêng. Chỉ chia sẻ helper giá/option hoặc primitive UI khi thực sự tương thích; không ép `CartItem` khách hàng vào `PosCartItem`.

### Checkout và theo dõi

- Tổng checkout hiển thị từng khối chi nhánh: tiền hàng, giảm tiền hàng, phí giao, giảm phí và tổng đơn con.
- Hiển thị tổng thanh toán chung và hai ô voucher tách biệt.
- Khi tạo thành công, chuyển đến PayOS. Khu vực đơn hàng hiển thị tất cả mã đơn con và trạng thái `Chờ thanh toán`.
- Sau thanh toán, mỗi đơn được theo dõi độc lập.
- Nếu phương thức nhận hàng không cho phép nhiều chi nhánh, UI thông báo nguyên nhân và hướng dẫn bỏ chọn các chi nhánh khác.

### Hủy món

- Nút hủy nằm trên từng dòng cấu hình và ghi rõ toàn bộ `qty` sẽ bị hủy.
- Bắt buộc chọn/nhập lý do.
- Hiển thị `Chờ chi nhánh duyệt`, `Đã chấp nhận`, `Bị từ chối` và trạng thái refund tương ứng.
- Khi đang chờ duyệt, KDS giữ dòng trong luồng xử lý nhưng gắn cảnh báo ưu tiên; chỉ quyết định `approved` mới đổi dòng sang `cancelled`.
- Gửi notification cho khách khi yêu cầu được duyệt/từ chối, refund hoàn tất hoặc đơn chi nhánh chuyển trạng thái.

## 9. Báo cáo, điểm thưởng và thông báo

- Doanh thu chi nhánh lấy tổng thực trả của order con, không nhân bản `checkout_groups.grand_total` cho từng order.
- Dòng bị hủy và refund phải được trừ đúng chi nhánh/dòng trong báo cáo.
- Điểm chỉ được ghi sau khi thanh toán thành công, dựa trên tiền hàng thực trả, không tính phí giao hàng. Khi refund hoàn tất, tạo point transaction điều chỉnh; không sửa/xóa lịch sử cũ.
- Khi group thành `unpaid`, khách có thể nhận thông báo **Chờ thanh toán** và thấy các mã đơn con trong lịch sử. Notification cho admin/KDS chỉ phát sau khi group `paid`; không gửi khi group còn `creating` hoặc `unpaid`.

## 10. Kiểm thử bắt buộc

- Cart đồng bộ hai thiết bị, version conflict và gộp cấu hình đúng khóa.
- Không gộp món giống nhau khác chi nhánh hoặc khác ghi chú.
- Preview và create dùng cùng price engine; thay giá/ngừng món giữa hai bước phải bị phát hiện.
- Multi-branch delivery tạo đúng một group, đúng một PayOS link và một order mỗi chi nhánh.
- Take-away nhiều chi nhánh và QR bàn sai chi nhánh bị từ chối ở backend.
- Retry/double click không tạo trùng group/order/link hoặc consume voucher hai lần.
- Hai checkout cạnh tranh voucher single/limited usage chỉ một request hợp lệ khi hết lượt.
- Webhook trùng, webhook sai amount, reconcile và regenerate QR toàn nhóm.
- Cart chỉ xóa các dòng đã chọn sau khi checkout thành `unpaid`; lỗi PayOS giữ nguyên cart.
- Voucher global/branch, min order, max discount, rounding và kết hợp merchandise + freeship.
- Hủy nguyên dòng qty, tự duyệt/chờ duyệt/từ chối theo trạng thái order.
- Hủy một dòng không hoàn ship; hủy toàn bộ order trước giao hoàn đúng phí thực trả.
- Refund pending/completed, audit, report và point adjustment.
- Ownership, admin RBAC và branch scope cho toàn bộ API mới.

## 11. Phạm vi không làm trong đợt này

- Không tự động gọi PayOS refund; chỉ quản lý ledger hoàn tiền thủ công.
- Không tính phí theo khoảng cách hoặc tích hợp đơn vị vận chuyển.
- Không cho hủy một phần `qty` trong cùng một dòng cấu hình.
- Không cho checkout đa chi nhánh với Take-away hoặc QR tại bàn.
- Không hợp nhất model cart khách hàng với POS cart.
- Không làm guest cart đồng bộ DB nếu khách chưa đăng nhập.
- Không mở checkout nhiều chi nhánh cho COD/POS trong phase này.

## 12. Chia giai đoạn triển khai

1. **DB cart:** migration, repository/service/API, đồng bộ frontend, edit/group/select và conflict handling. Checkout vẫn có thể tạm khóa một chi nhánh ở cuối phase này.
2. **Checkout group:** payment saga, đơn chi nhánh, price allocation, phí giao hàng, hai loại voucher, PayOS group webhook/reconcile/regenerate và UI theo dõi.
3. **Hủy/refund:** hủy dòng, duyệt theo trạng thái, refund ledger thủ công, notification, báo cáo và điều chỉnh điểm.

Mỗi phase phải có migration rollback, characterization test cho behavior cũ và test tích hợp PostgreSQL. Không triển khai plan frontend-only cũ vì plan đó không bảo đảm dữ liệu, thanh toán hoặc đối soát.
