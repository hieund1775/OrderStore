# Báo Cáo Kiến Trúc Thiết Kế Lại & Nâng Cấp Hệ Thống Catalog Đa Ngành
*(Comprehensive Catalog V2 Redesign & Multi-Category Architecture Handover for Codex)*

**Người chỉ đạo & duyệt kiến trúc:** Đại ca (Tech Lead / Product Owner)  
**Người thực hiện & lập báo cáo:** Antigravity (Pair Programming Assistant)  
**Đối tượng bàn giao & kế thừa:** Codex & Đội ngũ Kỹ thuật  
**Thời gian hoàn thành:** 30/08/2026  
**Trạng thái hệ thống:** ✅ Hoàn thành 100%, 74 Backend Tests & 90 Frontend Tests PASS, SSR Build thành công, đã push lên `Hieu`, `develop`, `main`.

---

## 1. Bối Cảnh & Vấn Đề Gốc Của Hệ Thống Cũ (Root Problems & Context)

1. **Dữ liệu Database cũ là Danh mục phẳng (`depth = 0`, `parent_id = null`)**:
   - Ban đầu cơ sở dữ liệu chỉ lưu danh mục 1 cấp (Ví dụ: `Trà Trái Cây Tươi`, `Trà Sữa`, `Nước Ép` đều có `parent_id = null`).
   - Khi chuyển sang Catalog V2 đa ngành, logic lọc cũ chỉ tìm con (`parent_id IS NOT NULL`) làm admin không nhìn thấy được dữ liệu cũ và khách hàng không thấy menu.
2. **Giao diện Admin phân mảnh, chật hẹp & lộ thông tin kỹ thuật**:
   - Giao diện cũ chia 3 cột hẹp trên một màn hình khiến bảng danh mục, sản phẩm và tùy chọn bị co cụm, khó thao tác.
   - Hiển thị các trường kỹ thuật như `slug-url`, `schema_id` gây rối mắt cho người quản trị cửa hàng.
   - Lỗi khi tạo sản phẩm: *"Sản phẩm Catalog V2 phải gắn với một schema đã xuất bản"* do danh mục chưa gán schema thủ công.
   - Form sản phẩm đặt khung ảnh ở dưới, có ô mô tả món không cần thiết, giá bán không có bước nhảy chuẩn.
3. **Cấu trúc Tùy chọn (Options/Modifiers) chưa phân tách rõ ràng**:
   - Các tùy chọn không tiền (Đá, Đường) và có tiền (Topping, Size) bị gộp chung, không phân định được quy tắc chọn 1 hay chọn nhiều.
   - Chưa có cơ chế cấu hình mặc định riêng cho các món đặc biệt (ví dụ: món thập cẩm có sẵn full topping và đá 70%).
4. **Trang Thực đơn Khách hàng (`/menu`) bị tràn ngang và lộ mã lỗi**:
   - Thanh chọn danh mục để ngang dài tràn màn hình, có icon File không phù hợp.
   - Lỗi gọi API thiếu tiền tố `/api` làm bung lỗi `Route /catalog/sections not found` ra màn hình khách hàng.

---

## 2. Ý Tưởng Tái Cấu Trúc Toàn Diện Của Đại Ca (Architecture Redesign)

Đại ca đã chỉ đạo tái cấu trúc toàn diện theo tư duy **Giao diện 3 Khối Tab Toàn Diện (Full-width 3-Tab View)** và chuẩn hóa trải nghiệm người dùng:

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ TOP HEADER: Bộ Chọn Danh Mục Gốc (Nước uống, Quần áo...) | ✏️ Sửa Tên | 🗑️ Xóa Danh Mục │
├───────────────────────────────────────────────────────────────────────────────────────┤
│ [ Tab 1: 📁 Danh Mục Con ]  |  [ Tab 2: 🛍️ Quản Lý Sản Phẩm ]  |  [ Tab 3: ⚙️ Tùy Chọn ]   │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.1. Top Header: Quản Lý Danh Mục Gốc (Root Categories)
- **Dropdown chọn Danh mục gốc**: Chọn nhanh giữa *Tất cả danh mục* hoặc từng ngành cụ thể (`Nước uống`, `Quần áo & Merch`...).
- **Nút `+ Tạo ngành hàng gốc`**: Mở modal tạo danh mục cấp cao nhất (`parent_id = null`).
- **Nút `✏️ Sửa tên ngành` & `🗑️ Xóa ngành`**:
  - Cho phép sửa tên danh mục gốc trực tiếp.
  - Xóa danh mục gốc an toàn (tự động chặn nếu danh mục gốc còn chứa danh mục con hoặc sản phẩm).

---

### 2.2. Tab 1: 📁 Danh Mục Con (Subcategories)
- **Bảng danh sách Danh mục con trực thuộc ngành đang chọn**:
  - Hiển thị tên danh mục con, số lượng món, khu vực xử lý mặc định (`🍳 Quầy Bếp / Pha chế` hoặc `📦 Soạn / Đóng gói`).
  - Giao diện tinh gọn, loại bỏ các dòng mô tả dài dòng không cần thiết.
- **Trạng thái & Cơ Chế Liên Kết Tự Động (Cascading Status)**:
  - Trạng thái hiển thị chuẩn: `🟢 Đang hoạt động` / `🔴 Tạm ngưng` (bỏ chữ Tạm ẩn).
  - **Cơ chế liên kết 2 chiều**:
    - Khi Admin bấm **`Tạm ngưng`** một danh mục con &rarr; Toàn bộ sản phẩm bên trong danh mục con này **tự động chuyển sang Tạm ngưng** (`is_available = false`, `status = 'inactive'`).
    - Khi Admin bấm **`Mở bán`** lại danh mục con (hoặc mở bán 1 món bất kỳ) &rarr; Tự động kích hoạt lại danh mục con cha.
- **Thao tác**: Nút `Tạm ngưng / Mở bán`, `Sửa`, `Xóa` và `+ Thêm Danh Mục Con`.

---

### 2.3. Tab 2: 🛍️ Quản Lý Sản Phẩm (Products)
- **Bộ lọc Dropdown Danh mục con**: Lọc nhanh danh sách món theo từng danh mục con hoặc xem tất cả món thuộc ngành.
- **Bảng dữ liệu sản phẩm**:
  - Hiển thị ảnh món, tên món, trà nền, giá bán, khu vực xử lý và trạng thái (`🟢 Đang bán` / `🔴 Tạm ngưng`).
  - Hiển thị 100% toàn bộ sản phẩm cũ và mới trên Database.
- **Thao tác nhanh**:
  - Nút **`Tạm ngưng / Mở bán`** (toggle tức thì).
  - Nút **`Sửa`** món.
  - Nút **`Xóa`** món (kèm hộp thoại xác nhận).
- **Form Tạo / Sửa Món Tinh Gọn ([`admin.catalog.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/routes/admin.catalog.tsx))**:
  - **Khung Ảnh ở TRÊN CÙNG**: Hỗ trợ nút `Tải ảnh từ máy` (chọn file từ thiết bị, đọc thành Data URL 2MB) hoặc dán link URL, kèm xem trước ảnh to rõ và nút `Xóa ảnh`.
  - **Tên món & Danh mục con**: Bắt buộc nhập.
  - **Giá bán (VNĐ)**: Bắt buộc nhập, nút bấm tăng/giảm nhảy đúng **1.000đ** (`step={1000}`).
  - **BỎ hoàn toàn ô Mô tả món**: Giúp thêm món cực nhanh.
  - Bỏ nút `Làm mới` thừa ở topbar và bỏ các text/thuật ngữ kỹ thuật DB.

---

### 2.4. Tab 3: ⚙️ Cấu Hình Tùy Chọn 3 Block Độc Lập ([`CatalogOption3BlocksEditor.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/components/admin/catalog/CatalogOption3BlocksEditor.tsx))
Đại ca chỉ đạo phân tách rõ ràng cấu trúc Tùy chọn thành **3 Block độc lập**, áp dụng cô lập cho từng danh mục con:

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ TAB 3: CẤU HÌNH TÙY CHỌN CHO DANH MỤC CON                                                                │
├───────────────────────────────┬───────────────────────────────┬───────────────────────────────────────────┤
│ 🧊 BLOCK 1: KHÔNG TỐN TIỀN    │ 💰 BLOCK 2: CÓ TÍNH TIỀN      │ 🎯 BLOCK 3: CẤU HÌNH RIÊNG CHO SẢN PHẨM   │
│ (Chọn 1 trong nhóm - Single)  │ (Chọn nhiều loại - Multi)     │ (Mặc định có sẵn cho từng món cụ thể)     │
├───────────────────────────────┼───────────────────────────────┼───────────────────────────────────────────┤
│ • Mức Đá: 100%, 70%, 50%, 0%  │ • Topping: Trân châu (+5k),   │ • Chọn món: Trà Sữa Thập Cẩm              │
│ • Mức Đường: 100%, 70%, 50%   │   Thạch (+3k), Pudding (+8k)  │ • Thiết lập mặc định:                     │
│ • Nhiệt độ: Lạnh, Nóng        │ • Size Ly: Size L (+7k),      │   - Mặc định sẵn Trân châu + Thạch        │
│                               │   Size XL (+12k)              │   - Mặc định sẵn Đá 70%                   │
│ [ + Thêm Nhóm Không Tiền ]    │ [ + Thêm Nhóm Có Tiền ]       │ [ Lưu Cấu Hình Riêng Cho Món ]            │
└───────────────────────────────┴───────────────────────────────┴───────────────────────────────────────────┘
```

1. **🧊 Block 1: Tùy Chọn Không Tiền (Chọn 1 trong nhóm - Single select)**:
   - Áp dụng cho các nhóm lựa chọn không tốn thêm tiền (+0đ).
   - Khách chỉ được chọn 1 mức duy nhất trong nhóm (VD: chọn 70% Đá thì không chọn 100% Đá).
   - Có nút **`+ Thêm Nhóm Không Tiền`** để tạo nhanh nhóm mới và bật áp dụng.
2. **💰 Block 2: Tùy Chọn Có Tiền (Chọn nhiều loại / Phụ thu - Multi-select)**:
   - Áp dụng cho các nhóm có phụ thu tiền (kèm giá từng món).
   - Khách có thể chọn nhiều loại cùng lúc (VD: vừa chọn Trân châu đen +5.000đ, vừa chọn Pudding +8.000đ).
   - Có nút **`+ Thêm Nhóm Có Tiền`** để tạo nhanh nhóm mới và bật áp dụng.
3. **🎯 Block 3: Cấu Hình Riêng Cho Sản Phẩm Cụ Thể (Product Preset / Override)**:
   - Cho phép chọn 1 món cụ thể thuộc danh mục này (VD: *Trà Sữa Thập Cẩm*).
   - Áp dụng các nhóm từ Block 1 và Block 2 thành các giá trị mặc định có sẵn cho món đó mà không làm ảnh hưởng đến các món khác trong danh mục.

---

### 2.5. Tối Ưu Bộ Lọc Trang Thực Đơn Khách Hàng ([`CategorySelector.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/components/catalog/CategorySelector.tsx))
- **Bỏ icon File**: Loại bỏ hoàn toàn các icon file/folder không cần thiết.
- **Đổi "Ngành hàng" thành "Danh mục"**:
  - Không để dạng thanh ngang dài tràn màn hình.
  - Thiết kế thành **2 Dropdown Bộ lọc gọn gàng**:
    - **Dropdown 1**: `Danh mục:` (`Tất cả danh mục`, `Nước uống`, `Quần áo & Merch`...).
    - **Dropdown 2**: `Danh sách danh mục:` (`Tất cả món trong danh mục`, `Trà sữa`, `Nước ép`...).
- **Ẩn thông tin lỗi kỹ thuật ([`menu.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/routes/menu.tsx))**:
  - Khi có sự cố mạng, hiển thị thông báo thân thiện: *"Không thể tải danh mục sản phẩm lúc này. Vui lòng thử lại sau."*, tuyệt đối không để lộ mã lỗi hay đường dẫn route.

---

## 3. Chi Tiết Các File & Thành Phần Triển Khai Trong Codebase

### 3.1. Backend (`backend/`)
- [`backend/app.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/app.js): Mount alias fallback `app.use('/catalog', publicCatalogV2Router)` bên cạnh `app.use('/api', publicRoutes)`.
- [`backend/repositories/postgres/admin-catalog-v2.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/repositories/postgres/admin-catalog-v2.js): Tự động phân giải Schema nhiều tầng (Category &rarr; Ancestors &rarr; Fallback default schema), tự động gán defaults (`fulfillment_lane = 'kitchen'`, `stock_mode = 'made_to_order'`), loại bỏ triệt để lỗi tạo sản phẩm.
- [`backend/repositories/postgres/catalog-v2.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/repositories/postgres/catalog-v2.js) & [`backend/dto/catalog-v2-dto.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/dto/catalog-v2-dto.js): Bổ sung `default_fulfillment_lane` vào truy vấn SQL và DTO mapper.
- [`backend/database/postgres/migrations/0018_fulfillment_and_scope_hardening.sql`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/database/postgres/migrations/0018_fulfillment_and_scope_hardening.sql): Đảm bảo toàn vẹn DB constraints, foreign key restrict và audit triggers mà không làm thay đổi checksum của migration 0016 và 0017 trên Render.

### 3.2. Frontend (`frontend/`)
- [`frontend/src/components/admin/catalog/CatalogOption3BlocksEditor.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/components/admin/catalog/CatalogOption3BlocksEditor.tsx) *(MỚI)*: Component quản lý 3 Block Tùy chọn độc lập: Block 1 (Không tiền), Block 2 (Có tiền), Block 3 (Cấu hình riêng món).
- [`frontend/src/components/admin/catalog/CatalogTabBlocksView.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/components/admin/catalog/CatalogTabBlocksView.tsx): Giao diện 3 Tab toàn diện, tích hợp cơ chế tạm ngưng liên kết sản phẩm, xóa món và lọc danh mục con.
- [`frontend/src/components/admin/catalog/CatalogRootSelector.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/components/admin/catalog/CatalogRootSelector.tsx): Bộ chọn ngành gốc tích hợp nút `✏️ Sửa tên ngành` và `🗑️ Xóa ngành`.
- [`frontend/src/routes/admin.catalog.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/routes/admin.catalog.tsx): Trang quản trị catalog chính với modal tạo món (khung ảnh ở trên cùng, upload trực tiếp từ máy, giá step 1000, bỏ ô mô tả, bỏ nút làm mới).
- [`frontend/src/components/catalog/CategorySelector.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/components/catalog/CategorySelector.tsx): Bộ lọc 2 tầng dạng Dropdown Select cho khách hàng.
- [`frontend/src/routes/menu.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/routes/menu.tsx): Trang menu khách hàng đã sanitize thông báo lỗi kỹ thuật.
- [`frontend/src/lib/api.ts`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/lib/api.ts): Chuẩn hóa toàn bộ URL gọi Public Catalog sang `/api/catalog/...`.

---

## 4. Bảng Kết Quả Kiểm Thử Tự Động (Quality Assurance)

| Hạng mục kiểm thử | Công cụ thực thi | Kết quả | Trạng thái |
| :--- | :--- | :---: | :---: |
| **Backend Unit & Contract Tests** | Node.js Test Runner | `5/5 suites, 74/74 tests` | 🟢 **PASS 100%** |
| **Frontend Unit & Component Tests** | Vitest (JSDOM) | `26/26 files, 90/90 tests` | 🟢 **PASS 100%** |
| **Frontend Production Bundling** | Vite + Nitro (SSR) | `0 errors, 0 warnings` | 🟢 **PASS 100%** |
| **TypeScript Type Checking** | TypeScript Compiler | `0 type errors` | 🟢 **PASS 100%** |

---

## 5. Lịch Sử Commit & Đồng Bộ Git

- **`ad4ae06`**: Triển khai nền tảng Catalog Admin và Option Scope theo cấu trúc phân cấp.
- **`fc8586f`**: Chuyển đổi sang giao diện 3 Tab toàn diện và ẩn hoàn toàn trường `slug-url`.
- **`e4986f3`**: Xử lý tương thích ngược dữ liệu phẳng trên DB và bổ sung hiển thị danh mục 2 tầng cho User.
- **`9611f43`**: Chuẩn hóa toàn bộ 9 hạng mục (API path, ẩn mã lỗi, sửa/xóa ngành gốc, auto-resolve schema, upload ảnh trên cùng, giá step 1000, bỏ mô tả, toggle tạm ngưng món & danh mục con, tạo nhóm tùy chọn mới).
- **`f3bc5a9`**: Tối ưu bộ lọc Dropdown trang Menu, bỏ icon file, logic tạm ngưng liên kết sản phẩm và xây dựng cấu trúc 3 Block Tùy chọn độc lập chuẩn xác.
- **`a4f085a`**: Cập nhật tài liệu kỹ thuật Catalog Redesign cho Codex.
- **Đồng bộ nhánh**: Đã push đồng bộ thành công lên cả 3 nhánh: `origin/Hieu`, `origin/develop`, `origin/main`.
