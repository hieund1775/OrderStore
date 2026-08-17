# Checkpoint C / Đợt 2 — Public read sang PostgreSQL

## Mục tiêu

Chuyển các API public chỉ đọc của catalog và cửa hàng sang PostgreSQL, không thay đổi HTTP contract hiện có. Đợt này không chuyển bất kỳ write path, order, voucher, payment hoặc báo cáo nào.

## Phạm vi

`backend/repositories/postgres/catalog.js` sở hữu query PostgreSQL cho:

- `GET /api/products`, `GET /api/products/:slug`, `GET /api/categories` và năm endpoint options.
- `GET /api/jobs`, `GET /api/tiers`, `GET /api/rewards`.
- `GET /api/products/:id/reviews`, `GET /api/search/suggestions`.
- `GET /api/users/:id/wishlist` sau middleware xác thực/scope hiện có.

`backend/repositories/postgres/stores.js` sở hữu `GET /api/stores` và `GET /api/stores/districts`.

Route public chỉ gọi hai repository này cho endpoint đã liệt kê. Các endpoint ghi (`POST /jobs/:id/apply`, `POST /products/:id/reviews`, `POST /users/:id/wishlist/:productId`) vẫn dùng SQL Server, cùng với order, payment, voucher, promotions, customer history, notifications và vouchers.

## Data access và response contract

- Mọi query dùng PostgreSQL `$n` parameters; không có helper dịch T-SQL hoặc nội suy input.
- Boolean PostgreSQL được dùng trực tiếp; `ILIKE` thay `LIKE` cho search không phân biệt hoa thường; `LIMIT` thay `TOP`.
- `products.tags` giữ kiểu `TEXT` tương thích schema hiện tại; tag filter dùng pattern chuỗi JSON (`%"tag"%`) và không đổi format dữ liệu trong đợt này.
- Danh sách và object giữ trường, status code và thứ tự sort hiện có. Chi tiết sản phẩm không thấy vẫn trả `404 { error: 'Không tìm thấy sản phẩm' }`.
- Endpoint public không trả raw PostgreSQL error; lỗi hạ tầng được chuyển qua error boundary hoặc message 500 chung.

## Bảo mật và ranh giới

- `GET /users/:id/wishlist` tiếp tục dùng `authenticate` và `requireCustomerSelf`; repository chỉ nhận user ID sau kiểm tra quyền.
- Không chuyển write path dùng dữ liệu catalog vì atomicity order/voucher là Checkpoint D.
- Không dual-write hoặc fallback giữa SQL Server/PostgreSQL cho endpoint đã chuyển. Các endpoint chưa được liệt kê tiếp tục SQL Server nguyên trạng.

## Kiểm thử và nghiệm thu

- Contract test kiểm tra filter product/category/search/tag, options, stores, reviews, search suggestion và wishlist read.
- `backend/test/postgres-public-read.integration.test.js` chạy repository/route thật qua `postgresDb`, migrations và seed trên PostgreSQL dedicated; không mock driver.
- Test live yêu cầu `POSTGRES_INTEGRATION=1` và `TEST_DATABASE_URL` qua guard. Skip không phải bằng chứng pass.
- Đợt 2 chỉ PASS khi PostgreSQL staging chạy xanh, public contract không regression và không còn T-SQL trong toàn bộ endpoint đã chuyển.

## Ngoài phạm vi

- Promotions/vouchers, orders/lookup/cancel, payments, KDS, admin và dashboard.
- Các thao tác ghi review, wishlist và job application.
- Cutover production hoặc thay thế SQL Server toàn hệ thống.
