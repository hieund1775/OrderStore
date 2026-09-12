import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), 'src');
const header = fs.readFileSync(path.join(root, 'components/site/Header.tsx'), 'utf8');
const checkout = fs.readFileSync(path.join(root, 'routes/dat-truoc.tsx'), 'utf8');

describe('preorder availability navigation contract', () => {
  it('uses the public configuration result for both desktop and mobile navigation', () => {
    expect(header).toContain('fetchPreorderStoreAvailability()');
    expect(header.match(/\{canPreorder && \(/g)?.length).toBe(2);
    expect(header).toContain('onClick={() => setMobileSheetOpen(false)}');
  });

  it('labels unavailable stores and prevents a 409 availability request while configuration loads', () => {
    expect(checkout).toContain('Chưa áp dụng đặt trước');
    expect(checkout).toContain('if (preorderStores == null) return undefined;');
    expect(checkout).toContain('selectedStorePreorderAvailable !== true');
  });

  it('lets customers select products and review their preorder cart without a separate checkout flow', () => {
    expect(checkout).toContain("ProductCard");
    expect(checkout).toContain("apiGet<ApiCatalogProduct[]>('/api/products')");
    expect(checkout).toContain('Chọn món cho đơn đặt trước');
    expect(checkout).toContain('Giỏ preorder');
    expect(checkout).toContain('selectedSubtotal');
  });
});
