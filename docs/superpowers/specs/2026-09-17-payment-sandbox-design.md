# Thiết kế cổng thanh toán Sandbox cho môi trường kiểm thử

Ngày: 2026-09-17
Trạng thái: Đã được chủ dự án duyệt về mặt thiết kế

## 1. Mục tiêu

Cho phép nhân sự kiểm thử gần như toàn bộ website trên môi trường Render hiện tại mà không chuyển tiền thật và không gọi PayOS. Cổng sandbox phải tạo cảm giác và vòng đời tương tự một cổng thanh toán: hệ thống đưa ra số tiền cần trả, tester nhập số tiền đã chuyển, backend chỉ xác nhận khi số tiền khớp chính xác.

Phạm vi bao gồm:

- Đơn thường, Mua ngay, đơn gộp và preorder.
- Payment attempt, hết hạn, hủy và tạo lại mã.
- Các bước sau thanh toán: Admin/POS, Bếp, Đóng gói, Shipper, hoàn thành, thông báo, realtime và đánh giá.
- Tài khoản khách có sẵn và tài khoản vừa đăng ký mới.

Không có banner môi trường kiểm thử và không có lớp mã truy cập chung trước website.

## 2. Các phương án đã cân nhắc

### 2.1. Môi trường QA riêng

An toàn nhất về dữ liệu nhưng cần thêm frontend, backend và database. Chưa chọn vì website hiện vẫn là môi trường kiểm thử trước bàn giao.

### 2.2. Voucher giảm 100%

Dễ triển khai nhưng không kiểm tra payment attempt, settlement và các cầu nối sau thanh toán. Không đáp ứng mục tiêu.

### 2.3. Cổng sandbox nội bộ trên môi trường hiện tại

Được chọn. PayOS giữ nguyên trong code; backend chọn duy nhất một provider theo cấu hình môi trường. Cách này cho phép mọi tài khoản mới kiểm tra đầy đủ mà không dùng tiền thật.

## 3. Cấu hình và ranh giới provider

Backend đọc biến cấu hình:

```text
PAYMENT_MODE=qa_sandbox | payos
```

Quy tắc:

- `qa_sandbox`: mọi checkout mới sử dụng provider `sandbox`; không tạo link, đối soát hoặc gọi API PayOS.
- `payos`: sử dụng nguyên luồng PayOS hiện tại; route và giao diện sandbox không khả dụng.
- Frontend không được gửi hoặc tự chọn provider. Backend là nguồn quyết định duy nhất.
- Giá trị thiếu hoặc không hợp lệ phải fail closed; backend không tự mặc định sang sandbox.
- Không thay đổi bí mật, profile hoặc thuật toán xác thực webhook PayOS.

Schema `payment_attempts` hiện chấp nhận provider dạng chuỗi nên thiết kế không yêu cầu migration. Provider sandbox được lưu rõ là `sandbox`, không giả danh `payos`.

## 4. Trải nghiệm thanh toán Sandbox

Checkout tạo payment attempt sandbox và trả về đường dẫn cổng sandbox. Trang sandbox hiển thị:

- Mã thanh toán.
- Số tiền phải trả.
- Thời gian còn lại.
- Ô nhập số tiền chuyển.
- Nút `Xác nhận chuyển khoản`.

Không có các nút mô phỏng trạng thái thành công, thất bại, hủy hoặc hết hạn.

Quy tắc số tiền:

- Chỉ nhận số nguyên VND dương.
- Số tiền nhập phải bằng chính xác amount snapshot của payment attempt.
- Thiếu hoặc dư đều bị từ chối; attempt và đơn vẫn chưa thanh toán, tester có thể thử lại khi attempt còn hiệu lực.
- Số tiền từ client không bao giờ được dùng làm amount chuẩn.

Attempt hết hạn hoặc bị hủy không thể thanh toán tiếp. Khách sử dụng luồng tạo lại mã hiện có để sinh attempt mới theo provider đang hoạt động.

## 5. Kiến trúc thành phần

### 5.1. Payment mode resolver

Một module nhỏ đọc và xác thực `PAYMENT_MODE`, cung cấp provider hiện hành cho checkout, status và regeneration. Module này không chứa logic thanh toán.

### 5.2. Sandbox attempt service

Phụ trách:

- Reserve và activate payment attempt qua repository canonical hiện có.
- Sinh identity/token không đoán được và URL sandbox nội bộ.
- Không tạo QR hoặc link từ nhà cung cấp bên ngoài.
- Tìm attempt theo token, kiểm tra ownership và trạng thái.
- Gửi settlement hợp lệ vào dịch vụ settlement chung.

### 5.3. Settlement chung

Sandbox không cập nhật trực tiếp `orders.payment_status`. Logic xác nhận thanh toán phải được đặt sau một ranh giới settlement dùng chung, bảo toàn:

- Transaction và row lock.
- Amount snapshot.
- Idempotency và chống double-submit.
- Cập nhật order hoặc checkout group.
- Payment event/audit hiện có.
- Cầu nối preorder `onPaymentSettled`.
- Thông báo và các projection sau thanh toán.

PayOS tiếp tục xác thực webhook/reconciliation trước khi gọi ranh giới settlement. Sandbox xác thực mode, token, owner, trạng thái và amount trước khi gọi cùng ranh giới.

### 5.4. Frontend sandbox checkout

Frontend chỉ render trang sandbox khi backend báo checkout artifact thuộc provider `sandbox`. Trang thanh toán hiện có tiếp tục poll trạng thái canonical. Không suy đoán mode từ hostname và không dùng biến frontend làm ranh giới bảo mật.

## 6. Luồng dữ liệu

### 6.1. Tạo thanh toán

1. Khách tạo đơn thường, Mua ngay, đơn gộp hoặc preorder.
2. Backend snapshot tổng tiền và tạo target như hiện tại.
3. Payment mode resolver chọn provider.
4. Sandbox service reserve/activate attempt và trả URL nội bộ.
5. Frontend chuyển tới trang sandbox.

### 6.2. Xác nhận đúng tiền

1. Khách đã đăng nhập gửi token attempt và số tiền nhập.
2. Backend khóa attempt và target trong transaction.
3. Backend kiểm tra owner, provider, trạng thái, hạn dùng và amount.
4. Settlement chung đánh dấu attempt/target đã thanh toán đúng một lần.
5. Nếu target gắn preorder, cầu nối chuyển `AWAITING_PAYMENT` sang `PENDING_MANAGER_CONFIRMATION` theo logic hiện có.
6. Frontend nhận trạng thái đã thanh toán qua polling/realtime hiện có.

### 6.3. Sai tiền

Backend trả lỗi nghiệp vụ rõ ràng, không sửa attempt, target, đơn hoặc preorder. Không tạo thêm đơn và không phát thông báo thanh toán thành công.

## 7. Chuyển đổi provider

- Attempt chỉ được xử lý bởi provider đã snapshot trên attempt đó.
- Trong `qa_sandbox`, attempt PayOS cũ không được xác nhận bằng sandbox.
- Trong `payos`, attempt sandbox cũ không được xác nhận hoặc đối soát qua PayOS.
- Tạo lại mã sẽ supersede attempt đang hoạt động theo quy tắc hiện tại và tạo attempt mới bằng provider hiện hành.
- Target đã thanh toán không được thay đổi khi chuyển mode.
- Khi chạy sandbox, mọi outbound create/reconcile/lookup tới PayOS phải bị chặn ở server.
- Webhook PayOS trong mode sandbox phải được xử lý fail-safe, không được phép cập nhật target sandbox và không gây vòng retry vô hạn.

## 8. Bảo mật và lỗi

- Route thanh toán sandbox bắt buộc customer authentication.
- Chỉ chủ sở hữu order/checkout group được xem hoặc thanh toán attempt.
- Token sandbox có entropy đủ lớn, có hạn dùng và không chứa ID tuần tự làm thông tin duy nhất.
- Không tin `order_code`, amount, provider hoặc trạng thái do client khai báo.
- Double-submit đồng thời chỉ settlement một lần; lần sau nhận kết quả idempotent đã thanh toán.
- Attempt `expired`, `cancelled` hoặc `superseded` trả lỗi 409 phù hợp.
- Route sandbox trả 404 khi `PAYMENT_MODE` không phải `qa_sandbox`.
- Không log token đầy đủ, mật khẩu, connection string hoặc dữ liệu thanh toán nhạy cảm.
- Lỗi database giữ nguyên dữ liệu trước giao dịch và trả lỗi hạ tầng; không giả thành thanh toán thành công.

## 9. Phạm vi kiểm thử bắt buộc

### 9.1. Automated backend

- Mode validation và fail-closed.
- Không có PayOS outbound call trong sandbox.
- Reserve/activate attempt cho order và checkout group.
- Ownership, token, provider và trạng thái.
- Amount đúng, thiếu, dư, không nguyên và âm.
- Double-submit/concurrency/idempotency.
- Expired, cancelled, superseded và regeneration khi đổi mode.
- Settlement đơn thường và đơn gộp.
- Preorder bridge chuyển đúng trạng thái và xử lý late payment theo logic hiện có.
- Sandbox route trả 404 trong mode PayOS.
- PayOS regression suites giữ nguyên kết quả.

### 9.2. Automated frontend

- Render đúng artifact sandbox.
- Nhập tiền, validation và trạng thái đang xử lý.
- Sai tiền không hiện thành công.
- Đúng tiền chuyển sang trạng thái đã thanh toán.
- Giao diện sandbox không xuất hiện trong mode PayOS.
- Giỏ thường và Buy Now giữ nguyên các bất biến hiện tại.

### 9.3. Browser E2E trên Render sandbox

- Khách QA có sẵn và một khách đăng ký mới.
- Đơn thường đi qua Admin/POS và lane phù hợp.
- Đơn hỗn hợp tạo task Bếp và Đóng gói, chặn bàn giao đến khi cả hai sẵn sàng.
- Buy Now không làm thay đổi giỏ thường.
- Preorder thanh toán, manager confirmation, check-in, chuẩn bị, handover và hoàn thành.
- Realtime cập nhật không cần reload.
- Đơn hoàn thành tạo review đúng sản phẩm; review xuất hiện đúng nguồn và aggregate.

Không gọi PayOS thật trong các bài test sandbox.

## 10. Bàn giao sang PayOS

1. Dừng hoạt động kiểm thử.
2. Tạo backup database.
3. Audit và dọn dữ liệu QA theo danh sách được chủ dự án phê duyệt; không tự động xóa catalog hoặc tài khoản cần giữ.
4. Đặt `PAYMENT_MODE=payos` trên Render.
5. Redeploy backend và frontend nếu frontend cần artifact/config mới.
6. Xác minh route sandbox trả 404 và không còn giao diện sandbox.
7. Chạy regression PayOS và một giao dịch thật giá trị thấp.

## 11. Ngoài phạm vi

- Không xây cổng ZaloPay hoặc provider bên thứ ba mới.
- Không mô phỏng hệ thống ngân hàng thực.
- Không xác nhận kết nối ngân hàng tới PayOS bằng tiền giả.
- Không thêm mã truy cập chung hoặc banner môi trường test.
- Không tự động dọn dữ liệu production/test nếu chưa có phê duyệt mục tiêu và backup.

## 12. Tiêu chí hoàn thành

Tính năng hoàn thành khi tester có thể đăng ký tài khoản mới, tạo và thanh toán toàn bộ loại checkout bằng số tiền sandbox chính xác, tiếp tục mọi luồng vận hành và đánh giá; đồng thời hệ thống chứng minh không phát sinh PayOS outbound call trong sandbox và sandbox hoàn toàn không khả dụng khi chuyển sang mode PayOS.
