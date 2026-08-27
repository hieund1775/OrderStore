import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { CategoryTreeEditor, type CategoryNode } from '../CategoryTreeEditor';
import { ProductTypeEditor, type ProductType } from '../ProductTypeEditor';
import { VariantGenerator } from '../VariantGenerator';

describe('Admin Catalog V2 Component Suite', () => {
  const sampleCategories: CategoryNode[] = [
    {
      id: 1,
      name: 'Nước Uống & Trà',
      slug: 'nuoc-uong-tra',
      parent_id: null,
      depth: 0,
      product_type_id: 1,
      product_type_name: 'Đồ Uống',
      sort_order: 1,
      is_visible: true,
      archived_at: null,
      children_count: 1,
      products_count: 10,
    },
    {
      id: 2,
      name: 'Trà Trái Cây Tươi',
      slug: 'tra-trai-cay-tuoi',
      parent_id: 1,
      depth: 1,
      product_type_id: 1,
      product_type_name: 'Đồ Uống',
      sort_order: 1,
      is_visible: true,
      archived_at: null,
      children_count: 0,
      products_count: 5,
    },
  ];

  const sampleProductTypes: ProductType[] = [
    {
      id: 1,
      code: 'beverage',
      name: 'Nước Uống & Trà',
      description: 'Pha chế theo order',
      default_stock_mode: 'made_to_order',
      default_fulfillment_lane: 'kitchen',
      published_version: 1,
      published_schema_id: 10,
      draft_version: null,
      draft_schema_id: null,
      products_count: 15,
    },
    {
      id: 2,
      code: 'fashion_apparel',
      name: 'Thời Trang & Quần Áo',
      description: 'Kiểm đếm tồn kho SKU',
      default_stock_mode: 'tracked',
      default_fulfillment_lane: 'packing',
      published_version: 1,
      published_schema_id: 11,
      draft_version: null,
      draft_schema_id: null,
      products_count: 20,
    },
  ];

  it('renders CategoryTreeEditor with root and nested categories', () => {
    const html = renderToString(
      <CategoryTreeEditor
        categories={sampleCategories}
        productTypes={sampleProductTypes}
        onRefresh={() => {}}
        isSuperAdmin={true}
      />,
    );

    expect(html).toContain('Nước Uống &amp; Trà');
    expect(html).toContain('Trà Trái Cây Tươi');
    expect(html).toContain('nuoc-uong-tra');
  });

  it('renders ProductTypeEditor and distinguishes between kitchen and packing fulfillment lanes', () => {
    const html = renderToString(
      <ProductTypeEditor
        productTypes={sampleProductTypes}
        selectedTypeId={1}
        onSelectType={() => {}}
        onRefresh={() => {}}
        isSuperAdmin={true}
      />,
    );

    expect(html).toContain('Nước Uống &amp; Trà');
    expect(html).toContain('Thời Trang &amp; Quần Áo');
    expect(html).toContain('Bếp pha chế');
    expect(html).toContain('Soạn đóng gói');
  });

  it('renders VariantGenerator with SKU generator prompt', () => {
    const html = renderToString(
      <VariantGenerator
        productId={100}
        productSlug="ao-thun-nam"
        schemaAttributes={[
          {
            id: 1,
            code: 'size',
            name: 'Kích cỡ',
            role: 'variant',
            values: [{ id: 1, code: 'l', label: 'Size L' }],
          },
        ]}
        existingVariants={[]}
        onSuccess={() => {}}
        isSuperAdmin={true}
      />,
    );

    expect(html).toContain('Bộ Sinh Biến Thể SKU Tự Động');
  });
});
