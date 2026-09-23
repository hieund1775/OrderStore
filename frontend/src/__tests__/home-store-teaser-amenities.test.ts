import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STORE_AMENITIES,
  getStoreAmenities,
  formatAmenityLabel,
} from '@/routes/index';

describe('Home Store Teaser Amenities Synchronization & Formatting Suite', () => {
  it('falls back to DEFAULT_STORE_AMENITIES when amenities is null or undefined', () => {
    expect(getStoreAmenities(null)).toEqual(DEFAULT_STORE_AMENITIES);
    expect(getStoreAmenities(undefined)).toEqual(DEFAULT_STORE_AMENITIES);
  });

  it('falls back to DEFAULT_STORE_AMENITIES when amenities is empty array [] (avoids disappearing amenities bug)', () => {
    expect(getStoreAmenities([])).toEqual(DEFAULT_STORE_AMENITIES);
    expect(getStoreAmenities(['', '   '])).toEqual(DEFAULT_STORE_AMENITIES);
  });

  it('falls back to DEFAULT_STORE_AMENITIES when amenities is empty JSON array string', () => {
    expect(getStoreAmenities('[]')).toEqual(DEFAULT_STORE_AMENITIES);
    expect(getStoreAmenities('')).toEqual(DEFAULT_STORE_AMENITIES);
  });

  it('correctly returns provided custom amenities array', () => {
    const custom = ['Chỗ đỗ xe', 'Máy lạnh', 'Giao 25p'];
    expect(getStoreAmenities(custom)).toEqual(custom);
  });

  it('correctly parses JSON string array of amenities', () => {
    expect(getStoreAmenities(JSON.stringify(['Đỗ ô tô', 'Máy lạnh']))).toEqual([
      'Đỗ ô tô',
      'Máy lạnh',
    ]);
  });

  it('formats amenity labels with detailed icons as expected by UI', () => {
    expect(formatAmenityLabel('Chỗ đỗ ô tô')).toBe('🚗 Đỗ ô tô');
    expect(formatAmenityLabel('Máy lạnh')).toBe('❄️ Máy lạnh');
    expect(formatAmenityLabel('Mua mang đi')).toBe('🛵 Mua mang đi');
    expect(formatAmenityLabel('Giao 25p')).toBe('⚡ Giao 25p');
    expect(formatAmenityLabel('Không gian thoáng')).toBe('🌿 Không gian thoáng');
    expect(formatAmenityLabel('Wifi miễn phí')).toBe('📶 Wifi miễn phí');
    expect(formatAmenityLabel('Khu vui chơi')).toBe('✨ Khu vui chơi');
  });
});
