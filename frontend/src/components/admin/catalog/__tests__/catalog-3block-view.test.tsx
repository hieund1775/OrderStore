import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { CatalogTabBlocksView } from '../CatalogTabBlocksView';
import type { CategoryNode } from '../CategoryTreeEditor';
import type { ProductV2 } from '../ProductEditor';
import type { SchemaDetails } from '../SchemaAttributeEditor';

describe('Admin Catalog Tab Blocks View Suite', () => {
  const rootCategories: CategoryNode[] = [
    {
      id: 1,
      name: 'Nước uống',
      slug: 'nuoc-uong',
      parent_id: null,
      depth: 0,
      product_type_id: 1,
      sort_order: 1,
      is_visible: true,
      archived_at: null,
    },
    {
      id: 10,
      name: 'Quần áo & Merch',
      slug: 'quan-ao',
      parent_id: null,
      depth: 0,
      product_type_id: 2,
      sort_order: 2,
      is_visible: true,
      archived_at: null,
    },
  ];

  const subcategories: CategoryNode[] = [
    {
      id: 2,
      name: 'Trà sữa',
      slug: 'tra-sua',
      parent_id: 1,
      depth: 1,
      product_type_id: 1,
      default_fulfillment_lane: 'kitchen',
      sort_order: 1,
      is_visible: true,
      archived_at: null,
    },
    {
      id: 3,
      name: 'Nước giải khát đóng chai',
      slug: 'nuoc-giai-khat',
      parent_id: 1,
      depth: 1,
      product_type_id: 1,
      default_fulfillment_lane: 'packing',
      sort_order: 2,
      is_visible: true,
      archived_at: null,
    },
  ];

  const allCategories = [...rootCategories, ...subcategories];

  const sampleProducts: ProductV2[] = [
    {
      id: 101,
      category_id: 2,
      category_name: 'Trà sữa',
      product_type_schema_id: 1,
      name: 'Trà sữa Khoai môn',
      slug: 'tra-sua-khoai-mon',
      description: 'Thơm béo khoai môn tươi',
      price: 35000,
      image_url: null,
      status: 'active',
      fulfillment_lane: 'kitchen',
      stock_mode: 'made_to_order',
      variants_count: 0,
      media: [],
    },
    {
      id: 102,
      category_id: 2,
      category_name: 'Trà sữa',
      product_type_schema_id: 1,
      name: 'Trà sữa Lá dứa',
      slug: 'tra-sua-la-dua',
      description: 'Lá dứa thơm thanh',
      price: 38000,
      image_url: null,
      status: 'active',
      fulfillment_lane: 'kitchen',
      stock_mode: 'made_to_order',
      variants_count: 0,
      media: [],
    },
    {
      id: 201,
      category_id: 3,
      category_name: 'Nước giải khát đóng chai',
      product_type_schema_id: 1,
      name: 'Nước suối Aquafina 500ml',
      slug: 'nuoc-suoi-aquafina-500ml',
      description: 'Nước suối tinh khiết',
      price: 15000,
      image_url: null,
      status: 'active',
      fulfillment_lane: 'packing',
      stock_mode: 'tracked',
      variants_count: 0,
      media: [],
    },
  ];

  const sampleSchema: SchemaDetails = {
    id: 1,
    product_type_id: 1,
    product_type_code: 'beverage',
    product_type_name: 'Nước uống',
    version: 1,
    status: 'published',
    attributes: [
      {
        id: 10,
        name: 'Size Ly',
        code: 'size_drink',
        role: 'variant',
        input_type: 'single_select',
        is_required: true,
        sort_order: 1,
        min_selections: 1,
        max_selections: 1,
        values: [
          { id: 1, code: 'm', label: 'M', price_adjustment: 0, sort_order: 1, is_active: true },
          { id: 2, code: 'l', label: 'L', price_adjustment: 7000, sort_order: 2, is_active: true },
        ],
      },
      {
        id: 11,
        name: 'Mức Đường',
        code: 'sugar_level',
        role: 'modifier',
        input_type: 'single_select',
        is_required: false,
        sort_order: 2,
        min_selections: 0,
        max_selections: 1,
        values: [
          { id: 3, code: '100', label: '100% đường', price_adjustment: 0, sort_order: 1, is_active: true },
          { id: 4, code: '50', label: '50% đường', price_adjustment: 0, sort_order: 2, is_active: true },
        ],
      },
    ],
  };

  it('renders tab buttons for 1. Danh Mục Con, 2. Quản Lý Sản Phẩm, 3. Tùy Chọn Danh Mục Con', () => {
    const html = renderToString(
      <CatalogTabBlocksView
        rootCategories={rootCategories}
        selectedRootId="1"
        onSelectRootId={() => {}}
        categories={allCategories}
        products={sampleProducts}
        activeSchema={sampleSchema}
        isSuperAdmin={true}
        onRefresh={async () => {}}
        onOpenProductEditor={() => {}}
      />,
    );

    expect(html).toContain('1. Danh Mục Con');
    expect(html).toContain('2. Quản Lý Sản Phẩm');
    expect(html).toContain('3. Tùy Chọn Danh Mục Con');
    expect(html).toContain('Trà sữa');
    expect(html).toContain('Nước giải khát đóng chai');
  });

  it('hides technical slug-url columns from the user UI', () => {
    const html = renderToString(
      <CatalogTabBlocksView
        rootCategories={rootCategories}
        selectedRootId="1"
        onSelectRootId={() => {}}
        categories={allCategories}
        products={sampleProducts}
        activeSchema={sampleSchema}
        isSuperAdmin={true}
        onRefresh={async () => {}}
        onOpenProductEditor={() => {}}
      />,
    );

    expect(html).not.toContain('Slug (URL)');
    expect(html).not.toContain('Mã Slug');
  });
});
