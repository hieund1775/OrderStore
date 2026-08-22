# Tài Liệu Đặc Tả Thiết Kế: Cải Tiến Bản Đồ Chi Nhánh, Vòng Đời Voucher & Hệ Thống Tuyển Dụng

> **Ngày tạo:** 22/08/2026  
> **Người thực hiện:** AGY Pair Programming Agent  
> **Người nghiệm thu:** Codex  
> **Mục tiêu:** Đặc tả kiến trúc kỹ thuật và luồng xử lý cho 4 yêu cầu nghiệp vụ: sửa lỗi marker bản đồ cửa hàng, hoàn thiện vòng đời & quản lý voucher, ràng buộc ngày và điều kiện voucher, cùng hệ thống quản trị tuyển dụng / nộp hồ sơ ứng tuyển.

---

## 1. Hạng Mục 1: Hiển Thị Marker Đánh Dấu Chi Nhánh Trên Bản Đồ Cửa Hàng

### 1.1 Hiện trạng & Vấn đề
- Trang `frontend/src/routes/cua-hang.tsx` sử dụng Google Maps Iframe với tham số `q=${selected.lat},${selected.lng}` mà không có nhãn vị trí hoặc tên chi nhánh.
- Trên nhiều trình duyệt, Google Maps embed chỉ pan tới tọa độ tâm nhưng không cắm cờ ghim (Marker Pin) màu đỏ, khiến người dùng không thấy điểm đánh dấu rõ ràng của cửa hàng.

### 1.2 Giải pháp Kiến trúc
- Chuẩn hóa query Google Maps embed URL:
  - Khi có tọa độ `lat, lng` và tên cửa hàng `name`, query được định dạng:  
    `https://maps.google.com/maps?q=${selected.lat},${selected.lng}+(${encodeURIComponent(selected.name)})&t=&z=16&ie=UTF8&iwloc=B&output=embed`
  - Trường hợp fallback (chưa có tọa độ): query theo tên và địa chỉ đầy đủ:  
    `https://maps.google.com/maps?q=${encodeURIComponent(selected.name + ', ' + fullAddr)}&t=&z=16&ie=UTF8&iwloc=B&output=embed`
  - Đảm bảo tham số `iwloc=B` hoặc nhãn `+(Tên_Cửa_Hàng)` kích hoạt Infowindow / Marker Pin màu đỏ hiển thị trực quan ngay tâm bản đồ.

---

## 2. Hạng Mục 2 & 3: Quản Lý Vòng Đời Voucher, Tự Động Hết Hạn & Ràng Buộc Điều Kiện

### 2.1 Hiện trạng & Vấn đề
- Thiếu chức năng xóa voucher (`DELETE`) khi không còn nhu cầu sử dụng.
- Cột lượt dùng chưa phân biệt rõ giữa voucher giới hạn lượt (`time_bounded`) và voucher áp dụng 1 lần theo số điện thoại (`single_use`).
- Trạng thái voucher chưa phản ánh chính xác các trạng thái: `Còn hạn`, `Hết hạn`, `Vô hạn`, `Tạm tắt`.
- Chưa khóa cứng điều kiện ngày (`start_date <= end_date`), cho phép người dùng chọn ngày kết thúc trước ngày bắt đầu.
- Cơ chế tự động khóa voucher khi hết hạn (quá deadline hoặc hết lượt dùng) cần được đảm bảo ở cả tầng hiển thị và tầng giao dịch checkout.

### 2.2 Quy tắc Nghiệp vụ Chi tiết
1. **Chức năng Xóa Voucher (`DELETE /admin/promotions/:id`)**:
   - Chỉ cho phép Super Admin xóa voucher.
   - Xóa liên kết trong `promotion_stores` và bản ghi voucher trong bảng `promotions` (nếu chưa phát sinh lịch sử dùng có ràng buộc khoá ngoại, hoặc xóa mềm/xóa an toàn).
2. **Cơ chế Lượt dùng & Khởi tạo**:
   - Voucher loại `time_bounded`: Mặc định `used_count` khởi tạo là `0`. Hiển thị `used_count / usage_limit` (hoặc `0 / ∞` nếu không đặt giới hạn).
   - Voucher loại `single_use` (áp dụng theo SĐT): Hiển thị lượt dùng là **"Không áp dụng"** (hoặc `Mỗi SĐT 1 lần`).
3. **Trạng thái Voucher**:
   - `Còn hạn`: `is_active === true`, `start_date <= today <= end_date`, và (`usage_limit IS NULL` hoặc `used_count < usage_limit`).
   - `Hết hạn`: `end_date < today` hoặc (`usage_limit IS NOT NULL` và `used_count >= usage_limit`).
   - `Vô hạn`: Dành cho mã không giới hạn thời gian (hoặc end_date xa vô tận).
   - `Tạm tắt`: Khi `is_active === false`.
4. **Tự động Khóa / Mở lại**:
   - Khi hết hạn, voucher tự động bị từ chối khi khách áp dụng tại `POST /api/vouchers/apply` và `POST /api/orders`.
   - Voucher chỉ mở lại (`Còn hạn`) khi Admin sửa gia hạn `end_date` mới (>= hôm nay) hoặc tăng `usage_limit`.
5. **Ràng buộc Ngày bắt đầu & Kết thúc**:
   - Frontend: Date picker của `end_date` có `min={form.start_date}` để chặn ngay trên giao diện. Validation form kiểm tra `end_date >= start_date`.
   - Backend: Joi/Zod/Custom validator từ chối `400 Bad Request` nếu `end_date < start_date`.
6. **Điều kiện Hạn mức & Đơn tối thiểu**:
   - Cho phép nhập đơn tối thiểu (`min_order`) hoặc để trống (Không giới hạn).
   - Cho phép nhập mức giảm tối đa (`max_discount`) đối với giảm theo phần trăm.

---

## 3. Hạng Mục 4: Hệ Thống Quản Trị Tuyển Dụng & Khách Hàng Ứng Tuyển

### 3.1 Cấu trúc Dữ liệu Hiện có trong PostgreSQL
- Bảng `jobs`:
  - `id`: BIGINT (PK)
  - `title`: VARCHAR(200) - Tiêu đề công việc
  - `type`: VARCHAR(100) - Hình thức (`Part-time`, `Full-time`, `Xoay ca / Thay ca`, `Linh hoạt`)
  - `salary`: VARCHAR(150) - Mức lương & đãi ngộ
  - `description`: TEXT - Mô tả công việc
  - `requirements`: TEXT - Yêu cầu ứng viên
  - `benefits`: TEXT - Quyền lợi
  - `is_active`: BOOLEAN - Trạng thái mở/đóng tuyển dụng
  - `created_at`: TIMESTAMPTZ
- Bảng `job_applications`:
  - `id`: BIGINT (PK)
  - `job_id`: BIGINT (FK -> jobs)
  - `store_id`: BIGINT (FK -> stores, nullable)
  - `fullname`: VARCHAR(120) - Họ tên ứng viên
  - `phone`: VARCHAR(20) - SĐT liên hệ
  - `email`: VARCHAR(150) - Email
  - `cv_url`: VARCHAR(500) - Đường dẫn CV hoặc file đính kèm
  - `status`: VARCHAR(30) (`Mới`, `Đang xem xét`, `Phỏng vấn`, `Trúng tuyển`, `Từ chối`)
  - `note`: TEXT - Ghi chú phỏng vấn của HR
  - `created_at`: TIMESTAMPTZ

### 3.2 4 Vị Trí Công Việc Mẫu (Preset Templates)
Admin có thể chọn nhanh từ 4 vị trí mẫu (hoặc tự nhập tùy chỉnh):
1. **Nhân viên Pha Chế (Barista Trà Trái Cây)**
2. **Thu Ngân**
3. **Quản Lý Cửa Hàng**
4. **Nhân Viên Phục Vụ / Part-time**

### 3.3 Phân hệ Admin Tuyển Dụng (`/admin/tuyen-dung`)
1. **Sidebar Navigation**: Bổ sung menu `Tuyển dụng` (Icon `Briefcase` hoặc `Users`).
2. **Tab 1: Tin tuyển dụng (`Jobs`)**:
   - Danh sách tin tuyển dụng, hiển thị Badge `Đang tuyển` (xanh) / `Đã đóng` (xám).
   - Nút bật/tắt nhanh trạng thái tuyển dụng (`Switch is_active`).
   - Modal Tạo/Sửa tin tuyển dụng:
     - Chọn vị trí từ 4 mẫu hoặc tự nhập.
     - Chọn Hình thức: `Part-time`, `Full-time`, `Xoay ca / Thay ca`, `Linh hoạt`.
     - Tự điền: Mô tả công việc, Yêu cầu, Mức lương, Quyền lợi.
   - Nút Xóa tin tuyển dụng kèm modal xác nhận.
3. **Tab 2: Danh sách Ứng viên (`Applications`)**:
   - Bảng hiển thị: Họ tên, SĐT, Email, Vị trí ứng tuyển, Chi nhánh mong muốn, Link CV, Ngày nộp, Trạng thái.
   - Dropdown cập nhật trạng thái hồ sơ (`Mới` ➔ `Đang xem xét` ➔ `Phỏng vấn` ➔ `Trúng tuyển` ➔ `Từ chối`).
   - Thêm ghi chú phỏng vấn / đánh giá ứng viên.

### 3.4 Phân hệ Người Dùng Ứng Tuyển (`/tuyen-dung`)
1. Fetch API thật `GET /api/jobs` từ PostgreSQL.
2. **Empty State**: Nếu danh sách `jobs` rỗng hoặc không có tin nào `is_active === true`, hiển thị thông báo thân thiện:
   > *"Hiện tại chưa có công việc ứng tuyển mới. Hãy theo dõi website và fanpage để cập nhật cơ hội việc làm sớm nhất nhé!"*
3. **Active State**: Hiển thị danh sách thẻ việc làm với đầy đủ Mô tả, Yêu cầu, Mức lương, Quyền lợi, Hình thức làm việc.
4. **Nộp hồ sơ**: Khách bấm *"Ứng tuyển ngay"* ➔ Mở Form điền Họ tên, SĐT, Email, Chi nhánh mong muốn, Link CV ➔ Gửi API thật `POST /api/jobs/:id/apply` ➔ Lưu vào database và thông báo thành công.

---

## 4. Hợp Đồng API Mới & Cập Nhật

### 4.1 Quản lý Voucher (Admin)
- `DELETE /admin/promotions/:id`: Xóa voucher (Super Admin).
- `PUT /admin/promotions/:id`: Cập nhật voucher (đã có, bổ sung validation ngày).

### 4.2 Tuyển dụng (Admin)
- `GET /admin/jobs`: Lấy toàn bộ danh sách tin tuyển dụng (kể cả đã đóng).
- `POST /admin/jobs`: Tạo tin tuyển dụng mới.
- `PUT /admin/jobs/:id`: Sửa thông tin tin tuyển dụng hoặc toggle `is_active`.
- `DELETE /admin/jobs/:id`: Xóa tin tuyển dụng.
- `GET /admin/job-applications`: Lấy danh sách hồ sơ ứng tuyển (kèm bộ lọc theo vị trí / trạng thái).
- `PATCH /admin/job-applications/:id/status`: Cập nhật trạng thái và ghi chú hồ sơ ứng viên.

### 4.3 Tuyển dụng (Public)
- `GET /api/jobs`: Lấy danh sách tin tuyển dụng đang mở (`is_active = TRUE`).
- `POST /api/jobs/:id/apply`: Nộp hồ sơ ứng tuyển.
## Quyết định phạm vi

- Không xóa cứng voucher đã có lịch sử trong `orders` hoặc `user_vouchers`; các voucher này được tắt bằng `is_active = false`.
- Không xóa cứng job đã có `job_applications`; chỉ đóng tuyển bằng `is_active = false` để giữ lịch sử ứng viên.
- “Vô hạn” chỉ là không giới hạn lượt dùng (`usage_limit IS NULL`), không phải không giới hạn thời gian.
- Contract admin tuyển dụng là `/admin/jobs` và `/admin/job-applications`; public là `/api/jobs` và `/api/jobs/:id/apply`.
- Không cam kết tuyệt đối màu marker của Google Maps iframe; tiêu chí nghiệm thu là map focus đúng chi nhánh và hiển thị tên/địa điểm tương ứng.
