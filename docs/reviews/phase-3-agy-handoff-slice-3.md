# Handoff Report — Phase 3 Lát 3: Stores, Promotions, Inventory & Tables Domain Refactoring

> **Ngày:** 19/08/2026  
> **Đặc tả kiến trúc:** `docs/superpowers/specs/2026-08-17-phase-3-domain-architecture-design.md`  
> **Người thực hiện:** AGY (Antigravity)  
> **Người nghiệm thu:** Codex  
> **Trạng thái:** Sẵn sàng nghiệm thu Lát 3 (Stores, Promotions, Inventory & Tables)

---

## 1. Tóm tắt kết quả thực hiện

Toàn bộ domain **Stores (Branches & Tables), Promotions (Vouchers) và Inventory** đã được bóc tách hoàn chỉnh khỏi các route tổng hợp theo kiến trúc 3 tầng:

1. **Validation Schemas:**
   - [`backend/validation/store-schemas.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/validation/store-schemas.js): Kiểm tra `store_id`, `table_id`, schemas tạo/sửa chi nhánh và bàn.
   - [`backend/validation/promotion-schemas.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/validation/promotion-schemas.js): Kiểm tra `promotion_id`, schemas tạo/sửa khuyến mãi và preview voucher.
   - [`backend/validation/inventory-schemas.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/validation/inventory-schemas.js): Kiểm tra `ingredient_id`, nhập/xuất kho và công thức.
2. **DTO Layer:**
   - [`backend/dto/store-dto.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/dto/store-dto.js): `toStoreDto`, `toTableDto`.
   - [`backend/dto/promotion-dto.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/dto/promotion-dto.js): `toPromotionDto`.
   - [`backend/dto/inventory-dto.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/dto/inventory-dto.js): `toIngredientDto`, `toStockLogDto`.
3. **Repository Entrypoints:**
   - [`backend/repositories/stores.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/repositories/stores.js)
   - [`backend/repositories/promotions.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/repositories/promotions.js)
   - [`backend/repositories/inventory.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/repositories/inventory.js)
4. **Service Layer:**
   - [`backend/services/stores/store-service.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/services/stores/store-service.js) & [`backend/services/stores/admin-store-service.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/services/stores/admin-store-service.js)
   - [`backend/services/promotions/promotion-service.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/services/promotions/promotion-service.js) & [`backend/services/promotions/admin-promotion-service.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/services/promotions/admin-promotion-service.js)
   - [`backend/services/inventory/admin-inventory-service.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/services/inventory/admin-inventory-service.js)
5. **Domain Routers:**
   - Public: [`routes/public/stores.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/routes/public/stores.js), [`routes/public/promotions.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/routes/public/promotions.js).
   - Admin: [`routes/admin/stores.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/routes/admin/stores.js) (`branchesRouter`, `tablesRouter`), [`routes/admin/promotions.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/routes/admin/promotions.js), [`routes/admin/inventory.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/routes/admin/inventory.js).
6. **Mount & Clean Legacy Routers:**
   - Mounted tại `/branches`, `/tables`, `/promotions`, `/inventory` trong `admin.js`.
   - Mounted tại `/` trong `public.js`.
   - Xóa bỏ toàn bộ raw SQL và inline handlers trùng lặp.

---

## 2. Bảng Mapping Route Cũ ➔ Domain Modules Mới

| Route URL & Method | Handler Cũ | Domain Module Mới | Quyền (RBAC) | Service Chịu Trách Nhiệm |
|---|---|---|---|---|
| `GET /api/stores` | `routes/public.js` | `routes/public/stores.js` | Public | `storeService.listActiveStores` |
| `GET /api/stores/districts` | `routes/public.js` | `routes/public/stores.js` | Public | `storeService.listStoreDistricts` |
| `GET /api/table/resolve` | `routes/public.js` | `routes/public/stores.js` | Public | `storeService.resolveTable` |
| `GET /api/promotions` | `routes/public.js` | `routes/public/promotions.js` | Public | `promotionService.listActivePromotions` |
| `POST /api/vouchers/apply` | `routes/public.js` | `routes/public/promotions.js` | Public | `promotionService.previewVoucher` |
| `GET /admin/branches` | `routes/admin.js` | `routes/admin/stores.js` | super, manager, cashier, kitchen | `adminStoreService.listBranches` |
| `POST /admin/branches` | `routes/admin.js` | `routes/admin/stores.js` | super | `adminStoreService.createBranch` |
| `PUT /admin/branches/:id` | `routes/admin.js` | `routes/admin/stores.js` | super, manager | `adminStoreService.updateBranch` |
| `DELETE /admin/branches/:id` | `routes/admin.js` | `routes/admin/stores.js` | super | `adminStoreService.deleteBranch` |
| `GET /admin/tables` | `routes/admin.js` | `routes/admin/stores.js` | super, manager, cashier | `adminStoreService.listAllTables` |
| `POST /admin/tables` | `routes/admin.js` | `routes/admin/stores.js` | super, manager | `adminStoreService.createTable` |
| `PUT /admin/tables/:id` | `routes/admin.js` | `routes/admin/stores.js` | super, manager | `adminStoreService.updateTable` |
| `DELETE /admin/tables/:id` | `routes/admin.js` | `routes/admin/stores.js` | super, manager | `adminStoreService.deleteTable` |
| `GET /admin/promotions` | `routes/admin.js` | `routes/admin/promotions.js` | super, manager | `adminPromotionService.listPromotions` |
| `POST /admin/promotions` | `routes/admin.js` | `routes/admin/promotions.js` | super | `adminPromotionService.createPromotion` |
| `PUT /admin/promotions/:id` | `routes/admin.js` | `routes/admin/promotions.js` | super | `adminPromotionService.updatePromotion` |
| `GET /admin/inventory` | `routes/admin.js` | `routes/admin/inventory.js` | super, manager | `adminInventoryService.listInventory` |
| `PUT /admin/inventory/:id` | `routes/admin.js` | `routes/admin/inventory.js` | super, manager | `adminInventoryService.updateInventory` |
| `POST /admin/inventory/:id/log` | `routes/admin.js` | `routes/admin/inventory.js` | super, manager | `adminInventoryService.logInventory` |

---

## 3. Bằng chứng kiểm thử thực tế (Test Provenance)

| Kiểm thử | File Test | Kết quả |
|---|---|---|
| HTTP Characterization (Public & Admin Stores/Promotions) | `test/phase3-stores-promotions-characterization.test.js` | **PASS** (2/2 suites) |
| Unit Tests (Stores, Promotions, Inventory Services) | `test/phase3-stores-promotions-service.test.js` | **PASS** (2/2 tests) |
| Architectural Boundary & Zero Raw SQL in Routes | `test/phase3-stores-promotions-boundaries.test.js` | **PASS** (4/4 tests) |
| Full Backend Test Suite (`npm test`) | 46 test suites | **PASS** (152 passed, 0 failed, 14 live-DB skipped) |
| Frontend Test Suite (`npm test -- --run`) | Vitest (3 files) | **PASS** (9 passed, 0 failed) |
| Frontend Production Build (`npm run build`) | Vite + TanStack Start | **PASS** (0 errors) |

---

## 4. Giới hạn & Bước kế tiếp

- Đã hoàn tất Lát 1 (Orders & KDS), Lát 2 (Catalog & Menu), và Lát 3 (Stores, Promotions, Inventory & Tables).
- Domain cuối cùng cần hoàn thiện: **Lát 4 (Reports, Customers & Engagement, Settings & Audit Logs)**.
