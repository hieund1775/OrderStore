# Checkpoint D / Đợt 1 — PayOS-first trên PostgreSQL

## Mục tiêu

Đưa tạo payment link, webhook, payment-status và expiry PayOS sang PostgreSQL trước voucher/promotions. Vì PayOS bắt buộc tham chiếu order, đợt này chuyển cùng lát tối thiểu tạo/lookup order online; không dual-write SQL Server/PostgreSQL.

## Phạm vi

- Tạo repository PostgreSQL cho online orders và payments.
- `POST /api/orders` cho online checkout tạo order PostgreSQL bằng transaction và `Idempotency-Key`.
- Tạo payment link sau khi order commit; lưu `payos_order_code`, `payment_link_id`, hạn thanh toán và trạng thái link.
- `GET /api/payments/payos/status`, webhook PayOS và command expiry đọc/ghi PostgreSQL.
- `payment_events` có provider-event key duy nhất; webhook retry cùng event không cập nhật order hai lần.
- PayOS sandbox/staging là môi trường kích hoạt đầu tiên. Không tự bật live production hoặc thay Render production config.

## Ngoài phạm vi

- Voucher/promotion eligibility và consume concurrency.
- Admin/KDS, reports, customer order history và cancel flow đầy đủ.
- Data import/cutover SQL Server, frontend public release và production activation.

## Luồng dữ liệu

1. Client gửi `Idempotency-Key` cùng request tạo online order.
2. Service hash canonical request. Cùng key/cùng hash trả kết quả order trước; cùng key/khác hash trả 409.
3. Trong một transaction: kiểm tra store/catalog, tính giá từ PostgreSQL, insert order/items/history và ghi idempotency record pending/completed.
4. Sau commit, service gọi PayOS. Kết quả thành công cập nhật payment references có điều kiện; lỗi provider không lộ message gốc và order chuyển trạng thái xử lý phù hợp để retry có kiểm soát.
5. Webhook xác minh chữ ký trước. Transaction lock order, ghi event idempotent, kiểm tra provider/amount/status, rồi CAS `unpaid → paid` một lần.
6. Cron command (không dùng timer web process) lấy advisory lock và batch-expire các order PayOS quá hạn.

## Ràng buộc an toàn

- Không trust total/price từ client; dùng giá PostgreSQL.
- Mọi query `$n` parameter và transaction dùng một PostgreSQL client.
- Không ghi full webhook payload, signature hoặc PayOS secrets vào log/response.
- Provider/DB error trả response an toàn; lỗi hạ tầng webhook trả 500 để PayOS retry.
- Hết hạn, webhook trùng, amount mismatch, wrong provider và webhook tới muộn phải idempotent, không ghi paid sai.

## Kiểm thử nghiệm thu

- PostgreSQL integration test thật cho create retry/collision, webhook duplicate/CAS/amount mismatch và expiry advisory lock.
- Contract tests giữ URL/status/response hiện có cho payment path được chuyển.
- PayOS SDK ở test dùng provider boundary fake; không gọi charge thật.
- Staging smoke dùng PayOS sandbox: tạo link → callback signed test → status `paid`; rerun callback không đổi state.

## Rollback

Trước khi mở write traffic staging, rollback bằng deploy bỏ mount PostgreSQL payment slice. Sau khi có write PostgreSQL, giữ maintenance mode và điều tra/reconcile; không tự chuyển ngược SQL Server vì mất payment/order write mới.
