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

  it('renders CatalogTabBlocksView with strictly isolated packing lane and "Đóng gói / Shipper" badge', async () => {
    const { CatalogTabBlocksView } = await import('../CatalogTabBlocksView');
    const packingRoot: CategoryNode = {
      id: 10,
      name: 'Hàng Đóng Gói',
      slug: 'hang-dong-goi',
      parent_id: null,
      depth: 0,
      default_fulfillment_lane: 'packing',
      sort_order: 1,
      is_visible: true,
      archived_at: null,
      children_count: 1,
      products_count: 0,
    };
    const packingSub: CategoryNode = {
      id: 11,
      name: 'Áo QA',
      slug: 'ao-qa',
      parent_id: 10,
      depth: 1,
      default_fulfillment_lane: 'packing',
      sort_order: 1,
      is_visible: true,
      archived_at: null,
      children_count: 0,
      products_count: 0,
    };
    const kitchenSub: CategoryNode = {
      id: 12,
      name: 'Trà Lài',
      slug: 'tra-lai',
      parent_id: 1,
      depth: 1,
      default_fulfillment_lane: 'kitchen',
      sort_order: 2,
      is_visible: true,
      archived_at: null,
      children_count: 0,
      products_count: 0,
    };

    const html = renderToString(
      <CatalogTabBlocksView
        rootCategories={[packingRoot]}
        selectedRootId="all"
        onSelectRootId={() => {}}
        categories={[packingRoot, packingSub, kitchenSub]}
        products={[]}
        activeSchema={null}
        activeLane="packing"
        isSuperAdmin={true}
        onRefresh={async () => {}}
        onOpenCreateProduct={() => {}}
        onOpenEditProduct={() => {}}
      />,
    );

    expect(html).toContain('Áo QA');
    expect(html).toContain('Đóng gói / Shipper');
    expect(html).not.toContain('Trà Lài');
    expect(html).not.toContain('Quầy Bếp / Pha chế');
  });

  it('renders CatalogTabBlocksView with kitchen lane and "Quầy Bếp / Pha chế" badge', async () => {
    const { CatalogTabBlocksView } = await import('../CatalogTabBlocksView');
    const kitchenRoot: CategoryNode = {
      id: 1,
      name: 'Đồ Uống Bếp',
      slug: 'do-uong-bep',
      parent_id: null,
      depth: 0,
      default_fulfillment_lane: 'kitchen',
      sort_order: 1,
      is_visible: true,
      archived_at: null,
      children_count: 1,
      products_count: 0,
    };
    const kitchenSub: CategoryNode = {
      id: 2,
      name: 'Trà Bếp QA',
      slug: 'tra-bep-qa',
      parent_id: 1,
      depth: 1,
      default_fulfillment_lane: 'kitchen',
      sort_order: 1,
      is_visible: true,
      archived_at: null,
      children_count: 0,
      products_count: 0,
    };

    const html = renderToString(
      <CatalogTabBlocksView
        rootCategories={[kitchenRoot]}
        selectedRootId="all"
        onSelectRootId={() => {}}
        categories={[kitchenRoot, kitchenSub]}
        products={[]}
        activeSchema={null}
        activeLane="kitchen"
        isSuperAdmin={true}
        onRefresh={async () => {}}
        onOpenCreateProduct={() => {}}
        onOpenEditProduct={() => {}}
      />,
    );

    expect(html).toContain('Trà Bếp QA');
    expect(html).toContain('Quầy Bếp / Pha chế');
    expect(html).not.toContain('Đóng gói / Shipper');
  });
});
