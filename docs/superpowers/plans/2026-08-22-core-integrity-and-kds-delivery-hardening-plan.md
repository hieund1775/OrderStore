# Kế Hoạch Triển Khai: Chuẩn Hóa Toàn Vẹn Dữ Liệu, Xác Thực Khách Hàng, Ràng Buộc Form & Luồng KDS Delivery

> **Ngày tạo:** 22/08/2026  
> **Tài liệu đặc tả (Spec):** [`docs/superpowers/specs/2026-08-22-core-integrity-and-kds-delivery-hardening-design.md`](file:///D:/Code/Extra/Planning_DuAn/Order/docs/superpowers/specs/2026-08-22-core-integrity-and-kds-delivery-hardening-design.md)  
> **Người thực hiện:** AGY Pair Programming Agent  
> **Kiểm toán viên / Người nghiệm thu:** Codex  
> **Mục tiêu:** Xử lý triệt để 5 vấn đề dữ liệu, auth gate, validation SĐT/tên và logic đơn delivery trên KDS bếp.

---

## 0. Quy Tắc Bắt Buộc & Tiêu Chuẩn Thực Hiện (Ground Rules)

1. **Tuân thủ quy trình từng Task**: Thực hiện tuần tự Task 1 → Task 5. Mỗi task phải có test case kiểm thử cụ thể và commit git độc lập.
2. **Không gây lỗi hồi quy (Zero Regression)**: Không làm phá vỡ các hợp đồng API đã có, không vi phạm Clean Architecture 3 tầng (Route → Service → Repository → DTO).
3. **Chỉ dùng Real Database**: Không tạo thêm dữ liệu mock ảo cho các thao tác nghiệp vụ/CRUD.
4. **An toàn kiểm thử**: Toàn bộ backend test suite (`npm test`) và frontend type-check (`npx tsc --noEmit`) phải xanh 100%.

---

## Task 1: Siết Chặt Validation Backend — SĐT Việt Nam & Quốc Tế (E.164) và Họ Tên Tiếng Việt

**Mục tiêu**: Chuẩn hóa validator cho Số điện thoại (VN 10 số & Quốc tế E.164 `+...`) và Họ tên tiếng Việt (viết hoa chữ cái đầu, Unicode có dấu, chặn số/ký tự đặc biệt) trên toàn bộ endpoints của Backend.

### Tệp cần chỉnh sửa / tạo mới:
* Modify: [`backend/validation/customer-schemas.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/validation/customer-schemas.js) (Thêm `validatePhoneNumber`, `validateVietnameseFullName`, `validateCustomerRegisterInput`).
* Modify: [`backend/validation/order-schemas.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/validation/order-schemas.js) (Áp dụng validator SĐT và Họ tên cho người nhận trong `validateCreateOrderInput`).
* Modify: [`backend/routes/customerAuth.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/routes/customerAuth.js) (Áp dụng schema vào route `/register`, `/send-otp`, `/verify-otp`, `/login`).
* Create: `backend/test/customer-validation-hardening.test.js` (Bộ test kiểm thử exhaustive cho SĐT và Họ tên).

### Yêu cầu Kiểm thử:
1. **SĐT Việt Nam**: Chấp nhận các số `03x`, `05x`, `07x`, `08x`, `09x` (10 chữ số) và `+84...`; từ chối các số có 9 chữ số, 11 chữ số nội địa hoặc đầu số cố định `02x`.
2. **SĐT Quốc tế (E.164)**: Chấp nhận `+1...`, `+82...`, `+86...`, `+81...` (8 - 15 số); từ chối số quốc tế thiếu dấu `+` hoặc chứa chữ cái/ký tự đặc biệt.
3. **Họ và Tên tiếng Việt**: Chấp nhận *"Nguyễn Văn An"*, *"Trần Thị Mỹ Duyên"*; từ chối *"nguyen van a"* (không viết hoa), *"Nguyễn 123"* (chứa số), *"Mai"* (chỉ 1 từ), *"Lê @ Hoàng"* (ký tự lạ).

### Lệnh kiểm tra (Verify):
```powershell
node --test backend/test/customer-validation-hardening.test.js
```
**Git Commit Message**: `feat(validation): enforce strict VN and E.164 phone and Vietnamese name validation`

---

## Task 2: Thiết Lập Auth Gate Backend — Bắt Buộc Xác Thực Khi Tạo Đơn Hàng

**Mục tiêu**: Đơn hàng đặt qua kênh công khai (Website/Mobile) bắt buộc phải gắn liền với tài khoản khách hàng hợp lệ (`req.user.id`), từ chối đơn hàng anonymous.

### Tệp cần chỉnh sửa:
* Modify: [`backend/routes/public/orders.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/routes/public/orders.js) (Bổ sung kiểm tra xác thực hoặc middleware `authenticateOptionalCustomer` chuyển thành bắt buộc đối với đơn web).
* Modify: [`backend/services/orders/customer-order-service.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/services/orders/customer-order-service.js) (Ràng buộc `customerId` phải tồn tại và hợp lệ khi tạo đơn).
* Create: `backend/test/orders-auth-gate.test.js` (Test case kiểm tra chặn đơn hàng không có token, cho phép đơn hàng có Customer JWT).

### Lệnh kiểm tra (Verify):
```powershell
node --test backend/test/orders-auth-gate.test.js
```
**Git Commit Message**: `feat(orders): enforce customer authentication gate on public order creation`

---

## Task 3: Dọn Dẹp Trạng Thái Dữ Liệu Ban Đầu & Thiết Lập Auth Gate Frontend

**Mục tiêu**: Xóa sạch dữ liệu mock khởi tạo, chặn khách vãng lai thêm vào giỏ / thanh toán, tích hợp regex validation vào toàn bộ các form khách hàng.

### Tệp cần chỉnh sửa:
* Modify: [`frontend/src/lib/cart.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/lib/cart.tsx):
  * Khởi tạo `wishlist` là mảng rỗng `[]` (xóa bỏ `'tra-dau-tay'`).
  * Trong `addItem`: Kiểm tra `getCustomerToken()`. Nếu chưa đăng nhập, hủy thao tác và phát thông báo `toast.error("Vui lòng đăng nhập để thêm món vào giỏ")`.
* Modify: [`frontend/src/routes/menu.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/routes/menu.tsx):
  * Bổ sung kiểm tra `getCustomerToken()` khi người dùng bấm `"Thêm vào giỏ"` hoặc `"Đặt ngay"`.
  * Hiển thị Dialog yêu cầu Đăng ký / Đăng nhập nhanh nếu chưa có token.
* Modify: [`frontend/src/routes/thanh-toan.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/routes/thanh-toan.tsx):
  * Áp dụng regex SĐT (`VN 10 số / E.164`) và Họ tên chuẩn tiếng Việt cho form người nhận.
  * Hiển thị lỗi form trực quan thời gian thực.
* Modify: [`frontend/src/routes/ho-so.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/routes/ho-so.tsx):
  * Áp dụng regex kiểm tra Họ tên và SĐT khi chỉnh sửa thông tin cá nhân.
  * Đảm bảo wishlist và đơn hàng khởi tạo rỗng khi chưa đăng nhập.

### Lệnh kiểm tra (Verify):
```powershell
cd frontend
npm run test
npx tsc --noEmit
```
**Git Commit Message**: `feat(frontend): clean initial state and enforce auth gate on cart and checkout`

---

## Task 4: Tái Cấu Trúc Luồng Đơn Delivery Trên Màn Hình Bếp (KDS) & Điều Phối Shipper

**Mục tiêu**: Phân tách rõ ràng hành vi hoàn tất pha chế: Đơn `POS`/`Take-away` chuyển sang `Hoàn thành`; Đơn `Delivery` chuyển sang `Đang giao` (bàn giao shipper) kèm form gán tài xế, chỉ Admin/Shipper mới chuyển sang `Hoàn thành`.

### Tệp cần chỉnh sửa:
* Modify: [`frontend/src/routes/admin.bep.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/routes/admin.bep.tsx):
  * Nhận biết thuộc tính `order_type`:
    * Nếu `order_type === 'Delivery'`: Nút chuyển thành `"🚚 Pha xong ➔ Giao Shipper"`.
    * Khi bấm: Mở `Dialog` bàn giao nhanh (cho phép nhập `driver_name`, `driver_phone` hoặc chuyển thẳng sang `Đang giao` để Admin điều phối sau).
    * Gọi API `PATCH /admin/orders/:id/status` với `{ status: "Đang giao", driver_name, driver_phone }`.
    * Nếu `order_type !== 'Delivery'`: Nút hiển thị `"✅ Hoàn thành"`, gọi `status: "Hoàn thành"`.
* Modify: [`frontend/src/routes/admin.don-hang.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/routes/admin.don-hang.tsx):
  * Bổ sung nút hành động rõ ràng cho đơn đang ở trạng thái `Đang giao`: `"Xác nhận giao thành công ➔ Hoàn thành"`.
  * Hoàn thiện modal gán / đổi thông tin Shipper (`driver_name`, `driver_phone`, `tracking_url`).
* Modify: [`frontend/src/routes/theo-doi-don.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/routes/theo-doi-don.tsx):
  * Hiển thị thông tin tài xế giao hàng khi đơn ở bước `Đang giao`.

### Lệnh kiểm tra (Verify):
```powershell
cd frontend
npx tsc --noEmit
npm run build
```
**Git Commit Message**: `feat(kds): implement delivery shipper transition and complete button separation`

---

## Task 5: Kiểm Thử Toàn Diện, Tổng Hợp Nghiệm Thu & Bàn Giao Cho Codex

**Mục tiêu**: Chạy toàn bộ các bộ kiểm thử tự động, xác minh không có lỗi hồi quy và xuất bản báo cáo bàn giao chuẩn mực.

### Các bước thực hiện:
1. Chạy trọn bộ kiểm thử Backend: `npm.cmd test` trong `backend` (yêu cầu 100% test pass).
2. Chạy kiểm tra TypeScript và Build Frontend: `npx tsc --noEmit` và `npm run build` trong `frontend`.
3. Soạn tài liệu bàn giao tại `docs/reviews/2026-08-22-core-integrity-and-kds-delivery-agy-handoff.md`.
4. Commit toàn bộ và thông báo sẵn sàng cho Codex kiểm toán.

### Lệnh kiểm tra (Verify):
```powershell
cd backend; npm.cmd test
cd ../frontend; npx tsc --noEmit; npm.cmd run build
```
**Git Commit Message**: `docs: record core integrity, auth gate, validation, and KDS delivery handoff`
