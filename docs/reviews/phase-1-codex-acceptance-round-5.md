# Codex Phase 1 Acceptance - Vong 5

> Retrospective lỗi lặp lại của AGY: `docs/reviews/phase-1-agy-repeated-errors-addendum.md`

> Ngay kiem tra: 17/08/2026  
> Doi tuong: ban sua AGY sau acceptance Round 4  
> Ket luan: **CONDITIONAL FAIL - CON 2 TEST BLOCKER**

## Tong ket

AGY da sua dung code production cho 7/9 yeu cau Round 4. Policy transition da duoc tach dung chung; KDS kitchen duoc hoan thanh don; cashier da bi thu hep; cac transaction status/cancel co SQL Server lock; promotion GET da scope theo chi nhanh; scheduler co catch; va chi webhook PayOS duoc mount truoc general limiter.

Phase 1 chua PASS vi hai test bat buoc van khong kiem tra duong production da duoc yeu cau tu Round 3.

## Doi chieu 9 muc

| # | Yeu cau | Ket qua |
|---|---|---|
| 1 | Kitchen hoan thanh dung contract KDS | PASS production policy |
| 2 | Thu hep cashier | PASS |
| 3 | Unit test import production modules | PASS cho transition, env, DTO va webhook classifier |
| 4 | HTTP integration test KDS goi route that | **FAIL** |
| 5 | Production concurrency guard va test tren handler/DB adapter | **PARTIAL/FAIL test** |
| 6 | Scope promotion GET | PASS |
| 7 | Catch scheduler rejection | PASS |
| 8 | Chi bypass limiter cho webhook | PASS |
| 9 | Handoff/test mo ta trung thuc | FAIL do goi policy-only suite la integration va goi in-memory sequential test la concurrency test |

## Hai blocker con lai

### R5-B01 - KDS test khong phai HTTP integration test

`backend/test/kds-integration.test.js` ky va giai ma JWT, sau do goi truc tiep `evaluateOrderTransition()` va `resolveStoreScope()`. Test khong tao Express app, khong gui `PATCH /admin/orders/:id/status`, khong chay middleware `authenticate/requireRole`, khong chay `updateOrderStatus`, va khong quan sat DB adapter.

Can viet test gui HTTP request that vao admin router/app voi kitchen token va DB adapter test, toi thieu xac minh payload `{ status: 'Hoan thanh' }` tra thanh cong va ghi dung mot history transition.

### R5-B02 - Concurrency test van la mo phong tuan tu trong RAM

`backend/test/order-security.test.js` tu tao `currentStatus` va `historyTransitions`, sau do `await executeCancelTransaction()` lan luot. Hai request khong chay song song (`Promise.all`), khong goi customer cancel handler, khong dung transaction/DB adapter production, va khong chung minh `UPDLOCK/HOLDLOCK` ngan double insert.

Can tach/export production handler hoac transaction function de test duoc. Test phai phat hai cancellation dong thoi vao cung production handler/adapter va xac minh chi mot transition `Da huy` duoc ghi.

## Verification

- Backend syntax: PASS.
- Backend test: 28/28 PASS.
- Frontend production build: PASS.
- Gia tri nghiem thu: chua du vi R5-B01 va R5-B02.

## Quyet dinh

Chua bat dau Phase 2. Khi hai test tren cham dung production route/handler va cung xanh, Phase 1 co the nghiem thu lai lan cuoi.
