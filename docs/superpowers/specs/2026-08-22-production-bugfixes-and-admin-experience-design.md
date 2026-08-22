# Design Specification: Production Bugfixes, Unified Login & Operational Refinements

**Tác giả**: Antigravity (AGY)  
**Ngày lập**: 22/08/2026  
**Trạng thái**: Draft / Sẵn sàng cho Codex review  
**Nhánh áp dụng**: `Hieu` / `develop` / `main`  

---

## 1. Bối Cảnh & Mục Tiêu

Trong quá trình nghiệm thu trên môi trường Production/Staging, hệ thống phát hiện 5 vấn đề cần được xử lý triệt để:

1. **Đăng nhập Quản trị viên (Unified Auth Experience)**: Admin/Nhân viên không cần phải gõ thủ công URL `.../admin/login` mà có thể đăng nhập trực tiếp từ popup đăng nhập của trang người dùng (`CustomerAuthDialog` / `Header.tsx`). Nếu tài khoản là Quản trị viên/Nhân viên, hệ thống tự động cấp quyền Admin và cung cấp lối tắt vào trang Quản trị (`/admin`).
2. **Lỗi Khóa Ngoại khi Xóa Chi Nhánh (Foreign Key Constraint Violation)**: Khi Super Admin xóa một chi nhánh trong `stores`, PostgreSQL báo lỗi ràng buộc khóa ngoại `promotion_stores_store_id_fkey` do chưa dọn dẹp các bảng phụ thuộc (`promotion_stores`, `job_stores`, `job_applications`, `ingredients`, `users.admin_branch_id`, `tables`).
3. **Bản Đồ Cửa Hàng Không Cập Nhật (Store Map Reactivity on `/cua-hang`)**: Khi người dùng click chọn các cửa hàng khác nhau trong danh sách, khung bản đồ Google Maps Iframe không chuyển tọa độ/địa chỉ theo cửa hàng được chọn mà bị kẹt ở tọa độ trung tâm thành phố.
4. **Tinh Gọn Trung Tâm Thông Báo (`/admin/thong-bao`)**: Bỏ các bộ lọc và loại thông báo không còn sử dụng: Cảnh báo kho (đã bỏ quản lý kho), Voucher, Nhân sự, Hệ thống, và Thanh toán (vì đơn hàng online đã chuyển khoản trước hoặc thanh toán tại bàn). Giữ lại luồng thông báo trọng tâm về Đơn hàng mới và vận hành.
5. **Lỗi 500 Internal Server Error tại `GET /admin/menu/options`**: Endpoint `GET /admin/menu/options` báo lỗi 500 do `adminMenuService.listOptions()` gọi `repository.listOptions()`, trong khi repository `adminCatalogRepository` đang đặt tên hàm là `listAllOptions()`.

---

## 2. Thiết Kế Chi Tiết Từng Hạng Mục

### 2.1 Hạng Mục 1: Đăng Nhập Quản Trị Viên Hợp Nhất (Unified Auth)

#### Hiện trạng & Vấn đề:
- Backend `POST /api/auth/login` gọi `findActiveCustomerByPhone(cleanPhone)` có điều kiện `AND is_admin = FALSE`.
- Khi Admin/Staff nhập SĐT quản trị (ví dụ `0909000001`) vào popup đăng nhập người dùng, backend trả về `401: Số điện thoại hoặc mật khẩu không đúng`.
- Admin bắt buộc phải nhớ và gõ đường dẫn `/admin/login`.

#### Giải pháp thiết kế:
1. **Backend (`backend/routes/customerAuth.js` & `backend/repositories/postgres/users.js`)**:
   - Bổ sung hàm `findActiveUserByPhone(phone)` trong `usersRepository`: tìm user theo số điện thoại không phân biệt `is_admin`.
   - Trong route `POST /api/auth/login`:
     - Tìm user theo số điện thoại.
     - So khớp `password_hash` bằng `bcrypt.compare`.
     - Nếu `user.is_admin === true`:
       - Ký JWT Token với đầy đủ payload quản trị (`sub: user.id`, `phone: user.phone`, `role: user.admin_role || 'super'`, `branch_id: user.admin_branch_id`, `is_admin: true`).
       - Trả về payload bao gồm `{ token, user: { ...customerPayload(user), is_admin: true, admin_role: user.admin_role } }`.
     - Nếu `user.is_admin === false`:
       - Ký Customer Token và trả về thông tin khách hàng như hiện tại.
2. **Frontend (`frontend/src/components/site/Header.tsx` & `frontend/src/lib/api.ts`)**:
   - Khi đăng nhập thành công từ popup Header:
     - Lưu `setCustomerToken(data.token)` và `setCustomerUser(data.user)`.
     - Nếu `data.user.is_admin === true`:
       - Đồng thời lưu `setToken(data.token)` và `setUser(data.user)`.
       - Hiển thị Toast: `"Xin chào Quản trị viên [Tên]!"`.
       - Trong dropdown Profile của Header, bổ sung mục nổi bật: **`👑 Truy cập Trang Quản trị (Admin)`** ➔ Chuyển hướng ngay đến `/admin`.

---

### 2.2 Hạng Mục 2: Khắc Phục Lỗi Khóa Ngoại khi Xóa Chi Nhánh (Cascade Store Deletion)

#### Hiện trạng & Vấn đề:
- `backend/repositories/postgres/admin-stores.js` hàm `deleteBranch(id)` chỉ xóa `tables` và `stores`:
  ```javascript
  await tx.query('DELETE FROM tables WHERE store_id = $1', [id]);
  await tx.query('DELETE FROM stores WHERE id = $1', [id]);
  ```
- Các bảng khác có khóa ngoại trỏ về `stores(id)` gồm:
  - `promotion_stores` (FK `promotion_stores_store_id_fkey`)
  - `job_stores` (FK `job_stores_store_id_fkey`)
  - `job_applications` (FK `job_applications_store_id_fkey`)
  - `ingredients` (FK `ingredients_store_id_fkey`)
  - `users` (`admin_branch_id`)

#### Giải pháp thiết kế:
Cập nhật transaction trong `deleteBranch(id)` theo thứ tự an toàn:
```javascript
async deleteBranch(id) {
  const [exists] = await database.query('SELECT id, name FROM stores WHERE id = $1', [id]);
  if (!exists[0]) throw new AdminStoreError('Không tìm thấy chi nhánh', 404);
  const [cnt] = await database.query('SELECT COUNT(*)::int AS c FROM orders WHERE store_id = $1', [id]);
  if (Number(cnt[0]?.c) > 0) {
    throw new AdminStoreError(`Không thể xóa chi nhánh "${exists[0].name}" vì đã có ${cnt[0].c} đơn hàng. Hãy dùng chức năng "Tạm ngưng" thay vì xóa.`);
  }
  return database.transaction(async (tx) => {
    await tx.query('DELETE FROM promotion_stores WHERE store_id = $1', [id]);
    await tx.query('DELETE FROM job_stores WHERE store_id = $1', [id]);
    await tx.query('UPDATE job_applications SET store_id = NULL WHERE store_id = $1', [id]);
    await tx.query('UPDATE users SET admin_branch_id = NULL WHERE admin_branch_id = $1', [id]);
    await tx.query('DELETE FROM ingredients WHERE store_id = $1', [id]);
    await tx.query('DELETE FROM tables WHERE store_id = $1', [id]);
    const [, affected] = await tx.query('DELETE FROM stores WHERE id = $1', [id]);
    return affected > 0;
  });
}
```

---

### 2.3 Hạng Mục 3: Sửa Lỗi Bản Đồ Google Maps trên Trang Cửa Hàng (`/cua-hang`)

#### Hiện trạng & Vấn đề:
- Trong `frontend/src/routes/cua-hang.tsx`, biến `mapCoords` được khởi tạo với tọa độ TP.HCM và được ghi đè khi đổi Tỉnh/Thành phố.
- Hàm `useMemo` tính `mapIframeUrl` ưu tiên `mapCoords` trước `selected`, khiến cho khi người dùng click vào các thẻ cửa hàng khác nhau (`handleSelectStore`), URL iframe không thay đổi hoặc không phản ánh đúng địa chỉ cửa hàng.

#### Giải pháp thiết kế:
1. Khi người dùng click chọn thẻ cửa hàng (`handleSelectStore(s)`):
   - Cập nhật `setSelectedId(s.id)`.
   - Cập nhật ngay `setMapCoords({ lat: s.lat, lng: s.lng, title: s.name })`.
2. Tái cấu trúc logic sinh `mapIframeUrl`:
   - Ưu tiên 1: Nếu có cửa hàng đang chọn (`selected`), sử dụng tọa độ `selected.lat, selected.lng` (hoặc chuỗi địa chỉ đầy đủ `${selected.name}, ${selected.address}, ${selected.district}, ${selected.city}`).
   - Ưu tiên 2: Nếu lọc theo thành phố, sử dụng tọa độ trung tâm thành phố.
   - Thêm `key={selected?.id ?? mapCoords.title}` cho `<iframe>` để React kích hoạt reload bản đồ mượt mà khi đổi chi nhánh.

---

### 2.4 Hạng Mục 4: Tinh Gọn Trung Tâm Thông Báo (`/admin/thong-bao`)

#### Hiện trạng & Vấn đề:
- Màn hình `/admin/thong-bao` hiển thị các tab/filter: Cảnh báo kho (`stock`), Voucher (`voucher`), Nhân sự (`staff`), Thanh toán (`payment`), Hệ thống (`system`).
- Nghiệp vụ hiện tại đã loại bỏ quản lý kho, đơn online đã thanh toán qua cổng PayOS/VietQR, các cảnh báo thừa gây rối mắt cho nhân viên vận hành.

#### Giải pháp thiết kế:
1. Rút gọn danh sách bộ lọc trong `admin.thong-bao.tsx`:
   ```typescript
   const filters = [
     { id: "all", label: "Tất cả" },
     { id: "order", label: "Đơn hàng mới" },
   ];
   ```
2. Cập nhật giao diện và mô tả trang: tập trung toàn bộ vào thông báo đơn hàng mới, trạng thái giao hàng và cập nhật đơn từ KDS.

---

### 2.5 Hạng Mục 5: Sửa Lỗi 500 tại `GET /admin/menu/options`

#### Hiện trạng & Vấn đề:
- `backend/routes/admin/menu.js` (dòng 138) gọi `adminMenuService.listOptions()`.
- `backend/services/catalog/admin-menu-service.js` gọi `repository.listOptions()`.
- `backend/repositories/postgres/admin-catalog.js` chỉ khai báo `async listAllOptions()` ➔ ném lỗi `TypeError: repository.listOptions is not a function`, dẫn đến response 500 `INTERNAL_SERVER_ERROR`.

#### Giải pháp thiết kế:
Trong `backend/repositories/postgres/admin-catalog.js`:
- Đổi tên hoặc khai báo `listOptions()` trả về `{ sizes, bases, sugars, ices, toppings }`.
- Đồng thời giữ `listAllOptions()` như một alias gọi `this.listOptions()` để tương thích ngược 100%.

---

## 3. Kế Hoạch Kiểm Thử & Tiêu Chí Nghiệm Thu (Acceptance Criteria)

1. **Unified Auth**:
   - Dùng SĐT `0909000001` + mật khẩu `admin123` đăng nhập tại popup User Header ➔ Đăng nhập thành công, xuất hiện nút truy cập `/admin`, mở được dashboard quản trị.
   - Dùng tài khoản khách hàng thông thường đăng nhập ➔ Hoạt động bình thường, hiển thị đúng điểm và hạng hội viên.
2. **Xóa Chi Nhánh**:
   - Tạo chi nhánh thử nghiệm, gán voucher trong `promotion_stores` và bàn trong `tables`, sau đó thực hiện xóa chi nhánh ➔ Xóa thành công, không gặp lỗi foreign key.
3. **Bản Đồ Cửa Hàng**:
   - Vào `/cua-hang`, click lần lượt các chi nhánh Quận 1, Quận 3, Quận 7, Đà Nẵng ➔ Khung Google Maps tự động pan/zoom và hiển thị đúng địa chỉ từng quán.
4. **Trung Tâm Thông Báo**:
   - Vào `/admin/thong-bao` ➔ Chỉ hiển thị các tab "Tất cả" và "Đơn hàng mới", không còn các nút cảnh báo kho, nhân sự, voucher thừa.
5. **Menu Options API**:
   - Gửi `GET /admin/menu/options` kèm Bearer token Admin ➔ Trả về `200 OK` với đầy đủ `{ sizes, bases, sugars, ices, toppings }`.
   - Bộ test backend `npm test` và frontend `npm run test` đạt **100% PASS**.
