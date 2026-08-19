# Kế hoạch Triển khai Ứng dụng Di động TeaPlus Khách hàng (React Native / Expo)

> **Dự án:** TeaPlus Customer Mobile App  
> **Tài liệu thiết kế:** `docs/superpowers/specs/2026-08-19-mobile-app-customer-expo-design.md`  
> **Ngày lập:** 19/08/2026  
> **Trạng thái:** Sẵn sàng thực thi

---

## Danh sách Công việc Cụ thể (Action Items)

### Task 1: Khởi tạo Project Expo & Cấu hình Nền tảng
- [ ] Khởi tạo thư mục `mobile/` với Expo SDK 52 (TypeScript, Expo Router).
- [ ] Cài đặt các thư viện cốt lõi:
  - `@tanstack/react-query`, `axios`, `zustand` (State & Data fetching)
  - `nativewind`, `tailwindcss` (Styling & Theme)
  - `lucide-react-native`, `react-native-svg` (Icons)
  - `expo-camera`, `expo-secure-store`, `expo-linking`, `expo-image`
- [ ] Cấu hình Theme màu sắc chuẩn TeaPlus: Primary cam `#f97316`, Accent xanh `#22c55e`, Background ấm `#fffbeb`.
- [ ] Tạo API Client kết nối trực tiếp đến Backend PostgreSQL.

### Task 2: Xây dựng Màn hình Trang Chủ & Thực Đơn
- [ ] Màn hình Home: Header chi nhánh gần nhất, Banner khuyến mãi, danh mục Best-seller.
- [ ] Màn hình Menu: Danh mục tab cuộn mượt mà, phân trang sản phẩm theo loại trà.
- [ ] Modal Tùy biến món (Product Customizer Sheet): Chọn size, lượng đường, lượng đá, chọn đế trà, thêm topping.
- [ ] Store Giỏ hàng (Cart Store) lưu trữ offline bằng Zustand.

### Task 3: Tính năng Quét QR Bàn & Đặt Món tại Quán
- [ ] Tích hợp `expo-camera` vào tab Quét QR (`scan.tsx`).
- [ ] Phân giải mã bàn từ URL QR qua API `GET /api/table/resolve`.
- [ ] Tự động chuyển mode `DineIn` và khóa vị trí bàn vào giỏ hàng.

### Task 4: Màn hình Thanh toán & Tích hợp VietQR PayOS
- [ ] Màn hình Checkout: Chọn giao hàng tận nơi (Delivery) hoặc tại bàn (DineIn).
- [ ] Nhập mã voucher & gọi API kiểm tra giảm giá `POST /api/vouchers/apply`.
- [ ] Tích hợp VietQR: Hiển thị mã QR PayOS và nút Deeplink mở ứng dụng ngân hàng tự động.

### Task 5: Theo dõi Đơn hàng & Thẻ Thành viên Số
- [ ] Màn hình Live Order Tracking với timeline 4 bước trực quan.
- [ ] Thẻ thành viên số: Hiển thị mã Barcode/QR cá nhân để tích điểm tại máy POS.
- [ ] Kho Voucher cá nhân & danh sách món yêu thích (Wishlist).

---

## Minh chứng Kiểm thử & Nghiệm thu
1. Khởi chạy app trên máy ảo hoặc thiết bị thật qua Expo Go.
2. Tạo thử 1 đơn hàng từ Mobile App ➔ Xác nhận đơn xuất hiện tức thì trên màn hình Bếp KDS và Thu ngân POS của Web.
3. Quét thử mã QR bàn ➔ Nhận diện đúng bàn và chi nhánh.
