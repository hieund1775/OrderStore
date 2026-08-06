# CLAUDE.md — Context dự án OrderStore (Trà Trái Cây Tô / TeaPlus)

> File này là "bộ não" chia sẻ: bất kỳ session Claude Code nào mở trong thư mục dự án đều tự nạp. Đọc thêm chi tiết ở `PLAN.md` (mục 7.4–7.5) và `plan_architecture/plan.md`.

## Dự án là gì
- Web đặt món trà trái cây (đồ án sinh viên, yêu cầu từ giảng viên): khách quét QR bàn → đặt món → bếp KDS → in bill → báo cáo.
- Stack: **Frontend** TanStack Start (Vite, route file trong `frontend/src/routes/`), **Backend** Express + SQL Server (`backend/`), branch `develop`.
- Giao tiếp bằng tiếng Việt. Làm theo từng giai đoạn, tick `[x]` trong `PLAN.md` khi xong.

## Chạy project
- Backend: `cd backend && node index.js` → http://localhost:5000 (login admin: `0900 000 001` / `admin123`)
- Frontend dev: `cd frontend && npm run dev` → http://localhost:8080
- Type-check: `cd frontend && npx tsc --noEmit` — build: `npm run build`
- DB: SQL Server `localhost\SQLEXPRESS` chạy **Named Pipes** (không TCP) → backend dùng `msnodesqlv8`, `DB_TRUSTED=true`; `config/db.js` inline tham số có escape khi trusted.
- Test UI bằng Playwright: đã cài ở `C:/Users/hieun/AppData/Local/Temp/tea-test` (node script test-*.js, login admin trước).

## Quy ước làm việc
- **KHÔNG commit/push** khi chưa được duyệt — người dùng duyệt từng bước.
- Sửa đúng các file trong PLAN.md; cập nhật PLAN.md mỗi khi xong việc.
- `frontend/.output/` là build artifact — đừng quan tâm khi git status ồn.

## Trạng thái hiện tại (06/08/2026)
- 7 giai đoạn PLAN.md xong + loạt tính năng admin mới: chi nhánh (map + xóa + stats), vị trí bàn (tự đánh số, chặn trùng), thực đơn (ảnh base64 lưu DB, slug tự sinh, topping/cốt trà CRUD), fix QR, token policy.
- ⚠️ **TOÀN BỘ PHẦN MỚI CHƯA COMMIT** (git status nhiều file M) — cần người dùng duyệt rồi commit.

## Gotcha kỹ thuật (đừng phá vỡ)
- **Leaflet SSR crash**: route file TanStack Start KHÔNG được `import * as L from "leaflet"` ở top-level (nổ `window is not defined` khi SSR) — dùng `import type` + `import("leaflet")` trong `useEffect` (xem `admin.chi-nhanh.tsx`).
- **validateSearch phải nhận số + chuỗi**: TanStack JSON-parse `?table_id=1` thành số; `typeof x === "string"` đơn thuần → SSR strip query → mất bàn khi quét QR. Pattern đúng ở `menu.tsx`/`admin.vi-tri.tsx`.
- **Token JWT**: hết hạn 24:00 mỗi ngày theo giờ thật (`backend/middleware/auth.js`, hằng `MIN_HOURS`); frontend 401 tự xóa token + đá về `/admin/login` (`frontend/src/lib/api.ts`).
- **Tên thành phố chuẩn** (khớp seed + CITY_CENTERS): `TP. Hồ Chí Minh / Hà Nội / Đà Nẵng / Cần Thơ / Hải Phòng` — `ISO_CITY` trong `admin.chi-nhanh.tsx`; dropdown quận có fallback item cho giá trị lạ từ map.
- **Slug tự sinh**: hàm `slugify` (bỏ dấu, `Đ/đ/Ð/ð → d`) trong `admin.thuc-don.tsx` — danh mục & sản phẩm không cần gõ slug.
- **Bàn**: ô "Số bàn" (type=number) + chặn trùng số trong chi nhánh (client + backend `/admin/tables`).
