# Kế Hoạch Triển Khai: Giỏ Hàng Thông Minh (Phase 1 Implementation Plan)

**Mục tiêu**: Nâng cấp Giỏ hàng phân ngăn theo Chi nhánh chuẩn Shopee, hiển thị thời gian thêm món, checkbox chọn món thanh toán có chọn lọc và Modal chỉnh sửa tùy chọn món (Size, Topping, Đường, Đá, Ghi chú) trực tiếp trong giỏ cho cả Khách hàng và Admin POS.

---

### Task 1: Nâng cấp `CartItem` & State Management trong `frontend/src/lib/cart.tsx`
- [ ] Bổ sung các trường `branchId: number`, `branchName: string`, `addedAt: number`, `selected: boolean` vào `CartItem`.
- [ ] Cập nhật `addItem()`: Tự động gán `addedAt = Date.now()`, `selected = true`, `branchId` và `branchName` (lấy từ cửa hàng đang chọn).
- [ ] Triển khai hàm `updateItem(oldKey, updatedItem)`:
  - Tính toán `newKey` và `unitPrice` mới dựa trên các tùy chọn cập nhật.
  - Nếu `newKey` trùng với 1 món khác sẵn có trong giỏ ➔ Gộp số lượng (`qty`).
  - Nếu `newKey` khác ➔ Cập nhật đè lên vị trí món cũ, giữ nguyên `branchId`, `addedAt`, `selected`.
- [ ] Triển khai các hàm chọn lọc checkbox:
  - `toggleSelect(key: string)`
  - `toggleSelectBranch(branchId: number, selected: boolean)`
  - `toggleSelectAll(selected: boolean)`
  - `removeSelected()`
- [ ] Tính toán các giá trị phái sinh tự động:
  - `selectedItems`: Danh sách các món đang có `selected === true`.
  - `selectedCount`: Tổng số lượng các món đang được chọn.
  - `selectedSubtotal`: Tổng tiền các món đang được chọn.
  - `isAllSelected`: Boolean báo hiệu toàn bộ giỏ đang được chọn hay chưa.

---

### Task 2: Viết Unit Tests cho `cart.tsx` (`frontend/src/lib/cart.test.ts` / `frontend/src/lib/cart.test.tsx`)
- [ ] Test `addItem` gán đúng `addedAt`, `branchId`, `selected: true`.
- [ ] Test `updateItem` đổi Size / Topping / Đường / Đá (cập nhật key mới, đơn giá mới chính xác).
- [ ] Test `updateItem` tự gộp số lượng khi cấu hình mới trùng với món khác có sẵn.
- [ ] Test `toggleSelect`, `toggleSelectBranch`, `toggleSelectAll`, `removeSelected`.
- [ ] Test tính toán `selectedSubtotal` và `selectedCount`.

---

### Task 3: Xây dựng Component `EditCartItemModal.tsx` (`frontend/src/components/cart/EditCartItemModal.tsx`)
- [ ] Thiết kế Dialog nạp dữ liệu món hiện tại: Size (M/L/XL), Cốt trà, Đường, Đá, Danh sách Topping, Ghi chú.
- [ ] Tự động tính giá tạm tính thời gian thực khi khách bấm chọn thêm bớt topping hay đổi size.
- [ ] Nút "Lưu cập nhật" gọi `updateItem()` và hiển thị toast thông báo.
- [ ] Responsive tối ưu: hiển thị mượt mà trên cả Mobile, Tablet và Desktop.

---

### Task 4: Nâng cấp Giao diện Giỏ hàng `QuickCart` trong `frontend/src/components/site/Header.tsx`
- [ ] Header giỏ hàng: Checkbox "Chọn tất cả" + Nút "Xóa đã chọn".
- [ ] Phân nhóm danh sách món theo từng Chi nhánh cửa hàng (Store Groups).
- [ ] Thẻ món:
  - Checkbox riêng từng món.
  - Badge thời gian thêm món (`⏱️ 14:32 · Vừa xong`, `⏱️ 5 phút trước`, `⏱️ Hôm nay 10:15`...).
  - Nút **[✏️ Sửa tùy chọn]** kích hoạt `EditCartItemModal`.
  - Bộ tăng giảm số lượng và nút Xóa.
- [ ] Footer giỏ hàng: Hiển thị Tổng thanh toán theo `selectedSubtotal` và nút "Thanh toán ngay ({selectedCount})".

---

### Task 5: Tích hợp Nút ✏️ Sửa món trong Giỏ POS Thu Ngân (`frontend/src/routes/admin.pos.tsx`)
- [ ] Tích hợp nút **✏️ Sửa tùy chọn** trên từng món trong giỏ hàng POS (cả sidebar Desktop lẫn drawer Mobile).
- [ ] Mở `EditCartItemModal` cho phép thu ngân đổi nhanh size, topping, đường đá khi khách đổi ý.

---

### Task 6: Nâng cấp Trang Thanh toán (`frontend/src/routes/thanh-toan.tsx`)
- [ ] Sử dụng `selectedItems` để tạo đơn hàng.
- [ ] Hiển thị danh sách món được chọn phân theo chi nhánh và thời gian.
- [ ] Xử lý cảnh báo thân thiện nếu khách chọn món từ nhiều chi nhánh khác nhau.

---

### Task 7: Kiểm Thử Toàn Diện & Đóng Gói (Verification)
- [ ] Chạy `npx tsc --noEmit` (0 lỗi TypeScript).
- [ ] Chạy `npm test` (Tất cả test suites passed).
- [ ] Chạy `npm run build` (Build production thành công 100%).
