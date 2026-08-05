import { stores } from './data';

export const adminBranches = [
  { id: 'all', name: 'Tất cả chi nhánh' },
  ...stores.map((s) => ({ id: s.id, name: s.name })),
];

export const adminRoles = [
  { id: 'super', label: 'Super Admin', desc: 'Toàn quyền quản trị hệ thống' },
  { id: 'manager', label: 'Store Manager', desc: 'Quản lý chi nhánh được phân quyền' },
  { id: 'kitchen', label: 'Kitchen Staff', desc: 'Màn hình bếp (KDS Mode)' },
  { id: 'cashier', label: 'Cashier Staff', desc: 'Ghi nhận đơn tại quầy (POS Mode)' },
];

export const kpis = [
  {
    id: 'revenue',
    label: 'Doanh thu tạm tính',
    value: '42.680.000₫',
    delta: '+12,4%',
    tone: 'primary',
  },
  { id: 'orders', label: 'Đơn hoàn thành', value: '318', delta: '+8,1%', tone: 'leaf' },
  { id: 'cancel', label: 'Tỷ lệ hủy đơn', value: '2,8%', delta: '-0,6%', tone: 'berry' },
  { id: 'cups', label: 'Tổng ly đã bán', value: '764', delta: '+15,2%', tone: 'primary' },
];

export const urgentKpis = [
  { id: 'paused', label: 'Món đang tạm ngưng', value: 2, tone: 'danger', to: '/admin/thuc-don' },
  { id: 'prep', label: 'Đơn đang chuẩn bị', value: 7, tone: 'info', to: '/admin/bep' },
  { id: 'late', label: 'Đơn giao trễ', value: 1, tone: 'danger', to: '/admin/don-hang' },
];

export const hourlyRevenue = [
  { hour: '07h', value: 1200 },
  { hour: '09h', value: 2600 },
  { hour: '11h', value: 4900 },
  { hour: '13h', value: 3800 },
  { hour: '15h', value: 6800 },
  { hour: '17h', value: 7400 },
  { hour: '19h', value: 5600 },
  { hour: '21h', value: 3100 },
];

export const revenueByCategory = [
  { name: 'Trà trái cây tươi', value: 46 },
  { name: 'Trà đậm vị', value: 24 },
  { name: 'Trà tuyết', value: 18 },
  { name: 'Hi-Tea Detox', value: 12 },
];

export const revenueByBranch = [
  { name: 'Nguyễn Huệ', value: 15400 },
  { name: 'Võ Văn Tần', value: 11200 },
  { name: 'Phú Mỹ Hưng', value: 8600 },
  { name: 'Hoàn Kiếm', value: 4900 },
  { name: 'Hải Châu', value: 2580 },
];

export type OrderStatus =
  | 'Chờ xác nhận'
  | 'Đã xác nhận'
  | 'Đang chuẩn bị'
  | 'Đang giao'
  | 'Hoàn thành'
  | 'Đã hủy';

export type AdminOrder = {
  id: string;
  customer: string;
  phone: string;
  branch: string;
  type: 'Delivery' | 'Take-away' | 'POS';
  payment: 'COD' | 'VietQR' | 'MoMo' | 'ZaloPay';
  status: OrderStatus;
  total: number;
  time: string;
  minutes: number;
  items: { name: string; qty: number; options: string }[];
};

export const adminOrders: AdminOrder[] = [
  {
    id: 'VX26072801',
    customer: 'Nguyễn Minh Anh',
    phone: '0903 118 226',
    branch: 'Trà Trái Cây Tô – Nguyễn Huệ',
    type: 'Delivery',
    payment: 'MoMo',
    status: 'Chờ xác nhận',
    total: 158000,
    time: '15:24',
    minutes: 3,
    items: [
      {
        name: 'Trà Dâu Tây Lài Thơm',
        qty: 2,
        options: 'Size L · 50% đường · 70% đá · Thạch nha đam',
      },
      { name: 'Trà Cam Sả Mật Ong', qty: 1, options: 'Size M · 30% đường · 100% đá' },
    ],
  },
  {
    id: 'VX26072802',
    customer: 'Trần Quốc Bảo',
    phone: '0987 442 019',
    branch: 'Trà Trái Cây Tô – Võ Văn Tần',
    type: 'Take-away',
    payment: 'VietQR',
    status: 'Đang chuẩn bị',
    total: 104000,
    time: '15:18',
    minutes: 9,
    items: [
      { name: 'Ô Long Đào Vải', qty: 1, options: 'Size M · 70% đường · Trân châu trắng' },
      { name: 'Hi-Tea Nho Nha Đam', qty: 1, options: 'Size L · 0% đường · Đá riêng' },
    ],
  },
  {
    id: 'VX26072803',
    customer: 'Lê Thu Hà',
    phone: '0912 776 350',
    branch: 'Trà Trái Cây Tô – Phú Mỹ Hưng',
    type: 'POS',
    payment: 'COD',
    status: 'Đang chuẩn bị',
    total: 232000,
    time: '15:02',
    minutes: 17,
    items: [
      { name: 'Trà Tuyết Dưa Hấu Táo', qty: 3, options: 'Size L · 50% đường · Trái cây dầm' },
      { name: 'Trà Xoài Chanh Dây', qty: 1, options: 'Size M · 100% đường' },
    ],
  },
  {
    id: 'VX26072804',
    customer: 'Phạm Gia Huy',
    phone: '0934 220 118',
    branch: 'Trà Trái Cây Tô – Nguyễn Huệ',
    type: 'Delivery',
    payment: 'ZaloPay',
    status: 'Đang giao',
    total: 96000,
    time: '14:47',
    minutes: 26,
    items: [{ name: 'Trà Cam Sả Mật Ong', qty: 2, options: 'Size L · 30% đường · Aloe Vera' }],
  },
  {
    id: 'VX26072805',
    customer: 'Đỗ Khánh Linh',
    phone: '0977 615 402',
    branch: 'Trà Trái Cây Tô – Hoàn Kiếm',
    type: 'Take-away',
    payment: 'VietQR',
    status: 'Hoàn thành',
    total: 143000,
    time: '14:12',
    minutes: 42,
    items: [{ name: 'Trà Dâu Tây Lài Thơm', qty: 2, options: 'Size M · 70% đường · Macchiato' }],
  },
  {
    id: 'VX26072806',
    customer: 'Vũ Nhật Nam',
    phone: '0961 338 274',
    branch: 'Trà Trái Cây Tô – Hải Châu',
    type: 'Delivery',
    payment: 'COD',
    status: 'Đã hủy',
    total: 58000,
    time: '13:55',
    minutes: 60,
    items: [{ name: 'Trà Tuyết Dưa Hấu Táo', qty: 1, options: 'Size L · 50% đường' }],
  },
];

export const kdsColumns = [
  { id: 'wait', label: 'Chờ làm', tone: 'amber' },
  { id: 'prep', label: 'Đang chuẩn bị', tone: 'blue' },
  { id: 'done', label: 'Hoàn thành', tone: 'green' },
] as const;

export const menuCategories = [
  { id: 'c1', name: 'Trà Trái Cây Tươi', items: 12, visible: true },
  { id: 'c2', name: 'Trà Đậm Vị', items: 8, visible: true },
  { id: 'c3', name: 'Trà Trái Cây Tuyết', items: 6, visible: true },
  { id: 'c4', name: 'Hi-Tea Detox', items: 5, visible: true },
  { id: 'c5', name: 'Bánh Ngọt Ăn Kèm', items: 9, visible: false },
];

export const optionGroups = [
  { id: 'o1', name: 'Size', values: ['M (Chuẩn)', 'L (+10.000₫)'] },
  { id: 'o2', name: 'Cốt trà', values: ['Lục Trà Lài', 'Trà Ô Long', 'Trà Đen'] },
  { id: 'o3', name: 'Độ ngọt', values: ['0%', '30%', '50%', '70%', '100%'] },
  { id: 'o4', name: 'Mức đá', values: ['Không đá', '30%', '50%', '70%', '100%', 'Đá riêng'] },
  { id: 'o5', name: 'Topping / Sốt', values: ['Trái cây dầm', 'Thạch nha đam', 'Macchiato'] },
  { id: 'o6', name: 'Nước đóng lon', values: ['Pepsi Có Đường', 'Pepsi Không Đường (Zero Sugar)'] },
];

export type Ingredient = {
  id: string;
  name: string;
  kind: 'fresh' | 'canned';
  unit: string;
  stock: number;
  safe: number;
};

export const ingredients: Ingredient[] = [
  { id: 'i1', name: 'Cam vàng', kind: 'fresh', unit: 'kg', stock: 42, safe: 60 },
  { id: 'i2', name: 'Ổi ruột hồng', kind: 'fresh', unit: 'kg', stock: 9, safe: 40 },
  { id: 'i3', name: 'Táo Envy', kind: 'fresh', unit: 'kg', stock: 24, safe: 50 },
  { id: 'i4', name: 'Dưa hấu', kind: 'fresh', unit: 'kg', stock: 0, safe: 45 },
  { id: 'i5', name: 'Dứa (thơm)', kind: 'fresh', unit: 'kg', stock: 33, safe: 40 },
  { id: 'i6', name: 'Dâu tây Đà Lạt', kind: 'fresh', unit: 'kg', stock: 6, safe: 30 },
  { id: 'i7', name: 'Pepsi Có Đường', kind: 'canned', unit: 'lon', stock: 240, safe: 300 },
  {
    id: 'i8',
    name: 'Pepsi Không Đường (Zero Sugar)',
    kind: 'canned',
    unit: 'lon',
    stock: 58,
    safe: 300,
  },
  { id: 'i9', name: 'Nha đam đóng hộp', kind: 'canned', unit: 'hộp', stock: 74, safe: 120 },
];

export function stockLevel(i: Ingredient) {
  const pct = Math.round((i.stock / i.safe) * 100);
  if (pct === 0) return { pct, label: 'Hết hàng', tone: 'out' as const };
  if (pct < 20) return { pct, label: 'Nguy hiểm', tone: 'danger' as const };
  if (pct <= 30) return { pct, label: 'Cảnh báo', tone: 'warn' as const };
  return { pct, label: 'Bình thường', tone: 'ok' as const };
}

export const adminPromotions = [
  {
    id: 'ap1',
    name: 'Flash Sale 15h Vàng',
    type: 'Flash Sale',
    scope: 'Toàn chuỗi',
    time: 'Mỗi ngày 15:00 – 16:00',
    audience: 'Tất cả khách hàng',
    status: 'Đang chạy',
  },
  {
    id: 'ap2',
    name: 'Happy Hour Trà Tuyết',
    type: 'Happy Hour',
    scope: 'Q1, Q3, Q7',
    time: 'T2 – T6 · 14:00 – 16:00',
    audience: 'Hạng Bạc trở lên',
    status: 'Đang chạy',
  },
  {
    id: 'ap3',
    name: 'Mua 2 Tặng 1 Cam Sả',
    type: 'Mua 2 Tặng 1',
    scope: 'Toàn chuỗi',
    time: '01/08 – 07/08',
    audience: 'Khách mới',
    status: 'Lên lịch',
  },
  {
    id: 'ap4',
    name: 'Combo Trà + Bánh 79K',
    type: 'Combo',
    scope: 'Hà Nội, Đà Nẵng',
    time: '01/06 – 30/06',
    audience: 'Tất cả khách hàng',
    status: 'Kết thúc',
  },
];

export const adminCustomers = [
  {
    id: 'cu1',
    name: 'Nguyễn Minh Anh',
    phone: '0903 118 226',
    tier: 'Kim Cương',
    points: 3240,
    ltv: 12480000,
    orders: 86,
    lastOrder: 'Hôm nay',
    segment: 'VIP',
  },
  {
    id: 'cu2',
    name: 'Trần Quốc Bảo',
    phone: '0987 442 019',
    tier: 'Vàng',
    points: 1780,
    ltv: 6420000,
    orders: 54,
    lastOrder: '2 ngày trước',
    segment: 'VIP',
  },
  {
    id: 'cu3',
    name: 'Lê Thu Hà',
    phone: '0912 776 350',
    tier: 'Bạc',
    points: 640,
    ltv: 2380000,
    orders: 21,
    lastOrder: '6 ngày trước',
    segment: 'Sinh nhật tháng này',
  },
  {
    id: 'cu4',
    name: 'Phạm Gia Huy',
    phone: '0934 220 118',
    tier: 'Đồng',
    points: 120,
    ltv: 680000,
    orders: 7,
    lastOrder: '45 ngày trước',
    segment: 'Churn Risk',
  },
  {
    id: 'cu5',
    name: 'Đỗ Khánh Linh',
    phone: '0977 615 402',
    tier: 'Vàng',
    points: 1520,
    ltv: 5210000,
    orders: 48,
    lastOrder: '38 ngày trước',
    segment: 'Churn Risk',
  },
];

export const topProducts = [
  { name: 'Trà Dâu Tây Lài Thơm', qty: 268, revenue: 14740000 },
  { name: 'Trà Cam Sả Mật Ong', qty: 231, revenue: 10395000 },
  { name: 'Trà Tuyết Dưa Hấu Táo', qty: 154, revenue: 8932000 },
  { name: 'Ô Long Đào Vải', qty: 128, revenue: 6272000 },
  { name: 'Hi-Tea Nho Nha Đam', qty: 96, revenue: 5184000 },
];

export const topVouchers = [
  { code: 'SNOW30', used: 412, discount: 8240000 },
  { code: 'CAMSA11', used: 306, discount: 6120000 },
  { code: 'FREESHIPW', used: 188, discount: 2820000 },
];

export const ingredientUsage = [
  { name: 'Cam vàng', used: '128 kg' },
  { name: 'Dâu tây Đà Lạt', used: '74 kg' },
  { name: 'Dưa hấu', used: '96 kg' },
  { name: 'Pepsi Zero Sugar', used: '312 lon' },
];

export const topStaff = [
  { name: 'Trần Bảo Ngọc', branch: 'Nguyễn Huệ', orders: 214, revenue: 9820000 },
  { name: 'Lý Thanh Tùng', branch: 'Võ Văn Tần', orders: 186, revenue: 8140000 },
  { name: 'Hồ Mai Chi', branch: 'Phú Mỹ Hưng', orders: 152, revenue: 6730000 },
];

export const adminNotifications = [
  {
    id: 'an1',
    type: 'order',
    title: 'Đơn online mới VX26072801',
    time: '1 phút trước',
    tone: 'info',
  },
  {
    id: 'an2',
    type: 'stock',
    title: 'Dưa hấu đã hết hàng tại Q7',
    time: '12 phút trước',
    tone: 'danger',
  },
  {
    id: 'an3',
    type: 'stock',
    title: 'Dâu tây còn 20% tại Q1',
    time: '40 phút trước',
    tone: 'warn',
  },
  {
    id: 'an4',
    type: 'voucher',
    title: 'Voucher SNOW30 sắp hết lượt dùng',
    time: '2 giờ trước',
    tone: 'warn',
  },
  {
    id: 'an5',
    type: 'staff',
    title: 'Yêu cầu duyệt tài khoản nhân viên mới',
    time: 'Hôm qua',
    tone: 'info',
  },
  {
    id: 'an6',
    type: 'payment',
    title: 'Lỗi cổng thanh toán ZaloPay (mã 502)',
    time: 'Hôm qua',
    tone: 'danger',
  },
];

export const adminAccounts = [
  {
    id: 'u1',
    name: 'Nguyễn Hoàng Quân',
    email: 'quan@tratraicayto.vn',
    role: 'Super Admin',
    branch: 'Toàn hệ thống',
    active: true,
  },
  {
    id: 'u2',
    name: 'Trần Bảo Ngọc',
    email: 'ngoc@tratraicayto.vn',
    role: 'Store Manager',
    branch: 'Nguyễn Huệ',
    active: true,
  },
  {
    id: 'u3',
    name: 'Lý Thanh Tùng',
    email: 'tung@tratraicayto.vn',
    role: 'Cashier Staff',
    branch: 'Võ Văn Tần',
    active: true,
  },
  {
    id: 'u4',
    name: 'Hồ Mai Chi',
    email: 'chi@tratraicayto.vn',
    role: 'Kitchen Staff',
    branch: 'Phú Mỹ Hưng',
    active: false,
  },
];

export const auditLogs = [
  {
    id: 'l1',
    user: 'quan@tratraicayto.vn',
    action: 'Cập nhật giá sản phẩm',
    detail: 'Trà Cam Sả: 42.000₫ → 45.000₫',
    time: '27/07 14:52',
    ip: '113.185.44.2',
    device: 'Chrome · macOS',
  },
  {
    id: 'l2',
    user: 'ngoc@tratraicayto.vn',
    action: 'Tạm ngưng bán món',
    detail: 'Trà Tuyết Dưa Hấu: Đang bán → Tạm ngưng',
    time: '27/07 13:20',
    ip: '171.244.10.88',
    device: 'Safari · iPad',
  },
  {
    id: 'l3',
    user: 'quan@tratraicayto.vn',
    action: 'Tạo khuyến mãi',
    detail: 'Flash Sale 15h Vàng',
    time: '26/07 09:11',
    ip: '113.185.44.2',
    device: 'Chrome · macOS',
  },
  {
    id: 'l4',
    user: 'tung@tratraicayto.vn',
    action: 'Hủy đơn hàng',
    detail: 'VX26072806 – lý do: khách báo hủy',
    time: '26/07 08:04',
    ip: '14.161.7.19',
    device: 'Chrome · Windows',
  },
];
