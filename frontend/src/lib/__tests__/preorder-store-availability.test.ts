import { describe, expect, it } from 'vitest';
import { hasAvailablePreorderStore, isPreorderAvailableForStore } from '../preorder-store-availability';

describe('preorder store availability presentation', () => {
  const stores = [
    { store_id: 1, is_available: false },
    { store_id: 2, is_available: true },
  ];

  it('shows the preorder entry point only when at least one store is configured', () => {
    expect(hasAvailablePreorderStore(stores)).toBe(true);
    expect(hasAvailablePreorderStore([{ store_id: 1, is_available: false }])).toBe(false);
  });

  it('keeps an unavailable store visible but disallows its preorder selection', () => {
    expect(isPreorderAvailableForStore(stores, 1)).toBe(false);
    expect(isPreorderAvailableForStore(stores, 2)).toBe(true);
  });
});
