# Checkpoint D / Đợt 2 — Voucher concurrency PostgreSQL

## Mục tiêu

Chuyển kiểm tra và tiêu hao voucher sang PostgreSQL, giữ nguyên API và rule hiện tại: mã phải active/đúng thời gian/đủ đơn tối thiểu/đúng chi nhánh; mã single-use chỉ dùng một lần theo số điện thoại.

## Thiết kế

- `repositories/postgres/promotions.js` sở hữu mọi SQL voucher PostgreSQL.
- Eligibility đọc promotion cùng `promotion_stores`; không dùng text `scope` để quyết định quyền áp dụng.
- Create order gọi validate và consume trong cùng transaction PostgreSQL.
- Voucher giới hạn lượt dùng conditional update `used_count < usage_limit`; affected row bằng 0 là hết lượt.
- Single-use insert `voucher_usage_history` chịu unique/lock theo promotion + normalized phone, nên hai request cạnh tranh chỉ một request thành công.
- Lỗi business giữ response 4xx tiếng Việt; lỗi hạ tầng không lộ SQL.

## Kiểm thử

- Live integration PostgreSQL kiểm tra chi nhánh sai, mã hết hạn, minimum order, single-use và hai request đồng thời khi còn một lượt.
- Regression HTTP giữ request/response `POST /api/vouchers/apply` và create order hiện có.

## Ngoài phạm vi

Không chuyển promotion CRUD/Admin, order lookup/cancel/history hoặc data cutover SQL Server.
