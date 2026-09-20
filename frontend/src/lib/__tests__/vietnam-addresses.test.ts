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
  });
});
