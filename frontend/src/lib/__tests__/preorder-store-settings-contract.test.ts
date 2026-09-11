import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const page = fs.readFileSync(path.resolve(process.cwd(), 'src/routes/admin.dat-truoc.tsx'), 'utf8');

describe('Super preorder store settings UI contract', () => {
  it('loads and saves only the canonical Super configuration endpoints', () => {
    expect(page).toContain("apiGet<{ stores: PreorderStoreSetting[] }>('/admin/preorders/settings')");
    expect(page).toContain('apiPut(`/admin/preorders/settings/${setting.store_id}`');
    expect(page).toContain("user?.role === 'super'");
  });

  it('cannot present an enabled branch without an eligible Manager', () => {
    expect(page).toContain('noEligibleManager || draft.managerId === UNASSIGNED_MANAGER');
    expect(page).toContain('Không có Manager đang hoạt động thuộc chi nhánh này; không thể bật preorder.');
  });
});
