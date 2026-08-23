# Kế Hoạch Triển Khai: Phân Tầng Rate Limiting & Tối Ưu Polling Tránh Lỗi 429

**Ngày tạo**: 23/08/2026  
**Người lập**: Antigravity (AGY)  
**Tài liệu thiết kế**: [`docs/superpowers/specs/2026-08-23-rate-limiting-and-polling-architecture-design.md`](file:///D:/Code/Extra/Planning_DuAn/Order/docs/superpowers/specs/2026-08-23-rate-limiting-and-polling-architecture-design.md)  
**Trạng thái**: Draft / Chờ Codex & Đại ca duyệt

---

## 1. Danh Sách Công Việc Chi Tiết (Implementation Tasks)

### Task 1: Backend — Cấu Trúc Lại Rate Limiters trong `backend/app.js`
- **Mục tiêu**: Tách rạch ròi rate limiter giữa Mutation (`POST /api/orders`, `/cancel`, `/vouchers/apply`, `/auth`) và Read-only Polling/Catalog.
- **Tệp thay đổi**: [`backend/app.js`](file:///D:/Code/Extra/Planning_DuAn/Order/backend/app.js).
- **Chi tiết**:
  1. Thay thế `sensitiveLimiter` chung ở prefix `/api/orders` bằng:
     - `orderMutationLimiter` (`max: 60` req / 15 min): Chỉ áp dụng cho các route `POST` (`/api/orders`, `/api/orders/cancel`, `/api/orders/:id/cancel`, `/api/vouchers/apply`).
     - `authLimiter` (`max: 30` req / 15 min): Áp dụng cho `/api/auth` và `/admin/login`.
     - `generalLimiter` (`max: 1200` req / 15 min): Áp dụng cho toàn bộ `/api` còn lại (lookup polling, status polling, catalog, stores).
  2. Bật `standardHeaders: true` và `legacyHeaders: false` để trả về chuẩn IETF RateLimit headers.
  3. Không dùng `generalLimiter = 1200` để bù polling. Tạo `pollingLimiter` riêng cho `GET /api/orders/lookup` và `GET /api/payments/payos/status`, với key gồm IP + mã đơn đã chuẩn hóa và ngân sách đủ cho một phiên giao dịch dài.
  4. Đảm bảo route đã có limiter chuyên biệt không bị tính thêm vào general limiter, hoặc ghi rõ và kiểm thử hành vi double-limit.
  5. Giữ lookup response ở mức DTO hiện tại, không mở rộng PII chỉ vì polling được nới giới hạn.

---

### Task 2: Backend — Bổ Sung Test Suite Kiểm Thử Rate Limiting Phân Tầng
- **Mục tiêu**: Đảm bảo các route tra cứu đơn có thể được gọi liên tục trên 30 lần mà không gặp 429, trong khi route tạo đơn vẫn được bảo vệ.
- **Tệp tạo mới**: `backend/test/rate-limiting-tiering.test.js`.
- **Chi tiết**:
  1. Test polling lookup: Gửi 30+ requests `GET /api/orders/lookup` liên tiếp $\rightarrow$ Tất cả đều nhận status khác 429 (200 / 400).
  2. Test mutation protection: Xác minh `orderMutationLimiter` được gắn đúng trên các route POST.

---

### Task 3: Frontend — Tối Ưu Vòng Đời Polling tại `thanh-toan.tsx`
- **Mục tiêu**: Giảm thiểu request không cần thiết và tránh rò rỉ polling.
- **Tệp thay đổi**: [`frontend/src/routes/thanh-toan.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/routes/thanh-toan.tsx).
- **Chi tiết**:
  1. Dừng polling khi `countdownSec <= 0` (hết hạn).
  2. Lắng nghe sự kiện `visibilitychange` để tạm dừng interval khi tab ẩn và fetch ngay 1 lần khi tab active trở lại.
  3. Dùng chained timeout hoặc polling controller; không tạo lại `setInterval` mỗi lần `countdownSec` thay đổi và không cho phép request kế tiếp bắt đầu trước khi request hiện tại hoàn tất.
  4. Khi gặp 429/5xx/lỗi mạng, dùng exponential backoff có trần; khi `paid` hoặc hết hạn thì dừng hoàn toàn.

---

### Task 4: Frontend — Tối Ưu Vòng Đời Polling tại `theo-doi-don.tsx`
- **Mục tiêu**: Dừng polling khi đơn hàng đã kết thúc.
- **Tệp thay đổi**: [`frontend/src/routes/theo-doi-don.tsx`](file:///D:/Code/Extra/Planning_DuAn/Order/frontend/src/routes/theo-doi-don.tsx).
- **Chi tiết**:
  1. Kiểm tra trạng thái đơn: nếu `current_status === 'Hoàn thành'` hoặc `'Đã hủy'`, dọn sạch timer `clearInterval` ngay lập tức.
  2. Tạm dừng khi tab ẩn (`document.hidden`).
  3. Dừng khi `payment_status` là `expired`, khi đã `paid` và trạng thái terminal, hoặc khi lookup trả 404/403.
  4. Dùng chained timeout/polling controller để không chồng request; tab hiện lại kiểm tra ngay một lần.

---

### Task 5: Chạy Kiểm Thử Toàn Diện & Build Production
- **Lệnh thực thi**:
  ```bash
  # Backend
  cd backend && npm test
  # Frontend
  cd frontend && npx tsc --noEmit && npm run test && npm run build
  ```

---

## 2. Tiêu Chí Nghiệm Thu (Acceptance Checklist)

- [ ] Polling `GET /api/orders/lookup?code=...` chạy trên 60s/15p không còn gặp lỗi 429.
- [ ] Polling lookup/status đi qua limiter riêng, không bị general limiter hoặc double-limit ngoài thiết kế.
- [ ] Endpoint tạo đơn `POST /api/orders` vẫn có rate limit bảo vệ chống spam (60 req / 15 min).
- [ ] Frontend tự động dọn sạch interval khi đơn đã kết thúc hoặc tab ẩn.
- [ ] Không có request polling chồng nhau; 429/5xx/network error có backoff giới hạn.
- [ ] Rate limit polling không làm lộ PII hoặc làm yếu bảo vệ mã đơn.
- [ ] Tất cả các bài test tự động backend và frontend đều pass 100%.
