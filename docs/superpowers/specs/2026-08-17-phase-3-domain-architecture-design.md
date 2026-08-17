# Thiết kế Phase 3 — Kiến trúc theo domain và chất lượng code

> Ngày: 17/08/2026  
> Trạng thái: Đã được chủ dự án duyệt trong hội thoại  
> Phạm vi: Phase 3, không thay đổi nghiệp vụ hoặc public API contract

## 1. Bối cảnh và quyết định đầu vào

Phase 1 đã nghiệm thu phần an toàn và tính đúng. Phase 2 đã hoàn thiện phần lớn hiệu năng database/API. Chủ dự án quyết định chấp nhận dataset benchmark 1.000 orders thay cho yêu cầu 100.000 trước đây để ưu tiên tiến độ. Việc giảm dataset không miễn các yêu cầu còn lại: benchmark phải có IO metrics, ShowPlan/access operator, chạy trên dedicated database và cleanup/restore phải fail nếu không thành công.

Phase 3 xử lý nợ kiến trúc nổi bật: `backend/routes/admin.js` và `backend/routes/public.js` đang gộp nhiều domain, SQL, orchestration và HTTP mapping trong các file lớn. Frontend cũng có các màn hình lớn với API/state/UI gắn chặt nhau.

## 2. Mục tiêu

- Chia backend theo domain nhưng giữ nguyên URL, status code và response contract.
- Đưa nghiệp vụ, transaction và SQL ra khỏi route.
- Chuẩn hóa validation, DTO, async error handling, RBAC và branch scope.
- Tách frontend theo feature một cách tăng dần, ưu tiên vùng đang được backend refactor.
- Thiết lập quality gate có thể chạy trong CI.
- Mỗi thay đổi nhỏ, kiểm thử được và có thể rollback độc lập.

## 3. Ngoài phạm vi

- Không đổi nghiệp vụ order/payment/promotion hiện hành.
- Không đổi schema database nếu không có blocker được chứng minh.
- Không đổi public URL hoặc tự thiết kế API version mới.
- Không chuyển polling sang WebSocket/SSE.
- Không rewrite framework, ORM hoặc state management toàn dự án.
- Không format toàn repository chung với commit logic.

## 4. Chiến lược triển khai

Phase 3 đi theo từng lát domain, không tách toàn bộ backend trong một lần:

1. Orders và KDS.
2. Catalog và Menu.
3. Stores và Promotions.
4. Reports, Settings và Engagement.
5. Frontend feature tương ứng sau khi backend domain ổn định.
6. Quality gate cuối: validation coverage, lint/format và CI.

Mỗi lát hoàn thành đầy đủ route, service, repository/DB adapter, DTO, test và handoff trước khi bắt đầu lát kế tiếp.

## 5. Kiến trúc backend

### 5.1. Luồng xử lý chuẩn

```text
HTTP request
→ domain route
→ validation + authentication + branch scope
→ domain service
→ repository / DB adapter
→ DTO mapper
→ HTTP response
```

### 5.2. Trách nhiệm từng tầng

- **Route:** khai báo URL/middleware, parse input đã validate, gọi service và map kết quả sang HTTP.
- **Validation:** schema allowlist, độ dài, kiểu số, enum và quan hệ field; chạy trước DB access.
- **Service:** chính sách nghiệp vụ, transaction, orchestration và phân loại lỗi nghiệp vụ.
- **Repository/DB adapter:** SQL và mapping database rows; không biết `req`/`res`.
- **DTO mapper:** output công khai/admin theo quyền, loại bỏ field nội bộ và PII không được phép.
- **Shared middleware:** async error boundary, authentication, RBAC và branch scope nhất quán.

Không tạo base class hoặc generic repository. Helper chung chỉ được trích khi ít nhất hai domain có cùng hành vi thực tế.

### 5.3. Cấu trúc đích

```text
backend/
  routes/
    admin/
      orders.js
      kitchen.js
      menu.js
      stores.js
      promotions.js
      reports.js
      settings.js
    public/
      catalog.js
      orders.js
      customers.js
      engagement.js
  services/
    orders/
    catalog/
    stores/
    promotions/
    reports/
  repositories/
    orders.js
    catalog.js
    stores.js
    promotions.js
    reports.js
  validation/
  dto/
  middleware/
```

Đây là cấu trúc định hướng, không phải yêu cầu tạo trước mọi thư mục. Chỉ tạo module khi lát domain sử dụng nó.

### 5.4. Tương thích và chuyển đổi

`admin.js` và `public.js` giữ vai trò composition trong giai đoạn chuyển tiếp. Một route chỉ bị xóa khỏi file cũ sau khi router domain mới được mount tại cùng URL và characterization/integration tests chứng minh contract tương đương. Không tồn tại hai handler production cạnh tranh cho cùng method/path.

## 6. Kiến trúc frontend

Frontend được tách sau backend domain tương ứng, theo cấu trúc tối thiểu:

```text
frontend/src/features/<domain>/
  api/
  hooks/
  components/
  types/
```

- API adapter sở hữu request/response mapping.
- Hook hoặc reducer sở hữu state flow và side effect của feature.
- Component tập trung render và interaction cục bộ.
- Checkout/POS dùng reducer hoặc hook orchestration khi nhiều state/effect cùng điều khiển một quy trình.
- Không di chuyển file chỉ để đạt cấu trúc; mỗi lần tách phải làm giảm coupling và có test/build chứng minh.

## 7. Error handling và an toàn

- Lỗi validation trả mã 4xx ổn định trước khi gọi DB.
- Lỗi nghiệp vụ dùng error code nội bộ rõ ràng và được route map nhất quán.
- Lỗi SQL/stack được log nội bộ; production response không trả trực tiếp `err.message` hoặc query text.
- Transaction rollback và cleanup/restore bắt buộc propagate lỗi nếu không hoàn tất.
- RBAC và branch scope chạy trước repository query; input/cursor không được ghi đè scope đã resolve.
- Existing concurrency, idempotency và payment invariants từ Phase 1 phải được giữ nguyên.

## 8. Chiến lược kiểm thử

Mỗi lát domain thực hiện theo thứ tự:

1. Thêm characterization tests chạm production route/module hiện tại.
2. Tách module mà giữ nguyên fixture, URL và expected contract.
3. Thêm unit test cho service/validation/DTO khi có nhánh nghiệp vụ đáng kể.
4. Chạy HTTP integration cho RBAC, branch isolation, success, validation và DB failure mapping.
5. Chạy toàn bộ backend regression.
6. Nếu có frontend liên quan, chạy production-module Vitest và production build.
7. Commit và handoff riêng; Codex nghiệm thu trước lát kế tiếp.

Test copy/paste implementation không được tính là bằng chứng. Mock được phép tại boundary repository/external provider, nhưng test phải import production module.

## 9. Lát 1 — Orders và KDS

Lát đầu tiên bao gồm:

- Admin order list/detail và cursor pagination.
- KDS list và status transition.
- Public create/lookup/cancel/history order.
- Price calculation, payment mapping và DTO liên quan trực tiếp.
- Giữ nguyên state-transition policy, branch scope, cancellation token và concurrency guarantees.

Lát 1 không bao gồm catalog CRUD độc lập, promotion CRUD, reports hoặc settings dù route orders có thể đọc dữ liệu của chúng qua interface hiện hữu.

## 10. Commit và handoff

- Mỗi commit chỉ chứa một mục đích: characterization test, extraction hoặc quality configuration.
- Không trộn format cơ học với logic.
- Handoff ghi commit, file production, test command, kết quả và giới hạn chưa kiểm chứng.
- AGY không tuyên bố hoàn tất lát tiếp theo khi lát hiện tại chưa được Codex nghiệm thu.
- Lỗi lặp hoặc claim vượt bằng chứng tiếp tục được ghi vào report trong `docs/reviews`.

## 11. Acceptance Phase 3

Phase 3 chỉ PASS khi:

- `admin.js` và `public.js` chỉ composition hoặc đã được thay bởi domain routers rõ ràng.
- Route không còn SQL dài hoặc business orchestration đáng kể.
- API quan trọng có validation và DTO rõ ràng.
- Không lộ lỗi SQL nội bộ ở production.
- URL, status code, response, RBAC, branch isolation và nghiệp vụ không regression.
- Backend regression, frontend tests/build và lint/CI đều xanh.
- Mỗi domain có test production-path và handoff tái lập được.

## 12. Điều kiện dừng và rollback

Nếu một lát làm thay đổi contract hoặc tạo regression Blocker/High, AGY dừng ở lát đó, sửa và gửi nghiệm thu lại. Không mở rộng sang domain tiếp theo. Vì router cũ được giữ đến khi module mới đạt test, rollback thực hiện bằng cách bỏ mount module mới và khôi phục handler cũ trong commit của chính lát đó, không reset các thay đổi ngoài phạm vi.
