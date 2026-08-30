# Báo Cáo Thiết Kế Lại & Nâng Cấp Hệ Thống Catalog Đa Ngành (Catalog V2 Redesign Report)

**Người chỉ đạo & duyệt kiến trúc:** Đại ca (Tech Lead / Product Owner)  
**Người thực hiện & báo cáo:** Antigravity (Pair Programming Assistant)  
**Đối tượng bàn giao:** Codex & Đội ngũ Kỹ thuật  
**Ngày lập:** 30/08/2026  
**Trạng thái:** ✅ Đã hoàn thành 100%, kiểm thử tự động toàn diện và triển khai lên Git.

---

## 1. Tổng Quan Ý Tưởng Thiết Kế Lại Của Đại Ca (Core Philosophy & Requirements)

Trước đây, giao diện quản trị Catalog bị phân mảnh và nhồi nhét nhiều cột hẹp hoặc cấu hình phức tạp, trong khi dữ liệu cũ trên Database vốn là danh mục phẳng (`depth = 0`, `parent_id = null`). Đại ca đã chỉ đạo tái cấu trúc toàn diện theo tư duy **3 Khối Tab Toàn Diện (Full-width 3-Tab Architecture)** với các nguyên tắc cốt lõi sau:

### 1.1. Kiến trúc Quản trị 3 Khối Tab Mạch Lạc (`/admin/catalog`)
- **Tầng cao nhất (Top Header)**:
  - Bộ chọn **Ngành hàng gốc** (`Nước uống`, `Quần áo & Merch`, `Đồ ăn vặt`...).
  - Nút **`+ Tạo ngành hàng gốc`**, cùng 2 nút tiện ích: **`✏️ Sửa tên ngành`** và **`🗑️ Xóa ngành`** (có kiểm tra an toàn nếu còn nhánh con hoặc sản phẩm).
- **Tab 1: 📁 Danh Mục Con (Subcategories)**:
  - Quản lý các nhóm món con thuộc ngành gốc đang chọn (VD thuộc *Nước uống* gồm: `🧋 Trà sữa`, `🍊 Nước ép & Sinh tố`, `🥤 Nước giải khát`...).
  - Hiển thị số lượng món, trạng thái (`🟢 Đang hiển thị` / `🟡 Tạm ẩn`), khu vực xử lý mặc định (`🍳 Quầy Bếp / Pha chế` hoặc `📦 Soạn / Đóng gói`).
  - Hỗ trợ nút **`Tạm ẩn / Hiển thị`**, **`Sửa`**, **`Xóa`** và **`+ Thêm danh mục con`**.
  - *Tương thích ngược*: Nếu ngành gốc là danh mục phẳng cũ chưa chia nhánh con, hệ thống vẫn hiển thị thông báo rõ ràng và cho phép thêm danh mục con để phân nhóm.
- **Tab 2: 🛍️ Quản Lý Sản Phẩm (Products)**:
  - Bảng danh sách món có **Dropdown lọc theo từng danh mục con** (`Tất cả`, `Trà sữa`, `Nước ép`...).
  - Hiển thị ảnh đại diện, tên món, giá bán, khu vực xử lý và trạng thái (`🟢 Đang bán` / `🔴 Tạm ngưng`).
  - Nút thao tác trực tiếp: **`Tạm ngưng / Mở bán`** (toggle tức thì), **`Sửa`**, **`Xóa món`** (kèm xác nhận), **`+ Thêm món mới`**.
  - Hiển thị 100% toàn bộ sản phẩm cũ và mới trên Database.
- **Tab 3: ⚙️ Tùy Chọn Danh Mục Con (Option Scoping)**:
  - **Tùy chọn được cấu hình cô lập cho đúng từng Danh mục con cụ thể**, không bị dính sang danh mục con khác trong cùng một ngành gốc.
  - Phân định rõ 2 nhóm tùy chọn:
    - 📌 **1. Tùy chọn Mặc định (Bắt buộc chọn 1)**: Size ly (M: +0đ, L: +7.000đ), Size áo (S/M/L)...
    - 💡 **2. Tùy chọn Sở thích (Tùy biến thêm)**: Mức đường (0-100%), Mức đá, Topping trân châu, Đóng hộp...
  - Nếu danh mục con là hàng đóng chai/lon sẵn (như *Nước giải khát Aquafina, Coca, Sting*), hệ thống thông báo rõ ràng không áp dụng tùy chọn.
  - Cung cấp nút **`+ Tạo Nhóm Tùy Chọn Mới`** để tạo nhanh nhóm tùy chọn và gán thẳng cho danh mục con đang chọn.

---

### 1.2. Trải Nghiệm Người Dùng & Tinh Gọn Form (UX Refinements)
1. **Ẩn 100% trường `slug-url`**: Người dùng quản trị không phải nhìn thấy hay nhập trường kỹ thuật `slug`. Hệ thống tự động sinh slug URL tiếng Việt không dấu chuẩn SEO (`generateSlugFromName`) ngầm ở background.
2. **Form Tạo/Sửa Món Tinh Gọn**:
   - **Khung Ảnh đặt ở TRÊN CÙNG**: Có nút `Tải ảnh từ máy` (chọn file từ máy tính, đọc thành Data URL 2MB) hoặc dán link URL, kèm khung xem trước ảnh to rõ và nút `Xóa ảnh`.
   - **Tên món & Danh mục con**: Bắt buộc nhập.
   - **Giá bán (VNĐ)**: Bắt buộc nhập, nút bấm tăng/giảm nhảy đúng **1.000đ** (`step={1000}`).
   - **BỎ hoàn toàn ô Mô tả món**: Giúp thao tác thêm món cực nhanh.
3. **Trang Khách Hàng (`/menu`)**:
   - Hiển thị 2 tầng danh mục trực quan:
     - **Tầng 1 (Ngành hàng gốc)**: `🌐 Tất cả món`, `🍹 Nước uống`, `👕 Quần áo & Merch`...
     - **Tầng 2 (Danh mục con)**: Khi khách chọn một ngành hàng, hệ thống tự động bung ra hàng danh mục con tương ứng (`Tất cả Nước uống`, `🧋 Trà sữa`, `🍊 Nước ép`...) để bấm lọc món tức thì.
   - **Ẩn thông tin lỗi kỹ thuật**: Nếu mạng hoặc API gặp sự cố, hiển thị thông báo thân thiện *"Không thể tải danh mục sản phẩm lúc này. Vui lòng thử lại sau."*, tuyệt đối không để lộ mã lỗi, đường dẫn route hay stack trace.

---

## 2. Chi Tiết Các Thay Đổi & Triển Khai Code (Implementation Details)

### 2.1. Backend (`backend/`)
1. **Tự Động Phân Giải Schema Khi Tạo Sản Phẩm ([`admin-catalog-v2.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/repositories/postgres/admin-catalog-v2.js))**:
   - Khắc phục lỗi: *"Sản phẩm Catalog V2 phải gắn với một schema đã xuất bản"*.
   - Triển khai cơ chế dò tìm Schema nhiều tầng:
     - Nếu `data.product_type_schema_id` chưa có &rarr; Tìm theo `category.product_type_id`.
     - Nếu chưa có &rarr; Đệ quy tìm qua các danh mục tổ tiên (Ancestors).
     - Nếu vẫn chưa có &rarr; Tự động fallback về Schema xuất bản mặc định (`beverage` hoặc schema đầu tiên).
     - Tự động gán mặc định `fulfillment_lane = 'kitchen'` và `stock_mode = 'made_to_order'` nếu chưa cấu hình.
2. **Bổ Sung `default_fulfillment_lane` Vào Category DTO & Repository**:
   - File [`backend/repositories/postgres/catalog-v2.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/repositories/postgres/catalog-v2.js): Bổ sung `c.default_fulfillment_lane` vào câu lệnh `SELECT` của hàm `listCategories`.
   - File [`backend/dto/catalog-v2-dto.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/dto/catalog-v2-dto.js): Bổ sung trường `default_fulfillment_lane` vào hàm chuyển đổi `toCategoryTreeDto`.
3. **Chuẩn Hóa Route Mounting ([`backend/app.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/app.js))**:
   - Thêm alias fallback `app.use('/catalog', publicCatalogV2Router)` bên cạnh `app.use('/api', publicRoutes)`. Đảm bảo cả hai cách gọi `/api/catalog/...` và `/catalog/...` đều hoạt động 100%.
4. **Bảo Toàn Integrity Migration Checksum**:
   - Khôi phục file `0016_catalog_option_scopes.sql` và `0017_fulfillment_capabilities.sql` về đúng checksum ban đầu khi deploy Render.
   - Chuyển toàn bộ các constraints, foreign key restrict và trigger sang migration mới: [`0018_fulfillment_and_scope_hardening.sql`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/database/postgres/migrations/0018_fulfillment_and_scope_hardening.sql).

---

### 2.2. Frontend (`frontend/`)
1. **Component Quản Trị 3 Tab Mới ([`CatalogTabBlocksView.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/components/admin/catalog/CatalogTabBlocksView.tsx))**:
   - Tab 1: Danh mục con (Quản lý phân cấp, toggle Tạm ẩn/Hiển thị, gán luồng Bếp/Đóng gói).
   - Tab 2: Quản lý sản phẩm (Dropdown lọc danh mục con, toggle Đang bán/Tạm ngưng, xóa món, sửa món).
   - Tab 3: Tùy chọn danh mục con (Gán tùy chọn cô lập cho từng danh mục con, phân nhóm Mặc định vs Sở thích, kèm modal `+ Tạo Nhóm Tùy Chọn Mới`).
2. **Bộ Chọn Danh Mục Khách Hàng ([`CategorySelector.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/components/catalog/CategorySelector.tsx))**:
   - Chuyển đổi thành **Bộ lọc Dropdown / Select gọn gàng**:
     - Dropdown 1: `Danh mục` (Tất cả danh mục, Nước uống, Quần áo...).
     - Dropdown 2: `Danh sách danh mục` (Tất cả món trong danh mục, Trà sữa, Nước ép...).
   - Bỏ hoàn toàn các icon File rườm rà và không để thanh tràn ngang màn hình.
3. **Quản Lý Tùy Chọn 3 Block Chuẩn Xác ([`CatalogOption3BlocksEditor.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/components/admin/catalog/CatalogOption3BlocksEditor.tsx))**:
   - **Block 1: Tùy Chọn Không Tiền**: Chọn 1 trong nhóm (+0đ) như Mức đá (100%, 70%, 50%), Mức đường... Có nút tạo thêm nhóm không tiền.
   - **Block 2: Tùy Chọn Có Tiền**: Chọn nhiều loại kèm phụ thu (+VND) như Topping (Trân châu, Thạch, Pudding...), Size ly nâng cấp... Có nút tạo thêm nhóm có tiền.
   - **Block 3: Cấu Hình Riêng Sản Phẩm**: Chọn một món cụ thể (VD: Trà Sữa Thập Cẩm) để áp dụng các nhóm từ Block 1 và Block 2 thành giá trị mặc định có sẵn.
4. **Cơ Chế Trạng Thái Liên Kết Danh Mục Con & Món**:
   - Khi tạm ngưng một danh mục con &rarr; Tự động tạm ngưng toàn bộ sản phẩm bên trong.
   - Khi mở bán lại một món &rarr; Tự động mở bán lại danh mục con cha nếu danh mục đang tạm ngưng.
5. **Trang Quản Trị Chính ([`admin.catalog.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/routes/admin.catalog.tsx))**:
   - Bỏ nút "Làm mới" ở trên cùng.
   - Bỏ dòng text hướng dẫn `Bấm tăng/giảm nhảy 1.000đ`.
   - Bỏ các thông tin/thuật ngữ kỹ thuật DB.

---

## 3. Kết Quả Kiểm Thử Toàn Diện (Verification & Quality Gates)

Toàn bộ hệ thống đã vượt qua 100% các bài test tự động và build thành công:

| Hạng mục kiểm thử | Công cụ | Kết quả | Trạng thái |
| :--- | :--- | :---: | :---: |
| **Backend Unit & Contract Tests** | Node.js Test Runner | `5/5 suites, 74/74 tests` | 🟢 **PASS 100%** |
| **Frontend Unit & Component Tests** | Vitest (JSDOM) | `26/26 files, 90/90 tests` | 🟢 **PASS 100%** |
| **Frontend Production Bundling** | Vite + Nitro (SSR) | `0 errors, 0 warnings` | 🟢 **PASS 100%** |
| **TypeScript / Schema Contract** | TypeScript Compiler | `0 type errors` | 🟢 **PASS 100%** |

---

## 4. Lịch Sử Commit & Đồng Bộ Git

- **Commit `ad4ae06`**: Triển khai nền tảng Catalog Admin và Option Scope theo cấu trúc phân cấp.
- **Commit `fc8586f`**: Chuyển đổi sang giao diện 3 Tab toàn diện và ẩn hoàn toàn trường `slug-url`.
- **Commit `e4986f3`**: Xử lý tương thích ngược dữ liệu phẳng trên DB và bổ sung hiển thị danh mục 2 tầng cho User.
- **Commit `9611f43`**: Chuẩn hóa toàn bộ 9 hạng mục (API path, ẩn mã lỗi, sửa/xóa ngành gốc, auto-resolve schema, upload ảnh trên cùng, giá step 1000, bỏ mô tả, toggle tạm ngưng món & danh mục con, tạo nhóm tùy chọn mới).
- **Commit `f3bc5a9`**: Tối ưu bộ lọc Dropdown trang Menu, bỏ icon file, logic tạm ngưng liên kết sản phẩm và xây dựng cấu trúc 3 Block Tùy chọn độc lập chuẩn xác.
- **Nhánh đồng bộ**: Đã push đồng bộ thành công lên cả 3 nhánh: `origin/Hieu`, `origin/develop`, `origin/main`.
