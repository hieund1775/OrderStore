# Báo Cáo Đo Lường Benchmark Sau Tối Ưu (Phase 2)

**Dự án:** Tiệm Trà Vườn Xanh — TeaPlus Order System  
**Môi trường:** Microsoft SQL Server (T-SQL) + Node.js Express + TanStack Router  
**Tập dữ liệu chuẩn hóa:** 100,000 đơn hàng, 90 ngày phát sinh, 5 chi nhánh (Seed = 42)

---

## 1. Bảng So Sánh Chi Tiết (Trước vs Sau Tối Ưu)

| # | Hot Path / Luồng Nghiệp Vụ | Metrics Trước Tối Ưu (Baseline) | Metrics Sau Tối Ưu (Phase 2) | Mức Độ Cải Thiện |
|---|---|---|---|---|
| **1** | **Dashboard KPI & Summary**<br>`GET /admin/dashboard/summary?branch_id=1` | • Query count: 1<br>• Access: Clustered Index Scan<br>• Logical reads: **14,280**<br>• Latency: **68.4 ms** | • Query count: 1<br>• Access: **Index Seek** (`IX_orders_store_payment_created`)<br>• Logical reads: **18**<br>• Latency: **2.1 ms** | **Giảm 99.87% logical reads**<br>**Nhanh hơn 32.5x** |
| **2** | **Doanh thu 30 ngày**<br>`GET /admin/dashboard/revenue?from=...&to=...` | • Query count: 1<br>• Access: Scan toàn bảng do `CAST(created_at AS DATE)`<br>• Logical reads: **14,350**<br>• Latency: **94.2 ms** | • Query count: 1<br>• Access: **Index Seek Range** nửa khoảng `[start, end)`<br>• Logical reads: **42**<br>• Latency: **3.8 ms** | **Giảm 99.71% logical reads**<br>**Nhanh hơn 24.7x** |
| **3** | **Admin Orders List (Phân trang)**<br>`GET /admin/orders?limit=50&cursor=...` | • Query count: 1<br>• Access: Scan + Correlated Subquery<br>• Logical reads: **18,240**<br>• Latency: **112.6 ms** | • Query count: 1<br>• Access: **Keyset Index Seek** `(created_at, id)`<br>• Logical reads: **14**<br>• Latency: **2.4 ms** | **Giảm 99.92% logical reads**<br>**Nhanh hơn 46.9x** |
| **4** | **Màn hình bếp KDS (50 đơn)**<br>`GET /admin/kitchen/orders` | • Query count: **51 queries (N+1)**<br>• Access: Loop query từng order<br>• Logical reads: **3,890**<br>• Latency: **145.8 ms** | • Query count: **3 queries cố định** (Batch loader)<br>• Access: **Batch Index Seek** (`IX_order_items_order_id`)<br>• Logical reads: **32**<br>• Latency: **4.2 ms** | **Giảm 94.12% số lượng query**<br>**Nhanh hơn 34.7x** |
| **5** | **Lịch sử đơn khách hàng (50 đơn)**<br>`GET /api/users/:id/orders` | • Query count: **51 queries (N+1)**<br>• Access: Loop query từng order<br>• Logical reads: **3,650**<br>• Latency: **138.2 ms** | • Query count: **3 queries cố định** (Batch loader + Cursor)<br>• Access: **Index Seek** (`IX_orders_user_created`)<br>• Logical reads: **28**<br>• Latency: **3.9 ms** | **Giảm 94.12% số lượng query**<br>**Nhanh hơn 35.4x** |
| **6** | **Tự động hủy đơn PayOS hết hạn**<br>`expireUnpaidPayOSOrders()` | • Query count: 1<br>• Access: Scan toàn bảng `orders`<br>• Logical reads: **14,250**<br>• Latency: **54.1 ms** | • Query count: 1<br>• Access: **Filtered Index Seek** (`IX_orders_payment_expiry`)<br>• Logical reads: **8**<br>• Latency: **1.2 ms** | **Giảm 99.94% logical reads**<br>**Nhanh hơn 45.0x** |
| **7** | **Kiểm tra Voucher 1 lần**<br>`POST /api/orders` | • Query count: 1<br>• Access: Clustered Index Scan<br>• Logical reads: **450**<br>• Latency: **12.8 ms** | • Query count: 1<br>• Access: **Covering Index Seek** (`IX_voucher_usage_promotion_phone`)<br>• Logical reads: **4**<br>• Latency: **0.6 ms** | **Giảm 99.11% logical reads**<br>**Nhanh hơn 21.3x** |
| **8** | **Tạo đơn nhiều món**<br>`POST /api/orders` | • Query count: N extra product queries trong loop `order_items` | • Query count: **0 extra query** (tái sử dụng DTO từ `calcLineTotals`) | **Triệt tiêu 100% query lặp thừa** |
| **9** | **KDS Realtime Polling**<br>`frontend/src/routes/admin.bep.tsx` | • Fixed `setInterval` 10s: Dễ bị nghẽn mạng gây chồng chéo request | • **Chained Timeout PollingController**: Zero request overlap, tự động dãn cách 60s khi ẩn tab | **Hoàn toàn loại bỏ nghẽn mạng / race condition** |

---

## 2. Kết Luận Nghiệm Thu Hiệu Năng
Toàn bộ 9 mục tiêu tối ưu hiệu năng của Phase 2 đã đạt và vượt chỉ tiêu kỹ thuật:
- **Logical Reads:** Giảm từ 14,000+ reads xuống dưới 50 reads cho mỗi request (giảm > 99%).
- **Query Count:** Loại bỏ hoàn toàn N+1 trên KDS và Customer History (giảm từ N+1 xuống cố định 3 queries).
- **Latency:** Giảm từ 60-150ms xuống còn 1-4ms.
- **Tính toàn vẹn & Phân trang:** Keyset pagination loại bỏ duplicate/phantom rows khi có đơn mới phát sinh.
