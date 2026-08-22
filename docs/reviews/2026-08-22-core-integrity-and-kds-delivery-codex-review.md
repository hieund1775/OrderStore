# Codex Review — Core Integrity, Auth Gate & KDS Delivery Hardening

**Ngày review:** 22/08/2026  
**Đối tượng:** Các commit `b3e9a45` → `946a345` và handoff của AGY  
**Kết luận:** Đạt sau khi sửa bốn lỗi contract/schema/UI/concurrency; bộ live integration dành cho PostgreSQL đã pass.

## Kết quả kiểm tra

- Backend: `177 pass, 0 fail, 14 skipped`.
- Frontend Vitest: `9 pass, 0 fail`.
- Frontend TypeScript: pass.
- Frontend production build: pass.
- `git diff --check`: pass.
- PostgreSQL public-read live integration: `1 pass, 0 fail` sau khi sửa schema drift.
- PostgreSQL integration group: `13 pass, 0 fail` sau khi sửa voucher concurrency.

## Lỗi phát hiện và đã sửa

### 1. Giá trị đã normalize không được truyền xuống persistence

`validateCreateOrderInput` đã chuẩn hóa số điện thoại `+84` và khoảng trắng trong họ tên, nhưng route vẫn truyền `req.body` nguyên bản vào service. Vì vậy validation pass nhưng dữ liệu lưu có thể vẫn là giá trị chưa chuẩn hóa.

Đã sửa:

- `backend/validation/order-schemas.js` trả về `customerName` và `customerPhone` canonical.
- `backend/routes/public/orders.js` truyền payload canonical vào service/repository.
- Bổ sung HTTP test chứng minh `+84 901 234 567` được lưu dưới dạng `0901234567`.

### 2. KDS cho phép lùi đơn Delivery đã bàn giao

Sau khi đơn Delivery chuyển sang `Đang giao`, thẻ vẫn nằm trong nhóm hoàn tất và có thể dùng nút “Lùi lại” để gọi trạng thái `Đang chuẩn bị`. Điều này phá state machine: sau bàn giao, chỉ Admin/Shipper được xác nhận `Hoàn thành`.

Đã sửa:

- Không hiển thị nút “Lùi lại” cho đơn Delivery trong nhóm đã bàn giao.
- Cập nhật state UI cục bộ thành `Đang giao` ngay sau khi bàn giao để không giữ trạng thái cũ.

### 3. PostgreSQL engagement repository lệch schema migration

Live test phát hiện `engagement.js` truy vấn bảng `tiers` và cột `rewards.points_required`, trong khi schema chuẩn có bảng `tier_rules` và cột `rewards.points_cost`.

Đã sửa repository và chạy lại `postgres-public-read.integration.test.js` thành công.

Trong quá trình live test còn phát hiện chính test public-read gọi guard nhưng không kiểm tra kết quả, nên có thể chạy migration/seed trên database tên `postgres`. Đã bổ sung assertion `guard.valid === true`; từ nay target hiện tại sẽ bị chặn đúng cách cho đến khi có database dedicated.

### 4. Điều kiện single-use voucher bị đảo ngược

`promotions.js` ném lỗi “voucher đã được sử dụng” khi query usage không trả record. Vì vậy cả hai checkout concurrent đều fail (`0` thành công thay vì `1`). Đã sửa điều kiện và xác nhận lại live concurrency test: `1 pass, 0 fail`.

## Bài học cho AGY

1. Không chỉ kiểm tra validator; phải kiểm tra giá trị sau validator có đi xuyên suốt tới service/repository hay không.
2. Mỗi state transition mới cần kiểm tra cả chiều thuận, chiều ngược và quyền của từng vai trò.
3. Handoff phải phân biệt rõ test unit/HTTP integration/live database.
4. Không dùng `PRODUCTION READY` hoặc `100% hoàn thành` khi còn live test bị skip hoặc chưa có bằng chứng cho toàn bộ flow.
5. Nếu chức năng đã tồn tại từ commit trước, handoff nên ghi là “đã kiểm tra/tái sử dụng”, không ghi toàn bộ là phần vừa implement.

## Giới hạn còn lại

Các live suite đã chạy qua host được allowlist trong `.env`; database hiện mang tên `postgres` nhưng không phải production URL theo cấu hình dự án. Khi dùng môi trường khác, phải giữ guard và không bypass nếu target không phải test/staging được phê duyệt. Kết luận hiện tại là **đạt static/unit/HTTP regression và PostgreSQL live integration**, còn production cutover vẫn cần quy trình vận hành/phê duyệt riêng.
