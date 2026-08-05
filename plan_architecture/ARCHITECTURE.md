# ARCHITECTURE.md — Roadmap tương lai: OrderService (C# Clean Architecture)

> [!NOTE]
> **Trạng thái hiện tại (05/08/2026):** Backend chính thức là **Node.js/Express** tại `backend/` theo `plan.md` — ưu tiên "đơn hàng chạy được". Tài liệu này là **roadmap tương lai** cho việc migrate Order sang C# khi hệ thống ổn định; mọi code C# mới (khi thực hiện migration) phải tuân thủ tài liệu này.
>
> Ngữ cảnh tham chiếu: bảng `orders`, `order_items`, `order_item_toppings`, `order_status_history` trong `backend/database/schema.sql` và luồng Order Tracking trên frontend (`/theo-doi-don/:id`).

## 1. Tổng quan

Backend hiện tại là Node.js/Express đặt ở `backend/`. Dự án C# mới sẽ được tạo thành một solution riêng trong thư mục `backend/`:

```
backend/
├── ...                    (backend Node.js cũ — giữ nguyên cho tới khi migration xong)
└── OrderService/          ← solution C# mới
    ├── Order.sln
    ├── Order.Domain/            (classlib — không phụ thuộc gì)
    ├── Order.Application/       (classlib — phụ thuộc Domain)
    ├── Order.Infrastructure/    (classlib — phụ thuộc Domain + Application)
    └── Order.Api/               (webapi  — phụ thuộc tất cả)
```

## 2. Dependency rule (bắt buộc)

Chỉ được phụ thuộc từ ngoài vào trong, **không bao giờ phụ thuộc ngược**:

| Lớp | Được phụ thuộc |
|---|---|
| `Order.Domain` | **Không phụ thuộc gì** — không EF Core, không ASP.NET, không package nào ngoài chuẩn .NET |
| `Order.Application` | Chỉ `Order.Domain` — định nghĩa interface repository, use case, DTO |
| `Order.Infrastructure` | `Order.Application` + `Order.Domain` — cài đặt EF Core, repository |
| `Order.Api` | Tất cả — chỉ chứa controller, middleware, DI registration |

Hệ quả thực tế:
- `Domain` không được `using` EF Core/ASP.NET, không dùng attribute của EF (`[Key]`, `[Table]`, `[Required]`).
- `Application` không được `using` EF Core (`DbContext`, `.Include()`, `IQueryable` ra khỏi repository). Mọi truy cập dữ liệu qua interface do chính `Application` định nghĩa.
- `Infrastructure` không được chứa logic nghiệp vụ và không được `using` `Order.Api`.
- `Api` không được chứa nghiệp vụ, không gọi `DbContext` trực tiếp — controller chỉ "dịch" HTTP request thành lời gọi service và response.

## 3. `Order.Domain` — lõi nghiệp vụ

### 3.1. Cấu trúc

```
Order.Domain/
├── Entities/
│   ├── Order.cs
│   ├── OrderItem.cs
│   └── OrderStatusHistory.cs
├── Enums/
│   ├── OrderStatus.cs
│   ├── OrderType.cs
│   └── PaymentMethod.cs
├── Repositories/
│   └── IOrderRepository.cs
├── Common/
│   ├── IUnitOfWork.cs        (nếu dùng)
│   └── DomainException.cs
└── Services/
    └── IDomainEventDispatcher.cs   (chỉ khi cần event; có thể bỏ qua ở giai đoạn đầu)
```

### 3.2. `OrderStatus.cs` — enum trạng thái

Đặt tại `Order.Domain/Enums/OrderStatus.cs`. Map với status hiện tại trong `order_status_history` và UI Order Tracking:

```csharp
public enum OrderStatus
{
    Pending = 0,     // Chờ xác nhận
    Confirmed = 1,   // Đã xác nhận
    Preparing = 2,   // Đang chuẩn bị
    Delivering = 3,  // Đang giao
    Completed = 4,   // Hoàn thành
    Cancelled = 5    // Đã hủy
}
```

Bổ sung `OrderType` (Delivery, Takeaway, Pos) và `PaymentMethod` (Cod, VietQr, MoMo, ZaloPay) — theo CHECK constraint của `orders` table.

### 3.3. `Order.cs` — entity trung tâm

**Đường dẫn bắt buộc:** `backend/OrderService/Order.Domain/Entities/Order.cs`

Entity phản ánh cột của bảng `orders` (schema.sql), nhưng các member phản ánh **hành vi nghiệp vụ** — không phải "DTO của bảng":

```csharp
public class Order
{
    // ---- State (map với bảng orders) ----
    public int Id { get; private set; }                 // PK
    public string OrderCode { get; private set; }       // unique, sinh tự động
    public int CustomerId { get; private set; }         // user_id
    public int StoreId { get; private set; }            // store_id
    public OrderType OrderType { get; private set; }    // Delivery / Take-away / POS
    public PaymentMethod PaymentMethod { get; private set; }
    public string CustomerName { get; private set; }
    public string CustomerPhone { get; private set; }
    public string? DeliveryAddress { get; private set; }   // null nếu Take-away
    public OrderStatus Status { get; private set; }        // enum, KHÔNG dùng string
    public string? VoucherCode { get; private set; }
    public int DiscountAmount { get; private set; }
    public int PointsUsed { get; private set; }
    public int PointsEarned { get; private set; }
    public int Subtotal { get; private set; }
    public int TotalAmount { get; private set; }           // thành tiền cuối
    public string? Note { get; private set; }
    public string? CancelReason { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    // ---- Navigation (chỉ phục vụ thao tác trong tầng Domain/Infrastructure) ----
    private readonly List<OrderItem> _items = new();
    public IReadOnlyCollection<OrderItem> Items => _items;   // KHÔNG public List

    private readonly List<OrderStatusHistory> _statusHistory = new();
    public IReadOnlyCollection<OrderStatusHistory> StatusHistory => _statusHistory;

    // ---- Behavior (nghiệp vụ nằm TRONG entity) ----
    protected Order() { }   // cho EF

    public static Order Create(int customerId, int storeId, OrderType orderType,
        string customerName, string customerPhone, string? deliveryAddress,
        PaymentMethod paymentMethod, string? voucherCode, string? note)
    {
        // Sinh OrderCode, set CreatedAt, Status = Pending, Subtotal/Total = 0
        // Ném DomainException nếu tham số bắt buộc thiếu/rỗng
    }

    public void AddItem(OrderItem item)          // bổ sung item + đánh dấu thay đổi
    public void RemoveItem(OrderItem item)
    public void RecalculateTotals()              // Subtotal = sum(line_total), Total = Subtotal - Discount
    public void ApplyVoucher(string code, int discountAmount)  // validate discount <= subtotal
    public void Confirm()            // Pending -> Confirmed
    public void StartPreparing()     // Confirmed -> Preparing
    public void StartDelivering()    // Preparing -> Delivering
    public void Complete()           // Delivering -> Completed
    public void Cancel(string reason)  // chỉ khi chưa Delivering; set CancelReason, cập nhật Points
}
```

Nguyên tắc: `setter` là `private`; đổi trạng thái chỉ qua các method có tên theo hành động nghiệp vụ; **invalid transition ném `DomainException`**; `TotalAmount` không bao giờ được set trực tiếp từ bên ngoài. Mỗi lần đổi status ghi thêm 1 dòng vào `StatusHistory` (map với bảng `order_status_history`).

### 3.4. `IOrderRepository.cs` — interface, không có EF

```csharp
public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<Order?> GetByCodeAsync(string orderCode, CancellationToken ct = default);
    Task<IReadOnlyList<Order>> GetByCustomerIdAsync(int customerId, CancellationToken ct = default);
    Task AddAsync(Order order, CancellationToken ct = default);
    void Update(Order order);
}
```

## 4. `Order.Application` — use cases / services / DTO

```
Order.Application/
├── UseCases/
│   ├── CreateOrderUseCase.cs      (hoặc OrderService nếu team thấy gọn hơn)
│   ├── GetOrderUseCase.cs
│   ├── CancelOrderUseCase.cs
│   └── UpdateOrderStatusUseCase.cs
├── DTOs/
│   ├── CreateOrderRequest.cs
│   ├── OrderDto.cs / OrderItemDto.cs / OrderStatusDto.cs
└── Common/ (Interfaces cho Infrastructure implement — không bắt buộc, chỉ nếu cần email/SMS...)
```

- Use case/service **chỉ thao tác qua `IOrderRepository`** (+ `IUnitOfWork`), **không biết EF**.
- Nhận `CreateOrderRequest` (DTO) và **map sang entity** bằng `Create(...)` của `Order`; trả về `OrderDto`.
- Rule nghiệp vụ liên quan data bên ngoài domain (vd: kiểm tra khách tồn tại, tính điểm tích lũy) đặt ở đây, gọi qua interface do Application định nghĩa.
- Nếu chỉ có 1–2 use case cho Order, có thể gộp thành 1 file `OrderService.cs` + `IOrderService.cs` cho thực dụng; khi số use case nhiều lên thì tách file.

## 5. `Order.Infrastructure` — EF Core và repository thật

```
Order.Infrastructure/
├── Persistence/
│   ├── AppDbContext.cs
│   ├── Configurations/
│   │   ├── OrderConfiguration.cs        (map Order -> bảng orders)
│   │   ├── OrderItemConfiguration.cs
│   │   └── OrderStatusHistoryConfiguration.cs
│   └── Migrations/
├── Repositories/
│   └── OrderRepository.cs               (implement IOrderRepository)
├── UnitOfWork.cs                        (implement IUnitOfWork, bọc DbContext.SaveChangesAsync)
└── DependencyInjection.cs               (extension: AddInfrastructure(connString))
```

- Mapping cột ↔ property (đặt tên, `IsRequired`, unique cho `OrderCode`, relation 1–n với `OrderItem`) nằm hết trong `Configurations/` — **không** rải attribute lên entity Domain.
- `OrderRepository` map `Order` (domain) sang/tháo bảng qua `AppDbContext`; `_items`/`_statusHistory` load bằng `Include` **ở đây**, không lộ ra Application.

## 6. `Order.Api` — HTTP layer

```
Order.Api/
├── Controllers/
│   └── OrdersController.cs
├── Middleware/  (ExceptionHandler: DomainException -> 400, NotFound -> 404)
└── Program.cs   (DI: AddDomain, AddApplication, AddInfrastructure, AddControllers)
```

`OrdersController`:
- `POST /api/orders` → `CreateOrderUseCase` → 201 + OrderDto
- `GET /api/orders/{id}` → `GetOrderUseCase` → 200 / 404
- `GET /api/orders?customerId=` → danh sách đơn của khách
- `POST /api/orders/{id}/cancel` → `CancelOrderUseCase`
- `POST /api/orders/{id}/status` → `UpdateOrderStatusUseCase` (cho admin/kitchen)

Controller không chứa `if` nghiệp vụ (vd: kiểm tra "đơn chưa giao mới hủy được" phải nằm trong entity method `Cancel`, không nằm trong controller).

## 7. Checklist review tuân thủ kiến trúc

Dùng checklist này để review code Order (đặc biệt là `Order.cs`):

1. **Domain sạch**: `Order.cs` không có `using` EF Core/ASP.NET/Newtonsoft; không attribute EF `[Key]/[Table]/[Required]`; không tham chiếu tới `Order.Application`, `Order.Infrastructure`, `Order.Api`.
2. **Dependency direction**: `.csproj` của Domain không có `ProjectReference` nào; Application chỉ reference Domain; Infrastructure chỉ reference Domain + Application; chỉ Api thấy Infrastructure.
3. **Entity không phải DTO**: `Order.cs` không có public setter cho state (trừ private); không có constructor public parameterless dùng từ nghiệp vụ (chỉ `protected` cho EF); không có `List<T>` public — dùng `IReadOnlyCollection` hoặc private list.
4. **Trạng thái là enum**: `Status` kiểu `OrderStatus` (enum) chứ không phải `string`; không có so sánh status bằng chuỗi rải rác trong service/controller.
5. **Nghiệp vụ ở đúng chỗ**: quy tắc đổi trạng thái hợp lệ (`Pending → Confirmed → ...`, chỉ hủy khi chưa giao) nằm trong method của entity, ném `DomainException` khi vi phạm — không nằm trong controller.
6. **Tính tiền đóng gói**: `TotalAmount`/`Subtotal` chỉ thay đổi qua `RecalculateTotals()`/`ApplyVoucher()` bên trong entity — không có chỗ nào set `TotalAmount` trực tiếp từ Application/Api.
7. **Application không biết EF**: service/use case không `using Microsoft.EntityFrameworkCore`, không gọi `.Include()`, không nhận `AppDbContext` qua constructor; chỉ dùng `IOrderRepository`/`IUnitOfWork`.
8. **Controller mỏng**: controller không chứa logic nghiệp vụ/validation nghiệp vụ; chỉ map request → gọi use case → map response; không gọi `DbContext`.
9. **Repository đúng việc**: mọi truy cập DB đi qua `IOrderRepository`/`IUnitOfWork`; không ai khác ngoài Infrastructure tạo/query `AppDbContext`.
10. **EF config tách biệt**: mapping bảng/cột/relation nằm trong `Configurations/` (Fluent API) — không dùng Data Annotation trong Domain.
11. **Tên phương thức theo nghiệp vụ**: method của entity mô tả hành động nghiệp vụ (`Confirm()`, `Cancel(reason)`) chứ không mô tả hành vi kỹ thuật (`SetStatus(2)`).
12. **Lịch sử trạng thái**: mỗi lần đổi status đều ghi vào `StatusHistory` — không đổi `Status` mà không có trace.

---
*Cập nhật lần đầu: 2026-08-04. Khi review `Order.cs`, đối chiếu mục 3.3 và checklist mục 7.*
