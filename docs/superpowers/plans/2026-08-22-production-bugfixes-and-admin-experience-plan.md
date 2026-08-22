# Implementation Plan: Production Bugfixes, Unified Login & Operational Refinements

**Mục tiêu**: Xử lý triệt để 5 vấn đề phát sinh sau kiểm thử thực tế trên Production, bao gồm trải nghiệm đăng nhập Admin hợp nhất từ giao diện người dùng, sửa lỗi khóa ngoại xóa chi nhánh, sửa tương tác bản đồ cửa hàng, tinh gọn trung tâm thông báo và khắc phục lỗi 500 API menu options.

**Kiến trúc liên quan**:
- Backend: Express, PostgreSQL Repositories, JWT Auth, Service Layer
- Frontend: TanStack Router, React, Tailwind CSS, Google Maps Embed
- Tài liệu thiết kế: `docs/superpowers/specs/2026-08-22-production-bugfixes-and-admin-experience-design.md`

---

## User Review Required Before Implementation

> [!IMPORTANT]
> - **Unified Login**: Cho phép đăng nhập cả tài khoản Khách hàng và Admin/Nhân viên trực tiếp từ popup đăng nhập trên Header. Nếu là tài khoản Admin, hệ thống tự động cấp quyền và hiển thị lối tắt truy cập nhanh vào `/admin`.
> - **Xóa Chi Nhánh**: Khi xóa chi nhánh (chưa có đơn hàng phát sinh), hệ thống sẽ dọn dẹp an toàn các liên kết trong `promotion_stores`, `tables`, `ingredients`, `job_stores` trong cùng transaction mà không gây lỗi khóa ngoại.
> - **Menu Options Endpoint**: Khớp nối chuẩn tên hàm `listOptions` giữa `admin-menu-service` và `admin-catalog` repository để dứt điểm lỗi 500.

---

## Proposed Changes

### Task 1: Khắc phục lỗi 500 tại `GET /admin/menu/options`
- **Files**:
  - `backend/repositories/postgres/admin-catalog.js`
  - `backend/test/phase3-catalog-admin-endpoints.test.js` (hoặc tạo file test mới)
- **Hành động**:
  1. Thêm `listOptions` trong `adminCatalogRepository` trả về `{ sizes, bases, sugars, ices, toppings }`.
  2. Giữ `listAllOptions` làm alias.
  3. Viết unit test xác thực `GET /admin/menu/options` trả về status `200` và đầy đủ các trường tùy chọn món.

---

### Task 2: Khắc phục lỗi Khóa Ngoại khi Xóa Chi Nhánh (`promotion_stores_store_id_fkey`)
- **Files**:
  - `backend/repositories/postgres/admin-stores.js`
  - `backend/test/admin-stores-cascade-delete.test.js`
- **Hành động**:
  1. Trong `deleteBranch(id)` của `adminStoresRepository`, bổ sung các lệnh dọn dẹp liên kết con trong transaction:
     - `DELETE FROM promotion_stores WHERE store_id = $1`
     - `DELETE FROM job_stores WHERE store_id = $1`
     - `UPDATE job_applications SET store_id = NULL WHERE store_id = $1`
     - `UPDATE users SET admin_branch_id = NULL WHERE admin_branch_id = $1`
     - `DELETE FROM ingredients WHERE store_id = $1`
     - `DELETE FROM tables WHERE store_id = $1`
     - `DELETE FROM stores WHERE id = $1`
  2. Viết test xác nhận xóa chi nhánh có ràng buộc `promotion_stores` và `tables` diễn ra trơn tru.

---

### Task 3: Hợp nhất Đăng nhập Khách hàng & Quản trị viên (Unified Auth Experience)
- **Files**:
  - `backend/repositories/postgres/users.js`
  - `backend/routes/customerAuth.js`
  - `frontend/src/components/site/Header.tsx`
  - `frontend/src/lib/api.ts`
  - `backend/test/unified-auth.test.js`
- **Hành động**:
  1. Trong `usersRepository`, tạo hàm `findActiveUserByPhone(phone)` tìm người dùng hoạt động theo số điện thoại (bất kể `is_admin`).
  2. Trong `backend/routes/customerAuth.js` route `POST /api/auth/login`:
     - Nếu `user.is_admin === true` và mật khẩu khớp, ký token với claims quản trị (`role: user.admin_role || 'super'`) và trả về `user` có `is_admin: true`.
  3. Trong `frontend/src/components/site/Header.tsx`:
     - Khi đăng nhập thành công với `is_admin: true`, lưu cả `setToken(data.token)` và `setUser(data.user)`.
     - Thêm nút / menu item nổi bật trong dropdown: **`👑 Trang Quản Trị (Admin)`** liên kết trực tiếp tới `/admin`.
     - Hiển thị Toast thông báo đăng nhập Admin thành công.

---

### Task 4: Sửa Lỗi Tương Tác Bản Đồ Cửa Hàng trên `/cua-hang`
- **Files**:
  - `frontend/src/routes/cua-hang.tsx`
- **Hành động**:
  1. Tối ưu `handleSelectStore(s)` để luôn cập nhật `mapCoords` và `selectedId` ngay khi người dùng click vào thẻ chi nhánh.
  2. Cập nhật `mapIframeUrl` để luôn ưu tiên hiển thị địa chỉ/tọa độ của `selected` store đang kích hoạt.
  3. Gán `key={selected?.id ?? mapCoords.title}` vào thẻ `<iframe>` để bản đồ Google Maps kích hoạt re-render chính xác khi người dùng chọn giữa các chi nhánh khác nhau.

---

### Task 5: Tinh Gọn Trung Tâm Thông Báo (`/admin/thong-bao`)
- **Files**:
  - `frontend/src/routes/admin.thong-bao.tsx`
- **Hành động**:
  1. Rút gọn mảng `filters` chỉ giữ lại 2 tab:
     - `{ id: "all", label: "Tất cả" }`
     - `{ id: "order", label: "Đơn hàng mới" }`
  2. Xóa bỏ các tab lọc: Cảnh báo kho, Voucher, Nhân sự, Thanh toán, Hệ thống.
  3. Cập nhật giao diện tinh gọn, phản ánh đúng thông báo vận hành đơn hàng thực tế.

---

### Task 6: Kiểm Thử Toàn Diện & Đồng Bộ Lên GitHub
- **Hành động**:
  1. Chạy toàn bộ backend test suites (`npm test`).
  2. Chạy kiểm thử frontend (`npm run test` & `npx tsc --noEmit` & `npm run build`).
  3. Commit các thay đổi rõ ràng theo từng commit logic.
  4. Đồng bộ lên các nhánh `Hieu`, `develop`, và `main`.

---

## Verification Plan

### Automated Tests
1. **Backend**:
   - `npm test` trong thư mục `backend` (yêu cầu tất cả các test suites PASS 100%).
2. **Frontend**:
   - `npm run test` trong `frontend` (Vitest unit tests PASS).
   - `npx tsc --noEmit` trong `frontend` (0 lỗi TypeScript).
   - `npm run build` trong `frontend` (Build Nitro SSR thành công).

### Manual Verification Scenarios
1. **Unified Login**: Đăng nhập bằng `0909000001` / `admin123` trên popup Header ➔ Kiểm tra hiển thị nút truy cập Admin và vào được `/admin`.
2. **Xóa Cửa Hàng**: Thử xóa một cửa hàng có liên kết khuyến mãi trong `admin.chi-nhanh.tsx` ➔ Không bị lỗi 500 / foreign key constraint.
3. **Bản Đồ Cửa Hàng**: Vào `/cua-hang`, click các chi nhánh Nguyễn Huệ, Võ Văn Tần, Phú Mỹ Hưng, Hải Châu ➔ Bản đồ đổi ngay lập tức đến địa chỉ tương ứng.
4. **Thông Báo Admin**: Vào `/admin/thong-bao` ➔ Chỉ hiển thị tab "Tất cả" và "Đơn hàng mới".
5. **Menu Options**: Truy cập trang cấu hình thực đơn admin hoặc gọi `GET /admin/menu/options` ➔ Trả về mã 200 OK với danh sách size, cốt trà, đường, đá, topping.
