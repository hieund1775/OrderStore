import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { CatalogOption3BlocksEditor } from '../CatalogOption3BlocksEditor';
import type { SchemaDetails } from '../SchemaAttributeEditor';

describe('CatalogOption3BlocksEditor Component Suite', () => {
  const sampleSchema: SchemaDetails = {
    id: 1,
    product_type_id: 1,
    product_type_code: 'beverage',
    product_type_name: 'Nước uống',
    version: 1,
    status: 'published',
    attributes: [
      {
        id: 11,
        name: 'Mức Đá',
        code: 'ice_level',
        role: 'modifier',
        input_type: 'single_select',
        is_required: false,
        sort_order: 1,
        min_selections: 0,
        max_selections: 1,
        values: [
          { id: 1, code: '100_ice', label: '100% Đá', price_adjustment: 0, sort_order: 1, is_active: true },
          { id: 2, code: '50_ice', label: '50% Đá', price_adjustment: 0, sort_order: 2, is_active: true },
        ],
      },
      {
        id: 12,
        name: 'Topping Thêm',
        code: 'toppings',
        role: 'modifier',
        input_type: 'multi_select',
        is_required: false,
        sort_order: 2,
        min_selections: 0,
        max_selections: 5,
        values: [
          { id: 3, code: 'tran_chau', label: 'Trân châu đen', price_adjustment: 5000, sort_order: 1, is_active: true },
          { id: 4, code: 'thach_dua', label: 'Thạch dừa', price_adjustment: 7000, sort_order: 2, is_active: true },
        ],
      },
    ],
  };

  it('renders Block 1 (Nhóm chọn một) and Block 2 (Nhóm chọn nhiều) with Edit and Delete action buttons', () => {
    const html = renderToString(
      <CatalogOption3BlocksEditor
        categoryId={2}
        categoryName="Trà sữa"
        schema={sampleSchema}
        categoryProducts={[]}
        onRefresh={async () => {}}
      />,
    );

    // Block 1
    expect(html).toContain('Block 1: Nhóm chọn một');
    expect(html).toContain('Khách chỉ chọn 1 lựa chọn trong nhóm.');
    expect(html).toContain('Ví dụ: Kích cỡ, Đường, Đá, Mức ngọt.');
    expect(html).toContain('Mức Đá');
    expect(html).toContain('100% Đá');
    expect(html).toContain('50% Đá');

    // Block 2
    expect(html).toContain('Block 2: Nhóm chọn nhiều');
    expect(html).toContain('Khách có thể chọn nhiều lựa chọn trong nhóm.');
    expect(html).toContain('Ví dụ: Topping, món thêm.');
    expect(html).toContain('Topping Thêm');
    expect(html).toContain('Trân châu đen');
    expect(html).toContain('+5.000đ');
    expect(html).toContain('Thạch dừa');
    expect(html).toContain('+7.000đ');

    // Edit and Delete buttons on cards
    expect(html).toContain('title="Chỉnh sửa nhóm"');
    expect(html).toContain('title="Xóa nhóm"');
    expect(html).toContain('+ Bật áp dụng');
  });

  it('renders button to add option group for both blocks', () => {
    const html = renderToString(
      <CatalogOption3BlocksEditor
        categoryId={2}
        categoryName="Trà sữa"
        schema={sampleSchema}
        categoryProducts={[]}
        onRefresh={async () => {}}
      />,
    );

    expect(html).toContain('Thêm nhóm chọn một');
    expect(html).toContain('Thêm nhóm chọn nhiều');
  });

  it('renders Block 1 with price adjustment badges if a single_select group has prices (e.g. Size)', () => {
    const sizeSchema: SchemaDetails = {
      ...sampleSchema,
      attributes: [
        {
          id: 10,
          name: 'Kích cỡ (Size)',
          code: 'size',
          role: 'modifier',
          input_type: 'single_select',
          is_required: true,
          sort_order: 1,
          min_selections: 1,
          max_selections: 1,
          values: [
            { id: 101, code: 'size_m', label: 'Size M', price_adjustment: 0, sort_order: 1, is_active: true },
            { id: 102, code: 'size_l', label: 'Size L', price_adjustment: 3000, sort_order: 2, is_active: true },
            { id: 103, code: 'size_xl', label: 'Size XL', price_adjustment: 5000, sort_order: 3, is_active: true },
          ],
        },
      ],
    };

    const html = renderToString(
      <CatalogOption3BlocksEditor
        categoryId={2}
        categoryName="Trà sữa"
        schema={sizeSchema}
        categoryProducts={[]}
        onRefresh={async () => {}}
      />,
    );

    expect(html).toContain('Kích cỡ (Size)');
    expect(html).toContain('Size M');
    expect(html).toContain('Size L');
    expect(html).toContain('+3.000đ');
    expect(html).toContain('Size XL');
    expect(html).toContain('+5.000đ');
  });
});

