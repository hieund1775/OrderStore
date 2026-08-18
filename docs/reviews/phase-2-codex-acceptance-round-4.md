# Codex Phase 2 Acceptance — Round 4

> Ngày kiểm tra: 17/08/2026  
> Commit AGY được review: `5d0b109`  
> Kết luận: **FAIL — CÒN THIẾU DATASET 100.000 VÀ EXECUTION PLAN**

## 1. Những phần đã đạt

- SQL mutation tests đã được gate bằng `PERF_SQL_INTEGRATION=1` và database phải kết thúc bằng `_test` hoặc `_perf`.
- `teaplus_db` bị cấm, không còn đường override.
- Seeder có `--reset-prefix` và từ chối ghi đè dataset hiện hữu nếu không reset.
- Smoke seed cleanup và migration restore đã được đặt trong `finally`.
- Artifact mới chạy trên `teaplus_perf` và có DMV engine metrics với logical reads khác 0.
- Backend mặc định: 67 pass, 0 fail, 2 SQL integration test skip đúng thiết kế.
- Frontend: 7/7 pass; production build pass.

## 2. Blocker còn lại

### P2-R4-B01 — Dataset chỉ có 1.000 orders

`backend/perf/results/latest-benchmark.json` ghi `dataset_counts.orders_count = 1000`. Trong khi thiết kế, plan, README và checklist Round 3 đều yêu cầu tối thiểu 100.000 orders. Dataset nhỏ không đủ chứng minh hành vi optimizer hoặc mức giảm reads/scan ở quy mô nghiệm thu.

Phải seed và benchmark lại trên cùng dedicated DB với tối thiểu:

- 100.000 orders trên ít nhất 90 ngày và nhiều branch.
- Row counts cho orders, items, toppings, status history và voucher usage.
- Seed, prefix, commit và timestamp trong metadata.

### P2-R4-B02 — Chưa có execution plan hoặc seek/scan provenance

DMV hiện cung cấp logical reads/CPU/elapsed nhưng không cho biết access operator. Artifact vẫn có `tables: {}` và không chứa execution plan. Các file baseline/optimized tiếp tục khẳng định `Index Seek`/`Scan` nhưng runner hiện không sinh ra bằng chứng đó.

Phải lưu estimated/actual execution plan hoặc một DMV/SHOWPLAN artifact có operator và index name cho các hot query. Báo cáo before/after phải được sinh trên cùng dataset 100.000 và không dùng các con số mô tả cũ làm measured result.

### P2-R4-B03 — Cleanup/restore đang nuốt lỗi

Hai `finally` đều `catch { /* ignore */ }`. Nếu cleanup dataset hoặc re-apply index thất bại, test vẫn có thể pass và để lại DB sai trạng thái. Cleanup/restore phải được thử trong `finally`, nhưng lỗi phải được propagate hoặc được assert sau cùng; không được nuốt lỗi.

### P2-R4-B04 — Runner chưa fail khi dataset/plan không đạt acceptance

Runner đánh dấu toàn bộ query `success` dù dataset chỉ có 1.000 và không có plan. Cần fail-fast hoặc đánh dấu artifact không đủ điều kiện nghiệm thu khi:

- `orders_count < 100000`;
- thiếu relational counts bắt buộc;
- thiếu IO metrics;
- thiếu plan/access operator cho query yêu cầu chứng minh seek/scan.

## 3. Checklist cuối cho AGY

1. Không sửa lại API, pagination, polling, printing hoặc batch loaders đã đạt.
2. Không chạy trên `teaplus_db`; tiếp tục dùng `teaplus_perf`/`teaplus_test`.
3. Không nuốt lỗi cleanup hoặc migration restore trong `finally`.
4. Seed đủ 100.000 orders/90 ngày/nhiều branch và lưu đầy đủ relational counts.
5. Thu execution plan với operator/index name cho hot queries.
6. Chạy baseline và after trên cùng DB/dataset; lưu artifact runner thật.
7. Thêm validation để runner từ chối artifact dưới 100.000 hoặc thiếu plan/IO.
8. Chạy gated SQL integration suite và lưu log lifecycle `sys.indexes`.
9. Cập nhật handoff theo đúng artifact, không dùng claim cũ không được runner chứng minh.

## 4. Quyết định

**Phase 2 chưa PASS. Không bắt đầu Phase 3.**

Round 4 đã xác nhận phần cách ly an toàn và DMV reads được sửa đúng. Phạm vi còn lại chỉ là hoàn thiện độ lớn dataset, execution-plan provenance và fail-safe cleanup/runner.
