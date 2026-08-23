# Báo Cáo Chuyển Giao: Vòng Đời Mã QR PayOS & Quy Trình Điều Phối Đơn Hàng (KDS - Shipper - Hoàn Thành)

**Ngày hoàn thành**: 23/08/2026  
**Người thực hiện**: Antigravity (AGY)  
**Trạng thái**: ⚠️ **ĐÃ TRIỂN KHAI HOÀN TẤT — CHỜ CODEX NGHIỆM THU**

---

## 1. Tổng Quan Kết Quả Đạt Được

| # | Hạng Mục Nghiệp Vụ | Trạng Thái Trước | Giải Pháp Đã Triển Khai & Kiểm Chứng | Trạng Thái |
|---|---|---|---|:---:|
| **1** | **Tự đóng mã QR khi chuyển khoản thành công** | Khách quét mã xong màn hình QR ở `/thanh-toan` không tự đóng ngay do phụ thuộc polling chậm; chưa có nút kiểm tra thủ công. | - Thêm nút **"🔍 Tôi đã chuyển khoản xong (Kiểm tra ngay)"**.<br>- Polling 3s phát hiện `payment_status === 'paid'` lập tức `clear()` giỏ hàng, xóa storage, toast thành công và `navigate` sang `/theo-doi-don?code=...`.<br>- Thêm endpoint test giả lập `POST /api/payments/payos/simulate-success` (kèm guard kép: `NODE_ENV !== 'production'` && `ENABLE_PAYOS_SIMULATOR === 'true'`). | ✅ **ĐÃ XỬ LÝ** |
| **2** | **Mã QR hết hạn & Tái tạo mã mới** | Hết 15 phút đơn bị tự động hủy và bắt khách phải chọn lại món từ đầu. | - Đơn giữ trạng thái `unpaid`, dùng `payment_expires_at < NOW()` để biểu thị hết hạn.<br>- Thêm API `POST /api/payments/payos/regenerate-qr` có kiểm tra ownership (JWT/cancel_token) và lock transaction `FOR UPDATE`.<br>- UI hiển thị 2 nút: **"🔄 Tạo mã QR thanh toán mới"** (gia hạn 15p mới) và **"🗑️ Hủy / Xóa đơn này"**. | ✅ **ĐÃ XỬ LÝ** |
| **3** | **Tinh gọn trang Theo dõi đơn (`theo-doi-don.tsx`)** | Vẫn hiện banner vàng "Đang chờ xác nhận thanh toán" và nút thanh toán dù đơn đã thanh toán hoặc đang chuẩn bị. | - Ẩn hoàn toàn banner vàng và nút thanh toán khi `payment_status === 'paid'` hoặc đơn đang ở bước pha chế/giao hàng.<br>- Hiển thị thanh tiến độ 3 bước chuẩn: **Đang chuẩn bị $\rightarrow$ Đang giao $\rightarrow$ Hoàn thành**. | ✅ **ĐÃ XỬ LÝ** |
| **4** | **Phân luồng Bếp KDS & Bàn giao Shipper** | Chưa phân biệt rõ ràng luồng hoàn thành giữa đơn Tại bàn (Take-away) và đơn Giao tận nơi (Delivery). | - **Tại bàn / Đến lấy**: Bếp ấn **"✅ Hoàn thành"** $\rightarrow$ Đơn về đích `Hoàn thành`.<br>- **Giao tận nơi**: Bếp ấn **"🚚 Pha xong ➔ Giao Shipper"** $\rightarrow$ Đơn chuyển sang `Đang giao`.<br>- Shipper giao xong $\rightarrow$ Admin ấn **"Xác nhận giao xong (Hoàn thành)"**. | ✅ **ĐÃ XỬ LÝ** |
| **5** | **Vận hành Render Cron & Chống Webhook Cũ** | Cron job trong `render.yaml` chỉ là comment; Webhook từ QR cũ có nguy cơ đổi trạng thái sai. | - Khai báo service `type: cron` trong `render.yaml` (`teaplus-payos-expiry-cron` chạy `*/5 * * * *`).<br>- Query lock và matching active `payos_order_code` / `payment_link_id` chặn triệt để webhook từ QR cũ. | ✅ **ĐÃ XỬ LÝ** |

---

## 2. Danh Sách Tệp Đã Tạo & Chỉnh Sửa

### Backend
1. `backend/repositories/postgres/payments.js` (Thêm hàm `renewPayOSOrderLink` với transaction lock `FOR UPDATE`, ownership check, và `simulatePaymentSuccess`).
2. `backend/routes/payments.js` (Thêm endpoint `POST /api/payments/payos/regenerate-qr` và `POST /api/payments/payos/simulate-success` kèm production guard).
3. `backend/test/payos-lifecycle.test.js` (Test suite kiểm thử hợp đồng vòng đời QR PayOS: 404 not found, 403 ownership, 400 cancelled/paid, atomic update, và reject old webhook).
4. `render.yaml` (Khai báo service cron `teaplus-payos-expiry-cron` chạy `node commands/expire-payos-orders.js` mỗi 5 phút).

### Frontend
1. `frontend/src/routes/thanh-toan.tsx` (Thêm nút kiểm tra tức thì, xử lý tự đóng QR khi `paid`, giao diện hết hạn với 2 nút tạo QR mới và hủy đơn).
2. `frontend/src/lib/mock-engine.ts` (Bổ sung mock cho `regenerate-qr` và `simulate-success` cho chế độ Standalone).
3. `frontend/src/routes/theo-doi-don.tsx` (Dọn sạch banner vàng khi đơn đã `paid`, tinh gọn tiến độ 3 bước).
4. `frontend/src/routes/admin.bep.tsx` (Đồng bộ nút Hoàn thành cho Take-away và nút Giao Shipper cho Delivery).
5. `frontend/src/routes/admin.don-hang.tsx` (Nút "Xác nhận giao xong (Hoàn thành)" khi đơn ở trạng thái Đang giao).

---

## 3. Kết Quả Kiểm Thử (Verification)

```bash
# 1. Backend Test Suite
$ npm test
ℹ tests 221 (60 suites)
ℹ pass 207
ℹ fail 0
ℹ skipped 14 (Live DB integration tests)
ℹ duration_ms 34039ms

# 2. Frontend Type Check
$ npx tsc --noEmit
✔ Exit Code: 0 (No TypeScript errors)

# 3. Frontend Vitest Suite
$ npm run test
 Test Files  3 passed (3)
      Tests  9 passed (9)
   Duration  27.77s

# 4. Frontend Production Build
$ npm run build
✓ 2125 modules transformed.
✓ built in 21.43s (client) + 3.42s (server)
✔ Exit Code: 0
```
