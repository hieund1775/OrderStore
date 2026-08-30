import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { Catalog3BlockView } from '../Catalog3BlockView';
import type { CategoryNode } from '../CategoryTreeEditor';
import type { ProductV2 } from '../ProductEditor';
import type { SchemaDetails } from '../SchemaAttributeEditor';

describe('Admin Catalog 3-Block View Suite', () => {
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
        values: [
          { id: 1, value_code: 'm', value_label: 'M', price_adjustment: 0, sort_order: 1, is_active: true },
          { id: 2, value_code: 'l', value_label: 'L', price_adjustment: 7000, sort_order: 2, is_active: true },
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
        values: [
          { id: 3, value_code: '100', value_label: '100% đường', price_adjustment: 0, sort_order: 1, is_active: true },
          { id: 4, value_code: '50', value_label: '50% đường', price_adjustment: 0, sort_order: 2, is_active: true },
        ],
      },
    ],
  };

  it('renders all 3 blocks with titles and subcategories of selected root', () => {
    const html = renderToString(
      <Catalog3BlockView
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

    // Block 1 check
    expect(html).toContain('1. Danh Mục Con');
    expect(html).toContain('Trà sữa');
    expect(html).toContain('Nước giải khát đóng chai');

    // Block 2 check
    expect(html).toContain('2. Sản Phẩm:');

    // Block 3 check
    expect(html).toContain('3. Tùy Chọn:');
    expect(html).toContain('Độc lập');
    expect(html).toContain('chỉ áp dụng cho các món trong danh mục này');
  });

  it('displays fulfillment lane indicators (Bếp vs Đóng gói) clearly for categories and products', () => {
    const html = renderToString(
      <Catalog3BlockView
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

    expect(html).toContain('Bếp');
    expect(html).toContain('Đóng gói');
  });
});
