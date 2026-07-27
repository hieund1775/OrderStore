import camSa from '@/assets/p-cam-sa.jpg';
import dauTay from '@/assets/p-dau-tay.jpg';
import xoai from '@/assets/p-xoai.jpg';
import daoVai from '@/assets/p-dao-vai.jpg';
import duaHau from '@/assets/p-dua-hau.jpg';
import nho from '@/assets/p-nho.jpg';

export const brand = {
  name: 'Tiệm Trà Vườn Xanh',
  tagline: 'Trà đậm vị – Trái cây tươi mỗi ngày',
  hotline: '1900 8386',
  email: 'cskh@travuonxanh.vn',
};

export function vnd(value: number) {
  return value.toLocaleString('vi-VN') + '₫';
}

export type ProductTag = 'best-seller' | 'new' | 'seasonal';

export type Product = {
  id: string;
  name: string;
  base: string;
  desc: string;
  price: number;
  image: string;
  rating: number;
  reviews: number;
  calories: number;
  line: string;
  fruit: string;
  tags: ProductTag[];
};

export const teaLines = [
  'Trà Trái Cây Tươi',
  'Trà Đậm Vị',
  'Trà Trái Cây Tuyết',
  'Hi-Tea Detox',
  'Bánh Ngọt Ăn Kèm',
] as const;

export const fruitGroups = [
  'Cam / Sả',
  'Dâu / Nho',
  'Đào / Vải',
  'Xoài / Chanh Dây',
  'Dưa Hấu / Táo',
] as const;

export const products: Product[] = [
  {
    id: 'tra-cam-sa',
    name: 'Trà Cam Sả Mật Ong',
    base: 'Cốt Lục Trà Lài',
    desc: 'Vị chua dịu của cam vàng hòa cùng sả thơm và mật ong rừng, hậu trà thanh mát.',
    price: 45000,
    image: camSa,
    rating: 4.8,
    reviews: 1240,
    calories: 180,
    line: 'Trà Trái Cây Tươi',
    fruit: 'Cam / Sả',
    tags: ['best-seller', 'seasonal'],
  },
  {
    id: 'tra-dau-tay',
    name: 'Trà Dâu Tây Lài Thơm',
    base: 'Cốt Lục Trà Lài',
    desc: 'Dâu tây Đà Lạt dầm tươi quyện lục trà nhài thơm ngát, chua ngọt cân bằng.',
    price: 55000,
    image: dauTay,
    rating: 4.9,
    reviews: 2038,
    calories: 210,
    line: 'Trà Trái Cây Tươi',
    fruit: 'Dâu / Nho',
    tags: ['best-seller'],
  },
  {
    id: 'tra-xoai-chanh-day',
    name: 'Trà Xoài Chanh Dây',
    base: 'Trà Đen Đậm Vị',
    desc: 'Xoài chín cắt khúc, chanh dây nguyên hạt, vị nhiệt đới rực rỡ.',
    price: 52000,
    image: xoai,
    rating: 4.7,
    reviews: 864,
    calories: 230,
    line: 'Trà Trái Cây Tươi',
    fruit: 'Xoài / Chanh Dây',
    tags: ['new'],
  },
  {
    id: 'tra-dao-vai',
    name: 'Ô Long Đào Vải',
    base: 'Trà Ô Long',
    desc: 'Đào ngâm giòn ngọt cùng vải thiều, nền ô long nướng nhẹ thơm sữa.',
    price: 49000,
    image: daoVai,
    rating: 4.6,
    reviews: 512,
    calories: 195,
    line: 'Trà Đậm Vị',
    fruit: 'Đào / Vải',
    tags: ['seasonal'],
  },
  {
    id: 'tuyet-dua-hau',
    name: 'Trà Tuyết Dưa Hấu Táo',
    base: 'Lục Trà',
    desc: 'Dưa hấu xay tuyết mát lạnh, thêm táo giòn – giải nhiệt tức thì.',
    price: 58000,
    image: duaHau,
    rating: 4.5,
    reviews: 390,
    calories: 240,
    line: 'Trà Trái Cây Tuyết',
    fruit: 'Dưa Hấu / Táo',
    tags: ['new', 'seasonal'],
  },
  {
    id: 'detox-nho-nha-dam',
    name: 'Hi-Tea Nho Nha Đam',
    base: 'Lục Trà Không Đường',
    desc: 'Nho mọng cùng nha đam giòn, ít đường, thanh lọc nhẹ nhàng.',
    price: 54000,
    image: nho,
    rating: 4.7,
    reviews: 623,
    calories: 150,
    line: 'Hi-Tea Detox',
    fruit: 'Dâu / Nho',
    tags: ['best-seller'],
  },
];

export const tagLabel: Record<ProductTag, string> = {
  'best-seller': '🔥 Best Seller',
  new: '✨ Món Mới',
  seasonal: '🍊 Trái Cây Theo Mùa',
};

export const sizeOptions = [
  { id: 'M', label: 'Size M (Chuẩn)', extra: 0 },
  { id: 'L', label: 'Size L (Lớn)', extra: 10000 },
];

export const baseOptions = ['Lục Trà Lài', 'Trà Ô Long', 'Trà Đen'];
export const sugarOptions = [
  '0% (Không đường)',
  '30%',
  '50%',
  '70%',
  '100% (Mặc định)',
  'Ngọt tự nhiên từ trái cây',
];
export const iceOptions = ['Không đá', '30%', '50%', '70%', '100% (Mặc định)', 'Đá riêng'];

export const toppingOptions = [
  { id: 'trai-cay-dam', label: 'Trái cây dầm tươi', price: 10000 },
  { id: 'nha-dam', label: 'Thạch nha đam', price: 8000 },
  { id: 'thach-trai-cay', label: 'Thạch trái cây', price: 8000 },
  { id: 'tran-chau-trang', label: 'Trân châu trắng', price: 7000 },
  { id: 'aloe', label: 'Aloe Vera', price: 9000 },
  { id: 'macchiato', label: 'Macchiato kem cheese', price: 12000 },
];

export const stores = [
  {
    id: 'q1',
    name: 'Vườn Xanh – Nguyễn Huệ',
    city: 'TP. Hồ Chí Minh',
    district: 'Quận 1',
    address: '125 Nguyễn Huệ, P. Bến Nghé, Quận 1',
    hours: '07:00 – 22:30',
    phone: '028 3822 1188',
    amenities: ['Chỗ đỗ ô tô', 'Máy lạnh', 'Mua mang đi'],
  },
  {
    id: 'q3',
    name: 'Vườn Xanh – Võ Văn Tần',
    city: 'TP. Hồ Chí Minh',
    district: 'Quận 3',
    address: '88 Võ Văn Tần, P.6, Quận 3',
    hours: '07:30 – 22:00',
    phone: '028 3930 6677',
    amenities: ['Máy lạnh', 'Mua mang đi', 'Giao hàng 24/7'],
  },
  {
    id: 'pmh',
    name: 'Vườn Xanh – Phú Mỹ Hưng',
    city: 'TP. Hồ Chí Minh',
    district: 'Quận 7',
    address: 'R4-15 Hưng Phước, Phú Mỹ Hưng, Quận 7',
    hours: '08:00 – 23:00',
    phone: '028 5410 2299',
    amenities: ['Chỗ đỗ ô tô', 'Không gian rộng', 'Máy lạnh'],
  },
  {
    id: 'hn-hk',
    name: 'Vườn Xanh – Hoàn Kiếm',
    city: 'Hà Nội',
    district: 'Hoàn Kiếm',
    address: '12 Hàng Bài, P. Tràng Tiền, Hoàn Kiếm',
    hours: '07:00 – 22:00',
    phone: '024 3936 5544',
    amenities: ['Máy lạnh', 'Mua mang đi'],
  },
  {
    id: 'dn-hc',
    name: 'Vườn Xanh – Hải Châu',
    city: 'Đà Nẵng',
    district: 'Hải Châu',
    address: '45 Bạch Đằng, Hải Châu 1, Hải Châu',
    hours: '07:30 – 22:30',
    phone: '0236 3812 345',
    amenities: ['View sông Hàn', 'Chỗ đỗ ô tô', 'Máy lạnh'],
  },
];

export type PromoStatus = 'Đang diễn ra' | 'Sắp diễn ra' | 'Đã kết thúc';

export const promotions: {
  id: string;
  title: string;
  period: string;
  status: PromoStatus;
  code: string;
  rule: string;
  emoji: string;
}[] = [
  {
    id: 'p1',
    title: 'Mua 1 Tặng 1 Trà Cam Sả',
    period: '01/07 – 31/07',
    status: 'Đang diễn ra',
    code: 'CAMSA11',
    rule: 'Áp dụng cho đơn tại quầy và đặt online từ 14:00 – 17:00 mỗi ngày.',
    emoji: '🍊',
  },
  {
    id: 'p2',
    title: 'Giảm 30% Trà Trái Cây Tuyết',
    period: '10/07 – 20/07',
    status: 'Đang diễn ra',
    code: 'SNOW30',
    rule: 'Giảm tối đa 30.000₫, áp dụng cho đơn từ 89.000₫.',
    emoji: '🍉',
  },
  {
    id: 'p3',
    title: 'Freeship 0đ Cuối Tuần',
    period: '05/08 – 07/08',
    status: 'Sắp diễn ra',
    code: 'FREESHIPW',
    rule: 'Miễn phí giao hàng bán kính 5km cho hội viên hạng Bạc trở lên.',
    emoji: '🚚',
  },
  {
    id: 'p4',
    title: 'Tặng Topping Trái Cây Dầm',
    period: '01/06 – 30/06',
    status: 'Đã kết thúc',
    code: 'TOPPINGFREE',
    rule: 'Tặng 1 topping trái cây dầm cho mọi đơn từ 69.000₫.',
    emoji: '🍓',
  },
];

export const jobs = [
  {
    id: 'barista',
    title: 'Nhân viên Pha Chế (Barista Trà Trái Cây)',
    type: 'Toàn thời gian',
    salary: '7 – 9 triệu + thưởng doanh số',
    jd: 'Pha chế theo công thức chuẩn, sơ chế trái cây tươi mỗi ngày, giữ vệ sinh khu vực quầy.',
    req: 'Từ 18 tuổi, ưu tiên có 6 tháng kinh nghiệm F&B, nhanh nhẹn, chịu khó.',
  },
  {
    id: 'cashier',
    title: 'Thu Ngân',
    type: 'Toàn thời gian / Ca linh hoạt',
    salary: '6.5 – 8 triệu',
    jd: 'Tiếp nhận đơn hàng, thanh toán, tư vấn món và chương trình tích điểm cho khách.',
    req: 'Giao tiếp tốt, cẩn thận với tiền mặt, sử dụng được máy POS.',
  },
  {
    id: 'manager',
    title: 'Quản Lý Cửa Hàng',
    type: 'Toàn thời gian',
    salary: '12 – 18 triệu',
    jd: 'Quản lý vận hành, nhân sự, tồn kho nguyên liệu và chỉ tiêu doanh thu chi nhánh.',
    req: 'Tối thiểu 1 năm kinh nghiệm quản lý F&B, kỹ năng đào tạo đội ngũ.',
  },
  {
    id: 'parttime',
    title: 'Nhân Viên Part-time',
    type: 'Bán thời gian (4h/ca)',
    salary: '25.000 – 30.000₫/giờ',
    jd: 'Hỗ trợ pha chế, phục vụ, dọn dẹp khu vực khách ngồi.',
    req: 'Sinh viên, sắp xếp được tối thiểu 4 ca/tuần.',
  },
];

export const tiers = [
  { name: 'Đồng', need: 0, perks: ['Tích 1 điểm / 10.000₫', 'Ưu đãi sinh nhật 10%'] },
  { name: 'Bạc', need: 500, perks: ['Giảm 5% mọi đơn', 'Tặng 1 topping / tháng'] },
  { name: 'Vàng', need: 1500, perks: ['Giảm 10% mọi đơn', 'Freeship 3km', 'Quà sinh nhật'] },
  {
    name: 'Kim Cương',
    need: 3000,
    perks: ['Giảm 15% mọi đơn', 'Freeship không giới hạn', 'Ưu tiên thử món mới'],
  },
];

export const rewards = [
  { id: 'r1', name: 'Voucher giảm 20.000₫', points: 200, emoji: '🎟️' },
  { id: 'r2', name: 'Miễn phí Topping bất kỳ', points: 120, emoji: '🍒' },
  { id: 'r3', name: 'Upsize Size L miễn phí', points: 90, emoji: '🥤' },
  { id: 'r4', name: '1 Ly Trà Cam Sả Size M', points: 450, emoji: '🍹' },
  { id: 'r5', name: 'Bình giữ nhiệt Vườn Xanh', points: 1200, emoji: '🧊' },
  { id: 'r6', name: 'Voucher giảm 100.000₫', points: 900, emoji: '💳' },
];

export const orderHistory = [
  {
    id: 'VX240712',
    date: '12/07/2026 · 15:24',
    status: 'Hoàn tất' as const,
    total: 158000,
    items: [
      'Trà Dâu Tây Lài Thơm (L, 50% đường, thạch nha đam)',
      'Trà Cam Sả Mật Ong (M, 30% đường)',
    ],
  },
  {
    id: 'VX240705',
    date: '05/07/2026 · 09:10',
    status: 'Hoàn tất' as const,
    total: 104000,
    items: ['Ô Long Đào Vải (M, 70% đường)', 'Hi-Tea Nho Nha Đam (M, 0% đường)'],
  },
  {
    id: 'VX240628',
    date: '28/06/2026 · 20:02',
    status: 'Đã hủy' as const,
    total: 58000,
    items: ['Trà Tuyết Dưa Hấu Táo (L, 50% đường)'],
  },
];

export const notifications = [
  { id: 'n1', title: 'Voucher SNOW30 vừa được thêm vào ví', time: '5 phút trước', type: 'voucher' },
  { id: 'n2', title: 'Đơn VX240712 đã giao thành công', time: '2 giờ trước', type: 'order' },
  { id: 'n3', title: 'Món mới: Trà Tuyết Dưa Hấu Táo đã lên kệ', time: 'Hôm qua', type: 'news' },
];

export const searchSuggestions = [
  'Trà cam sả',
  'Dâu tây lài',
  'Trà tuyết dưa hấu',
  'Ô long đào vải',
  'Topping trân châu trắng',
];
