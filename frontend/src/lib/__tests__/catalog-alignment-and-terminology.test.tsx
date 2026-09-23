import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Catalog Filter Alignment & Terminology Standardization', () => {
  const root = path.resolve(__dirname, '../../../');

  it('verifies admin.hang-dang-ban.tsx filter layout alignment and removal of Ngành hàng gốc', () => {
    const filePath = path.join(root, 'src/routes/admin.hang-dang-ban.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Filter container must use items-center for uniform vertical alignment
    expect(content).toContain('flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3');

    // Must NOT contain the displaced label 'Ngành hàng gốc'
    expect(content).not.toContain('Ngành hàng gốc');

    // Must render standardized options for root and child dropdowns
    expect(content).toContain('<option value="all">Tất cả danh mục</option>');
    expect(content).toContain('<option value="all">Tất cả danh mục con</option>');

    // Must render catalog filter title aligned
    expect(content).toContain('Lọc theo catalog:');
  });

  it('verifies CatalogRootSelector.tsx terminology updates to Danh mục', () => {
    const filePath = path.join(root, 'src/components/admin/catalog/CatalogRootSelector.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Must NOT contain old terms
    expect(content).not.toContain('Ngành hàng gốc');
    expect(content).not.toContain('Sửa tên ngành');
    expect(content).not.toContain('Xóa ngành');
    expect(content).not.toContain('Tạo ngành hàng gốc');

    // Must contain new standardized terms
    expect(content).toContain('Danh mục:');
    expect(content).toContain('placeholder="Chọn danh mục"');
    expect(content).toContain('Sửa danh mục');
    expect(content).toContain('Xóa danh mục');
    expect(content).toContain('Tạo danh mục');
  });

  it('verifies admin.catalog.tsx terminology updates to Danh mục', () => {
    const filePath = path.join(root, 'src/routes/admin.catalog.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Must NOT contain old root terms
    expect(content).not.toContain('ngành hàng gốc');
    expect(content).not.toContain('Đổi Tên Ngành Hàng Gốc');
    expect(content).not.toContain('Tạo Ngành Hàng Gốc');

    // Must contain new terms
    expect(content).toContain('Tên danh mục');
    expect(content).toContain('Đổi Tên Danh Mục');
    expect(content).toContain('Tạo danh mục');
    expect(content).toContain('Đã xóa danh mục');
    expect(content).toContain('Đã cập nhật danh mục');
    expect(content).toContain('Đã tạo danh mục');
  });

  it('verifies admin.hang-dang-ban.tsx pagination limit is set to 20 instead of 5', () => {
    const filePath = path.join(root, 'src/routes/admin.hang-dang-ban.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    expect(content).toContain('limit: 20');
    expect(content).not.toContain('limit: 5,');
  });

  it('verifies dropdowns have compact max-height and scrolling to prevent screen takeover', () => {
    const rootSelectorPath = path.join(root, 'src/components/admin/catalog/CatalogRootSelector.tsx');
    const rootSelectorContent = fs.readFileSync(rootSelectorPath, 'utf8');
    expect(rootSelectorContent).toContain('className="max-h-60 overflow-y-auto"');

    const tabBlocksPath = path.join(root, 'src/components/admin/catalog/CatalogTabBlocksView.tsx');
    const tabBlocksContent = fs.readFileSync(tabBlocksPath, 'utf8');
    expect(tabBlocksContent).toContain('className="max-h-60 overflow-y-auto"');

    const selectUiPath = path.join(root, 'src/components/ui/select.tsx');
    const selectUiContent = fs.readFileSync(selectUiPath, 'utf8');
    expect(selectUiContent).toContain('max-h-64 min-w-[8rem] overflow-y-auto');
  });
});
