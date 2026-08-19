# Handoff Report — Phase 3 Lát 2: Catalog & Menu Domain Refactoring

> **Ngày:** 19/08/2026  
> **Đặc tả kiến trúc:** `docs/superpowers/specs/2026-08-17-phase-3-domain-architecture-design.md`  
> **Người thực hiện:** AGY (Antigravity)  
> **Người nghiệm thu:** Codex  
> **Trạng thái:** Sẵn sàng nghiệm thu Lát 2 (Catalog & Menu)

---

## 1. Tóm tắt kết quả thực hiện

Toàn bộ domain **Catalog & Menu** đã được bóc tách hoàn chỉnh khỏi các route tổng hợp (`admin.js` và `public.js`) theo đúng kiến trúc 3 tầng:

1. **Validation Layer:** Tạo [`backend/validation/catalog-schemas.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/validation/catalog-schemas.js) kiểm tra `category_id`, `product_id`, `option_id`, schemas tạo/sửa danh mục, sản phẩm, topping, cốt trà và bộ lọc tìm kiếm.
2. **DTO Layer:** Tạo [`backend/dto/catalog-dto.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/dto/catalog-dto.js) chuyển đổi an toàn `toProductDto`, `toCategoryDto`, `toOptionDto` với kiểu số/boolean chuẩn và parse tags JSON.
3. **Repository Layer:** Tạo [`backend/repositories/catalog.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/repositories/catalog.js) làm điểm truy cập thống nhất cho cả public catalog và admin catalog.
4. **Service Layer:**
   - [`backend/services/catalog/catalog-service.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/services/catalog/catalog-service.js): Nghiệp vụ public catalog (danh sách món, chi tiết theo slug, danh mục, tùy chọn, gợi ý tìm kiếm).
   - [`backend/services/catalog/admin-menu-service.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/services/catalog/admin-menu-service.js): Nghiệp vụ CRUD danh mục, sản phẩm, bật/tắt món, topping, cốt trà.
5. **Domain Route Layer:**
   - [`backend/routes/public/catalog.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/routes/public/catalog.js): Phục vụ `/api/products`, `/api/products/:slug`, `/api/categories`, `/api/options/:kind`, `/api/search/suggestions`.
   - [`backend/routes/admin/menu.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/routes/admin/menu.js): Phục vụ `/admin/menu/categories`, `/admin/menu/products`, `/admin/menu/options`, `/admin/menu/toppings`, `/admin/menu/bases`.
6. **Mount & Clean Legacy Routes:**
   - Mount `adminMenuRouter` tại `/menu` trong `backend/routes/admin.js` và loại bỏ ~190 dòng code inline handler cũ.
   - Mount `publicCatalogRouter` tại `/` trong `backend/routes/public.js` và loại bỏ toàn bộ inline catalog handlers cũ.

---

## 2. Bảng Mapping Route Cũ ➔ Domain Modules Mới

| Route URL & Method | Handler Cũ | Domain Module Mới | Quyền (RBAC) | Service Chịu Trách Nhiệm |
|---|---|---|---|---|
| `GET /api/products` | `routes/public.js` | `routes/public/catalog.js` | Public | `catalogService.listProducts` |
| `GET /api/products/:slug` | `routes/public.js` | `routes/public/catalog.js` | Public | `catalogService.findProductBySlug` |
| `GET /api/categories` | `routes/public.js` | `routes/public/catalog.js` | Public | `catalogService.listCategories` |
| `GET /api/options/:kind` | `routes/public.js` | `routes/public/catalog.js` | Public | `catalogService.listOptions` |
| `GET /api/search/suggestions` | `routes/public.js` | `routes/public/catalog.js` | Public | `catalogService.listSearchSuggestions` |
| `GET /admin/menu/categories` | `routes/admin.js` | `routes/admin/menu.js` | super, manager, cashier, kitchen | `adminMenuService.listCategories` |
| `POST /admin/menu/categories` | `routes/admin.js` | `routes/admin/menu.js` | super | `adminMenuService.createCategory` |
| `PUT /admin/menu/categories/:id` | `routes/admin.js` | `routes/admin/menu.js` | super | `adminMenuService.updateCategory` |
| `DELETE /admin/menu/categories/:id` | `routes/admin.js` | `routes/admin/menu.js` | super | `adminMenuService.deleteCategory` |
| `GET /admin/menu/products` | `routes/admin.js` | `routes/admin/menu.js` | super, manager, cashier, kitchen | `adminMenuService.listProducts` |
| `POST /admin/menu/products` | `routes/admin.js` | `routes/admin/menu.js` | super | `adminMenuService.createProduct` |
| `PUT /admin/menu/products/:id` | `routes/admin.js` | `routes/admin/menu.js` | super | `adminMenuService.updateProduct` |
| `PUT /admin/menu/products/:id/toggle` | `routes/admin.js` | `routes/admin/menu.js` | super | `adminMenuService.toggleProduct` |
| `DELETE /admin/menu/products/:id` | `routes/admin.js` | `routes/admin/menu.js` | super | `adminMenuService.deleteProduct` |
| `GET /admin/menu/options` | `routes/admin.js` | `routes/admin/menu.js` | super, manager, cashier, kitchen | `adminMenuService.listOptions` |
| `POST /admin/menu/toppings` | `routes/admin.js` | `routes/admin/menu.js` | super | `adminMenuService.createTopping` |
| `PUT /admin/menu/toppings/:id` | `routes/admin.js` | `routes/admin/menu.js` | super | `adminMenuService.updateTopping` |
| `DELETE /admin/menu/toppings/:id` | `routes/admin.js` | `routes/admin/menu.js` | super | `adminMenuService.deleteTopping` |
| `POST /admin/menu/bases` | `routes/admin.js` | `routes/admin/menu.js` | super | `adminMenuService.createBase` |
| `PUT /admin/menu/bases/:id` | `routes/admin.js` | `routes/admin/menu.js` | super | `adminMenuService.updateBase` |
| `DELETE /admin/menu/bases/:id` | `routes/admin.js` | `routes/admin/menu.js` | super | `adminMenuService.deleteBase` |

---

## 3. Bằng chứng kiểm thử thực tế (Test Provenance)

| Kiểm thử | File Test | Kết quả |
|---|---|---|
| HTTP Characterization (Public & Admin Menu) | `test/phase3-catalog-characterization.test.js` | **PASS** (2/2 suites) |
| Unit Tests (Catalog & Admin Menu Service) | `test/phase3-catalog-service.test.js` | **PASS** (2/2 tests) |
| Architectural Boundary & Zero Raw SQL in Routes | `test/phase3-catalog-boundaries.test.js` | **PASS** (4/4 tests) |
| Full Backend Test Suite (`npm test`) | 43 test suites | **PASS** (144 passed, 0 failed, 14 live-DB skipped) |
| Frontend Test Suite (`npm test -- --run`) | Vitest (3 files) | **PASS** (9 passed, 0 failed) |
| Frontend Production Build (`npm run build`) | Vite + TanStack Start | **PASS** (0 errors) |

---

## 4. Giới hạn & Bước kế tiếp

- Đã hoàn tất Lát 1 (Orders & KDS) và Lát 2 (Catalog & Menu).
- Các domain còn lại: **Lát 3 (Stores & Promotions & Inventory & Tables)** và **Lát 4 (Reports, Customers & Engagement)**.
