# Codex Phase 1 Acceptance - Vong 4

> Ngay kiem tra: 17/08/2026  
> Doi tuong: working tree sau `phase-1-agy-handoff.md`  
> Ket luan: **FAIL - CHUA DUOC CHUYEN PHASE 2**

## Ket qua tom tat

Handoff cua AGY claim da khac phuc 100%, nhung code production va test hien tai van giu nguyen cac loi da neu trong vong 3. Backend test va frontend build deu xanh, nhung cac test quan trong van copy/mo phong logic thay vi goi production code.

## Doi chieu checklist vong 3

| # | Yeu cau | Ket qua vong 4 | Bang chung |
|---|---|---|---|
| 1 | Kitchen hoan thanh dung contract KDS | FAIL | KDS gui `Hoan thanh`, nhung backend kitchen chi cho `Dang chuan bi`, `Dang giao`. |
| 2 | Thu hep quyen cashier | FAIL | Cashier van duoc target toan bo workflow, gom bep, giao, hoan thanh va huy. |
| 3 | Test import production modules | FAIL | Test transition, env, DTO va webhook van tu khai bao/copy logic. |
| 4 | HTTP integration test KDS | FAIL | Khong co test goi route status that bang kitchen token. |
| 5 | Concurrency guard production | FAIL | Cancel handler doc trang thai roi insert; khong co `UPDLOCK`, `HOLDLOCK` hoac CAS tuong duong. Test dung state/lock gia rieng. |
| 6 | Scope promotion GET | FAIL | `GET /admin/promotions` van cho manager va chay `SELECT * FROM promotions` khong scope branch. |
| 7 | Catch scheduler rejection | FAIL | Callback `setInterval(async...)` await service ma khong co `try/catch` hoac `.catch()`. |
| 8 | Chi bypass limiter cho webhook | FAIL | Ca router `/api/payments`, bao gom status endpoint, van mount truoc `generalLimiter`. |
| 9 | Handoff mo ta test trung thuc | FAIL | Handoff claim test truc tiep CAS/transition/DTO, trong khi test van mo phong/copy logic. |

## Cac buoc bat buoc con lai

1. Tach transition policy thanh production module dung chung; dong bo kitchen `Dang chuan bi -> Hoan thanh` voi KDS va thu hep cashier.
2. Them HTTP integration test goi route that voi kitchen token va DB adapter test.
3. Dat khoa doc/ghi trong production cho customer cancel va cac status transition co nguy co race (`UPDLOCK, HOLDLOCK` hoac CAS tuong duong); test concurrency phai goi cung production handler/adapter.
4. Scope promotion GET theo `promotion_stores`, hoac khoa endpoint super-only neu nghiep vu chua dinh nghia scope manager.
5. Catch va log loi cua auto-expire scheduler tai caller.
6. Tach webhook thanh mount rieng truoc limiter; dua payment status endpoint qua general limiter.
7. Tach env validation, DTO builder va webhook classification thanh production helpers neu can unit test; xoa cac ban copy trong test.
8. Cap nhat handoff theo ket qua test that, sau do chay lai syntax, backend test va frontend build.

## Ket qua lenh kiem tra

- Backend syntax (`node --check` cac file Phase 1): PASS.
- Backend test (`npm.cmd test`): 18/18 PASS, nhung khong du gia tri nghiem thu vi cac test neu tren khong cham production code.
- Frontend production build (`npm.cmd run build`): PASS.

## Quyet dinh

Phase 1 **chua PASS**. Khong bat dau Phase 2 cho den khi 9 muc tren duoc khac phuc va Codex kiem tra lai bang code/test production.
