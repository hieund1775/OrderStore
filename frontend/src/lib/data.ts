export const brand = {
  name: 'Trà Trái Cây Tô',
  tagline: 'Trà đậm vị – Trái cây tươi mỗi ngày',
  hotline: '1900 8386',
  email: 'cskh@tratraicayto.vn',
};

export function vnd(value: number | string | null | undefined) {
  const amount = Number(value);
  return (Number.isFinite(amount) ? amount : 0).toLocaleString('vi-VN') + '₫';
}

export {
  parseTimestamp,
  parseLocalDate,
  formatDateTimeInZone,
  formatVietnamTime,
  formatVietnamTimeFull,
  formatVietnamDate,
  formatVietnamDateTime,
  fmtTime,
  fmtTimeFull,
  fmtDate,
  fmtDateTime,
  elapsedDurationMs,
  fmtClockTimer,
  formatVietnamOrderDatePrefix,
  VIETNAM_TIMEZONE,
  FALLBACK_DASH,
} from './time';

/**
 * Format full store address cleanly without duplicate district or city names
 */
export function formatFullAddress(address?: string, district?: string, city?: string): string {
  const parts: string[] = [];
  const addr = (address || '').trim();
  const dist = (district || '').trim();
  const cty = (city || '').trim();

  if (addr) parts.push(addr);

  if (dist) {
    const lowerAddr = addr.toLowerCase();
    const lowerDist = dist.toLowerCase();
    if (!lowerAddr.includes(lowerDist)) {
      parts.push(dist);
    }
  }

  if (cty) {
    const lowerAddr = addr.toLowerCase();
    const lowerCty = cty.toLowerCase();
    if (!lowerAddr.includes(lowerCty)) {
      parts.push(cty);
    }
  }

  return parts.join(', ');
}

/**
 * Standardize sugar level to prevent duplicates like "100% Đường đường" or "Không đường đường"
 */
export function normalizeSugarLevel(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  if (/đường/i.test(trimmed)) {
    const cleaned = trimmed.replace(/\s*đường/gi, '').trim();
    return cleaned ? `${cleaned} Đường` : 'Đường';
  }
  return `${trimmed} Đường`;
}

/**
 * Standardize ice level to prevent duplicates like "100% Đá đá" or "Không đá đá"
 */
export function normalizeIceLevel(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  if (/^(nóng|hot)$/i.test(trimmed)) {
    return 'Nóng';
  }
  if (/đá/i.test(trimmed)) {
    const cleaned = trimmed.replace(/\s*đá/gi, '').trim();
    return cleaned ? `${cleaned} Đá` : 'Đá';
  }
  return `${trimmed} Đá`;
}

/**
 * Format all order item customizations cleanly into a single unified string
 * e.g. "M · Lục Trà Lài · 100% Đường · 100% Đá · Trân châu đen"
 */
export function formatOrderItemOptions(item: {
  size_label?: string | null;
  base_tea?: string | null;
  sugar_level?: string | null;
  ice_level?: string | null;
  toppings?: Array<{ name: string } | string> | null;
}): string {
  const parts: string[] = [];
  if (item.size_label) parts.push(item.size_label);
  if (item.base_tea) parts.push(item.base_tea);
  const sugar = normalizeSugarLevel(item.sugar_level);
  if (sugar) parts.push(sugar);
  const ice = normalizeIceLevel(item.ice_level);
  if (ice) parts.push(ice);
  if (Array.isArray(item.toppings) && item.toppings.length > 0) {
    const toppingNames = item.toppings
      .map((t) => (typeof t === 'string' ? t : t?.name))
      .filter(Boolean);
    if (toppingNames.length > 0) {
      parts.push(toppingNames.join(', '));
    }
  }
  return parts.join(' · ');
}

export type ProductTag = 'best-seller' | 'new' | 'seasonal';

export type Product = {
  id: string;
  name: string;
  slug: string;
  base: string;
  desc: string;
  price: number;
  image: string;
  rating: number;
  reviews: number;
  total_sold?: number;
  created_at?: string;
  calories: number;
  line: string;
  fruit: string;
  fulfillment_lane?: string;
  tags: ProductTag[];
};

export type ApiCatalogProduct = {
  id: number | string;
  name?: string;
  slug?: string;
  base_tea?: string;
  description?: string | null;
  price?: number | string;
  image_url?: string | null;
  rating?: number | string;
  review_count?: number | string;
  total_sold?: number | string;
  created_at?: string;
  calories?: number | string;
  category_name?: string | null;
  fulfillment_lane?: string | null;
  tags?: string | string[] | null;
  is_bestseller?: boolean;
  is_seasonal?: boolean;
};

export const DEFAULT_PRODUCT_IMAGES: Record<string, string> = {
  'tra-cam-sa': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=640&q=80',
  'tra-dau-tay': 'https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?auto=format&fit=crop&w=640&q=80',
  'tra-xoai-chanh-day': 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=640&q=80',
  'tra-dao-vai': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=640&q=80',
  'olong-dao-vai': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=640&q=80',
  'tuyet-dua-hau': 'https://images.unsplash.com/photo-1589733955941-5eeaf752f6dd?auto=format&fit=crop&w=640&q=80',
  'detox-nho-nha-dam': 'https://images.unsplash.com/photo-1536935338788-846bb9981813?auto=format&fit=crop&w=640&q=80',
};

export const PLACEHOLDER_FOOD_IMAGE = '/placeholders/placeholder-food.jpg';
export const PLACEHOLDER_GOODS_IMAGE = '/placeholders/placeholder-goods.jpg';
export const FALLBACK_TEA_IMAGE = PLACEHOLDER_FOOD_IMAGE;

export const DEFAULT_PRODUCT_PLACEHOLDER = PLACEHOLDER_FOOD_IMAGE;

export function getProductPlaceholder(context?: {
  category?: string | null;
  fulfillment_lane?: string | null;
  name?: string;
  slug?: string;
}): string {
  const cat = (context?.category || '').toLowerCase();
  const lane = (context?.fulfillment_lane || '').toLowerCase();
  const name = (context?.name || '').toLowerCase();
  const s = (context?.slug || '').toLowerCase();

  const isGoods =
    lane === 'packing' ||
    cat.includes('áo') ||
    cat.includes('aó') ||
    cat.includes('quần') ||
    cat.includes('merch') ||
    cat.includes('thời trang') ||
    cat.includes('đóng gói') ||
    cat.includes('dong goi') ||
    cat.includes('phụ kiện') ||
    cat.includes('quà tặng') ||
    cat.includes('snack') ||
    cat.includes('hạt') ||
    name.includes('áo') ||
    name.includes('aó') ||
    name.startsWith('ao ') ||
    name.includes(' áo ') ||
    name.includes('quần') ||
    name.includes('hoodie') ||
    name.includes('túi') ||
    name.includes('nón') ||
    name.includes('bình giữ nhiệt') ||
    name.includes('ly giữ nhiệt') ||
    name.includes('hạt dinh dưỡng') ||
    s.includes('ao-') ||
    s.includes('quan-') ||
    s.includes('hoodie') ||
    s.includes('tui-') ||
    s.includes('merch') ||
    s.includes('dong-goi') ||
    s.includes('ly-giu-nhiet') ||
    s.includes('hat-dinh-duong');

  return isGoods ? PLACEHOLDER_GOODS_IMAGE : PLACEHOLDER_FOOD_IMAGE;
}

export function resolveProductImage(
  slug?: string,
  image?: string | null,
  context?: { category?: string | null; fulfillment_lane?: string | null; name?: string; image_url?: string | null },
): string {
  const cat = (context?.category || '').toLowerCase();
  const lane = (context?.fulfillment_lane || '').toLowerCase();
  const name = (context?.name || '').toLowerCase();
  const s = (slug || '').toLowerCase();

  const isGoods =
    lane === 'packing' ||
    cat.includes('áo') ||
    cat.includes('aó') ||
    cat.includes('quần') ||
    cat.includes('merch') ||
    cat.includes('thời trang') ||
    cat.includes('đóng gói') ||
    cat.includes('dong goi') ||
    cat.includes('phụ kiện') ||
    cat.includes('quà tặng') ||
    cat.includes('snack') ||
    cat.includes('hạt') ||
    name.includes('áo') ||
    name.includes('aó') ||
    name.startsWith('ao ') ||
    name.includes(' áo ') ||
    name.includes('quần') ||
    name.includes('hoodie') ||
    name.includes('túi') ||
    name.includes('nón') ||
    name.includes('bình giữ nhiệt') ||
    name.includes('ly giữ nhiệt') ||
    name.includes('hạt dinh dưỡng') ||
    s.includes('ao-') ||
    s.includes('quan-') ||
    s.includes('hoodie') ||
    s.includes('tui-') ||
    s.includes('merch') ||
    s.includes('dong-goi') ||
    s.includes('ly-giu-nhiet') ||
    s.includes('hat-dinh-duong');

  // Direct image from database / CDN if valid and not a broken local path or placeholder
  const rawTarget = (image && image.trim() !== '') ? image.trim() : (context?.image_url && context.image_url.trim() !== '') ? context.image_url.trim() : null;
  const isInvalidImage = !rawTarget ||
    rawTarget.startsWith('/src/assets/p-') ||
    rawTarget === '/placeholder.png' ||
    rawTarget.includes('images.unsplash.com/photo-1556679343-c7306c1976bc');

  if (isGoods) {
    if (!isInvalidImage) {
      return rawTarget;
    }
    if (name.includes('hạt') || name.includes('hat') || name.includes('snack') || s.includes('hat-dinh-duong') || s.includes('snack')) {
      return '/catalog/hat-dinh-duong.png';
    }
    if (name.includes('ly') || name.includes('bình') || name.includes('binh') || s.includes('ly-giu-nhiet')) {
      return '/catalog/ly-giu-nhiet.png';
    }
    return PLACEHOLDER_GOODS_IMAGE;
  }

  // Handle valid external/public URL from database
  if (!isInvalidImage && (
    rawTarget.startsWith('http://') ||
    rawTarget.startsWith('https://') ||
    rawTarget.startsWith('/catalog/') ||
    rawTarget.startsWith('/placeholders/') ||
    rawTarget.startsWith('/images/') ||
    rawTarget.startsWith('data:image/')
  )) {
    return rawTarget;
  }

  // Exact slug match
  if (slug && DEFAULT_PRODUCT_IMAGES[slug]) {
    return DEFAULT_PRODUCT_IMAGES[slug];
  }

  // Semantic category and keyword matching for dishes entered in QA / DB
  if (
    name.includes('bạc xỉu') ||
    name.includes('bac xiu') ||
    name.includes('cà phê') ||
    name.includes('ca phe') ||
    name.includes('cafe') ||
    name.includes('coffee') ||
    s.includes('bac-xiu') ||
    s.includes('ca-phe') ||
    s.includes('coffee') ||
    cat.includes('cà phê') ||
    cat.includes('ca phe')
  ) {
    return '/catalog/ca-phe-sua.png';
  }

  if (name.includes('dưa hấu') || name.includes('dua hau') || s.includes('dua-hau')) {
    return DEFAULT_PRODUCT_IMAGES['tuyet-dua-hau'];
  }

  if (name.includes('dâu') || name.includes('dau') || s.includes('dau')) {
    return DEFAULT_PRODUCT_IMAGES['tra-dau-tay'];
  }

  if (name.includes('đào') || name.includes('dao') || s.includes('dao')) {
    return '/catalog/tra-dao-cam-sa.png';
  }

  if (
    name.includes('trà sữa') ||
    name.includes('tra sua') ||
    name.includes('ô long') ||
    name.includes('o long') ||
    s.includes('tra-sua') ||
    s.includes('olong')
  ) {
    return '/catalog/tra-sua-olong.png';
  }

  if (name.includes('xoài') || name.includes('xoai') || s.includes('xoai')) {
    return DEFAULT_PRODUCT_IMAGES['tra-xoai-chanh-day'];
  }

  if (name.includes('cam') || name.includes('sả') || name.includes('sa') || s.includes('cam-sa')) {
    return DEFAULT_PRODUCT_IMAGES['tra-cam-sa'];
  }

  if (name.includes('nho') || name.includes('nha đam') || name.includes('nha dam') || s.includes('nho')) {
    return DEFAULT_PRODUCT_IMAGES['detox-nho-nha-dam'];
  }

  if (!isInvalidImage) {
    return rawTarget;
  }

  return PLACEHOLDER_FOOD_IMAGE;
}

/** Maps the PostgreSQL catalog DTO to the storefront card shape. */
export function mapApiProduct(product: ApiCatalogProduct): Product {
  const category = product.category_name?.trim() || 'Trà Trái Cây Tươi';
  const tags: ProductTag[] = [];

  if (Array.isArray(product.tags)) {
    for (const t of product.tags) {
      if ((t === 'best-seller' || t === 'new' || t === 'seasonal') && !tags.includes(t)) {
        tags.push(t);
      }
    }
  } else if (typeof product.tags === 'string' && product.tags.trim() !== '') {
    try {
      const parsed = JSON.parse(product.tags);
      if (Array.isArray(parsed)) {
        for (const t of parsed) {
          if ((t === 'best-seller' || t === 'new' || t === 'seasonal') && !tags.includes(t)) {
            tags.push(t);
          }
        }
      }
    } catch {
      const parts = product.tags.split(',').map((s: string) => s.trim());
      for (const t of parts) {
        if ((t === 'best-seller' || t === 'new' || t === 'seasonal') && !tags.includes(t)) {
          tags.push(t);
        }
      }
    }
  }

  if (product.is_bestseller && !tags.includes('best-seller')) tags.push('best-seller');
  if (product.is_seasonal && !tags.includes('seasonal')) tags.push('seasonal');

  const slug = product.slug || '';
  const parsedReviewCount = Number(product.review_count);
  const reviews = Number.isFinite(parsedReviewCount) && parsedReviewCount >= 0
    ? parsedReviewCount
    : 0;
  const parsedRating = Number(product.rating);
  // Products with no visible, verified review deliberately present as 5.0 / 0.
  // Never invent catalogue social proof from the former 4.8 / 120 fallback.
  const rating = reviews === 0
    ? 5
    : Number.isFinite(parsedRating) && parsedRating > 0
      ? parsedRating
      : 5;

  const parsedTotalSold = Number(product.total_sold);
  const total_sold = Number.isFinite(parsedTotalSold) && parsedTotalSold >= 0
    ? parsedTotalSold
    : 0;

  // Fallback to match mock/catalog product tags if still empty
  if (tags.length === 0) {
    const matched = products.find(
      (p) => p.slug === slug || p.id === String(product.id) || p.name === product.name
    );
    if (matched && matched.tags && matched.tags.length > 0) {
      tags.push(...matched.tags);
    }
  }

  const cleanName = (product.name || 'Sản phẩm TeaPlus').replace(/\bAó\b/g, 'Áo').replace(/\baó\b/g, 'áo');
  const rawImage = product.image_url || (product as any).image;

  return {
    id: String(product.id),
    name: cleanName,
    slug,
    base: product.base_tea || category,
    desc: product.description || '',
    price: Number(product.price || 0),
    image: resolveProductImage(slug, rawImage, {
      category: product.category_name,
      fulfillment_lane: product.fulfillment_lane,
      name: product.name,
      image_url: product.image_url,
    }),
    rating,
    reviews,
    total_sold,
    created_at: product.created_at,
    calories: Number(product.calories || 180),
    line: category,
    fruit: category,
    fulfillment_lane: product.fulfillment_lane || undefined,
    tags,
  };
}

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
    id: '1',
    slug: 'tra-cam-sa',
    name: 'Trà Cam Sả Mật Ong',
    base: 'Cốt Lục Trà Lài',
    desc: 'Vị chua dịu của cam vàng hòa cùng sả thơm và mật ong rừng, hậu trà thanh mát.',
    price: 45000,
    image: DEFAULT_PRODUCT_IMAGES['tra-cam-sa'],
    rating: 4.8,
    reviews: 1240,
    calories: 180,
    line: 'Trà Trái Cây Tươi',
    fruit: 'Cam / Sả',
    tags: ['best-seller', 'seasonal'],
  },
  {
    id: '2',
    slug: 'tra-dau-tay',
    name: 'Trà Dâu Tây Lài Thơm',
    base: 'Cốt Lục Trà Lài',
    desc: 'Dâu tây Đà Lạt dầm tươi quyện lục trà nhài thơm ngát, chua ngọt cân bằng.',
    price: 55000,
    image: DEFAULT_PRODUCT_IMAGES['tra-dau-tay'],
    rating: 4.9,
    reviews: 2038,
    calories: 210,
    line: 'Trà Trái Cây Tươi',
    fruit: 'Dâu / Nho',
    tags: ['best-seller'],
  },
  {
    id: '3',
    slug: 'tra-xoai-chanh-day',
    name: 'Trà Xoài Chanh Dây',
    base: 'Trà Đen Đậm Vị',
    desc: 'Xoài chín cắt khúc, chanh dây nguyên hạt, vị nhiệt đới rực rỡ.',
    price: 52000,
    image: DEFAULT_PRODUCT_IMAGES['tra-xoai-chanh-day'],
    rating: 4.7,
    reviews: 864,
    calories: 230,
    line: 'Trà Trái Cây Tươi',
    fruit: 'Xoài / Chanh Dây',
    tags: ['new'],
  },
  {
    id: '4',
    slug: 'tra-dao-vai',
    name: 'Ô Long Đào Vải',
    base: 'Trà Ô Long',
    desc: 'Đào ngâm giòn ngọt cùng vải thiều, nền ô long nướng nhẹ thơm sữa.',
    price: 49000,
    image: DEFAULT_PRODUCT_IMAGES['tra-dao-vai'],
    rating: 4.6,
    reviews: 512,
    calories: 195,
    line: 'Trà Đậm Vị',
    fruit: 'Đào / Vải',
    tags: ['seasonal'],
  },
  {
    id: '5',
    slug: 'tuyet-dua-hau',
    name: 'Trà Tuyết Dưa Hấu Táo',
    base: 'Lục Trà',
    desc: 'Dưa hấu xay tuyết mát lạnh, thêm táo giòn – giải nhiệt tức thì.',
    price: 58000,
    image: DEFAULT_PRODUCT_IMAGES['tuyet-dua-hau'],
    rating: 4.5,
    reviews: 390,
    calories: 240,
    line: 'Trà Trái Cây Tuyết',
    fruit: 'Dưa Hấu / Táo',
    tags: ['new', 'seasonal'],
  },
  {
    id: '6',
    slug: 'detox-nho-nha-dam',
    name: 'Hi-Tea Nho Nha Đam',
    base: 'Lục Trà Không Đường',
    desc: 'Nho mọng cùng nha đam giòn, ít đường, thanh lọc nhẹ nhàng.',
    price: 54000,
    image: DEFAULT_PRODUCT_IMAGES['detox-nho-nha-dam'],
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
  new: '✨ New',
  seasonal: '🥭 Trái Cây Theo Mùa',
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
    name: 'Trà Trái Cây Tô – Nguyễn Huệ',
    city: 'TP. Hồ Chí Minh',
    district: 'Quận 1',
    address: '125 Nguyễn Huệ, P. Bến Nghé',
    hours: '07:00 – 22:30',
    phone: '028 3822 1188',
    amenities: ['Chỗ đỗ ô tô', 'Máy lạnh', 'Mua mang đi'],
  },
  {
    id: 'q3',
    name: 'Trà Trái Cây Tô – Võ Văn Tần',
    city: 'TP. Hồ Chí Minh',
    district: 'Quận 3',
    address: '88 Võ Văn Tần, P.6',
    hours: '07:30 – 22:00',
    phone: '028 3930 6677',
    amenities: ['Máy lạnh', 'Mua mang đi', 'Giao hàng 24/7'],
  },
  {
    id: 'pmh',
    name: 'Trà Trái Cây Tô – Phú Mỹ Hưng',
    city: 'TP. Hồ Chí Minh',
    district: 'Quận 7',
    address: 'R4-15 Hưng Phước, Phú Mỹ Hưng',
    hours: '08:00 – 23:00',
    phone: '028 5410 2299',
    amenities: ['Chỗ đỗ ô tô', 'Không gian rộng', 'Máy lạnh'],
  },
  {
    id: 'hn-hk',
    name: 'Trà Trái Cây Tô – Hoàn Kiếm',
    city: 'Hà Nội',
    district: 'Hoàn Kiếm',
    address: '12 Hàng Bài, P. Tràng Tiền',
    hours: '07:00 – 22:00',
    phone: '024 3936 5544',
    amenities: ['Máy lạnh', 'Mua mang đi'],
  },
  {
    id: 'dn-hc',
    name: 'Trà Trái Cây Tô – Hải Châu',
    city: 'Đà Nẵng',
    district: 'Hải Châu',
    address: '45 Bạch Đằng, Hải Châu 1',
    hours: '07:30 – 22:30',
    phone: '0236 3812 345',
    amenities: ['View sông Hàn', 'Chỗ đỗ ô tô', 'Máy lạnh'],
  },
];

export type Store = (typeof stores)[number];

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
  { id: 'r5', name: 'Bình giữ nhiệt Trà Trái Cây Tô', points: 1200, emoji: '🧊' },
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
