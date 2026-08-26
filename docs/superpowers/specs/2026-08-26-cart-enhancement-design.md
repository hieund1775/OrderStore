# Tài liệu Thiết Kế: Giỏ Hàng Thông Minh (Shopee-Style Cart & Inline Item Customization)

**Ngày tạo**: 26/08/2026  
**Trạng thái**: Đã phê duyệt thiết kế  
**Tác giả**: HieuND & Antigravity  

---

## 1. Mục tiêu & Bối cảnh

Hệ thống đặt hàng trực tuyến của Trà Trái Cây Tô hiện tại có giỏ hàng cơ bản (thêm món, tăng giảm số lượng, xóa món). Để nâng cấp trải nghiệm người dùng theo định hướng sàn thương mại điện tử chuyên nghiệp và hiện đại:
1. **Chỉnh sửa tùy chọn món trực tiếp trong giỏ**: Khách hàng có thể đổi Size, Topping, % Đường, % Đá, Ghi chú của món đã có trong giỏ hàng mà không cần phải xóa đi tạo lại từ thực đơn.
2. **Phân ngăn theo Chi nhánh & Thời gian (Chuẩn Shopee)**:
   - Giỏ hàng chia thành từng ngăn theo Chi nhánh cửa hàng (`🏬 Chi nhánh Quận 1`, `🏬 Chi nhánh Bình Thạnh`...).
   - Hiển thị thời gian thêm món (`⏱️ 14:32 · Vừa xong`, `⏱️ Hôm qua 20:15`...).
   - Checkbox chọn món thông minh (Chọn tất cả, Chọn theo chi nhánh, Chọn từng món riêng lẻ) để thanh toán có chọn lọc.

---

## 2. Cấu trúc dữ liệu & State Management (`frontend/src/lib/cart.tsx`)

### 2.1. Kiểu dữ liệu `CartItem` mở rộng
```typescript
export type CartItem = {
  key: string;              // Unique key: [productId, size, base, sugar, ice, toppings.sort().join('|')].join('__')
  productId: string;        // ID sản phẩm
  name: string;             // Tên món
  image: string;            // URL ảnh món
  size: string;             // 'S' | 'M' | 'L' | 'XL'
  base: string;             // Cốt trà (vd: "Trà đen", "Trà lài")
  sugar: string;            // '0%' | '30%' | '50%' | '70%' | '100%'
  ice: string;              // '0%' | '30%' | '50%' | '70%' | '100%'
  toppings: string[];       // Danh sách ID topping đã chọn
  note?: string;            // Ghi chú đặc biệt của món
  unitPrice: number;        // Đơn giá sau khi cộng size extra và topping
  qty: number;              // Số lượng

  // --- CÁC TRƯỜNG MỚI ---
  branchId: number;         // ID chi nhánh đặt món (lấy từ useBranch().selectedStoreId)
  branchName: string;       // Tên chi nhánh hiển thị trên header ngăn
  addedAt: number;          // Timestamp thời điểm thêm món (Date.now())
  selected: boolean;        // Trạng thái tick checkbox thanh toán (mặc định: true)
};
```

### 2.2. CartContext API mở rộng
```typescript
export type CartContextValue = {
  items: CartItem[];
  count: number;                       // Tổng số lượng tất cả món
  subtotal: number;                    // Tổng tiền tất cả món trong giỏ
  selectedItems: CartItem[];           // Danh sách các món đang được chọn (selected === true)
  selectedCount: number;               // Tổng số lượng món được chọn
  selectedSubtotal: number;            // Tổng tiền các món được chọn thanh toán

  // Các thao tác giỏ hàng
  addItem: (item: Omit<CartItem, 'key' | 'addedAt' | 'selected'>) => boolean;
  updateItem: (oldKey: string, updated: Omit<CartItem, 'key' | 'addedAt' | 'selected'>) => boolean;
  removeItem: (key: string) => void;
  removeSelected: () => void;          // Xóa tất cả các món đang được tick chọn
  setQty: (key: string, qty: number) => void;
  clear: () => void;

  // Checkbox Selection
  toggleSelect: (key: string) => void;
  toggleSelectBranch: (branchId: number, selected: boolean) => void;
  toggleSelectAll: (selected: boolean) => void;
  isAllSelected: boolean;
};
```

---

## 3. Kiến trúc Giao diện & Trải nghiệm Người dùng (UI/UX)

### 3.1. Phân ngăn Giỏ hàng (`QuickCart` & `/thanh-toan`)
1. **Header giỏ hàng**:
   - Checkbox "Chọn tất cả" (`toggleSelectAll`) kèm số lượng.
   - Nút "Xóa đã chọn" (`removeSelected`) hiển thị khi có ít nhất 1 món được chọn.
2. **Nhóm theo Chi nhánh (Store Sections)**:
   - Danh sách món được nhóm bằng `itemsByBranch`:
     ```typescript
     const branchGroups = useMemo(() => {
       const groups = new Map<number, { branchId: number; branchName: string; items: CartItem[] }>();
       items.forEach(item => {
         const bId = item.branchId || 0;
         if (!groups.has(bId)) {
           groups.set(bId, { branchId: bId, branchName: item.branchName || 'Chi nhánh mặc định', items: [] });
         }
         groups.get(bId)!.items.push(item);
       });
       return Array.from(groups.values());
     }, [items]);
     ```
   - Mỗi ngăn có Checkbox chọn toàn bộ món của chi nhánh đó (`toggleSelectBranch`).
3. **Thẻ Món trong giỏ**:
   - Checkbox riêng của món (`toggleSelect`).
   - Badge thời gian thêm món thân thiện (`formatTimeAgo(item.addedAt)`: *"Vừa xong"*, *"5 phút trước"*, *"Hôm nay 10:15"*, *"25/08 20:00"*).
   - Nút **[✏️ Sửa tùy chọn]**: Mở `EditCartItemModal`.
   - Bộ đếm `[−] [qty] [+]` và nút Xóa.
4. **Footer giỏ hàng**:
   - Hiển thị **Tổng thanh toán** tính theo `selectedSubtotal`.
   - Nút "Thanh toán ngay ({selectedCount})" — disabled nếu `selectedCount === 0`.

### 3.2. Modal Chỉnh sửa Tùy chọn Món (`EditCartItemModal`)
- Component: `frontend/src/components/cart/EditCartItemModal.tsx`
- Nhận props: `{ item: CartItem | null, open: boolean, onOpenChange: (v: boolean) => void }`
- Tải thông tin sản phẩm gốc từ dữ liệu thực đơn (`products.find(p => p.id === item.productId)`).
- Pre-fill state: Size, Cốt trà, Đường, Đá, Topping, Ghi chú của món hiện tại.
- Khi người dùng bấm **"Lưu cập nhật"**:
  - Gọi `updateItem(oldKey, updatedItem)`.
  - Nếu món mới trùng key với 1 món khác trong giỏ ➔ Gộp số lượng.
  - Nếu key khác ➔ Thay thế vị trí món cũ, giữ nguyên `branchId`, `addedAt`, và `selected`.
  - Hiển thị toast thông báo thành công.

---

## 4. Xử lý Logic Thanh toán (`/thanh-toan`)
- Trang Thanh toán (`/thanh-toan`) lấy `selectedItems` để tạo đơn.
- Nếu giỏ hàng có các món từ nhiều chi nhánh khác nhau mà cùng được tick chọn:
  - Hiển thị cảnh báo: *"Bạn đang chọn món từ nhiều chi nhánh. Hệ thống sẽ tạo đơn cho chi nhánh [Tên Chi Nhánh] được chọn ưu tiên hoặc tách đơn"*.
  - Cho phép người dùng chuyển nhanh giữa các chi nhánh hoặc thanh toán theo từng chi nhánh.

---

## 5. Kế hoạch Kiểm thử & Đảm bảo Chất lượng
1. **Unit Tests (`cart.test.ts`)**:
   - Test thêm món có gán `addedAt`, `branchId`, `selected: true`.
   - Test `updateItem` khi thay đổi Size / Topping (đổi key thành công, tính lại unitPrice chuẩn xác).
   - Test gộp số lượng khi update trùng key với món sẵn có.
   - Test toggle selection: `toggleSelect`, `toggleSelectBranch`, `toggleSelectAll`, `removeSelected`.
   - Test tính `selectedSubtotal` và `selectedCount` chính xác 100%.
2. **E2E & Responsive Checks**:
   - Kiểm tra hiển thị Drawer `QuickCart` trên Mobile, Tablet và Laptop.
   - Kiểm tra `EditCartItemModal` hiển thị chuẩn trên màn hình nhỏ.
   - Chạy `npx tsc --noEmit` và `npm test` đạt 100%.
