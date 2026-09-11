import { describe, expect, it } from 'vitest';
import { canDeleteBranch } from '../branch-permissions';

describe('branch deletion visibility', () => {
  it('shows destructive branch deletion only to Super', () => {
    expect(canDeleteBranch('super')).toBe(true);
    expect(canDeleteBranch('manager')).toBe(false);
    expect(canDeleteBranch('cashier')).toBe(false);
    expect(canDeleteBranch('kitchen')).toBe(false);
    expect(canDeleteBranch('packing')).toBe(false);
    expect(canDeleteBranch(null)).toBe(false);
  });
});
