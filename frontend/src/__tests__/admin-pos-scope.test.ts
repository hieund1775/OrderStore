import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/routes/admin.pos.tsx'), 'utf8');

describe('admin POS branch-scope boundary', () => {
  it('uses the authenticated admin APIs instead of public checkout/store endpoints', () => {
    expect(source).toContain('apiGet<Store[]>("/admin/branches")');
    expect(source).toContain('`/admin/tables?store_id=${selectedStoreId}`');
    expect(source).toContain('"/admin/pos/orders"');
    expect(source).not.toContain('apiGet<Store[]>("/api/stores")');
    expect(source).not.toContain('"/api/orders",');
  });

  it('recognizes Super as the only role that may choose a branch in the POS UI', () => {
    expect(source).toContain('const canChooseStore = currentUser?.role === "super";');
  });
});
