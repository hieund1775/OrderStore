# Codex Acceptance — PostgreSQL Migration Checkpoint A

> Ngày kiểm tra: 17/08/2026  
> Commit AGY được review: `915db63`  
> Kết quả sau Codex remediation: **PASS CHECKPOINT A**

## 1. Đánh giá AGY

AGY hoàn thành tốt nền tảng app/server split, health endpoints, request context, central error handler, Swagger toggle, Node engine, dependency update và OTP service abstraction. Cấu trúc thay đổi đúng hướng và regression suite ban đầu xanh.

Tuy nhiên handoff “100%” không đúng tại thời điểm bàn giao. Các lỗi Codex phát hiện:

1. `ProductionSmsProvider` trả success giả, không gọi SMS API.
2. Production vẫn dùng in-memory OTP store, trái yêu cầu fail-closed đến khi có PostgreSQL persistence.
3. Khối reject `123456` rỗng; test chỉ pass vì không có OTP record nên không kiểm tra nhánh tuyên bố.
4. OTP được lưu trước khi provider gửi; send thất bại vẫn để lại code/cooldown.
5. Attempts/consumed state của adapter không được persist lại rõ ràng.
6. Central error handler không bảo vệ hàng chục legacy route tự trả raw `err.message`.
7. Graceful shutdown kiểm tra `db.close()` nhưng DB adapter không triển khai method này.
8. `TRUST_PROXY="1"` từ env không được parse thành số hop.
9. `server.js` gọi `validateEnv()` không truyền `process.env/isProduction`, nên lời gọi explicit không thực sự validate production config.

Chất lượng AGY ở vòng này: **nền tảng tốt nhưng nghiệm thu thiếu chiều sâu; 6,5/10 trước remediation**. Lỗi đáng chú ý nhất vẫn là claim vượt bằng chứng production.

## 2. Codex remediation

- Production SMS dùng generic HTTP provider thực, bearer auth, payload rõ, timeout 5 giây và fail khi provider trả non-2xx.
- Thêm `PHONE_OTP_ENABLED`, `SMS_PROVIDER`, `SMS_API_URL`; production startup validate cấu hình khi bật phone OTP.
- Production OTP cấm in-memory persistence và fail-closed cho đến Task 7/PostgreSQL OTP repository.
- Không sinh demo code `123456`; verify production từ chối record có hash `123456` thật.
- Chỉ lưu OTP sau khi provider chấp nhận gửi; send failure không tạo cooldown/code.
- Persist attempt/consumed state qua adapter contract.
- Thêm middleware mask mọi legacy 5xx JSON ở production trong giai đoạn route chưa chuyển sang central errors.
- Parse numeric `TRUST_PROXY` đúng kiểu.
- Thêm `db.close()` thật và sửa startup validation explicit.
- Clear readiness timeout ở cả success/failure path.

## 3. Verification

- Backend full suite: **83 pass, 0 fail, 2 skip**.
- Deploy/OTP/env targeted suite: **20 pass, 0 fail**.
- Syntax `app.js`, `server.js`, OTP provider/service: PASS.
- `npm audit --omit=dev`: **0 vulnerabilities**.
- `git diff --check`: PASS.

Hai skipped tests là SQL Server performance integration có explicit gate, không phải Checkpoint A regression.

## 4. Giới hạn được chấp nhận

- Phone OTP production hiện cố ý chưa hoạt động nếu chưa có PostgreSQL persistence. Đây là fail-closed đúng plan, không phải tính năng hoàn chỉnh.
- Generic SMS endpoint vẫn cần chủ dự án cung cấp URL/key hoặc adapter provider cụ thể trước production go-live.
- Legacy route internals vẫn còn direct `err.message`; response sanitizer ngăn leak tạm thời. Phase migration/domain conversion phải chuyển dần sang central error boundary.
- Rate-limit store vẫn in-memory; chỉ chấp nhận cho staging/một instance. Trước scale nhiều instance phải dùng shared store.

## 5. Quyết định

Sau các sửa trực tiếp của Codex, **Checkpoint A PASS**. AGY được phép bắt đầu **Checkpoint B, Task 4–6** và phải dừng gửi review khi Checkpoint B hoàn tất.
