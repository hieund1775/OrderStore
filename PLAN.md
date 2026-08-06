# PLAN.MD — Kế hoạch triển khai (Giai đoạn 0 + 1 + 2)

> Dựa trên: `plan_architecture/plan.md` (master plan đã chuẩn hóa), `.cursorrules` (quy trình làm việc).
> **Nguyên tắc**: Làm xong bước nào tick `[x]` bước đó. Chỉ sửa đúng các file trong PLAN này.

---

## GIAI ĐOẠN 0: ẨN ROUTE THỪA THEO SCOPE MỚI (Frontend)

### 0.1. Xóa route file (TanStack Router tự regen `routeTree.gen.ts` khi dev/build)

- [x] Xóa `frontend/src/routes/admin.kho.tsx` (Kho/nguyên liệu)
- [x] Xóa `frontend/src/routes/admin.khach-hang.tsx` (CRM khách hàng)
- [x] Xóa `frontend/src/routes/su-kien.tsx` (Sự kiện)
- [x] Xóa `frontend/src/routes/hoi-vien.tsx` (Thẻ hội viên)

### 0.2. Sửa file (bỏ link/nav thừa)

- [x] `AdminSidebar.tsx` — bỏ nav Kho + Khách hàng; nhãn "Khuyến mãi & Voucher"; v4.0
- [x] `Header.tsx` — bỏ nav Sự kiện + Thẻ hội viên
- [x] `admin-data.ts` — bỏ urgentKpi "Nguyên liệu sắp hết"
- [x] `Footer.tsx` — bỏ link "Khuyến mãi & sự kiện" + "Thẻ hội viên" *(phát hiện thêm khi grep, thuộc mục tiêu 0.3)*
- [x] `routes/index.tsx` — hero CTA "Xem ưu đãi" → "Ghé cửa hàng"; card "Tích điểm mỗi ly" → card "Voucher giảm giá %" *(phát hiện thêm, thuộc mục tiêu 0.3)*
- [x] `routes/sitemap[.]xml.ts` — bỏ 2 entry `/su-kien`, `/hoi-vien` *(phát hiện thêm, thuộc mục tiêu 0.3)*

### 0.3. Xác minh

- [x] `npm run build` — ✅ thành công (không lỗi TS, routeTree.gen.ts regen sạch)
- [x] Grep `admin/kho|admin/khach-hang|su-kien|hoi-vien` toàn `src/` — không còn tham chiếu

---

## GIAI ĐOẠN 1: CORE BACKEND — BẢO MẬT + JWT/RBAC + ENGINE TÍNH GIÁ SERVER-SIDE

### 1.1. Cài đặt package (Backend)

- [x] `npm i helmet express-rate-limit jsonwebtoken bcryptjs`

### 1.2. File sửa/tạo mới

| File | Thao tác | Trạng thái |
|---|---|---|
| `backend/index.js` | Sửa | [x] Helmet + CORS (whitelist `FRONTEND_URL`) + rate limit 100 req/15p cho `/api/orders`, `/api/vouchers/apply`, `/admin/login`; mount `routes/auth.js` |
| `backend/middleware/auth.js` | **Tạo mới** | [x] `signToken` (JWT HS256 8h), `authenticate`, `requireRole(...)` |
| `backend/routes/auth.js` | **Tạo mới** | [x] `POST /admin/login` (bcrypt verify + is_admin=1), `GET /admin/me` |
| `backend/routes/admin.js` | Sửa | [x] Gắn `authenticate + requireRole` toàn bộ; `PATCH /admin/orders/:id/status` (ghi `order_status_history` + `kitchen_notified_at`); CRUD `/admin/tables` (POST tự sinh token 16-byte); `POST /admin/orders/:id/print` |
| `backend/routes/public.js` | Sửa | [x] `GET /api/table/resolve`, `POST /api/orders` (transaction atomic), `POST /api/vouchers/apply` |
| `backend/services/price-engine.js` | **Tạo mới** | [x] `calcLineTotals` (giá 100% từ DB), `validateVoucher` (% + max_discount + min_order + single_use/time_bounded), `consumeVoucher` (UPDATE atomic chống race), `generateOrderCode` (TP+YYMMDD+4 số) |
| `backend/config/db.js` | Sửa | [x] Trả `rowsAffected` thật + thêm `db.transaction(fn)` (BEGIN/COMMIT/ROLLBACK) |
| `backend/database/seed.sql` | Sửa | [x] 4 admin đổi hash placeholder → bcrypt thật (`admin123`) |
| `backend/.env.example` | Sửa | [x] Thêm `JWT_SECRET`, `FRONTEND_URL` |

### 1.3. API Contract — `POST /api/orders` (Zero-Trust Price Engine) — [x] code + test ✅ 05/08/2026

### 1.4. API Contract — `POST /api/vouchers/apply` — [x] code + test ✅ 05/08/2026

### 1.5. JWT/RBAC phạm vi — [x] Verified:
- `POST /admin/login` public + rate limit ✅ (200 đúng mật khẩu; 401 sai mật khẩu; 401 khách thường; 429 sau 110 req)
- `/admin/*` còn lại bắt buộc JWT ✅ (401 thiếu token, 401 token rác, 200 token hợp lệ)
- `GET /api/table/resolve` ✅ (200 table 1; 404 table 999)
- Test DB thật ✅: login → tạo đơn (Zero-Trust: gửi giá 1000 → backend tính 45000) → CAMSA11/SNOW30/SINGLE10 → rollback (không đơn rác) → PATCH status (ghi history + kitchen_notified_at) → CRUD bàn → print tracking. Chi tiết tick trong `plan_architecture/testing.md`.

### 1.6. State management (frontend) — không đổi ✅

### Ghi chú môi trường (05/08/2026)
- SQL Server `localhost\SQLEXPRESS` chạy **Named Pipes** (không có TCP listener, SQLBrowser tắt) → backend dùng `msnodesqlv8` với Windows Auth (`DB_TRUSTED=true`).
- `msnodesqlv8` có bug prepared statement nhiều tham số (`@p1 already declared`) → `config/db.js` inline tham số có escape an toàn khi `DB_TRUSTED=true`; vẫn dùng parameterized chuẩn khi SQL Auth.
- Đã tạo login `teaplus_app` (db_owner teaplus_db) cho hướng SQL Auth về sau.

---

## KHÔNG LÀM TRONG PLAN NÀY

- Màn hình bếp Kanban/âm thanh (Giai đoạn 3), In bill UI (Giai đoạn 5), Báo cáo tinh gọn (Giai đoạn 6) — chờ PLAN riêng sau khi duyệt.
- Không refactor file/đổi cấu trúc ngoài phạm vi (theo Refactor Policy).
- Không commit push — chờ bạn duyệt từng bước.

---

# GIAI ĐOẠN 2: QUẢN LÝ VỊ TRÍ BÀN & QUÉT QR ĐẶT MÓN

> Backend CRUD bàn + `/api/table/resolve` + `/admin/orders/:id/print` **đã hoàn thành ở Giai đoạn 1** (đã test). Giai đoạn 2 này làm **Frontend kết nối hệ thống** theo plan.md: `admin.vi-tri.tsx`, banner QR ở Menu, đính kèm `table_id` khi thanh toán.

## Khảo sát (05/08/2026)

- Frontend **chưa có API layer** (chỉ data demo `lib/data.ts`, `lib/admin-data.ts`; `server.ts` chỉ là entry TanStack Start).
- `CartItem` lưu `productId` (slug), size/base/sugar/ice/toppings bằng **nhãn hiển thị** — backend cần `product_id`/`size_id`/`topping_ids` (int) → cần map slug→id qua `/api/products` + `/api/options/*` khi submit.
- Admin chưa có luồng login frontend để nhận JWT gọi `/admin/*` → **bắt buộc thêm** (mở rộng cần thiết ngoài plan.md — ghi rõ để duyệt).

## 2.1. API client + Admin login (nền tảng cho mọi API gọi sau)

- [x] `frontend/src/lib/api.ts` — apiFetch/apiGet/apiPost/apiPatch/apiPut/apiDelete + token localStorage
- [x] `frontend/src/routes/admin.login.tsx` — trang đăng nhập admin (SĐT + mật khẩu → JWT → /admin)
- [x] `frontend/src/routes/admin.tsx` — `beforeLoad` kiểm tra token → redirect /admin/login; render login full-width
- [x] `AdminSidebar.tsx` — thêm nav `/admin/vi-tri` "Vị trí & Mã QR bàn"

## 2.2. Trang Quản lý Vị trí & Mã QR (`/admin/vi-tri`)

- [x] `frontend/src/routes/admin.vi-tri.tsx` — CRUD bàn thật (API /admin/tables), filter chi nhánh, QR dataURL mỗi bàn, nút Tải PNG + In QR (popup print), xóa có xác nhận, empty state
- [x] Cài `qrcode` + `@types/qrcode`

## 2.3. Menu: Banner Quét QR Bàn (`/menu?table_id=X`)

- [x] `menu.tsx` — `validateSearch` đọc `table_id`, gọi `/api/table/resolve`, banner "📍 Bạn đang ngồi tại: Bàn X - Chi nhánh Y"; **sửa lỗi flow**: lưu `teaplus_table_id` vào sessionStorage để link "Thanh toán" không mất bàn

## 2.4. Thanh Toán: đính kèm `table_id` + gọi `POST /api/orders` thật

- [x] `thanh-toan.tsx` — đọc table_id (URL + sessionStorage), banner bàn + mặc định "Tại bàn", áp voucher thật (`/api/vouchers/apply`), submit `POST /api/orders` với map slug→id qua `/api/products` + `/api/options/*`, success → toast + navigate theo dõi đơn

## Verify (đã chạy thật bằng agent-browser 05/08/2026) ✅

- [x] `npm run build` không lỗi TS
- [x] `/admin/login` → đăng nhập thành công → vào `/admin`
- [x] `/admin/vi-tri` → tạo "Bàn 06 - Test QR" → QR hiển thị → đổi tên thành "Bàn 06 - Tầng 2"
- [x] Quét QR giả lập `/menu?table_id=10` → banner "Bạn đang ngồi tại: Bàn 06" xuất hiện
- [x] Thêm món → click "Thanh toán" (SPA nav giữ giỏ + bàn) → banner "Đặt món tại: Bàn 06" + "Bàn đã được gắn vào đơn"
- [x] Đặt đơn → toast "Mã đơn TP2608056630 · 45.000₫" → navigate theo dõi đơn
- [x] Verify DB: đơn TP2608056630 có `table_id=10`, `location_name="Bàn 06 - Tầng 2"`, `total=45000`, status "Chờ xác nhận"
- [x] web-design-guidelines review: thêm `aria-label` 4 icon-button vi-tri + `inputMode="tel"` login

---

# GIAI ĐOẠN 3: MÀN HÌNH BẾP KANBAN & THÔNG BÁO TỨC THÌ (KDS)

> Khảo sát 05/08/2026: `admin.bep.tsx` hiện dùng **data demo tĩnh** (`adminOrders`), không polling, không âm thanh, không tự ẩn đơn xong. API `GET /admin/kitchen/orders` **đã có** (trả orders + items + toppings, current_status ∈ Chờ xác nhận/Đã xác nhận/Đang chuẩn bị) nhưng **thiếu** `location_name`, `table_id`, `note`, `customer_phone` cho chi tiết đơn → bổ sung.

## 3.1. Backend — bổ sung chi tiết vào API bếp

- [x] `backend/routes/admin.js` — `GET /admin/kitchen/orders`: thêm `table_id, location_name, note, customer_phone` vào SELECT

## 3.2. Frontend — viết lại `admin.bep.tsx` kết nối hệ thống

- [x] **Polling realtime** 10 giây, phát hiện đơn mới (so sánh id)
- [x] **Chuông báo "Ding dong"** Web Audio (oscillator E6→C6), nút bật/tắt, unlock lần tương tác đầu
- [x] **3 cột Kanban**: Chờ làm (Chờ xác nhận/Đã xác nhận) → Đang chuẩn bị → Hoàn thành (tự ẩn sau 5 phút)
- [x] **Chuyển trạng thái 1-click** `PATCH /admin/orders/:id/status`
- [x] **Cảnh báo > 15 phút**: đếm realtime `0′00″`, viền đỏ + nhấp nháy
- [x] **Dialog chi tiết**: click thẻ → mã đơn, bàn, món + toppings + note, SĐT, loại đơn
- [x] **Thẻ đơn mới** nhấp nháy 6 giây

## Verify Giai đoạn 3 (agent-browser 05/08/2026) ✅

- [x] Build không lỗi TS
- [x] KDS hiển thị đơn thật từ API (TP2608053919, TP2608053365)
- [x] Tạo đơn mới qua API (TP2608053357) → sau 10s polling xuất hiện trên KDS
- [x] Bấm "Bắt đầu làm" → đơn sang cột Đang chuẩn bị (nút "Hoàn thành")
- [x] Bấm "Hoàn thành" → sang cột Hoàn thành (nút "Lùi lại")
- [x] Verify DB: history = [Chờ xác nhận, Đang chuẩn bị, Hoàn thành], `kitchen_notified_at` set
- [x] Click thẻ → dialog chi tiết đầy đủ

---

# GIAI ĐOẠN 5: XUẤT HÓA ĐƠN & MẪU IN BILL HTML (K80/K57)

> Theo giảng viên: **"thực đơn giống máy in, giống html gọi máy in ra để in"**. Backend `POST /admin/orders/:id/print` (set `is_printed=1`) **đã có + đã test** ở Giai đoạn 1. Phần này làm UI In Bill.

## 5.1. Component InBillModal

- [x] `frontend/src/components/admin/InBillModal.tsx` (mới):
  - Preview bill **80mm** đen trắng: logo, cửa hàng, hotline, mã đơn, bàn, giờ, khách + SĐT, món (size/topping/ghi chú), Subtotal − Giảm = TỔNG, QR đơn, cảm ơn
  - Nút **"In hóa đơn"** → `POST /admin/orders/:id/print` (is_printed=1) → mở print window HTML `@media print` (80mm) → `window.print()`

## 5.2. Gắn nút In bill

- [x] `admin.bep.tsx` — dialog chi tiết: nút "In hóa đơn" (dữ liệu thật từ `/admin/kitchen/orders` — đã bổ sung `subtotal/discount/total/payment_method` vào API)
- [x] `admin.don-hang.tsx` — dialog chi tiết: nút "In bill" (map từ data hiện có)
- [x] Sửa lỗi TS từ Giai đoạn 2: `validateSearch` cần return type `{ table_id?: string }` (optional) — ảnh hưởng mọi Link tới /menu, /thanh-toan

## Verify Giai đoạn 5 (agent-browser 05/08/2026) ✅

- [x] `npx tsc --noEmit` sạch + build OK
- [x] Mở đơn TP2608053919 → "In hóa đơn" → preview 80mm đầy đủ (TRÀ TRÁI CÂY TÔ, Hotline, Mã đơn, Khách, 1× Trà Cam Sả, 45.000₫, TỔNG CỘNG, Cảm ơn)
- [x] Bấm In → `is_printed = true` trong DB (print tracking)

---

# GIAI ĐOẠN 4: QUẢN LÝ KHUYẾN MÃI & VOUCHER ADMIN

> Voucher engine backend (validate/consume/apply) **đã xong + test** (Giai đoạn 1). Checkout áp mã **đã xong + test** (Giai đoạn 2). Còn: trang admin quản lý voucher + bổ sung 2 cột thiếu vào backend.

## 4.1. Backend — bổ sung loại mã vào CRUD promotions

- [x] `admin.js` POST /promotions: thêm `voucher_type` (mặc định time_bounded) + `usage_limit` vào INSERT
- [x] `admin.js` PUT /promotions/:id: thêm `voucher_type`, `usage_limit` vào danh sách field

## 4.2. Frontend — viết lại `admin.khuyen-mai.tsx` kết nối hệ thống

- [x] Danh sách từ `GET /admin/promotions`: Mã, % giảm, Loại mã (🎟️ 1 lần / 📅 thời hạn), Max giảm, Min đơn, Hạn dùng, Lượt dùng, Trạng thái, Switch bật/tắt
- [x] Modal tạo/sửa: title, code, discount_value %, max_discount, min_order, voucher_type, usage_limit (chỉ khi time_bounded), start_date, end_date
- [x] Xóa nội dung marketing cũ (Flash Sale, Happy Hour, banner) — đúng scope giảng viên

## Verify Giai đoạn 4 (agent-browser 05/08/2026) ✅

- [x] `npx tsc --noEmit` sạch + build OK
- [x] Danh sách voucher thật hiển thị (FREESHIPW, CAMSA11, SNOW30, SINGLE10...)
- [x] Tạo mã TEST1LAN qua UI (single_use, 15%, max 50.000) → xuất hiện trong bảng
- [x] Verify DB: `voucher_type=single_use, discount_value=15, max_discount=50000, is_active=true, status="Đang diễn ra"`
- [x] Áp mã: đơn 100.000 → giảm 15.000 (15%) ✅; đơn thật 45.000 → giảm 6.750 ✅

---

# GIAI ĐOẠN 6: DASHBOARD & BÁO CÁO TINH GỌN

> Theo giảng viên: **"báo cáo cứ để và làm gọn"** — không phân tích nguyên liệu/khâu sơ chế. API backend đã đủ (reports/summary + dashboard/*).

## 6.1. Backend

- [x] `admin.js` thêm `GET /admin/reports/kpi-summary`: Doanh thu, Tổng đơn, AOV, Tỷ lệ hủy (%) theo from/to

## 6.2. Frontend — viết lại `admin.bao-cao.tsx` kết nối hệ thống

- [x] Bộ lọc khoảng ngày `from/to` → gọi lại API
- [x] 4 KPI cards: Doanh thu, Tổng đơn, AOV, Tỷ lệ hủy (kpi-summary)
- [x] Biểu đồ: Doanh thu theo giờ (bar), theo danh mục (pie), theo chi nhánh (bar) — dashboard/*
- [x] Top 10 món bán chạy (bảng: tên, số ly, doanh thu)
- [x] Nút Export CSV (client-side, có BOM UTF-8)
- [x] Bỏ: nguyên liệu (`ingredientUsage`), top nhân viên (`topStaff`)

## Verify Giai đoạn 6 (agent-browser 05/08/2026) ✅

- [x] `npx tsc --noEmit` sạch + build OK
- [x] KPI thật: Doanh thu 264.250₫, AOV 52.850₫, Tỷ lệ hủy 0%
- [x] Top món thật: Trà Cam Sả Mật Ong, Trà Dâu Tây Lài Thơm...
- [x] Charts hiển thị (giờ/danh mục/chi nhánh)

## ✅ HOÀN THÀNH TOÀN BỘ 7 GIAI ĐOẠN (05/08/2026)

## API contract đã có (Giai đoạn 1 — không đổi)

- `POST /admin/login` `{phone, password}` → `{token, user}`
- `GET /admin/tables` / `POST /admin/tables {store_id, name}` / `PUT /admin/tables/:id` / `DELETE /admin/tables/:id`
- `GET /api/table/resolve?table_id=X` → `{table: {id, name, store_id, store_name, store_address}}`
- `POST /api/orders` (Zero-Trust) — xem mục 1.3
- `POST /api/vouchers/apply` `{code, subtotal, customer_phone}`

## Verify

- `bun run build` — hết lỗi TS.
- Chạy dev: `/admin/login` → vào `/admin/vi-tri` tạo bàn → scan QR → `/menu?table_id=X` hiện banner → đặt món → `/thanh-toan` gắn bàn → đặt đơn thành công → đơn hiện ở `/admin/don-hang`.

---

# GIAI ĐOẠN 7: KẾT NỐI TOÀN HỆ THỐNG & ĐÓNG LỖ HỔNG (05/08/2026)

> Sau khi đối chiếu `plan_architecture/plan.md` với code: các trang `/theo-doi-don`, `admin.don-hang`, `admin.index`, `admin.thuc-don`, `admin.thong-bao`, `admin.chi-nhanh`, `admin.cai-dat` còn dùng **data demo**; thiếu API khách tra cứu/hủy đơn; audit log chưa tự ghi; export chỉ có CSV. Giai đoạn này đóng toàn bộ.

## 7.1. Backend

- [x] `backend/routes/public.js` — thêm `GET /api/orders/lookup?code=` (đơn + items + toppings + status_history) và `POST /api/orders/:id/cancel` (transaction, chỉ hủy khi `Chờ xác nhận`, ghi `Đã hủy` + `cancel_reason`)
- [x] `backend/services/audit.js` (mới) — `logAudit(user, action, detail, req)` ghi `audit_logs` kèm IP + user-agent, không fail thao tác chính
- [x] `backend/routes/admin.js` — gắn audit log vào: đổi trạng thái đơn, hủy đơn, in bill, CRUD bàn, CRUD danh mục/món + toggle, CRUD khuyến mãi, cập nhật chi nhánh, gửi thông báo

## 7.2. Frontend

- [x] `theo-doi-don.tsx` — viết lại: đọc `?code=` (QR/URL), polling 5s, timeline 5 bước thật + trạng thái Đã hủy, chi tiết đơn (món/topping/tổng), nút Hủy đơn (AlertDialog + lý do, chỉ khi `Chờ xác nhận`), trạng thái không có mã → ô nhập mã
- [x] `thanh-toan.tsx` — navigate kèm `code` sau đặt đơn
- [x] `admin.don-hang.tsx` — viết lại: list/kanban từ `GET /admin/orders` (lọc chi nhánh/trạng thái/loại/PTTT/tìm kiếm), chi tiết từ `GET /admin/orders/:id` (items + toppings + history), chuyển trạng thái 1-click, hủy có lý do, InBill dữ liệu thật
- [x] `admin.index.tsx` — viết lại: KPI + cảnh báo khẩn + doanh thu theo giờ + đơn đang chờ từ `/admin/dashboard/*` + `/admin/orders`
- [x] `admin.thuc-don.tsx` — viết lại: CRUD danh mục/món thật, toggle bật/tắt, tab tùy chọn từ `/admin/menu/*`
- [x] `admin.thong-bao.tsx` — viết lại từ `GET /admin/notifications`
- [x] `admin.chi-nhanh.tsx` — viết lại từ `GET /admin/branches` + PUT (chỉnh sửa + bật/tắt)
- [x] `admin.cai-dat.tsx` — tài khoản + audit log thật từ `/admin/settings/*`
- [x] `admin.login.tsx` — bỏ hardcode `localhost:5000`, dùng API client chung
- [x] `admin.bao-cao.tsx` — thêm export **Excel** (xlsx) + **PDF** (jspdf + jspdf-autotable); cài `xlsx`, `jspdf`, `jspdf-autotable`

## Verify Giai đoạn 7 (05/08/2026) ✅

- [x] `npx tsc --noEmit` sạch + `npm run build` OK
- [x] Backend chạy thật + curl: lookup VX26072801 (200) / mã rác (404); tạo đơn TP2608054348 (Zero-Trust 65.000₫ = 45.000 + 10.000 size + 10.000 topping) → hủy thành công → hủy lại bị 400; hủy đơn `Đang chuẩn bị` bị 400
- [x] Audit log: PATCH đơn 2 → `Đã xác nhận` → `audit_logs` có dòng mới (user Quân, action, detail, ip ::1)
- [x] Dashboard KPI trả số thật; `/admin/orders?status=Đã xác nhận` lọc đúng

## 7.3. Google Maps — trang cửa hàng & sửa bug checkout chi nhánh (05/08/2026)

- [x] `cua-hang.tsx` — viết lại: store thật từ `GET /api/stores` (id số + lat/lng từ DB), iframe **Google Maps embed** (không cần API key, `q=lat,lng&output=embed`) căn giữa chi nhánh đang chọn, click thẻ → map di chuyển; nút **GPS** (geolocation + Haversine → chi nhánh gần nhất + toast khoảng cách); nút **Chỉ đường** (Google Maps directions URL); nút **"Đặt từ chi nhánh này"** → lưu `teaplus_store_id` → `/menu`
- [x] `thanh-toan.tsx` — sửa bug tiềm ẩn: trước đây Select chi nhánh dùng store mock (id 'q1'...) → `Number(branch)` = NaN → đơn lỗi khi không quét QR; giờ load `/api/stores` thật (id số), mặc định đọc `teaplus_store_id` từ trang cửa hàng, guard thiếu chi nhánh khi submit

## Verify 7.3 (05/08/2026) ✅

- [x] `npx tsc --noEmit` sạch + `npm run build` OK
- [x] `/api/stores` trả 5 cửa hàng đủ `lat/lng` (10.773/106.703...) + `is_active`
- [x] SSR `/cua-hang` render 200; map iframe render client-side sau khi fetch store

## 7.4. Hệ thống cửa hàng — tìm kiếm địa chỉ bằng bản đồ thật (05/08/2026)

> Hoàn thiện nốt phần còn dở của `admin.chi-nhanh.tsx` theo yêu cầu: địa chỉ phải chọn được từ bản đồ thật, giờ mở cửa phải là đồng hồ.

- [x] `admin.chi-nhanh.tsx` — thêm ô **tìm kiếm địa chỉ** (Nominatim search, debounce 400ms, giới hạn VN): gõ → xổ list gợi ý thật từ bản đồ → chọn → **tự điền** Thành phố / Quận-Huyện / Địa chỉ + đặt marker + di chuyển bản đồ tới vị trí đó
- [x] Bấm trên bản đồ (Leaflet/OSM) vẫn reverse-geocode để điền địa chỉ như cũ
- [x] Giờ mở cửa dùng **picker đồng hồ** `type="time"` (Giờ bắt đầu → Giờ kết thúc) — không còn nhập chuỗi số
- [x] **Badge realtime 🟢 Đang mở cửa / 🔴 Đã đóng cửa** (`isStoreOpen` so giờ hiện tại, ticker mỗi 60s) trên card chi nhánh ở cả `admin.chi-nhanh` và `cua-hang` — helper dùng chung `lib/store-hours.ts`
- [x] Bản đồ: `attributionControl: false` + nút zoom dời góc **dưới-phải** (`L.control.zoom position bottomright`) — Kỹ thuật 3 plan.md
- [x] **Fix SSR crash**: Leaflet trước đây import top-level → server render nổ `window is not defined` → trang không hydrate → **dropdown tìm kiếm không hoạt động**. Chuyển sang `import type` + `import("leaflet")` trong `useEffect` (client-only), build + SSR 200 sạch
- [x] **Rà soát 2 trang (05/08/2026)**: thống nhất tên thành phố 1 chuẩn (`TP. Hồ Chí Minh`/`Hà Nội`/`Đà Nẵng`/`Cần Thơ`/`Hải Phòng`) qua `ISO_CITY` + dropdown (khớp seed + `CITY_CENTERS` map); thêm import `ui/select` (dropddown TP/Quận); chặn đặt món chi nhánh `is_active=false`; chặn giờ rỗng khi lưu; đồng bộ ô tìm kiếm khi bấm bản đồ
- [x] `npx tsc --noEmit` sạch + `npm run build` OK

## 7.5. Mở rộng trang chi nhánh admin (05/08/2026)

> Theo yêu cầu: mở rộng trang `/admin/chi-nhanh` thêm quản lý tiện hơn (không đổi DB).

- [x] Backend `GET /admin/branches` — bổ sung theo từng chi nhánh: `table_count` (số bàn), `today_orders` + `today_revenue` (hôm nay, trừ đơn Đã hủy, chuẩn `CAST(GETDATE() AS DATE)` như dashboard)
- [x] `admin.chi-nhanh.tsx` — ô **tìm kiếm** chi nhánh (tên/địa chỉ/quận/SĐT) + **lọc theo thành phố**; card thêm khối thống kê **Bàn · Đơn hôm nay · Doanh thu hôm nay**; nút **Xem bản đồ** (modal Google Maps embed); nút **Quản lý bàn** → `/admin/vi-tri?store_id=X` lọc sẵn chi nhánh
- [x] `admin.vi-tri.tsx` — thêm `validateSearch {store_id?}` + khởi tạo `branchFilter` từ query param (cùng pattern `/menu?table_id`)
- [x] **Fix quận/huyện khi bấm map**: Nominatim VN không trả `county/district` mà trả `suburb` (Phường/Xã) + `city` (tên thành phố) → logic cũ lấy nhầm city làm quận ("Thành phố Hà Nội"/"Thủ Đức") không khớp dropdown. Sửa: ưu tiên `county→district→city_district→town→suburb` + bỏ tiền tố "Phường/Xã/Thị trấn"; dropdown quận tự thêm item fallback nếu giá trị từ map chưa có trong danh sách
- [x] **Mở rộng tỉnh/thành ngoài 5 thành phố**: thêm `Huế, Nha Trang, Bình Dương, Đồng Nai, Vũng Tàu, Đà Lạt, Quảng Ninh` vào `ISO_CITY` + dropdown thành phố + `CITY_CENTERS` (trang cửa hàng); làm sạch tên city từ map (bỏ "Tỉnh/Thành phố" prefix); dropdown thành phố cũng có item fallback cho city lạ → bấm map ở bất kỳ đâu vẫn điền đầy đủ
- [x] **Badge mở/đóng theo nút bật/tắt**: trước đây badge 🟢/🔴 tính theo giờ (`isStoreOpen`) nên bật nút mà ngoài khung giờ vẫn báo "Đã đóng cửa" → không theo nút. Giờ badge = `is_active` trực tiếp (admin + trang cửa hàng): ON → "🟢 Đang mở cửa", OFF → "🔴 Đã đóng cửa"; giờ mở/đóng vẫn hiện cạnh badge. Verify bằng Playwright thật (toggle OFF → badge đổi, toggle ON → badge đổi)
- [x] **Xóa chi nhánh**: backend `DELETE /admin/branches/:id` (transaction: chặn chi nhánh có đơn hàng → 400; dọn `promotion_stores` + `tables` trước khi xóa store; audit log); frontend nút 🗑 trên card + AlertDialog xác nhận. Verify Playwright: tạo → xóa → card biến mất + API xác nhận
- [x] **Vị trí bàn ăn theo chi nhánh + tự đánh số bàn**: `admin.vi-tri` bỏ dropdown mock `adminBranches` → load `GET /admin/branches` thật (cả filter lẫn form); form Thêm bàn **tự điền "Bàn N"** (số = max số bàn hiện có trong chi nhánh + 1), đổi chi nhánh tự cập nhật số, bỏ gợi ý "Tầng"
- [x] **Fix bug mất query param khi load thẳng (quan trọng)**: TanStack JSON-parse `?table_id=1` → số 1, nhưng `validateSearch` chỉ nhận string → trả undefined → SSR redirect **bỏ** query → **quét QR `/menu?table_id=N` load thẳng bị mất bàn** (không hiện banner, đơn không gắn bàn!). Sửa `menu`, `thanh-toan`, `admin.vi-tri`: chấp nhận số + chuỗi. Verify Playwright: `/menu?table_id=1` → banner "Bạn đang ngồi tại" hiện; `/admin/vi-tri?store_id=1` → lọc đúng chi nhánh
- [x] **Ràng buộc số bàn không trùng**: form Thêm/Sửa bàn đổi từ nhập tên tự do → **ô nhập "Số bàn"** (`type=number`, chặn chữ, tự điền số tiếp theo); client + backend (POST/PUT `/admin/tables`) đều chặn **trùng số** trong cùng chi nhánh (trích số từ tên, khớp cả tên cũ "Bàn 01 - Tầng 1"); dọn dữ liệu rác "Bàn 7sadasd" do code cũ cho lưu. Verify Playwright + API: nhập "7sadasd" → chữ bị bỏ; số 1 trùng → 400 "Số bàn này đã tồn tại trong chi nhánh"
- [x] **Upload ảnh sản phẩm lưu thẳng DB**: `products.image_url` đổi NVARCHAR(500) → **NVARCHAR(MAX)** (chứa base64); form thêm/sửa món thêm ô **Chọn ảnh** (file input, chặn non-image + tối đa 2MB) → **preview hiện ngay** bằng data URL → lưu thẳng base64 xuống DB (không URL/file). Verify Playwright: chọn ảnh → preview hiện → lưu → API trả `image_url` dạng `data:image` → card hiện ảnh
- [x] **Xóa món + danh mục (thực đơn)**: backend `DELETE /menu/products/:id` (chặn món có trong order_items → 400; transaction xóa reviews + wishlists + product) + `DELETE /menu/categories/:id` (chặn danh mục còn món → 400); frontend nút 🗑 trên card món + dòng danh mục + AlertDialog xác nhận. Verify Playwright + API: xóa món không đơn → thành công; danh mục còn 3 món → 400
- [x] **Thực đơn nâng cấp (danh mục/SEO/topping)**: (1) **Danh mục** bỏ nút bật/tắt (thêm là tự kích hoạt), chỉ **Sửa + Xóa** — CategoryForm hỗ trợ edit (prefill + PUT); (2) thêm tab **SEO** quản lý riêng: chỉnh slug + mô tả (meta description) từng món, lưu qua PUT; (3) **Topping** thành quản lý đầy đủ: backend `POST/PUT/DELETE /menu/toppings` (CRUD), UI bỏ badge → danh sách bật/tắt + sửa + xóa + thêm mới (dialog tên + giá). Tabs giữ nguyên tab khi reload. Verify Playwright: danh mục 0 switch + 5 nút sửa + prefill đúng; SEO 7 dòng lưu được; topping thêm/hiện/xóa OK
- [x] **Slug tự sinh từ tên + bỏ hiển thị slug**: hàm `slugify` (bỏ dấu tiếng Việt, `Đ/đ/Ð/ð → d`, nối "-") — danh mục & sản phẩm **không cần gõ slug**; danh mục hiển thị gọn "**Trà Tươi · 2 món**" (bỏ "/slug · N món"); tab SEO ẩn hẳn slug + dòng "Slug tự tạo" ở cả form danh mục/sản phẩm, khung mô tả meta dạng **Textarea 3 dòng** + nút ✏️ mở form sửa món. Verify Playwright: "Trà Sen" → slug `tra-sen` khớp DB; "Nha Ðam" (U+00D0) → `nha-dam`; SEO 7 textarea + 7 nút sửa, 0 slug hiển thị
- [x] **Quản lý cốt trà nền (base tea) + tự áp vào form sản phẩm**: backend `POST/PUT/DELETE /menu/bases` (CRUD, chặn trùng tên UNIQUE → 409); tab Tùy chọn section "Cốt trà nền" thành danh sách thêm/sửa/xóa (như topping); form thêm/sửa món đổi "Cốt trà nền" từ ô gõ tự do → **Select lấy từ danh sách đã quản lý** (tự áp). Verify Playwright: thêm cốt trà → hiện trong list + dropdown form sản phẩm
- [x] **Bỏ tab SEO** (theo thỏa thuận): mô tả meta trùng ô "Mô tả" trong form sản phẩm, slug đã tự sinh — tab SEO gỡ hẳn, UI còn 3 tab **Sản phẩm / Danh mục / Tùy chọn**; slug tự sinh + ô Mô tả trong form sản phẩm giữ nguyên
- [x] **Token hết hạn + auto-logout**: JWT **hết hạn 24:00 mỗi ngày theo giờ thật** (khung làm việc 08:00–24:00, đăng nhập sau nửa đêm vẫn sống tới 24:00 = hiệu ứng "reset lúc 8h sáng", tối thiểu 1h — chỉnh ở `backend/middleware/auth.js` hằng `MIN_HOURS`); frontend gặp 401 → tự xóa token + chuyển `/admin/login` (trước đây kẹt trang hiện lỗi). Verify Playwright: token rác → tự đá về login; decode token: đăng nhập 02:15 → hết hạn 23:59 hôm đó
- [x] `npx tsc --noEmit` sạch + `npm run build` OK; API `/admin/branches` trả stats thật (VD chi nhánh 1: 6 bàn, 5 đơn, 264.250₫)
