# Kế Hoạch Triển Khai: Vòng Đời Mã QR PayOS & Quy Trình Điều Phối Đơn Hàng

> **Tài liệu tham chiếu**: [`docs/superpowers/specs/2026-08-23-payos-qr-lifecycle-and-order-workflow-design.md`](file:///D:/Code/Extra/Planning_DuAn/Order/docs/superpowers/specs/2026-08-23-payos-qr-lifecycle-and-order-workflow-design.md)  
> **Người thực hiện**: Antigravity (AGY)  
> **Người nghiệm thu**: Codex  

---

## 1. Mục Tiêu & Phạm Vi

1. **Vòng đời mã QR PayOS linh hoạt**:
   - Khi thanh toán thành công: Đóng QR ngay lập tức và điều hướng sang `/theo-doi-don`.
   - Bổ sung nút "Kiểm tra thanh toán ngay" trên giao diện QR.
   - Khi QR hết hạn: Không hủy mất đơn/món của khách, cho phép **🔄 Tạo mã QR mới** (gia hạn 15p) hoặc **🗑️ Hủy đơn nhanh**.
2. **Dọn sạch giao diện theo dõi đơn (`theo-doi-don.tsx`)**:
   - Ẩn hoàn toàn banner và nút xác thực thanh toán khi đơn đã thanh toán thành công (`payment_status === 'paid'`) hoặc bếp đang làm.
3. **Chuẩn hóa quy trình 7 bước**:
   - Đơn Tại bàn / Mang đi $\rightarrow$ Bếp làm xong ấn **"Hoàn thành"**.
   - Đơn Giao tận nơi $\rightarrow$ Bếp làm xong ấn **"Pha xong ➔ Giao Shipper"** $\rightarrow$ Đơn chuyển `Đang giao`.
   - Shipper giao xong $\rightarrow$ Admin ấn **"Xác nhận giao xong (Hoàn thành)"**.

---

## 2. Chi Tiết Các Bước Triển Khai

### Task 1: Backend — API Tái Tạo Mã QR PayOS & Hỗ Trợ Test Local Dev
- **Files**:
  - `backend/repositories/postgres/payments.js` (Thêm hàm `renewPayOSOrderLink`)
  - `backend/services/payos.js` (Hỗ trợ tái tạo payment link cho `orderId`)
  - `backend/routes/payments.js` (Thêm route `POST /api/payments/payos/regenerate-qr`, `POST /api/payments/payos/simulate-success`)
- **Nghiệp vụ**:
  - `POST /api/payments/payos/regenerate-qr`: Nhận `order_code`, kiểm tra đơn chưa thanh toán (`unpaid`), gọi PayOS SDK tạo link mới với `payment_expires_at = NOW() + 15m`, cập nhật lại PostgreSQL và trả về QR/checkoutUrl mới.
  - `POST /api/payments/payos/simulate-success`: (Chỉ chạy khi dev `NODE_ENV !== 'production'`) kích hoạt đơn thành `paid` để test cục bộ không cần cài ngrok.
- **Verification**: Viết unit test `backend/test/payos-lifecycle.test.js`.

---

### Task 2: Frontend — Nâng Cấp Giao Diện QR & Xử Lý Hết Hạn Tại `thanh-toan.tsx`
- **Files**:
  - `frontend/src/routes/thanh-toan.tsx`
- **Nghiệp vụ**:
  - Thêm nút **"🔍 Kiểm tra thanh toán ngay"** gọi lookup tức thì và hiển thị loading spinner.
  - Khi `payment_status === 'paid'`: Tự động gọi `clear()`, xóa `sessionStorage.getItem("teaplus_pending_payment")`, hiện toast thành công và `navigate` sang `/theo-doi-don?code=...`.
  - Khi đếm ngược hết hạn (hoặc `payment_status === 'expired'`):
    - Đổi giao diện sang trạng thái thông báo hết hạn thân thiện.
    - Thêm nút **"🔄 Tạo mã QR thanh toán mới"** gọi `POST /api/payments/payos/regenerate-qr` và reset đồng hồ 15 phút.
    - Thêm nút **"🗑️ Hủy đơn này"** gọi hủy đơn và chuyển về thực đơn.
- **Verification**: `npx tsc --noEmit` & kiểm tra tương tác UI.

---

### Task 3: Frontend — Tinh Gọn & Chuẩn Hóa Trang Theo Dõi Đơn (`theo-doi-don.tsx`)
- **Files**:
  - `frontend/src/routes/theo-doi-don.tsx`
- **Nghiệp vụ**:
  - Kiểm tra điều kiện: Nếu `order.payment_status === 'paid'` hoặc đơn đang ở các trạng thái `"Đang chuẩn bị"`, `"Đang giao"`, `"Hoàn thành"` $\rightarrow$ **ẨN HOÀN TOÀN** banner vàng `"⏳ Đang chờ xác nhận thanh toán"` và nút `"Thanh toán ngay / Xem mã QR"`.
  - Nếu đơn ở trạng thái `unpaid` và hết hạn: Hiển thị nút "Tạo lại mã QR thanh toán" chuyển hướng về `/thanh-toan` để tạo mã mới.
- **Verification**: Kiểm tra giao diện tracking không còn nút xác thực thừa khi đơn đang nấu.

---

### Task 4: Frontend & Backend — Khớp Nối Phân Luồng KDS & Bàn Giao Shipper
- **Files**:
  - `frontend/src/routes/admin.bep.tsx`
  - `frontend/src/routes/admin.don-hang.tsx`
- **Nghiệp vụ**:
  - Trong `admin.bep.tsx`:
    - Đơn `Take-away` / `POS`: Nút **"✅ Hoàn thành"** $\rightarrow$ chuyển đơn sang `Hoàn thành`.
    - Đơn `Delivery`: Nút **"🚚 Pha xong ➔ Giao Shipper"** $\rightarrow$ mở modal bàn giao shipper $\rightarrow$ chuyển đơn sang `Đang giao`.
  - Trong `admin.don-hang.tsx`:
    - Khi đơn ở trạng thái `Đang giao`: Hiển thị nút **"Xác nhận giao xong (Hoàn thành)"** để Admin bấm hoàn tất đơn khi nhận được tin báo từ Shipper.
- **Verification**: Kiểm tra luồng KDS và Don-hang hoạt động trơn tru.

---

### Task 5: Kiểm Thử Toàn Diện & Nghiệm Thu
- Chạy backend test suite: `npm test` trong `backend/`
- Chạy frontend type check: `npx tsc --noEmit` trong `frontend/`
- Chạy frontend build: `npm run build` trong `frontend/`
- Viết báo cáo bàn giao: `docs/reviews/2026-08-23-payos-qr-lifecycle-and-order-workflow-agy-handoff.md`
