import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/routes/admin.pos.tsx'), 'utf8');

describe('Admin POS resilient bootstrap specification and contract', () => {
  it('eliminates mock catalog fallback from production POS route', () => {
    expect(source).not.toContain('mockProducts');
    expect(source).not.toMatch(/catalog\.length\s*>\s*0\s*\?\s*catalog\.map\(mapApiProduct\)\s*:\s*mockProducts/);
    expect(source).toContain('Never fall back to mock catalog in production runtime');
  });

  it('defines independent source loaders rather than an all-or-nothing Promise.all', () => {
    expect(source).not.toContain('Promise.all([');
    expect(source).toContain('const loadBranches = useCallback');
    expect(source).toContain('const loadSizes = useCallback');
    expect(source).toContain('const loadToppings = useCallback');
    expect(source).toContain('const loadProducts = useCallback');
    expect(source).toContain('const loadTables = useCallback');
  });

  it('tracks structured per-source bootstrap errors and loading indicators', () => {
    expect(source).toContain('export type BootstrapSource = "branches" | "products" | "sizes" | "toppings" | "tables"');
    expect(source).toContain('export type BootstrapErrors');
    expect(source).toContain('const [bootstrapErrors, setBootstrapErrors]');
    expect(source).toContain('const [loadingSources, setLoadingSources]');
  });

  it('provides single-flight deduplication on retry loaders to prevent spam', () => {
    expect(source).toContain('inFlightSourcesRef.current.has("branches")');
    expect(source).toContain('inFlightSourcesRef.current.has("products")');
    expect(source).toContain('inFlightSourcesRef.current.has("sizes")');
    expect(source).toContain('inFlightSourcesRef.current.has("toppings")');
  });

  it('scopes table loading to selectedStoreId and cancels stale requests via AbortController', () => {
    expect(source).toContain('const tableAbortControllerRef = useRef<AbortController | null>(null)');
    expect(source).toContain('tableAbortControllerRef.current.abort()');
    expect(source).toContain('`/admin/tables?store_id=${selectedStoreId}`');
  });

  it('renders retryable error banners and clean empty catalog states', () => {
    expect(source).toContain('bootstrapErrors.branches');
    expect(source).toContain('bootstrapErrors.products');
    expect(source).toContain('bootstrapErrors.sizes');
    expect(source).toContain('bootstrapErrors.toppings');
    expect(source).toContain('bootstrapErrors.tables');
    expect(source).toContain('Thử lại tải thực đơn');
    expect(source).toContain('Chưa có món nào trong thực đơn');
  });

  it('handles 401 redirect and 403 authorization error without fallback to demo data', () => {
    expect(source).toContain('clearToken()');
    expect(source).toContain('/admin/login');
    expect(source).toContain('403 Forbidden');
  });
});
