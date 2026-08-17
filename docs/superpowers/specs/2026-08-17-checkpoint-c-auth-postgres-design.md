# Checkpoint C / Đợt 1 — Chuyển identity sang PostgreSQL

## Mục tiêu

Chuyển toàn bộ domain identity của TeaPlus sang PostgreSQL: đăng nhập admin, phiên `/admin/me`, OTP khách hàng và đăng nhập Google. API giữ nguyên request/response và thông điệp nghiệp vụ đang công khai. Các domain catalog, đơn hàng, thanh toán và admin khác không nằm trong đợt này.

Production không chuyển traffic sang PostgreSQL trước khi staging riêng chạy thành công các integration test của đợt này.

## Phạm vi và ranh giới

- Route `backend/routes/auth.js` và `backend/routes/customerAuth.js` gọi repository PostgreSQL trực tiếp; không có nhánh SQL Server theo biến môi trường trong cùng handler.
- `backend/repositories/postgres/users.js` là nơi duy nhất truy cập bảng `users` và `user_identities` cho domain identity.
- `backend/repositories/postgres/otp.js` là nơi duy nhất truy cập `otp_codes`.
- `backend/services/otp-service.js` chỉ chuẩn hóa dữ liệu, tạo/hash OTP, gửi provider và điều phối repository. In-memory OTP chỉ còn cho test adapter rõ ràng, không được là fallback production.
- Các route chưa thuộc Checkpoint C tiếp tục chạy SQL Server. Không dual-write và không đồng bộ identity giữa hai database trong runtime.

## Luồng identity

### Admin

`POST /admin/login` tìm admin active theo số điện thoại từ PostgreSQL, xác thực bcrypt, rồi phát JWT giữ payload hiện có và thêm `token_version`. `GET /admin/me` truy vấn lại user PostgreSQL.

`authenticate` xác minh chữ ký và hạn JWT, sau đó ở protected session boundary tải user hiện tại từ PostgreSQL. Token bị từ chối nếu user không tồn tại, không active, hoặc `token_version` không khớp. Quy tắc role vẫn dùng claim đã xác thực sau bước kiểm tra này.

### OTP khách hàng

Gửi OTP tạo mã 6 số an toàn; chỉ sau khi provider chấp nhận gửi mới lưu hash, thời điểm hết hạn, số lần thử và thời điểm gửi trong `otp_codes`. Repository dùng transaction và row lock để kiểm tra hạn, số lần thử, chống replay và đánh dấu consumed trong một thao tác tuần tự. Mã sai tăng attempt atomically; mã hợp lệ chỉ được dùng một lần.

Sau khi OTP hợp lệ, repository lấy hoặc tạo customer bằng phone với xử lý race unique. Route vẫn trả token và object `user` như hiện tại. Job cleanup là command riêng, xóa OTP hết hạn/đã consume; không đặt timer trong web process.

### Google

Sau khi Google ID token được thư viện chính thức xác minh, định danh bền vững là cặp `provider='google'` và `provider_subject=payload.sub` trong `user_identities`. Email chỉ cập nhật profile/contact, không dùng để ghép tài khoản. Việc tạo user + identity chạy trong một transaction; va chạm unique trả lỗi nghiệp vụ không lộ PostgreSQL.

## Lỗi và bảo mật

- Không response lỗi SQL, connection string, query hay stack trace.
- Unique race được phân loại thành response nghiệp vụ ổn định; lỗi hạ tầng trả thông báo chung 500 và được log ở server.
- Production thiếu repository PostgreSQL hoặc cấu hình kết nối phải fail closed cho OTP, không dùng bộ nhớ tạm.
- Mọi query PostgreSQL dùng `$n` parameter; không nội suy dữ liệu đầu vào vào SQL.

## Kiểm thử và nghiệm thu

- Unit/contract test bao phủ validation input, lỗi public, payload JWT, token-version revoke, Google subject mapping, OTP expiry/attempt/replay.
- `backend/test/postgres-auth.integration.test.js` gọi route/repository/adaptor thật trên PostgreSQL dedicated, không mock `pg` hay gọi `Pool` trực tiếp.
- Live test chỉ chạy khi `POSTGRES_INTEGRATION=1` và `TEST_DATABASE_URL` qua guard hiện có. Thiếu hai điều kiện này là test skip có chủ đích và là gate chưa đạt, không phải PASS.
- Đợt 1 PASS khi auth PostgreSQL staging thật xanh, HTTP contract không regression, và không còn T-SQL trong các đường auth/OTP/Google đã chuyển.

## Ngoài phạm vi

- Catalog, stores và public reads (Checkpoint C / đợt 2).
- Promotions, orders, payments, KDS, báo cáo và data import/cutover.
- Chuyển toàn bộ application runtime hay production `DATABASE_URL` sang PostgreSQL.
