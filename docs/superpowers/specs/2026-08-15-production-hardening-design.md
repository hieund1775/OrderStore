# Thiết kế nâng cấp độ an toàn, hiệu năng và khả năng bảo trì TeaPlus

**Ngày chốt thiết kế:** 15/08/2026  
**Phạm vi:** Backend Express, SQL Server, frontend TanStack Start và chế độ Standalone  
**Mục tiêu:** Chuyển codebase hiện tại từ trạng thái demo chạy tốt sang nền tảng có thể vận hành ổn định hơn mà không làm gián đoạn luồng đặt món, PayOS, POS và KDS.

## 1. Bối cảnh và quyết định kiến trúc

Code hiện tại build production thành công và các luồng chính đã tồn tại, nhưng một số ranh giới bảo mật, trạng thái thanh toán và fallback demo chưa đủ an toàn cho vận hành thật. Việc sửa toàn bộ trong một lần tạo phạm vi thay đổi quá lớn và khó xác định nguyên nhân khi phát sinh regression.

Thiết kế thống nhất chia công việc thành ba đợt độc lập:

1. An toàn vận hành và tính đúng dữ liệu.
2. Hiệu năng database và API.
3. Làm sạch kiến trúc và chất lượng code.

Mỗi đợt phải được AGY triển khai, tự kiểm tra, Codex review và sửa lỗi còn lại, sau đó mới được chuyển sang đợt tiếp theo. Không trộn refactor thẩm mỹ vào đợt bảo mật.

## 2. Nguyên tắc xuyên suốt

- Backend là nguồn sự thật cho quyền truy cập, chi nhánh, giá, trạng thái thanh toán và trạng thái đơn.
- Frontend ẩn nút theo role chỉ là UX; backend vẫn phải chặn độc lập.
- Live backend và Standalone là hai chế độ tách biệt. Production không được tự chuyển sang dữ liệu mock khi mất mạng.
- Mọi cập nhật trạng thái cạnh tranh phải atomic tại SQL Server.
- Giữ nguyên API response hiện tại khi không có lý do bảo mật hoặc tính đúng dữ liệu buộc phải thay đổi.
- Migration phải idempotent và có thể chạy lại an toàn.
- Không rewrite Git history, không sửa các file chưa được theo dõi của người dùng nếu không thuộc phạm vi.

## 3. Đợt 1 — An toàn vận hành và tính đúng dữ liệu

### 3.1. Phân quyền và giới hạn chi nhánh

Tạo policy quyền tập trung cho các nhóm nghiệp vụ:

| Nhóm API | super | manager | cashier | kitchen |
|---|---:|---:|---:|---:|
| Cấu hình hệ thống, tài khoản, audit | Có | Không | Không | Không |
| Cửa hàng, bàn, thực đơn, voucher | Có | Có trong phạm vi được phép | Không | Không |
| Danh sách đơn | Có | Chi nhánh của mình | Chi nhánh của mình | Chi nhánh của mình |
| Xác nhận thanh toán thủ công | Có | Chi nhánh của mình | Chi nhánh của mình | Không |
| KDS và cập nhật trạng thái bếp | Có | Chi nhánh của mình | Chỉ đọc nếu cần | Chi nhánh của mình |
| Báo cáo | Có | Chi nhánh của mình | Không | Không |

`admin_branch_id` trong JWT không được dùng như dữ liệu đáng tin vĩnh viễn cho tác vụ nhạy cảm. Backend có thể dùng để lọc nhanh, nhưng khi thay đổi tài khoản cần phát hành token mới; các endpoint quan trọng phải luôn áp branch scope ở query.

Quy tắc scope:

- `super`: được chọn mọi `store_id`.
- Role khác: chỉ được truy cập `store_id === req.user.branch_id`.
- Nếu request không gửi `store_id`, backend tự ép chi nhánh từ token.
- Nếu gửi chi nhánh khác, trả `403`, không âm thầm đổi sang chi nhánh khác.

### 3.2. Bảo vệ dữ liệu khách và quyền hủy đơn

Public tracking trả một DTO tối thiểu, không dùng `SELECT o.*`. DTO chỉ gồm thông tin cần cho màn theo dõi: mã đơn, loại đơn, tên cửa hàng/bàn, món, tổng tiền, payment status, current status và status history. SĐT đầy đủ, địa chỉ đầy đủ, user id, transaction id và các trường nội bộ không được trả nếu không có quyền.

Quyền hủy:

- Khách đăng nhập: token customer phải khớp `orders.user_id`.
- Khách vãng lai: khi tạo đơn backend sinh cancellation token ngẫu nhiên, chỉ trả một lần cho client và lưu dạng hash trong DB.
- Admin hủy qua endpoint admin và audit bằng `req.user.sub`; không nhận `changed_by` từ body.
- Đơn `paid` chỉ được hủy theo policy admin; endpoint khách không được tự hủy đơn đã thanh toán hoặc đã qua giai đoạn cho phép.
- Update hủy phải atomic, kiểm tra current status trong cùng transaction.

Các endpoint user, wishlist và review phải dùng identity từ JWT thay cho `:id` hoặc `user_id` do client tự khai khi thực hiện thao tác riêng tư.

### 3.3. Phân luồng thanh toán đúng nguồn đơn

Backend chuẩn hóa `source` bằng allowlist `online | pos` và xác định provider như sau:

| source | payment_method | payment_provider |
|---|---|---|
| online | VietQR | payos nếu đã cấu hình; nếu chưa cấu hình thì từ chối rõ ràng |
| pos | VietQR | manual_vietqr |
| pos | COD | cod |
| online | COD | cod nếu chính sách vẫn cho phép |

POS không bao giờ tạo PayOS link. Online VietQR không được âm thầm hạ xuống VietQR thủ công vì không có thu ngân xác nhận trực tiếp.

Khi có `table_id`, backend bắt buộc xác minh bàn đang hoạt động và thuộc đúng `store_id`. Nếu không khớp, trả `400`.

### 3.4. Tách Standalone khỏi production

Mock chỉ hoạt động khi build có `VITE_STANDALONE=true`. Khi live backend mất kết nối:

- Không gọi `handleLocalMock`.
- Trả lỗi kết nối có mã nhận diện để UI hiển thị “Mất kết nối máy chủ”.
- POS giữ giỏ hàng để nhân viên retry.
- Checkout không xóa giỏ và không hiển thị đặt hàng thành công.

Không triển khai offline queue trong đợt này vì cần cơ chế đồng bộ và chống trùng phức tạp. Đây là phạm vi riêng nếu sau này có nhu cầu.

### 3.5. PayOS, webhook và auto-expire

Webhook thực hiện theo thứ tự:

1. Verify chữ ký.
2. Chỉ nhận giao dịch thành công.
3. Tìm đúng đơn PayOS.
4. Đối chiếu số tiền.
5. Atomic update từ `unpaid` sang `paid`.

Update phải có điều kiện `payment_status = 'unpaid' AND payment_provider = 'payos'`. Nếu không có row bị ảnh hưởng, đọc lại trạng thái để phân biệt idempotent `paid`, `expired` hoặc không hợp lệ.

Auto-expire dùng một câu update theo điều kiện, không select rồi loop từng đơn. Webhook phải được mount trước rate limiter tổng quát hoặc được exclude chính xác. Lỗi chữ ký/nghiệp vụ trả `200` để tránh retry vô ích; lỗi database/hạ tầng trả `5xx` để PayOS có cơ hội retry.

Không log toàn bộ webhook body. Log có cấu trúc gồm order code, reference, kết quả và correlation id; che dữ liệu không cần thiết.

### 3.6. Cấu hình production

Khi `NODE_ENV=production`, backend phải fail fast nếu thiếu:

- `JWT_SECRET`
- Các biến DB bắt buộc
- PayOS keys khi bật thanh toán PayOS
- `FRONTEND_URL`

Development vẫn được phép dùng cấu hình local, nhưng phải in cảnh báo rõ và không dùng secret development trong production.

### 3.7. Tiêu chí nghiệm thu đợt 1

- Kitchen không gọi được API menu/store/account/payment confirm.
- Cashier không sửa menu và không xem dữ liệu ngoài chi nhánh.
- Manager không đọc/sửa đơn chi nhánh khác bằng cách đổi query hoặc ID.
- Người không phải chủ đơn không hủy được đơn.
- Public lookup không lộ PII hoặc trường thanh toán nội bộ.
- POS VietQR luôn là `manual_vietqr`; online VietQR luôn là `payos` khi PayOS bật.
- Mất backend trong live mode không tạo dữ liệu local và không báo thành công giả.
- Webhook trùng, webhook chạy đồng thời với expire và webhook sai amount đều cho kết quả xác định.
- Server production không khởi động nếu thiếu secret bắt buộc.

## 4. Đợt 2 — Hiệu năng database và API

### 4.1. Index và query theo thời gian

Tạo migration index sau khi đo query thực tế. Bộ index khởi đầu cần phục vụ:

- Orders theo `store_id`, `payment_status`, `created_at`.
- Orders theo `payment_provider`, `payment_status`, `payment_expires_at`.
- Status history theo `order_id`, `created_at DESC`, `id DESC` và include `status`.
- Order items theo `order_id`.
- Item toppings theo `order_item_id`.
- Voucher history theo `promotion_id`, `user_phone`.
- Orders theo `user_id`, `created_at DESC`.

Không tạo index trùng với unique index hiện có. Trước và sau migration phải ghi lại execution plan hoặc tối thiểu thời gian query trên dữ liệu mẫu đủ lớn.

Thay mọi `CAST(created_at AS DATE)` trong điều kiện lọc bằng khoảng `[start, nextDay)` để SQL Server dùng index.

### 4.2. Loại N+1 query

- Price engine trả luôn tên sản phẩm và dữ liệu cần insert để route không query sản phẩm lần hai.
- Lịch sử đơn khách fetch items của toàn bộ danh sách order trong một query rồi group theo `order_id`.
- Các trang danh sách không fetch chi tiết từng dòng cho đến khi mở dialog.
- Endpoint danh sách orders phải có pagination ổn định bằng `created_at + id`, hoặc page/limit nếu quy mô hiện tại chưa cần cursor.

### 4.3. KDS polling

Không dùng interval tạo request chồng nhau. Chu kỳ tiếp theo chỉ bắt đầu sau khi request hiện tại kết thúc. Khi tab bị ẩn có thể giảm tần suất; khi tab active hoặc nhận storage event thì refetch ngay.

Giữ nguyên cơ chế dedup auto-print. Không đánh dấu printed trước khi adapter xác nhận đã khởi tạo lệnh in thành công; nếu không xác nhận được thì phải giữ nút retry thủ công.

### 4.4. Tiêu chí nghiệm thu đợt 2

- Query dashboard/KDS sử dụng index phù hợp và không scan toàn bảng orders ở điều kiện phổ biến.
- Lịch sử 50 đơn không phát sinh 50 query items riêng.
- Hai lần polling KDS không chạy đồng thời.
- Pagination không bỏ sót hoặc lặp đơn khi có đơn mới.
- Kết quả KPI trước và sau tối ưu giống nhau trên cùng dataset.

## 5. Đợt 3 — Kiến trúc và chất lượng code

### 5.1. Ranh giới backend

Chia route theo domain nhưng giữ nguyên URL công khai:

```text
backend/routes/admin/
  orders.js
  kitchen.js
  menu.js
  stores.js
  promotions.js
  settings.js
  reports.js

backend/routes/public/
  catalog.js
  orders.js
  customers.js
  engagement.js
```

Logic nghiệp vụ chuyển vào service; route chỉ parse input, gọi service và map response. Tạo middleware/helper chung cho async error, validation, RBAC và branch scope.

### 5.2. Ranh giới frontend

Tách theo feature, ưu tiên các trang trên 500 dòng. Mỗi feature gồm type, API adapter, hooks và component nghiệp vụ. Không di chuyển hàng loạt chỉ để đổi đường dẫn; mỗi lần tách phải giữ hành vi và có build/test xác nhận.

Các state machine có nhiều bước như checkout và POS cần gom trạng thái liên quan bằng reducer hoặc hook riêng, tránh nhiều effect độc lập cùng sửa một luồng.

### 5.3. DTO và validation

Định nghĩa schema input/output cho các API quan trọng: create order, payment confirm, status update, webhook mapping và public tracking. Backend validate allowlist, độ dài chuỗi và kiểu số trước khi truy cập DB. Không trả trực tiếp `err.message` từ SQL ra client ở production.

### 5.4. Lint, format và build

- Chốt line ending bằng `.gitattributes`.
- Cấu hình Prettier phù hợp style repo hoặc format repo trong một commit cơ học riêng.
- Không trộn commit format toàn repo với thay đổi logic.
- Sau khi baseline sạch, bắt buộc lint và build trong CI.
- Bỏ `vite-tsconfig-paths` nếu cấu hình Vite hiện tại hỗ trợ `resolve.tsconfigPaths` và build xác nhận không regression.

### 5.5. Test tự động tối thiểu

Backend cần integration test cho:

- RBAC và branch scope.
- Tạo đơn POS/online và mapping payment provider.
- Quyền lookup/hủy đơn.
- PayOS signature adapter, amount check, idempotency và race condition.
- KPI chỉ tính đơn paid hợp lệ.

Frontend cần test cho:

- Live mode mất backend không fallback mock.
- Standalone mode vẫn chạy golden path.
- Checkout giữ giỏ khi request thất bại.
- POS gửi đúng `source=pos`.

### 5.6. Tiêu chí nghiệm thu đợt 3

- Không còn file route nghiệp vụ quá lớn chỉ vì chứa nhiều domain không liên quan.
- Lint, frontend build và backend syntax/test đều sạch.
- Không thay đổi URL API hoặc route frontend ngoài danh sách được duyệt.
- Golden path online, POS, KDS và Standalone đều vượt smoke test.

## 6. Quy trình bàn giao AGY → Codex

Mỗi đợt AGY phải bàn giao:

1. Danh sách file đã sửa và lý do.
2. Migration đã tạo, cách chạy và cách xác minh.
3. Kết quả command build/lint/test.
4. Checklist thủ công đã chạy.
5. Các giả định hoặc phần chưa hoàn thành.

Codex sẽ review theo thứ tự:

1. Bảo mật và khả năng vượt quyền.
2. Tính atomic và tính đúng dữ liệu.
3. Regression API/UI.
4. Hiệu năng query.
5. Maintainability.

Nếu có lỗi blocker, Codex sửa hoặc trả lại đúng phạm vi đợt hiện tại. Không cho phép “để đợt sau” đối với lỗi bảo mật, thanh toán hoặc mất đơn.

## 7. Ngoài phạm vi

- WebSocket thay polling.
- Offline queue đồng bộ đơn giữa nhiều thiết bị.
- Thay SQL Server hoặc ORM.
- Thay framework frontend/backend.
- Tích hợp ví MoMo/ZaloPay thật.
- Viết lại toàn bộ UI admin.

Các hạng mục này chỉ được mở thành spec riêng sau khi ba đợt hiện tại hoàn tất.
