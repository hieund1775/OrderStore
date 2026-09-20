import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getProvinces,
  getDistricts,
  getWards,
  formatDeliveryAddress,
  saveLastDeliveryLocation,
  getLastDeliveryLocation,
  findProvinceByName,
  getDistrictsByProvinceName,
  findDistrictByName,
  getWardsByNames,
  findWardByName,
  parseBranchAddress,
  searchStreetSuggestions,
  isValidStreetAddress,
} from '../vietnam-addresses';

describe('Vietnam Administrative Addresses Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads all 63 provinces sorted alphabetically by Vietnamese locale', () => {
    const provinces = getProvinces();
    expect(provinces.length).toBe(63);

    const hcm = provinces.find((p) => p.name.includes('Hồ Chí Minh'));
    const hn = provinces.find((p) => p.name.includes('Hà Nội'));
    const dn = provinces.find((p) => p.name.includes('Đà Nẵng'));

    expect(hcm).toBeDefined();
    expect(hn).toBeDefined();
    expect(dn).toBeDefined();

    // Verify sorted
    expect(provinces[0].name.localeCompare(provinces[1].name, 'vi')).toBeLessThanOrEqual(0);
  });

  it('loads districts for a valid province code and handles null gracefully', () => {
    const provinces = getProvinces();
    const hcm = provinces.find((p) => p.name.includes('Hồ Chí Minh'))!;
    const districts = getDistricts(hcm.code);

    expect(districts.length).toBeGreaterThan(15);
    const q1 = districts.find((d) => d.name === 'Quận 1');
    expect(q1).toBeDefined();

    // Null or invalid code
    expect(getDistricts(null)).toEqual([]);
    expect(getDistricts(undefined)).toEqual([]);
    expect(getDistricts(999999)).toEqual([]);
  });

  it('loads wards for a valid district code and handles null gracefully', () => {
    const provinces = getProvinces();
    const hcm = provinces.find((p) => p.name.includes('Hồ Chí Minh'))!;
    const districts = getDistricts(hcm.code);
    const q1 = districts.find((d) => d.name === 'Quận 1')!;

    const wards = getWards(hcm.code, q1.code);
    expect(wards.length).toBeGreaterThan(5);
    expect(wards.some((w) => w.name.includes('Bến Nghé'))).toBe(true);

    // Invalid province/district
    expect(getWards(null, q1.code)).toEqual([]);
    expect(getWards(hcm.code, null)).toEqual([]);
    expect(getWards(hcm.code, 999999)).toEqual([]);
  });

  it('formats full delivery address accurately', () => {
    const full = formatDeliveryAddress({
      street: '123 Lê Lợi',
      ward: 'Phường Bến Nghé',
      district: 'Quận 1',
      province: 'Thành phố Hồ Chí Minh',
    });
    expect(full).toBe('123 Lê Lợi, Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh');

    // Handles partial fields gracefully without extraneous commas
    const partial = formatDeliveryAddress({
      street: '456 Nguyễn Huệ',
      province: 'Thành phố Hồ Chí Minh',
    });
    expect(partial).toBe('456 Nguyễn Huệ, Thành phố Hồ Chí Minh');
  });

  it('saves and restores last delivery location to and from localStorage', () => {
    expect(getLastDeliveryLocation()).toBeNull();

    saveLastDeliveryLocation({
      provinceCode: 79,
      districtCode: 760,
      wardCode: 26734,
      street: '789 Nam Kỳ Khởi Nghĩa',
    });

    const restored = getLastDeliveryLocation();
    expect(restored).not.toBeNull();
    expect(restored?.provinceCode).toBe(79);
    expect(restored?.districtCode).toBe(760);
    expect(restored?.wardCode).toBe(26734);
    expect(restored?.street).toBe('789 Nam Kỳ Khởi Nghĩa');
  });

  describe('Name-based Lookup & Normalization', () => {
    it('matches provinces with or without prefix and handles aliases', () => {
      expect(findProvinceByName('TP. Hồ Chí Minh')?.name).toBe('Thành phố Hồ Chí Minh');
      expect(findProvinceByName('Hồ Chí Minh')?.name).toBe('Thành phố Hồ Chí Minh');
      expect(findProvinceByName('Hà Nội')?.name).toBe('Thành phố Hà Nội');
      expect(findProvinceByName('Đà Nẵng')?.name).toBe('Thành phố Đà Nẵng');
      expect(findProvinceByName('Huế')?.name).toBe('Thành phố Huế');
      expect(findProvinceByName('Thừa Thiên Huế')?.name).toBe('Thành phố Huế');
      expect(findProvinceByName('Đà Lạt')?.name).toBe('Tỉnh Lâm Đồng');
      expect(findProvinceByName('Vũng Tàu')?.name).toBe('Tỉnh Bà Rịa - Vũng Tàu');
    });

    it('finds districts by province name and district name', () => {
      const districts = getDistrictsByProvinceName('Hồ Chí Minh');
      expect(districts.length).toBeGreaterThan(15);
      expect(districts.some((d) => d.name === 'Quận 1')).toBe(true);

      const d1 = findDistrictByName('TP. Hồ Chí Minh', 'Quận 1');
      expect(d1?.name).toBe('Quận 1');

      const dGovap = findDistrictByName('Hồ Chí Minh', 'Gò Vấp');
      expect(dGovap?.name).toBe('Quận Gò Vấp');
    });

    it('finds wards by names and cleans prefix', () => {
      const wards = getWardsByNames('Hồ Chí Minh', 'Quận 1');
      expect(wards.length).toBeGreaterThan(5);

      const wBenNghe = findWardByName('TP. Hồ Chí Minh', 'Quận 1', 'Bến Nghé');
      expect(wBenNghe?.name).toBe('Phường Bến Nghé');

      const wBenThanh = findWardByName('Hồ Chí Minh', 'Quận 1', 'Phường Bến Thành');
      expect(wBenThanh?.name).toBe('Phường Bến Thành');
    });

    it('parses branch address extracting ward and street correctly', () => {
      const wards = getWardsByNames('Hồ Chí Minh', 'Quận 1');

      // Address has ward at the end
      const p1 = parseBranchAddress('123 Lê Lợi, Phường Bến Nghé', wards);
      expect(p1.ward).toBe('Phường Bến Nghé');
      expect(p1.street).toBe('123 Lê Lợi');

      // Address has no matching ward
      const p2 = parseBranchAddress('456 Nguyễn Trãi', wards);
      expect(p2.ward).toBe('');
      expect(p2.street).toBe('456 Nguyễn Trãi');

      // Empty address
      const p3 = parseBranchAddress('', wards);
      expect(p3.ward).toBe('');
      expect(p3.street).toBe('');
    });

    it('handles searchStreetSuggestions gracefully on network failure or empty query', async () => {
      expect(await searchStreetSuggestions('')).toEqual([]);
      expect(await searchStreetSuggestions('a')).toEqual([]);

      // Test with mock fetch
      const origFetch = globalThis.fetch;
      try {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => [
            { address: { road: 'Đường Lê Lợi' } },
            { address: { road: 'Đường Nguyễn Huệ' } },
            { address: { road: 'Đường Lê Lợi' } }, // duplicate
          ],
        } as any);

        const results = await searchStreetSuggestions('Lê', {
          province: 'Thành phố Hồ Chí Minh',
          district: 'Quận 1',
        });
        expect(results).toEqual(['Đường Lê Lợi', 'Đường Nguyễn Huệ']);
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    describe('isValidStreetAddress Anti-Spam & Validation', () => {
      it('accepts valid normal street addresses within 30 chars', () => {
        expect(isValidStreetAddress('123 Lê Lợi')).toBe(true);
        expect(isValidStreetAddress('Hẻm 45/6 Huỳnh Thúc Kháng')).toBe(true);
        expect(isValidStreetAddress('1')).toBe(true);
        expect(isValidStreetAddress('A1-02 Toà S1')).toBe(true);
      });

      it('rejects empty or whitespace-only inputs', () => {
        expect(isValidStreetAddress('')).toBe(false);
        expect(isValidStreetAddress('   ')).toBe(false);
      });

      it('rejects strings exceeding 30 characters', () => {
        expect(isValidStreetAddress('123456789012345678901234567890')).toBe(true); // 30 chars
        expect(isValidStreetAddress('1234567890123456789012345678901')).toBe(false); // 31 chars
        expect(isValidStreetAddress('Căn hộ chung cư cao cấp Landmark 81 Tầng 45 Phòng 4502')).toBe(false);
      });

      it('rejects inputs without any alphanumeric character (pure punctuation/symbols)', () => {
        expect(isValidStreetAddress('...')).toBe(false);
        expect(isValidStreetAddress('----')).toBe(false);
        expect(isValidStreetAddress('!@#$%^&*')).toBe(false);
      });

      it('rejects keyboard smash spam with repeated characters (4+ times in a row)', () => {
        expect(isValidStreetAddress('aaaaa')).toBe(false);
        expect(isValidStreetAddress('11111')).toBe(false);
        expect(isValidStreetAddress('123 Đường aaaa')).toBe(false);
      });
    });
  });
});

