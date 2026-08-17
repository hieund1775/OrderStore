# Performance Benchmark Harness — TeaPlus Phase 2

## 1. Tổng quan
Thư mục này chứa công cụ seed dữ liệu benchmark và chạy kiểm thử hiệu năng cho SQL Server, phục vụ việc đo đạc trước và sau tối ưu index, loại bỏ N+1 query và phân trang cursor.

## 2. Guard an toàn (Safety Guards)
Các script benchmark bắt buộc phải thỏa mãn các điều kiện bảo vệ sau:
1. `NODE_ENV !== 'production'`.
2. Biến môi trường `PERF_SEED_CONFIRM=1` hoặc cờ CLI `--confirm`.
3. Tên database phải chứa các từ khóa test/perf được cho phép (`test`, `perf`, `dev`, `teaplus_db`, `teaplus_test`).
4. Tuyệt đối không chứa dữ liệu PII thật của khách hàng. Dữ liệu sinh ra là dữ liệu giả lập có tính xác định (deterministic seed).

## 3. Cách chạy

### Seed dữ liệu kiểm thử
```bash
# Seed 100,000 orders (chỉ chạy trên môi trường test)
PERF_SEED_CONFIRM=1 node backend/perf/seed-performance-data.js --orders=100000 --seed=42
```

### Chạy benchmark query và thu thập metrics
```bash
# Thu thập thời gian và logical reads với SET STATISTICS IO, TIME ON
node backend/perf/run-query-benchmarks.js
```
