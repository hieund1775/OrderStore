# Thiết Kế: Vòng Đời Mã QR PayOS & Quy Trình Điều Phối Đơn Hàng (KDS - Shipper - Hoàn Thành)

> **Mục tiêu**: Chuẩn hóa 100% trải nghiệm thanh toán PayOS (tự đóng QR khi thành công, tạo lại QR khi hết hạn mà không mất món), dọn sạch giao diện theo dõi đơn và đồng bộ quy trình 7 bước từ Bếp KDS đến Bàn giao Shipper và Hoàn thành đơn.

---

## 1. Hiện Trạng & Vấn Đề Cần Giải Quyết

| # | Hiện trạng | Vấn đề phát sinh | Giải pháp thiết kế |
|---|---|---|---|
| **1** | **Đóng mã QR khi thanh toán thành công** | Khách quét mã xong nhưng màn hình QR ở `/thanh-toan` không tự đóng ngay do phụ thuộc polling chậm hoặc chưa có nút kiểm tra thủ công. | - Thêm nút **"Kiểm tra thanh toán ngay"** trên khung QR.<br>- Polling 3s phát hiện `payment_status === 'paid'` lập tức dọn cart, xóa storage, toast thành công và redirect sang `/theo-doi-don`.<br>- Hỗ trợ endpoint mô phỏng webhook `POST /api/payments/payos/simulate-success` (chỉ bật ở dev/test) giúp kiểm thử local không cần ngrok. |
| **2** | **Mã QR hết hạn thanh toán (15 phút)** | Hệ thống tự hủy đơn `payment_status = 'expired'`, xóa giỏ hàng bắt khách phải chọn lại món từ đầu. | - Khi hết hạn, đơn giữ nguyên ở trạng thái **Chưa chuyển khoản**.<br>- Cung cấp 2 lựa chọn: **🔄 Tạo mã QR mới** (tự gia hạn 15p và sinh link PayOS mới cho đơn cũ) hoặc **🗑️ Hủy/Xóa đơn này**. |
| **3** | **Trang theo dõi đơn (`theo-doi-don.tsx`)** | Vẫn hiển thị khung cảnh báo vàng "⏳ Đang chờ xác nhận thanh toán" và nút "Thanh toán ngay" dù đơn đã thanh toán hoặc đang chuẩn bị. | - Ẩn hoàn toàn banner vàng và nút thanh toán khi `payment_status === 'paid'` hoặc đơn đang ở bước pha chế/giao hàng.<br>- Hiển thị thanh tiến độ chuẩn 3 bước trực quan. |
| **4** | **Phân luồng Bếp KDS & Bàn giao Shipper** | Chưa phân biệt rõ ràng luồng hoàn thành giữa đơn Tại bàn (Take-away) và đơn Giao tận nơi (Delivery). | - **Tại bàn / Đến lấy**: Bếp bấm **"✅ Hoàn thành"** $\rightarrow$ Đơn về đích `Hoàn thành`.<br>- **Giao tận nơi**: Bếp bấm **"🚚 Pha xong ➔ Giao Shipper"** $\rightarrow$ Đơn chuyển sang `Đang giao`.<br>- Shipper giao xong (trao đổi ngoài web) $\rightarrow$ Admin bấm **"Xác nhận giao xong (Hoàn thành)"**. |

---

## 2. Quy Trình 7 Bước Nghiệp Vụ Chuẩn

```
[1. User Đăng nhập & Tạo đơn]
             │
             ▼
[2. Tạo mã QR PayOS (15 phút)]
             │
             ├── (Hết hạn 15p) ──▶ [Trạng thái: Chưa chuyển khoản]
             │                            ├── [🔄 Tạo mã QR mới (Tái tạo link PayOS)]
             │                            └── [🗑️ Hủy / Xóa đơn này]
             │
             └── (Thanh toán thành công)
                     │
                     ▼
[3. Tự động đóng QR ➔ Chuyển qua /theo-doi-don]
   • Trạng thái: "Đang chuẩn bị"
   • Ẩn sạch mọi nút/banner xác thực thanh toán
                     │
                     ▼
[4. Màn hình Bếp KDS nhận đơn (Đã thanh toán)]
                     │
                     ▼
[5. Bếp hoàn tất pha chế]
             ├── (Đơn Tại bàn / Mang đi) ──▶ [6. Chuyển thẳng "Hoàn thành"]
             │
             └── (Đơn Giao tận nơi)      ──▶ [7. Chuyển "Đang giao" (Bàn giao Shipper)]
                                                            │
                                                            │ (Shipper giao hàng thành công)
                                                            ▼
                                             [Admin ấn "Xác nhận giao xong / Hoàn thành"]
```

---

## 3. Thiết Kế Chi Tiết Từng Phân Hệ

### 3.1. Backend API & Dữ Liệu

1. **API Tái tạo mã QR PayOS cho đơn cũ**:
   - Endpoint: `POST /api/payments/payos/regenerate-qr`
   - Payload: `{ order_code: string }`
   - Logic:
     - Kiểm tra đơn tồn tại, thuộc quyền sở hữu (hoặc đúng SĐT/JWT), `payment_status === 'unpaid'`.
     - Sinh `payos_order_code` 10 số mới.
     - Gọi PayOS SDK `createPaymentLink` với thời hạn mới 15 phút.
     - Cập nhật DB: `payos_order_code`, `payment_link_id`, `payment_checkout_url`, `payment_qr_code`, `payment_expires_at = NOW() + 15m`.
     - Trả về `{ checkout_url, qr_code, payment_expires_at, order_code, total }`.

2. **API Hủy đơn chưa thanh toán nhanh**:
   - Endpoint: `POST /api/orders/cancel-unpaid`
   - Payload: `{ order_code: string }`
   - Logic: Chỉ cho phép hủy khi `payment_status === 'unpaid'`, chuyển `current_status = 'Đã hủy'` mà không ảnh hưởng tồn kho hay báo cáo KPI.

3. **API Hỗ trợ kiểm thử Local Dev (Bypass Webhook khi test máy nội bộ)**:
   - Endpoint: `POST /api/payments/payos/simulate-success`
   - Guard: `process.env.NODE_ENV !== 'production'`
   - Payload: `{ order_code: string }`
   - Logic: Cập nhật ngay `payment_status = 'paid'`, `paid_at = NOW()`, kích hoạt đơn hàng vào Bếp KDS ngay trên máy local.

---

### 3.2. Frontend Web

1. **Trang Thanh toán (`thanh-toan.tsx`)**:
   - Khi đang chờ thanh toán:
     - Hiển thị QR VietQR, số tiền, đồng hồ đếm ngược 15 phút.
     - Nút **"🔍 Kiểm tra thanh toán ngay"** (gọi API lookup tức thì).
     - Polling 3s tự động kiểm tra.
   - Khi hết hạn 15 phút:
     - Khung chuyển sang màu cam thân thiện: *"Mã thanh toán đã hết hạn"*.
     - Nút **"🔄 Tạo mã QR mới"**: Bấm vào gọi API tái tạo QR, cập nhật lại hình QR và bắt đầu đếm ngược 15 phút mới.
     - Nút **"🗑️ Hủy đơn"**: Hủy đơn và quay lại thực đơn.
   - Khi thanh toán thành công:
     - Tự động đóng modal QR, xóa giỏ hàng và điều hướng sang `/theo-doi-don?code=TP...`.

2. **Trang Theo dõi đơn (`theo-doi-don.tsx`)**:
   - Nếu `payment_status === 'paid'`:
     - **Ẩn toàn bộ** banner vàng "⏳ Đang chờ xác nhận thanh toán" và nút "Thanh toán ngay".
     - Hiển thị timeline tiến độ:
       - Bước 1: **Đang chuẩn bị** (Bếp đang pha chế & đóng gói).
       - Bước 2: **Đang giao** (Shipper đang giao hàng / Đã mang ra bàn).
       - Bước 3: **Hoàn thành** (Đơn hàng hoàn tất).

3. **Màn hình Bếp KDS (`admin.bep.tsx`)**:
   - Chỉ hiển thị đơn đã thanh toán (`payment_status === 'paid'`).
   - Đơn **Tại bàn (`Take-away` / `POS`)**: Nút **"✅ Hoàn thành"** $\rightarrow$ chuyển đơn sang lane `Hoàn thành`.
   - Đơn **Giao tận nơi (`Delivery`)**: Nút **"🚚 Pha xong ➔ Giao Shipper"** $\rightarrow$ mở modal bàn giao shipper $\rightarrow$ chuyển sang lane `Đang giao`.

4. **Quản lý Đơn hàng Admin (`admin.don-hang.tsx`)**:
   - Đơn ở trạng thái `Đang giao`: Hiển thị nút nổi bật **"Xác nhận giao xong (Hoàn thành)"** để Admin đóng đơn khi nhận được báo cáo từ Shipper.

---

## 4. Kế Hoạch Kiểm Thử (Acceptance Criteria)

- [x] Tạo đơn online PayOS $\rightarrow$ Khung QR hiện đầy đủ, đồng hồ đếm ngược 15 phút chạy đúng.
- [x] Chuyển khoản thành công (hoặc simulate) $\rightarrow$ Khung QR đóng ngay lập tức, chuyển sang `/theo-doi-don`.
- [x] Trang `/theo-doi-don` không còn bất kỳ nút/banner xác thực thanh toán thừa nào khi đơn đã `paid`.
- [x] Để QR hết hạn 15 phút $\rightarrow$ Không mất đơn/món, bấm "Tạo mã QR mới" sinh được QR mới; bấm "Hủy đơn" hủy đơn sạch sẽ.
- [x] Bếp KDS nhận đơn đã `paid` $\rightarrow$ Đơn Tại bàn ấn Hoàn thành $\rightarrow$ Đơn Giao hàng ấn Giao Shipper chuyển `Đang giao`.
- [x] Admin ấn "Xác nhận giao xong" $\rightarrow$ Đơn chuyển `Hoàn thành`, khách thấy đơn hoàn tất.
- [x] Type-check `tsc --noEmit` và build production thành công 100%.
