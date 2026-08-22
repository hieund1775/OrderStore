# Kế Hoạch Triển Khai: Sửa Đánh Dấu Cửa Hàng, Vòng Đời Voucher & Hệ Thống Tuyển Dụng

> **Ngày tạo:** 22/08/2026  
> **Tài liệu đặc tả (Spec):** [`docs/superpowers/specs/2026-08-22-store-map-voucher-lifecycle-recruitment-design.md`](file:///D:/Code/Extra/Planning_DuAn/Order/docs/superpowers/specs/2026-08-22-store-map-voucher-lifecycle-recruitment-design.md)  
> **Người thực hiện:** AGY Pair Programming Agent  
> **Người nghiệm thu / Reviewer:** Codex  
> **Mục tiêu:** Thực hiện chuẩn xác 4 hạng mục theo yêu cầu: Sửa đánh dấu cửa hàng, Xóa voucher & Quản lý vòng đời lượt dùng, Khóa cứng ngày/điều kiện voucher, Xây dựng phân hệ Quản trị Tuyển dụng và Nộp hồ sơ.

---

## Tiêu Chuẩn Thực Hiện (Ground Rules)
1. **Tuân thủ Clean Architecture**: Route ➔ Service ➔ Repository ➔ DTO.
2. **Zero Mock Data**: Toàn bộ dữ liệu tin tuyển dụng, ứng viên, voucher và cửa hàng lấy và ghi trực tiếp vào PostgreSQL.
3. **Kiểm thử chặt chẽ**: Mỗi Task đều có kiểm thử unit test / integration test và verify build sạch (`tsc --noEmit`, `vitest`, `npm test`).

---

## Task 1: Sửa Lỗi Đánh Dấu (Marker Pin) Cửa Hàng Trên Bản Đồ Google Maps

### 1.1 Mục tiêu
Đảm bảo khi khách hàng mở trang `/cua-hang` và chọn chi nhánh hoặc tìm kiếm, Google Maps iframe luôn cắm ghim đỏ (Marker pin) hiển thị tên cửa hàng và vị trí chính xác thay vì chỉ căn tâm bản đồ trống trơn.

### 1.2 Tệp cần chỉnh sửa
* Modify: [`frontend/src/routes/cua-hang.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/routes/cua-hang.tsx)
  * Cập nhật hàm tạo URL `mapIframeUrl`:
    * Định dạng chuẩn có marker và title: `https://maps.google.com/maps?q=${encodeURIComponent(selected.name + ', ' + fullAddr)}&t=&z=16&ie=UTF8&iwloc=B&output=embed`
    * Hoặc dạng tọa độ kèm nhãn: `https://maps.google.com/maps?q=${selected.lat},${selected.lng}+(${encodeURIComponent(selected.name)})&t=&z=16&ie=UTF8&iwloc=B&output=embed`
    * Đảm bảo iframe key re-render mượt mà khi đổi chi nhánh được chọn.

### 1.3 Lệnh kiểm tra (Verify)
```powershell
cd frontend
npm run test
npx tsc --noEmit
```
**Commit Git**: `fix(stores): fix google maps iframe query to display interactive store marker pin`

---

## Task 2: Backend — Endpoint Xóa Voucher, Ràng Buộc Ngày & Quản Lý Lượt Dùng

### 2.1 Mục tiêu
1. Bổ sung endpoint `DELETE /admin/promotions/:id` cho Super Admin.
2. Siết chặt validation ngày: từ chối `400` nếu `end_date < start_date`.
3. Chuẩn hóa trạng thái voucher (`Còn hạn`, `Hết hạn`, `Vô hạn`, `Tạm tắt`) và tự động từ chối áp dụng khi quá deadline hoặc hết lượt dùng.
4. Mặc định `used_count` là 0 khi tạo mới.

### 2.2 Tệp cần chỉnh sửa / tạo mới
* Modify: [`backend/validation/promotion-schemas.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/validation/promotion-schemas.js) (Thêm kiểm tra `start_date <= end_date`).
* Modify: [`backend/routes/admin/promotions.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/routes/admin/promotions.js) (Bổ sung route `DELETE /:id`).
* Modify: [`backend/services/promotions/admin-promotion-service.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/services/promotions/admin-promotion-service.js).
* Modify: [`backend/repositories/postgres/admin-promotions.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/repositories/postgres/admin-promotions.js) (Thêm `deletePromotion(id)` xóa sạch `promotion_stores` và `promotions`).
* Create: `backend/test/promotions-lifecycle.test.js` (Bộ test kiểm thử tạo, xóa, validate ngày kết thúc, trạng thái hết hạn).

### 2.3 Lệnh kiểm tra (Verify)
```powershell
node --test backend/test/promotions-lifecycle.test.js
npm test
```
**Commit Git**: `feat(promotions): add delete promotion endpoint and enforce strict date bounds`

---

## Task 3: Frontend — Nâng Cấp Quản Trị Voucher (Xóa, Trạng Thái, Lượt Dùng, Khóa Ngày)

### 3.1 Mục tiêu
1. Thêm nút Xóa voucher kèm Confirm Dialog trong bảng quản trị.
2. Hiển thị cột Lượt dùng:
   - Voucher theo thời hạn (`time_bounded`): `used_count / usage_limit` (mặc định 0 khi vừa tạo).
   - Voucher 1 lần theo SĐT (`single_use`): Hiển thị `"Không áp dụng"`.
3. Hiển thị Badge Trạng thái chuẩn: `Còn hạn`, `Hết hạn`, `Vô hạn`, `Tạm tắt`.
4. Ràng buộc Date Picker: `end_date` có `min={form.start_date}` ngăn chặn chọn ngày kết thúc trước ngày bắt đầu.
5. Voucher hết hạn hiển thị trạng thái `Hết hạn` và bị khóa, khi Admin sửa gia hạn `end_date` mới sẽ chuyển lại thành `Còn hạn`.

### 3.2 Tệp cần chỉnh sửa
* Modify: [`frontend/src/routes/admin.khuyen-mai.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/routes/admin.khuyen-mai.tsx)

### 3.3 Lệnh kiểm tra (Verify)
```powershell
cd frontend
npx tsc --noEmit
npm run build
```
**Commit Git**: `feat(admin-promotions): add voucher delete action, usage formatting and date picker locking`

---

## Task 4: Backend — Xây Dựng Tuyển Dụng Service, Repository & Endpoints (Admin & Public)

### 4.1 Mục tiêu
1. Tạo Admin CRUD cho tuyển dụng:
   - `GET /admin/jobs`: Lấy danh sách tin tuyển dụng.
   - `POST /admin/jobs`: Tạo tin tuyển dụng mới.
   - `PUT /admin/jobs/:id`: Cập nhật tin tuyển dụng (Mô tả, yêu cầu, lương, quyền lợi, `is_active`).
   - `DELETE /admin/jobs/:id`: Xóa tin tuyển dụng.
   - `GET /admin/job-applications`: Lấy danh sách hồ sơ ứng tuyển kèm thông tin tin tuyển dụng và chi nhánh.
   - `PATCH /admin/job-applications/:id/status`: Cập nhật trạng thái (`Mới`, `Đang xem xét`, `Phỏng vấn`, `Trúng tuyển`, `Từ chối`) và ghi chú.
2. Public Endpoints:
   - `GET /api/jobs`: Chỉ trả về các tin đang mở (`is_active = TRUE`).
   - `POST /api/jobs/:id/apply`: Nộp hồ sơ vào bảng `job_applications`.

### 4.2 Tệp cần chỉnh sửa / tạo mới
* Create: `backend/routes/admin/recruitment.js`
* Create: `backend/services/recruitment/recruitment-service.js`
* Create: `backend/repositories/postgres/recruitment.js`
* Create: `backend/validation/recruitment-schemas.js`
* Create: `backend/dto/recruitment-dto.js`
* Modify: [`backend/routes/admin.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/routes/admin.js) (Mount router `/admin/recruitment` hoặc `/admin/jobs`).
* Modify: [`backend/routes/public/engagement.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/routes/public/engagement.js) (Cập nhật endpoint nộp hồ sơ chuẩn schema).
* Create: `backend/test/recruitment-lifecycle.test.js`

### 4.3 Lệnh kiểm tra (Verify)
```powershell
node --test backend/test/recruitment-lifecycle.test.js
npm test
```
**Commit Git**: `feat(recruitment): implement admin and public recruitment backend APIs`

---

## Task 5: Frontend — Giao Diện Quản Trị Tuyển Dụng & Trang Tuyển Dụng Khách Hàng

### 5.1 Mục tiêu
1. **Admin (`/admin/tuyen-dung`)**:
   - Thêm mục Tuyển dụng vào Menu Sidebar Admin (`frontend/src/components/admin/AdminSidebar.tsx`).
   - Giao diện 2 Tabs:
     - **Tab 1: Quản lý Tin Tuyển Dụng**:
       - Danh sách tin tuyển dụng có nút bật/tắt `is_active`, nút Sửa, nút Xóa.
       - Modal Tạo/Sửa tin tuyển dụng:
         - Chọn nhanh 1 trong **4 công việc mẫu**: *Nhân viên Pha Chế (Barista)*, *Thu Ngân*, *Quản Lý Cửa Hàng*, *Nhân Viên Phục Vụ / Part-time*.
         - Dropdown Hình thức: `Part-time`, `Full-time`, `Thay ca / Xoay ca`, `Linh hoạt`.
         - Input tự điền: Mô tả công việc, Yêu cầu, Mức lương, Quyền lợi.
     - **Tab 2: Danh sách Ứng Viên**:
       - Bảng danh sách ứng viên (Họ tên, SĐT, Email, Vị trí, Chi nhánh, Link CV, Ngày nộp, Trạng thái).
       - Select đổi trạng thái duyệt hồ sơ và ghi chú phỏng vấn.
2. **Khách hàng (`/tuyen-dung`)**:
   - Lấy dữ liệu thật từ `GET /api/jobs`.
   - Nếu không có tin nào mở (`is_active = false` hoặc rỗng): Hiển thị thông báo: *"Hiện tại chưa có công việc ứng tuyển mới. Hãy quay lại sau hoặc theo dõi fanpage của chúng tôi nhé!"*.
   - Nếu có tin mở: Hiển thị thẻ công việc ➔ Bấm *"Ứng tuyển ngay"* ➔ Form nộp hồ sơ kết nối trực tiếp API `POST /api/jobs/:id/apply`.

### 5.2 Tệp cần chỉnh sửa / tạo mới
* Create: `frontend/src/routes/admin.tuyen-dung.tsx`
* Modify: [`frontend/src/components/admin/AdminSidebar.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/components/admin/AdminSidebar.tsx)
* Modify: [`frontend/src/routes/tuyen-dung.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/routes/tuyen-dung.tsx)

### 5.3 Lệnh kiểm tra (Verify)
```powershell
cd frontend
npx tsc --noEmit
npm run test
npm run build
```
**Commit Git**: `feat(frontend): build admin recruitment management and dynamic careers page`

---

## 6. Tiêu Chí Nghiệm Thu Cho Codex (Codex Acceptance Criteria)

| Hạng Mục | Tiêu Chí Kiểm Tra Nghiệm Thu | Kết Quả Mong Đợi |
|---|---|:---:|
| **1. Store Marker Pin** | Mở `/cua-hang`, chọn bất kỳ chi nhánh. | Bản đồ Google Maps ghim marker đỏ chính xác tên và vị trí chi nhánh. |
| **2. Xóa Voucher** | Bấm xóa voucher trong `/admin/khuyen-mai`. | Voucher và liên kết store bị xóa hoàn toàn khỏi DB; giao diện cập nhật ngay. |
| **3. Lượt dùng & Khóa ngày** | - Voucher 1 lần theo SĐT.<br>- Voucher theo thời hạn.<br>- Chọn `end_date < start_date`. | - Cột lượt dùng hiển thị "Không áp dụng".<br>- Cột lượt dùng hiển thị `used_count / limit` (mặc định 0).<br>- Bị chặn min date và backend trả về 400 Bad Request. |
| **4. Trạng thái Tự Động** | Khi voucher quá hạn hoặc hết lượt dùng. | Hiển thị `Hết hạn`, tự động chặn áp dụng khi đặt hàng. |
| **5. Admin Tuyển Dụng** | - Tạo/Sửa/Đóng/Xóa tin tuyển dụng.<br>- Chọn 4 vị trí mẫu, hình thức làm việc.<br>- Xem danh sách ứng viên và đổi trạng thái. | Hoạt động trơn tru 100%, ghi dữ liệu thật vào bảng `jobs` & `job_applications`. |
| **6. Khách Hàng Tuyển Dụng** | - Khi admin đóng hết tin.<br>- Khi có tin mở và nộp hồ sơ. | - Hiển thị thông báo "Hiện tại chưa có công việc ứng tuyển".<br>- Form nộp gửi API `POST /api/jobs/:id/apply` thành công. |
| **7. Toàn Bộ Test Suite** | Chạy `npm test` backend & `vitest` / `tsc` frontend. | 100% tests PASS, 0 warning, 0 build error. |
## Quyết định bắt buộc trước khi triển khai

1. Voucher đã được tham chiếu bởi `orders` hoặc `user_vouchers` không được xóa cứng; chỉ chuyển `is_active = false`. Chỉ voucher chưa có lịch sử mới được xóa cứng cùng các liên kết `promotion_stores`.
2. Job đã có `job_applications` không được xóa cứng; chỉ đóng tuyển bằng `is_active = false`. Chỉ job chưa có hồ sơ mới được xóa cứng.
3. Với schema hiện tại, “Vô hạn” chỉ có nghĩa là không giới hạn lượt dùng (`usage_limit IS NULL`), vẫn tuân thủ `start_date` và `end_date`. Không đổi `end_date` thành nullable trong task này.
4. Thống nhất API admin tuyển dụng: `/admin/jobs` và `/admin/job-applications`. Public giữ `/api/jobs` và `/api/jobs/:id/apply`; mở rộng route hiện có, không tạo endpoint trùng.
5. Payload đã validate/canonical mới được truyền xuống service/repository; không truyền trực tiếp `req.body` sau validation.

## Test bắt buộc bổ sung

- Super admin xóa được voucher; manager nhận `403`.
- Voucher đã có lịch sử chỉ bị deactivate và vẫn giữ được lịch sử đơn hàng/khách hàng.
- Job đã có hồ sơ chỉ được đóng tuyển, không mất lịch sử ứng viên.
- Không thể apply job không tồn tại hoặc đã đóng.
- Hai checkout đồng thời với voucher giới hạn lượt dùng chỉ có một request thành công.
- Gia hạn voucher hợp lệ phải cho phép áp dụng lại nếu voucher không bị tắt thủ công.
- Tất cả route admin tuyển dụng dùng đúng prefix đã thống nhất.
