# 🍹 F&B Website Requirement Specification

> **Dự án:** Website Đặt Hàng Chuỗi Trà Trái Cây Tươi (TeaPlus)  
> **Mục tiêu:** Tối ưu trải nghiệm đặt món trực tuyến, cá nhân hóa ly trà, tối ưu chuyển đổi.
> **Phiên bản:** v4.0 — Chuẩn hóa theo yêu cầu giảng viên (05/08/2026): bỏ Kho/Nguyên liệu, Sự kiện, CRM, hạng Thành viên; bổ sung Quản lý Vị trí & QR Bàn, In Bill.

---

## 1. Quy Chuẩn Giao Diện User Khung Chứa & Responsive (Global Container Rules)

- **Max-Width Container Standard:**
  - Toàn bộ nội dung chính trên website (trừ các banner tràn màn hình) phải được gói gọn trong khung chứa chuẩn (`max-w-7xl` tương đương `1280px` - `1440px`), căn giữa màn hình (`margin: 0 auto`).
  - Đảm bảo nội dung không bị vỡ hay kéo dãn quá mức trên các màn hình độ phân giải siêu rộng (Ultrawide).
- **Padding An Toàn (Safe Zone):**
  - Luôn duy trì khoảng cách căn lề hai bên (`padding-x: 16px` đến `24px`) trên các thiết bị Mobile & Tablet để chữ và hình ảnh không chạm sát mép màn hình.
- **Bố Cục Tự Điều Chỉnh (Responsive Layout Rules):**
  - **Mobile:** Bố cục dạng 1 cột dọc (Single Column), ưu tiên thao tác bằng 1 tay.
  - **Tablet:** Bố cục linh hoạt 2 - 3 cột tùy mật độ thông tin.
  - **Desktop:** Bố cục dạng lưới (Grid) 3 - 4 cột cho danh sách sản phẩm, đảm bảo khoảng trắng (white space) thoáng đãng.

---

## 2. Sitemap (Sơ Đồ Website)

Home (Trang chủ)
├── Giới thiệu (Câu chuyện Trà & Trái cây tươi)
├── Menu (Thực đơn Trà Trái Cây & Đặt hàng)
├── Cửa hàng (Hệ thống chi nhánh & Định vị GPS)
├── Tuyển dụng (Tuyển dụng nhân sự)
├── Cart & Checkout (Giỏ hàng & Thanh toán)
└── Profile (Hồ sơ cá nhân)
├── Lịch sử đơn hàng & Tracking real-time
├── Danh sách Yêu thích (Wishlist)
└── Thông báo (Notifications)

---

## 3. Thành Phần Cố Định (Global Components)

### 3.1 Header & Navigation Bar (Sticky Header)

Hiển thị cố định ở đầu trang khi cuộn màn hình.

- **Bộ Chọn Chi Nhánh / Vị Trí (Branch / Address Selector):**
  - Cho phép người dùng chọn nhanh cửa hàng gần nhất hoặc nhập địa chỉ giao hàng ngay khi vào trang để hệ thống lọc đúng Menu & sản phẩm khả dụng.
- **Logo Thương Hiệu:** Click để quay về Trang chủ.
- **Thanh Tìm Kiếm (Search Bar):**
  - Hỗ trợ tìm theo: Tên món, Loại trà nền (Lục trà, Ô long), Loại trái cây (Xoài, Dâu, Cam, Sả, Đào, Vải...) hoặc Topping.
  - Tích hợp **Auto-Suggest**: Hiển thị gợi ý từ khóa hot và món bán chạy ngay khi click vào ô tìm kiếm.
- **Cụm Nút Hành Động (Action Icons):**
  - _Notification Icon:_ Mở danh sách thông báo (Voucher mới, Trạng thái đơn hàng).
  - _Wishlist Icon:_ Mở nhanh danh sách các món trà đã lưu yêu thích.
  - _Cart Icon:_ Hiển thị Badge số lượng món. Hover/Click để mở **Quick Cart Slide-over** (Xem danh sách món, tạm tính, nút chuyển nhanh đến Checkout).
  - _Profile Icon:_
    - Chưa đăng nhập -> Mở Popup Đăng nhập / Đăng ký (Số điện thoại + OTP / Google).
    - Đã đăng nhập -> Dropdown menu: Hồ sơ cá nhân | Lịch sử đơn hàng | Đăng xuất.
- **Tối Ưu Giao Diện Màn Hình Nhỏ (Mobile Navigation):**
  - Thu gọn thanh menu điều hướng chính vào nút **Hamburger Menu**.
  - Bổ sung **Mobile Bottom Sticky Bar**: Thanh thông báo giỏ hàng cố định ở đáy màn hình di động, hiển thị tổng tiền và nút thanh toán nhanh khi người dùng cuộn xem Menu.

### 3.2 Footer (Khung Container)

- **Thông tin thương hiệu:** Nguồn gốc trà, Giấy phép kinh doanh, Hotline CSKH, Email hỗ trợ.
- **Chính sách & Điều khoản:** Chính sách bảo mật, Điều khoản dịch vụ, Chính sách giao hàng & đổi trả.
- **Mạng xã hội & Khai báo:** Link Facebook Fanpage, Zalo OA, QR Code truy cập Zalo Mini App / Mobile App.

### 3.3 Nút Cố Định Móc Góc (Fixed Floating Widgets)

- Hotline gọi điện nhanh & Widget Chat trực tiếp (Zalo OA / Messenger).
- Nút Cuộn nhanh lên đầu trang (Back-To-Top).

---

## 4. Trang Chủ (Homepage)

### 4.1 Hero Banner (Carousel Slider - Full-width)

- Trình chiếu các chiến dịch Trà Trái Cây theo mùa (Seasonal Menu), bộ sưu tập món mới, chương trình ưu đãi nổi bật.
- Nút Call-To-Action (CTA): _"Đặt Món Ngay"_, _"Thử Món Mới"_.

### 4.2 Cam Kết Chất Lượng (Brand Story)

- Giới thiệu câu chuyện thương hiệu: Trà đậm vị pha chế trong ngày kết hợp với 100% trái cây tươi nhập mới mỗi ngày.
- Các chỉ số cam kết: _100% Trái cây tươi | Không chất bảo quản | Đạt chuẩn ATVSTP_.

### 4.3 Best Seller (Món Hot Trong Ngày)

- Hiển thị danh sách các món Trà Trái Cây được ưa chuộng nhất dưới dạng Lưới (Grid) hoặc Dải trượt (Carousel).
- Thông tin trên thẻ sản phẩm: Hình ảnh, Tên món, Loại trà nền, Giá bán, Đánh giá (Rating), Badge (`🔥 Best Seller`, `🍊 Hàng Mới`).

---

## 5. Trang Menu (Thực Đơn & Đặt Hàng)

### 5.1 Bố Cục & Cấu Trúc

- **Thanh Lọc Danh Mục (Filter Bar):**
  - _Lọc theo Dòng Trà:_ Trà Trái Cây Tươi, Trà Đậm Vị (Lục Trà / Ô Long), Trà Trái Cây Tuyết (Ice Blended), Hi-Tea Detox, Bánh Ngọt Ăn Kèm.
  - _Lọc theo Vị Trái Cây:_ Cam / Sả, Dâu / Nho, Đào / Vải, Xoài / Chanh Dây, Dưa Hấu / Táo.
- **Vùng Hiển Thị Sản Phẩm:**
  - Hiển thị dạng Card sản phẩm được sắp xếp gọn gàng trong khung Container.
  - Tự động giãn cột linh hoạt theo kích thước màn hình thiết bị đang truy cập.
- **Khung Tổng Quan Giỏ Hàng (Cart Overview):**
  - Hiển thị tóm tắt các món đã chọn (kèm tùy chọn đường, đá, topping) + Tổng giá tiền tạm tính.
  - Nút chuyển nhanh tới trang **Thanh Toán**.

### 5.2 Card Sản Phẩm (Product Card)

- **Nội dung hiển thị:**
  - Hình ảnh ly trà sắc nét.
  - Tên sản phẩm & Gợi ý loại Trà nền (vd: _Cốt Lục Trà Lài_).
  - Giá bán niêm yết.
  - Số lượt đánh giá & Tỷ lệ hài lòng.
  - Tag trạng thái (`🔥 Best Seller`, `🍊 Trái Cây Theo Mùa`, `✨ New`).
- **Nút hành động:**
  - Nút Yêu thích (Icon Trái tim).
  - Nút _Thêm nhanh_ (với tùy chọn mặc định).
  - Nút _Tùy chọn_ (Mở Popup Custom Món).

### 5.3 Popup Tùy Chỉnh Khẩu Vị Trà Trái Cây (Product Detail Popup)

Hiển thị Popup Modal giúp khách hàng điều chỉnh ly trà theo sở thích cá nhân:

- **Thông tin chi tiết:** Ảnh đại diện HD, Tên món, Mô tả hương vị (vd: _"Vị chua ngọt thanh mát từ dâu tây tươi hòa quyện cùng lục trà nhài thơm ngát"_), Lượng Calories ước tính.
- **Các tùy chọn chỉnh sửa (Customization):**
  - _Chọn Size (Radio Button):_ Size M (Chuẩn) / Size L (Lớn) [Hiển thị rõ số tiền chênh lệch].
  - _Chọn Cốt Trà Nền (Radio Button - Nâng cao):_ Lục Trà Lài / Trà Ô Long / Trà Đen.
  - _Mức Ngọt (Radio Button):_ 0% (Không đường) / 30% / 50% / 70% / 100% (Mặc định) / Ngọt tự nhiên từ trái cây.
  - _Mức Đá (Radio Button):_ Không đá / 30% / 50% / 70% / 100% (Mặc định) / Đá riêng.
  - _Topping Trái Cây & Thạch (Multi-select Checkbox):_ Trái cây dầm tươi, Thạch Nha Đam, Thạch Trái Cây, Trân Châu Trắng, Aloe Vera, Macchiato Kem Cheese... [Kèm giá tiền từng loại].
  - _Ghi chú cho Barista:_ Ô nhập văn bản tự do ngắn (vd: _"Cho nhiều đá hơn một chút", "Nhiều tép cam"_).
- **Điều chỉnh số lượng & Nút bấm:** Nút tăng/giảm số lượng `[-] 1 [+]` + Nút _"Thêm vào giỏ hàng - [Tổng tiền]"_.

---

## 6. Hệ Thống Cửa Hàng (Store Locator)

- **Bộ lọc Địa lý:** Lọc theo _Tỉnh / Thành phố_ -> _Quận / Huyện_.
- **Định vị GPS:** Nút _"Tìm chi nhánh gần tôi nhất"_ (Hệ thống yêu cầu quyền truy cập vị trí).
- **Bản đồ Tương tác:** Tích hợp Google Maps hiển thị các vị trí cửa hàng chính xác.
- **Thông tin Chi nhánh:** Địa chỉ chi tiết, Giờ mở cửa/đóng cửa, Hotline liên hệ, Danh sách tiện ích (Có chỗ đỗ ô tô, Có máy lạnh, Mua mang đi), Nút _"Chỉ đường"_ & Nút _"Đặt giao từ chi nhánh này"_.

---

## 7. Tuyển Dụng (Recruitment)

- **Danh sách vị trí:** Pha chế (Barista Trà Trái Cây), Thu ngân, Quản lý cửa hàng, Nhân viên Part-time.
- **Nội dung tuyển dụng:** Mô tả công việc (JD), Yêu cầu kinh nghiệm, Mức lương & Quyền lợi.
- **Form Nộp Hồ Sơ (Popup Form):**
  - Họ và tên, Số điện thoại, Email.
  - Lựa chọn Chi nhánh mong muốn làm việc.
  - Tải lên File CV (PDF/Word) hoặc dán đường dẫn hồ sơ online.

---

## 8. Voucher Giảm Giá % (Promotions)

> Theo yêu cầu giảng viên: **không làm Sự kiện marketing** (Flash Sale, Happy Hour, Combo...). Nếu cần chương trình, tạo **mã giảm giá % giới hạn** là đủ.

- **2 dạng mã voucher:**
  1. **Mã 1 lần sử dụng (Single-use):** Dùng 1 lần rồi vô hiệu (kiểm tra qua `voucher_usage_history`).
  2. **Mã theo thời hạn / giới hạn lượt dùng (Time-bounded):** Áp dụng trong khoảng `start_date` – `end_date`, giới hạn `usage_limit` lượt.
- **Cấu hình mã:** Mã voucher, % giảm (`discount_value`), mức giảm tối đa (`max_discount`), đơn tối thiểu (`min_order`), ngày bắt đầu/kết thúc.
- **Giao diện khách:** Ô nhập mã voucher % tại Checkout, phản hồi real-time số tiền được giảm.
- **Ghi chú:** Bảng `promotions`/`promotion_stores` giữ nguyên cấu trúc DB để mở rộng sau này.

---

## 9. Quét QR Bàn & Đặt Món Tại Bàn (QR Table Ordering)

> Theo yêu cầu giảng viên: **mỗi vị trí có mã QR riêng** — tạo vị trí để có QR, quét đường dẫn ra đặt hàng, gắn kèm ID vị trí vào đơn hàng.

- **Tạo vị trí & mã QR:** Admin tạo Bàn/Vị trí theo Chi nhánh (`/admin/vi-tri`) -> Hệ thống tự sinh `qr_code_token` ngẫu nhiên bảo mật -> Xem / Tải xuống / In bảng mã QR dán bàn.
- **Luồng khách hàng:**
  1. Quét QR tại bàn -> Mở URL `/menu?table_id=X` (kèm thông tin chi nhánh).
  2. Menu hiển thị banner: `📍 Bạn đang ngồi tại: Bàn 05 (Chi nhánh Q1)`.
  3. Đặt món như bình thường -> Khi thanh toán, đơn hàng tự gắn `table_id` + `location_name`.
- **Backend:** `GET /api/table/resolve` (giải mã `table_id`), `GET/POST/PUT/DELETE /admin/tables` (CRUD bàn).

---

## 10. Thanh Toán & Theo Dõi Đơn Hàng (Checkout & Tracking)

### 10.1 Trang Thanh Toán (Checkout Page)

- **Hình thức nhận hàng:** `Giao tận nơi (Delivery)` OR `Đến lấy tại cửa hàng (Take-away)` OR `Tại bàn (POS - từ QR Bàn)`.
- **Thông tin người nhận:** Họ tên, Số điện thoại, Địa chỉ giao hàng chi tiết, Ghi chú cho tài xế giao hàng.
- **Voucher giảm giá %:** Ô nhập mã voucher với phản hồi real-time số tiền giảm (2 dạng: mã 1 lần / mã thời hạn — xem Phần 8).
- **Phương thức thanh toán:**
  - Thanh toán khi nhận hàng (COD).
  - Chuyển khoản nhanh qua mã VietQR / VNPAY.
  - Ví điện tử: MoMo, ZaloPay.
- **Xác nhận đơn hàng:** Hiển thị tổng chi tiết: _Tiền món + Phí giao hàng - Giảm giá = Tổng thanh toán_.

### 10.2 Theo Dõi Đơn Hàng Real-time (Order Tracking)

Hiển thị thanh tiến trình đơn hàng trực quan qua 5 bước:

1. `Chờ xác nhận` (Hệ thống đã nhận đơn)
2. `Đã xác nhận` (Cửa hàng đã chấp nhận đơn)
3. `Đang chuẩn bị` (Barista đang chuẩn bị trà trái cây)
4. `Đang giao` (Shipper đang trên đường giao)
5. `Hoàn thành` (Đơn hàng đã giao thành công) / `Đã hủy`

---

## 11. Profile Cá Nhân (User Profile)

- **Thông tin chung:** Họ tên, Số điện thoại, Email cá nhân, Danh sách địa chỉ giao hàng đã lưu.
- **Lịch sử đơn hàng (Order History):**
  - Danh sách các đơn hàng đã đặt trong quá khứ (kèm chi tiết các món đã tùy chọn).
  - Nút **"Đặt lại đơn này" (Re-order):** Cho phép thêm nhanh toàn bộ món trong đơn cũ vào giỏ hàng hiện tại chỉ với 1-click.
- **Đánh giá & Review:** Cho phép đánh giá số sao ⭐, viết cảm nhận và tải lên ảnh ly trà thực tế sau khi hoàn thành đơn hàng.
- **Danh sách Yêu thích (Wishlist):** Quản lý và xem lại các món Trà Trái Cây đã thả tim.

---

# 🍹 F&B Admin Dashboard - Software Requirement Specification (SRS)

> **Dự án:** Hệ Thống Quản Trị Website & Chuỗi Cửa Hàng Nước Ép & Trái Cây Tươi  
> **Phiên bản:** v4.0 (Production-Ready SRS) — Chuẩn hóa theo yêu cầu giảng viên (05/08/2026): bỏ Kho/Nguyên liệu, CRM, Sự kiện; bổ sung Quản lý Vị trí & QR Bàn, In Bill.  
> **Phạm vi:** Dành cho Super Admin, Quản lý chi nhánh (Store Manager), Nhân viên sơ chế/chế biến (KDS View) và Thu ngân.

---

## 1. Quy Chuẩn Giao Diện Admin (Admin UI/UX Rules)

- **Bố cục chính (Dashboard Layout):**
  - **Sidebar (Thanh điều hướng trái):** Cố định (Fixed), chứa danh sách các Module quản lý. Cho phép thu gọn (Collapse) để tối ưu diện tích hiển thị.
  - **Top Navbar (Thanh công cụ trên):** Hiển thị bộ chọn Chi nhánh hoạt động (Branch Switcher), Trung tâm thông báo (Notification Center), Tìm kiếm nhanh & Hồ sơ Admin.
  - **Main Content Area (Vùng nội dung):** Áp dụng khung chứa chuẩn `max-w-7xl` hoặc `full-width padding-x: 24px`, căn giữa, không đè lấp thông tin.
- **Quyền truy cập (RBAC - Role-Based Access Control):**
  - `Super Admin`: Toàn quyền quản trị toàn hệ thống.
  - `Store Manager`: Quản lý đơn hàng, bàn, nhân sự và doanh thu của chi nhánh được phân quyền.
  - `Kitchen Staff`: Màn hình nhận đơn & sơ chế/chế biến tại quầy (KDS Mode).
  - `Cashier Staff`: Màn hình ghi nhận đơn tại quầy (POS Mode).

---

## 2. Sitemap Trang Admin (Admin Sitemap)

Dashboard (Tổng quan)
├── 1. Quản lý Đơn hàng (Orders Management)
│ ├── Danh sách Đơn hàng & Bộ lọc nâng cao
│ ├── Màn hình Bếp & Sơ chế (Kitchen Display System - KDS)
│ └── In hóa đơn nhiệt K80/K57 (Thermal Bill)
├── 2. Quản lý Thực đơn (Menu Management)
│ └── CRUD Danh mục & CRUD Sản phẩm
├── 3. Quản lý Vị trí & Mã QR Bàn (Tables & QR)
│ ├── Danh sách Bàn/Vị trí theo Chi nhánh
│ └── Sinh mã QR, Xem / Tải xuống / In bảng mã QR dán bàn
├── 4. Quản lý Hệ thống Cửa hàng (Stores)
│ ├── Danh sách chi nhánh & Giờ mở cửa
│ └── Bật/Tắt hoạt động từng cơ sở
├── 5. Quản lý Khuyến mãi & Voucher (Promotions)
│ └── Voucher giảm giá %: Mã 1 lần (Single-use) | Mã thời hạn / giới hạn lượt dùng
├── 6. Báo cáo & Thống kê Tinh gọn (Analytics & Reports)
│ ├── Doanh thu (Theo thời gian / Chi nhánh / PTTT)
│ ├── Top 10 món bán chạy & Chỉ số AOV
│ └── Export báo cáo Excel / PDF
├── 7. Trung tâm Thông báo (Notification Center)
│ └── Đơn mới, Voucher hết hạn, Lỗi hệ thống
└── 8. Cài đặt Hệ thống (System Settings)
├── Quản lý Tài khoản & Phân quyền nội bộ
├── Thông tin Thương hiệu & Khu vực giao hàng
├── Cấu hình API VietQR / MoMo / ZaloPay
└── Nhật ký Hoạt động (Audit Log)

---

## 3. Chi Tiết Các Module Chức Năng

### 3.1 Dashboard Tổng Quan (Overview)

- **Chỉ số Tài chính & Vận hành Real-time (KPI Cards):**
  - Doanh thu tạm tính (VNĐ) | Số đơn hoàn thành | Tỷ lệ hủy đơn (%) | Tổng số phần/ly đã bán.
  - **Chỉ số Vận hành khẩn cấp:** Món đang tạm ngưng bán | Số đơn đang chuẩn bị | Số đơn giao trễ.
- **Biểu đồ Doanh thu theo giờ:** Theo dõi biến động doanh thu theo khung giờ trong ngày (dự đoán Peak Hour).
- **Cảnh báo nhanh (Quick Alerts):** Nhấp trực tiếp vào cảnh báo để chuyển tới module xử lý.

---

### 3.2 Quản Lý Đơn Hàng & Màn Hình Bếp (Orders & KDS)

#### A. Danh sách đơn hàng & Bộ lọc Nâng cao (Order List)

- Hiển thị danh sách dạng **List View** hoặc **Kanban Board** (`Chờ xác nhận` -> `Đang chuẩn bị` -> `Đang giao` -> `Hoàn thành`).
- **Bộ lọc đa điều kiện:**
  - _Lọc theo Chi nhánh:_ Chọn 1 hoặc tất cả cơ sở.
  - _Lọc theo Khoảng thời gian:_ Theo ngày/giờ cụ thể.
  - _Lọc theo Trạng thái:_ Chờ xác nhận, Đang chuẩn bị, Đang giao, Complete, Canceled.
  - _Lọc theo Loại đơn:_ Delivery (Giao tận nơi), Take-away (Đến lấy), POS (Tại quầy).
  - _Lọc theo PTTT:_ COD, VietQR, MoMo, ZaloPay.
- Xem chi tiết sản phẩm & tùy chọn custom (Size, Cốt trà, Độ ngọt, Đá, Topping).

#### B. Màn hình Sơ chế / Chế biến (Kitchen Display System - KDS)

Giao diện thẻ kích thước lớn dành cho nhân viên bếp, hiển thị **Màu Trạng Thái Trực Quan**:

- 🟡 **Chờ làm (Màu Vàng):** Đơn mới chuyển xuống bếp.
- 🔵 **Đang chuẩn bị (Màu Xanh Dương):** Nhân viên đang ép nước / cắt trái cây / đóng gói.
- 🟢 **Hoàn thành (Màu Xanh Lá):** Đã đóng gói xong, sẵn sàng giao cho tài xế/khách.
- 🔴 **Quá thời gian (Màu Đỏ):** Đơn chuẩn bị vượt quá 15 phút (Cảnh báo ưu tiên làm trước).

---

### 3.3 Quản Lý Thực Đơn (Menu Management)

- **CRUD Danh mục:** Thêm, sửa, xóa, ẩn/hiện danh mục (Nước ép, Trái cây tô, Nước ngọt...).
- **CRUD Sản phẩm:**
  - Quản lý thông tin chi tiết: Tên, Mô tả, Giá bán, Danh mục, Tải lên nhiều hình ảnh (Gallery).
  - Cấu hình SEO Slug tự động cho sản phẩm trên Website public.
  - Sắp xếp thứ tự hiển thị (Drag & Drop sorting) trên giao diện khách hàng.
  - **Ẩn/Hiện sản phẩm nhanh:** Bật/tắt trạng thái kinh doanh của sản phẩm.
- **Cấu hình Option Customize:** Quản lý nhóm tùy chọn khớp schema hiện có — Size (`size_options`), Cốt trà nền (`base_options`), Mức đường (`sugar_options`), Mức đá (`ice_options`), Topping (`toppings`).

---

### 3.4 Quản Lý Vị Trí & Mã QR Bàn (Tables & QR Management)

> Theo yêu cầu giảng viên: quản lý vị trí để tạo mã QR riêng cho mỗi điểm đến, scan ra đường dẫn đặt hàng gắn kèm ID vị trí.

- **Danh sách Bàn/Vị trí theo Chi nhánh:** Hiển thị tên bàn, chi nhánh, trạng thái hoạt động (`is_active`).
- **Tạo Bàn mới:** Modal nhập tên vị trí + chọn chi nhánh -> Hệ thống tự sinh `qr_code_token` ngẫu nhiên bảo mật (không trùng lặp).
- **Xem / Tải xuống / In mã QR:** Giao diện hiển thị mã QR dán bàn (kèm tên bàn, chi nhánh), nút tải file ảnh hoặc in trực tiếp.
- **URL QR:** `https://<domain>/menu?table_id=X` — khi quét sẽ vào trang Menu với banner vị trí bàn.

### 3.5 Quản Lý Khuyến Mãi & Voucher % (Promotions)

> Theo yêu cầu giảng viên: **không làm các loại khuyến mãi marketing phức tạp** (Flash Sale, Happy Hour, Combo, Mua 2 tặng 1...). Chỉ giữ **Voucher giảm giá theo %** với 2 dạng mã.

- **Cấu hình Voucher giảm giá %:**
  - Mã voucher (`code`), Phần trăm giảm (`discount_value`), Mức giảm tối đa (`max_discount`), Đơn tối thiểu (`min_order`), Ngày bắt đầu/kết thúc (`start_date`, `end_date`).
- **2 dạng mã (phân loại qua `voucher_type`):**
  1. **Mã 1 lần sử dụng (`single_use`):** Mỗi khách chỉ dùng 1 lần — kiểm tra qua bảng `voucher_usage_history`.
  2. **Mã thời hạn / giới hạn lượt dùng (`time_bounded`):** Áp dụng trong khoảng thời gian, giới hạn tổng lượt dùng (`usage_limit`, `used_count`).
- **Không cần sự kiện:** Nếu cần chương trình thời điểm, tạo mã giới hạn là đủ.

---

### 3.6 Báo Cáo & Thống Kê Tinh Gọn (Analytics & Reports)

> Theo yêu cầu giảng viên: **báo cáo để và làm gọn** — không phân tích nguyên liệu/khâu sơ chế.

- **Báo cáo Doanh thu:** Theo khung giờ trong ngày, theo ngày/tháng, theo từng Chi nhánh, theo Phương thức thanh toán và theo Danh mục sản phẩm.
- **Phân tích Sản phẩm:** Top 10 món bán chạy, Top Voucher được sử dụng nhiều nhất.
- **Chỉ số Vận hành (Operational KPIs):**
  - Giá trị đơn hàng trung bình (Average Order Value - AOV).
  - Tỷ lệ khách hàng quay lại (Customer Retention Rate).
- **Xuất báo cáo:** Trích xuất dữ liệu định dạng Excel / PDF.

---

### 3.7 Trung Tâm Thông Báo (Notification Center)

- **Phân loại Thông báo Hệ thống (Real-time Push & Badge):**
  - _Đơn hàng mới:_ Chuông cảnh báo có đơn online mới phát sinh.
  - _Voucher sắp hết hạn / Hết lượt dùng._
  - _Nhân viên mới:_ Thông báo yêu cầu duyệt tài khoản nội bộ.
  - _Lỗi thanh toán:_ Cảnh báo khi giao dịch cổng thanh toán gặp sự cố.

---

### 3.8 Cài Đặt Hệ Thống & Quản Trị (System Settings)

- **Thông tin Thương hiệu & Cửa hàng:** Cấu hình Logo, Màu sắc thương hiệu, Hotline, Email CSKH, Cấu hình % thuế VAT.
- **Quản lý Khu vực & Phí Ship:** Cấu hình bán kính giao hàng, bảng phí ship theo km (Tích hợp Google Maps API).
- **Quản lý Cổng Thanh toán:** Cấu hình API Key cho VietQR, MoMo, ZaloPay.
- **Nhật ký Hoạt động (Audit Log):**  
  Ghi lại chi tiết mọi thao tác quan trọng trên Admin: _Người thực hiện (User) | Thao tác (Hành động) | Nội dung thay đổi (Before/After) | Thời gian | Địa chỉ IP | Thiết bị_.

---

### 3.9 In Hóa Đơn Nhiệt K80/K57 (Thermal Bill Printing)

> Theo yêu cầu giảng viên: **thực đơn/hóa đơn in như máy in nhiệt** — mẫu HTML gọi máy in để in.

- **Mẫu In Bill (`InBillModal.tsx`):** Mẫu in hóa đơn nhiệt chuẩn K80/K57 dạng HTML với CSS `@media print`:
  - Logo thương hiệu, Mã đơn (`order_code`), Tên bàn/vị trí (`location_name`), Ngày giờ.
  - Danh sách món: Tên món, Size, Cốt trà, Đường/Đá, Toppings, Số lượng, Line total.
  - Tổng tiền: Subtotal, Giảm giá (Voucher %), Total.
  - Mã QR đơn hàng (khách quét để xem trạng thái).
- **Nút in 1-click:** Đính kèm tại Màn hình Bếp (KDS) & Chi tiết Đơn hàng Admin.
- **Backend Print Tracking:** Cập nhật `is_printed = 1` khi in hóa đơn.
