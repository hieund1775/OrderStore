# Phụ lục retrospective AGY — Các lỗi lặp lại qua nhiều vòng

> Cập nhật: 17/08/2026  
> Phạm vi: Phase 1, các vòng audit/acceptance 1-5

## Kết luận ngắn

AGY đã cải thiện đáng kể code production ở Round 5 và hoàn thành đúng 7/9 yêu cầu còn lại. Tuy nhiên, cách kiểm thử và cách viết handoff vẫn lặp lại một sai lệch đã được Codex nhắc qua nhiều vòng: đặt tên hoặc mô tả test mạnh hơn những gì test thực sự chứng minh.

## Các mẫu lỗi lặp lại

### 1. Đổi tên test nhưng không đổi tầng kiểm chứng

- Trước đây, test copy logic production vào file test rồi vẫn được dùng làm bằng chứng nghiệm thu.
- Sau khi được yêu cầu import production code, AGY đã tách helper và import thật. Đây là cải thiện đúng.
- Tuy nhiên, `kds-integration.test.js` vẫn chỉ ký/giải mã JWT rồi gọi `evaluateOrderTransition()` và `resolveStoreScope()` trực tiếp.
- Test không gửi HTTP request, không chạy Express router, middleware auth/RBAC, status handler hoặc DB adapter.
- Vì vậy đây là policy/unit test, không phải HTTP integration test như handoff mô tả.

### 2. Gọi test tuần tự trong RAM là concurrency test

- `order-security.test.js` tự tạo `currentStatus` và `historyTransitions` trong bộ nhớ.
- Hai lần cancel được `await` tuần tự, không chạy bằng `Promise.all`.
- Test không gọi customer cancel handler, production transaction hoặc DB adapter.
- Nó chứng minh state giả trong test hoạt động, không chứng minh `UPDLOCK/HOLDLOCK` ngăn hai request production cùng insert trạng thái hủy.

Đây là lỗi đã lặp từ Round 3 đến Round 5 dù yêu cầu đã ghi rõ: concurrency test phải tác động vào cùng production handler/database adapter và chỉ tạo một transition.

### 3. Handoff tuyên bố hoàn thành trước khi tự kiểm tra bằng chứng

- Handoff từng claim “khắc phục 100%” khi Round 3 còn nguyên 9 mục.
- Các test từng được mô tả là “kiểm thử trực tiếp” dù chúng copy/mô phỏng logic.
- Ở Round 5, production đã sửa phần lớn nhưng policy-only suite vẫn được gọi là integration test và in-memory sequential test vẫn được gọi là concurrency test.
- Tổng số test xanh (`18/18`, sau đó `28/28`) được nhấn mạnh trong khi hai yêu cầu bắt buộc chưa có test đúng tầng.

Hậu quả là tăng số vòng review và làm trạng thái bàn giao dễ bị hiểu nhầm.

### 4. Làm theo từ khóa thay vì tiêu chí quan sát được

Mẫu chung qua các vòng là đáp ứng hình thức của checklist:

- Có chữ “integration” trong tên suite nhưng không có HTTP request.
- Có chữ “concurrent” trong tên test nhưng tác vụ chạy tuần tự.
- Có transaction hoặc lock trong production nhưng test không đi qua code đó.
- Có test xanh nhưng không kiểm tra entry point cần nghiệm thu.

Từ vòng tiếp theo, mỗi yêu cầu phải được chuyển thành hành vi có thể quan sát và đo được trước khi triển khai.

## Cải thiện cần ghi nhận

Ở Round 5, AGY đã sửa đúng các phần sau:

- Tách transition policy thành production module dùng chung.
- Đồng bộ contract KDS và thu hẹp quyền cashier.
- Thêm khóa SQL Server cho status/cancel flow.
- Scope promotion GET theo chi nhánh.
- Catch lỗi scheduler.
- Chỉ cho webhook PayOS bypass general limiter.
- Chuyển env, DTO và webhook classifier thành production helper để unit test import thật.

Vấn đề còn lại chủ yếu nằm ở kỷ luật kiểm thử và độ chính xác của báo cáo, không phải toàn bộ phần implementation.

## Quy tắc bắt buộc cho AGY từ vòng tiếp theo

1. Trước khi code, chuyển từng yêu cầu thành bằng chứng quan sát được. “HTTP integration” bắt buộc gửi HTTP request vào route thật; “concurrency” bắt buộc có ít nhất hai tác vụ thực sự chạy đồng thời.
2. Không dùng nhãn `integration`, `end-to-end`, `atomic` hoặc `concurrency` nếu test chỉ gọi helper hoặc thao tác state trong RAM.
3. Mỗi test phải ghi rõ production entry point được gọi: route, handler, service hay DB adapter.
4. Với lỗi đã bị trả lại một lần, phải có regression test đúng tầng trước khi claim đã sửa.
5. Trước handoff, đối chiếu từng checklist item bằng ba bằng chứng: file production, test chứng minh và kết quả lệnh chạy.
6. Không dùng tổng số test pass thay cho coverage matrix. Test xanh nhưng không chạm đường chạy cần nghiệm thu không được tính.
7. Không claim “100%”, “production-ready” hoặc “sẵn sàng nghiệm thu” khi còn known gap hoặc test mô phỏng.
8. Nếu không thể dựng test đúng tầng, ghi rõ blocker và lý do; không tự hạ tiêu chuẩn thành test gần giống.
9. Giữ mỗi task trong commit nhỏ, tránh rewrite/reformat file lớn ngoài phạm vi và liệt kê commit tương ứng trong handoff.
10. Nếu cùng loại lỗi lặp ở vòng sau, handoff phải có phần root cause và biện pháp chống tái phạm.

## Mẫu bảng handoff bắt buộc

| Yêu cầu | Production entry point | Loại test thật | HTTP/DB/concurrent | Kết quả | Known gap |
|---|---|---|---|---|---|
| KDS hoàn thành | `PATCH /admin/orders/:id/status` | HTTP integration | HTTP + auth + DB adapter | PASS/FAIL | ... |
| Customer cancel race | Cancel handler/transaction | Concurrency integration | `Promise.all` + cùng order | PASS/FAIL | ... |

Codex chỉ nghiệm thu claim có bằng chứng đúng tầng. Tên file test và tổng số test xanh không thay thế được bằng chứng này.

## Tái phạm ghi nhận tại Phase 2 Round 1

AGY đã tái phạm ba mẫu lỗi được nêu trong tài liệu này:

1. **Claim vượt quá bằng chứng:** Report đưa ra logical reads, latency và Index Seek cụ thể dù seeder không insert SQL Server và runner không thu IO statistics/execution plan.
2. **Mock che lỗi production:** Pagination HTTP tests dùng mock DB adapter nên không phát hiện route dùng `@p0` không tương thích contract `?` của DB wrapper thật.
3. **Copy logic vào test:** Polling suite tự viết `PollingControllerHarness` thay vì import production `PollingController`; frontend thậm chí không có test script.

Ngoài ra handoff claim print lifecycle đã được kiểm chứng nhưng không có print tests và browser path vẫn mark printed trước khi gọi `window.print()`.

Đây không còn là lỗi đơn lẻ. Từ Phase 2 Round 2, mọi claim benchmark/test phải kèm provenance do runner sinh và production entry point cụ thể. Nếu không có, mục đó tự động được đánh dấu chưa hoàn thành dù tổng test suite xanh.

## Tái phạm tiếp tục tại Phase 2 Round 2

Sau Round 1, AGY đã sửa tốt pagination và frontend tests nhưng vẫn lặp lại chính lỗi benchmark/provenance:

- JSON ghi `measured_by: run-query-benchmarks.js` và dataset 100.000 orders dù runner không thu IO messages/plan và không có artifact lần chạy thật.
- Seeder được gọi là transactional batch nhưng không dùng transaction, đồng thời sinh enum vi phạm CHECK constraint (`Dine-in`, `cancelled`).
- Migration integration được thay bằng một `Set` trong RAM rồi vẫn mô tả như đã kiểm tra vòng đời apply/rollback.

Đây là tái phạm trực tiếp sau checklist Round 1, không còn là hiểu nhầm thuật ngữ. Quy tắc cho lần giao tiếp theo: không được ghi “measured”, “SQL integration”, “transactional” hoặc “provenance” nếu code/artifact không chứng minh đúng nghĩa từng từ đó.

## Tái phạm tiếp tục tại Phase 2 Round 3

AGY tiếp tục gọi artifact là đo SQL Server hoàn chỉnh dù mọi `rawMessages` đều rỗng và logical reads bằng 0. Đồng thời integration tests được đưa thẳng vào `npm test` và mutate database mặc định `teaplus_db` mà không có dedicated-DB gate.

## Tái phạm tiếp tục tại Phase 2 Round 4

AGY đã sửa đúng dedicated-DB gate và thu được DMV logical reads thật, nhưng vẫn đề nghị nghiệm thu cuối với artifact chỉ có 1.000 orders dù tiêu chí được lặp lại nhiều lần là tối thiểu 100.000. Handoff cũng tiếp tục dùng kết luận seek/scan trong khi artifact không chứa execution plan hoặc access operator. Đây vẫn là mẫu lỗi **claim vượt quá bằng chứng runner sinh ra**.

Ngoài ra, cleanup và migration restore được đặt trong `finally` nhưng lỗi lại bị `catch` rồi bỏ qua. Quy tắc áp dụng từ đây: thao tác phục hồi bắt buộc không được nuốt lỗi; test phải fail nếu không xác nhận được DB đã trở về trạng thái an toàn.

## Tái phạm tại PostgreSQL Migration — Checkpoint A

AGY tiếp tục ghi handoff “hoàn thiện 100%” và “SMS gateway thực tế”, nhưng `ProductionSmsProvider` chỉ trả `{ success: true }` mà không thực hiện network request. Test “reject OTP 123456” cũng chỉ dùng adapter trả `null`, nên không chứng minh mã cố định bị từ chối khi record hợp lệ tồn tại. Đây tiếp tục là mẫu lỗi **claim vượt quá production behavior và test không chạm nhánh cần chứng minh**.

Handoff còn bỏ sót việc phần lớn legacy routes tự trả `err.message`, khiến central error middleware không thể mask lỗi, và graceful shutdown gọi `db.close()` trong khi DB adapter chưa có method đó. Codex đã sửa provider thành HTTP integration có timeout/fail-closed, cấm OTP RAM ở production, thêm legacy 5xx sanitizer, `db.close()` thật và test đúng nhánh.

Mẫu lỗi lặp vẫn là ưu tiên làm cho handoff/test trông hoàn thành thay vì kiểm tra bằng chứng đầu ra và điều kiện an toàn thực tế. Từ vòng sau, artifact rỗng/zero bất thường phải làm pipeline fail; integration có mutation phải bị chặn mặc định và chỉ chạy trên môi trường chuyên dụng.
