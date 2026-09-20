import rawData from '../data/vietnam-addresses.json';

interface RawWard {
  c: number;
  n: string;
}

interface RawDistrict {
  c: number;
  n: string;
  w: RawWard[];
}

interface RawProvince {
  c: number;
  n: string;
  d: RawDistrict[];
}

const provincesData: RawProvince[] = rawData as RawProvince[];

export interface AddressUnit {
  code: number;
  name: string;
}

export interface DeliveryAddressValue {
  provinceCode: number | null;
  provinceName: string;
  districtCode: number | null;
  districtName: string;
  wardCode: number | null;
  wardName: string;
  street: string;
  fullAddress: string;
  isComplete: boolean;
}

/**
 * Lấy danh sách 63 Tỉnh/Thành phố, sắp xếp theo bảng chữ cái tiếng Việt
 */
export function getProvinces(): AddressUnit[] {
  return provincesData
    .map((p) => ({
      code: p.c,
      name: p.n,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

/**
 * Lấy danh sách Quận/Huyện thuộc Tỉnh/Thành phố
 */
export function getDistricts(provinceCode: number | null | undefined): AddressUnit[] {
  if (provinceCode == null) return [];
  const province = provincesData.find((p) => p.c === Number(provinceCode));
  if (!province) return [];
  return province.d
    .map((d) => ({
      code: d.c,
      name: d.n,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

/**
 * Lấy danh sách Phường/Xã thuộc Quận/Huyện của Tỉnh/Thành phố
 */
export function getWards(
  provinceCode: number | null | undefined,
  districtCode: number | null | undefined,
): AddressUnit[] {
  if (provinceCode == null || districtCode == null) return [];
  const province = provincesData.find((p) => p.c === Number(provinceCode));
  if (!province) return [];
  const district = province.d.find((d) => d.c === Number(districtCode));
  if (!district) return [];
  return district.w
    .map((w) => ({
      code: w.c,
      name: w.n,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

function cleanProvinceName(s: string): string {
  return (s || '')
    .trim()
    .toLowerCase()
    .replace(/^(tỉnh|thành phố|tp\.?)\s+/i, '');
}

function cleanDistrictName(s: string): string {
  return (s || '')
    .trim()
    .toLowerCase()
    .replace(/^(quận|huyện|thị xã|thành phố|tp\.?)\s+/i, '');
}

const PROVINCE_ALIASES: Record<string, string> = {
  'thừa thiên huế': 'huế',
  'tỉnh thừa thiên huế': 'huế',
  'vũng tàu': 'bà rịa - vũng tàu',
  'bà rịa': 'bà rịa - vũng tàu',
  'đà lạt': 'lâm đồng',
  'nha trang': 'khánh hòa',
  'phan thiết': 'bình thuận',
  'buôn ma thuột': 'đắk lắk',
  'pleiku': 'gia lai',
  'quy nhơn': 'bình định',
};

/**
 * Tìm Tỉnh/Thành phố theo tên (chấp nhận cả tên có hoặc không có tiền tố Tỉnh/TP, hoặc tên viết tắt phổ biến)
 */
export function findProvinceByName(name: string): AddressUnit | undefined {
  if (!name) return undefined;
  const rawTarget = cleanProvinceName(name);
  const target = PROVINCE_ALIASES[rawTarget] || rawTarget;
  const found = provincesData.find((p) => {
    const pClean = cleanProvinceName(p.n);
    return (
      pClean === target ||
      pClean === rawTarget ||
      p.n.toLowerCase() === name.trim().toLowerCase()
    );
  });
  return found ? { code: found.c, name: found.n } : undefined;
}

/**
 * Lấy danh sách Quận/Huyện theo tên Tỉnh/Thành phố
 */
export function getDistrictsByProvinceName(provinceName: string): AddressUnit[] {
  const p = findProvinceByName(provinceName);
  if (!p) return [];
  return getDistricts(p.code);
}

/**
 * Tìm Quận/Huyện theo tên Tỉnh và tên Quận/Huyện
 */
export function findDistrictByName(
  provinceName: string,
  districtName: string,
): AddressUnit | undefined {
  const list = getDistrictsByProvinceName(provinceName);
  if (!districtName || list.length === 0) return undefined;
  const target = cleanDistrictName(districtName);
  return list.find((d) => {
    return cleanDistrictName(d.name) === target || d.name.toLowerCase() === districtName.trim().toLowerCase();
  });
}

/**
 * Lấy danh sách Phường/Xã theo tên Tỉnh và tên Quận/Huyện
 */
export function getWardsByNames(provinceName: string, districtName: string): AddressUnit[] {
  const p = findProvinceByName(provinceName);
  if (!p) return [];
  const d = findDistrictByName(provinceName, districtName);
  if (!d) return [];
  return getWards(p.code, d.code);
}

function cleanWardName(s: string): string {
  return (s || '')
    .trim()
    .toLowerCase()
    .replace(/^(phường|xã|thị trấn|tt\.?|p\.?)\s+/i, '');
}

/**
 * Tìm Phường/Xã theo tên
 */
export function findWardByName(
  provinceName: string,
  districtName: string,
  wardName: string,
): AddressUnit | undefined {
  const list = getWardsByNames(provinceName, districtName);
  if (!wardName || list.length === 0) return undefined;
  const target = cleanWardName(wardName);
  return list.find((w) => {
    return cleanWardName(w.name) === target || w.name.toLowerCase() === wardName.trim().toLowerCase();
  });
}

/**
 * Trích xuất Phường/Xã và Số nhà/Tên đường từ chuỗi địa chỉ chi nhánh cũ
 */
export function parseBranchAddress(
  rawAddress: string,
  availableWards: AddressUnit[] = [],
): { ward: string; street: string } {
  if (!rawAddress) return { ward: '', street: '' };
  const trimmed = rawAddress.trim();
  if (!availableWards || availableWards.length === 0) {
    return { ward: '', street: trimmed };
  }

  // Sắp xếp phường theo độ dài tên giảm dần để tránh so khớp nhầm tên ngắn hơn
  const sortedWards = [...availableWards].sort((a, b) => b.name.length - a.name.length);

  for (const w of sortedWards) {
    const escaped = w.name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(?:,\\s*)?${escaped}(?:\\s*,)?`, 'i');
    if (regex.test(trimmed)) {
      const street = trimmed
        .replace(regex, '')
        .replace(/^,\s*/, '')
        .replace(/,\s*$/, '')
        .trim();
      return { ward: w.name, street };
    }
  }

  return { ward: '', street: trimmed };
}

/**
 * Gợi ý tên đường thời gian thực qua Nominatim OpenStreetMap dựa trên bối cảnh địa giới đã chọn
 */
export async function searchStreetSuggestions(
  query: string,
  context: { province?: string; district?: string; ward?: string } = {},
): Promise<string[]> {
  const q = (query || '').trim();
  if (q.length < 2) return [];

  // Bóc tách nếu query có sẵn số nhà phía trước (ví dụ "123 Lê Lợi" -> tìm "Lê Lợi")
  const cleanedQuery = q.replace(/^(\d+[\w/.-]*\s+)/, '').trim() || q;

  const parts = [cleanedQuery];
  if (context.ward) parts.push(context.ward);
  if (context.district) parts.push(context.district);
  if (context.province) parts.push(context.province);
  parts.push('Việt Nam');

  const queryString = parts.join(', ');
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=vn&q=${encodeURIComponent(queryString)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'OrderStoreApp/1.0' } });
    if (!res.ok) return [];
    const list = (await res.json()) as any[];
    if (!Array.isArray(list)) return [];

    const streets = new Set<string>();
    for (const item of list) {
      const road = item.address?.road;
      if (road && typeof road === 'string' && road.trim()) {
        streets.add(road.trim());
      }
    }
    return Array.from(streets);
  } catch {
    return [];
  }
}

/**
 * Ghép các thành phần thành chuỗi địa chỉ hoàn chỉnh chuẩn Việt Nam
 */
export function formatDeliveryAddress({
  street,
  ward,
  district,
  province,
}: {
  street?: string;
  ward?: string;
  district?: string;
  province?: string;
}): string {
  const parts: string[] = [];
  const s = (street || '').trim();
  const w = (ward || '').trim();
  const d = (district || '').trim();
  const p = (province || '').trim();

  if (s) parts.push(s);
  if (w) parts.push(w);
  if (d) parts.push(d);
  if (p) parts.push(p);

  return parts.join(', ');
}

const STORAGE_KEY = 'teaplus_saved_delivery_location';

export interface SavedDeliveryLocation {
  provinceCode: number;
  districtCode: number;
  wardCode: number;
  street: string;
}

export function saveLastDeliveryLocation(data: SavedDeliveryLocation): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota or disabled errors
  }
}

export function getLastDeliveryLocation(): SavedDeliveryLocation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.provinceCode === 'number' &&
      typeof parsed.districtCode === 'number' &&
      typeof parsed.wardCode === 'number'
    ) {
      return {
        provinceCode: parsed.provinceCode,
        districtCode: parsed.districtCode,
        wardCode: parsed.wardCode,
        street: typeof parsed.street === 'string' ? parsed.street : '',
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Kiểm tra tính hợp lệ của địa chỉ / số nhà / tên đường (chống spam phím, chuỗi vô nghĩa, giới hạn 30 ký tự)
 */
export function isValidStreetAddress(street: string): boolean {
  const trimmed = (street || '').trim();
  if (trimmed.length < 1 || trimmed.length > 30) return false;

  // Chặn nếu toàn ký tự đặc biệt / không chứa ít nhất 1 chữ cái hoặc chữ số
  if (!/[\p{L}\d]/u.test(trimmed)) return false;

  // Chặn nếu có 1 ký tự lặp liên tiếp từ 4 lần trở lên (đè phím spam: aaaaa, 11111)
  if (/(.)\1{3,}/.test(trimmed)) return false;

  return true;
}
