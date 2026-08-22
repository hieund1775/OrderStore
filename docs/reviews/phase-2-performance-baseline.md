# Báo Cáo Đo Lường Baseline — Phase 2: Hiệu Năng Database & API

> **Ngày thực hiện:** 17/08/2026  
> **Bộ dữ liệu chuẩn:** 100.000 orders trải dài trên 90 ngày, 5 chi nhánh, seed = 42  
> **Mục đích:** Ghi lại các điểm nghẽn hiệu năng hiện hữu (N+1 queries, non-sargable date scans, table scans) trước khi áp dụng tối ưu.

---

## 1. Bảng Tổng Hợp Baseline Trước Tối Ưu

| # | Luồng Nghiệp Vụ / API | SQL / Pattern Hiện Tại | Loại Truy Cập SQL Server | Số Logical Reads (Trang 8KB) | Thời Gian (ms) | Query Count / Request | Vấn Đề Xác Định |
|---|---|---|---|:---:|:---:|:---:|---|
| **1** | **Dashboard Today** (`/admin/dashboard/summary`) | `CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)` | Clustered Index Scan | 14.280 | ~68 ms | 1 | `CAST()` làm mất tính sargable, bắt buộc scan toàn bộ bảng `orders`. |
| **2** | **Dashboard Revenue Range** (`/admin/dashboard/revenue`) | `WHERE CAST(created_at AS DATE) BETWEEN ? AND ?` | Clustered Index Scan | 14.350 | ~94 ms | 1 | Không tận dụng được index thời gian do bọc hàm `CAST()`. |
| **3** | **Admin Orders List** (`/admin/orders`) | `TOP 100` + correlated subquery trạng thái hiện tại | Clustered Index Scan + Subquery Scan | 18.240 | ~112 ms | 1 | Scan bảng lớn; chưa có phân trang cursor ổn định. |
| **4** | **KDS Kitchen List** (`/admin/kitchen/orders`) | Vòng lặp `for (const o of orders) { query items; query toppings; }` | N+1 Loop Queries | 3.890 | ~145 ms | **51 queries** (1 list + 50 items) | N+1 nghiêm trọng, số query tăng tuyến tính theo số đơn. |
| **5** | **Customer Order History** (`/api/users/:id/orders`) | Vòng lặp query chi tiết cho từng đơn hàng của khách | N+1 Loop Queries | 3.650 | ~138 ms | **51 queries** (1 list + 50 items) | N+1 query lặp từng đơn; không có cursor pagination. |
| **6** | **PayOS Auto-Expire Scan** (`expireUnpaidPayOSOrders`) | `UPDATE orders ... WHERE payment_provider = 'payos' AND payment_status = 'unpaid'` | Table Scan trên `orders` | 14.250 | ~54 ms | 1 | Thiếu filtered composite index trên provider + status + expires_at. |
| **7** | **Voucher Usage Lookup** (tạo đơn) | `WHERE promotion_id = ? AND user_phone = ?` | Table Scan trên `voucher_usage_history` | 450 | ~13 ms | 1 | Thiếu composite index `(promotion_id, user_phone)`. |
| **8** | **Create Order Item Query** (`POST /api/orders`) | Query `SELECT name FROM products WHERE id = ?` cho từng item | Duplicate Query | - | - | **N items queries** | Price engine đã query sản phẩm nhưng create order query lại lần 2. |

---

## 2. Mục Tiêu Tối Ưu Cần Đạt Được
1. **Chuyển toàn bộ Date Predicates sang Sargable Range:** Thay `CAST(created_at AS DATE) = ?` thành `created_at >= @start AND created_at < @end` $\rightarrow$ Chuyển từ **Scan** sang **Index Seek**.
2. **Triệt tiêu N+1 Queries:** Đưa Query Count của KDS và Customer History từ **51 queries $\rightarrow$ 2-3 queries cố định** (batch loading theo tập `IN (...)`).
3. **Loại bỏ Duplicate Query:** Tái sử dụng `product_name` từ `price-engine.js` khi tạo đơn.
4. **Phân trang Cursor ổn định:** Áp dụng `(created_at DESC, id DESC)` tránh trùng lặp/bỏ sót khi có đơn mới chèn vào giữa các trang.
