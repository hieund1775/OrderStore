import { describe, expect, it } from 'vitest';
import { filterActiveStores, resolveSelectedStoreId, type PublicStore } from '../branch';

const stores: PublicStore[] = [
  { id: 1, name: 'Nguyễn Huệ', is_active: true },
  { id: 2, name: 'Hàng Bài', is_active: false },
  { id: 3, name: 'Lê Lợi' },
];

describe('branch selection helpers', () => {
  it('keeps only valid active stores', () => {
    expect(filterActiveStores(stores).map((store) => store.id)).toEqual([1, 3]);
  });

  it('restores a valid saved store', () => {
    expect(resolveSelectedStoreId(filterActiveStores(stores), '3')).toBe(3);
  });

  it('falls back to the first active store for stale storage', () => {
    expect(resolveSelectedStoreId(filterActiveStores(stores), '999')).toBe(1);
  });

  it('returns null when no active store exists', () => {
    expect(resolveSelectedStoreId([], '1')).toBeNull();
  });
});
