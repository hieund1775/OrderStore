import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { buildLocalFallbackConfiguration, DynamicProductConfigurator } from '../DynamicProductConfigurator';

describe('Dynamic Product Configurator Suite', () => {
  it('renders correctly without runtime errors', () => {
    const html = renderToString(
      <DynamicProductConfigurator
        open={false}
        onOpenChange={() => {}}
        productSlug="tra-dao-cam-sa"
        onAddToCart={() => {}}
      />,
    );

    expect(html).toBe('');
  });

  it('keeps the canonical configuration shape when the pricing resolver is unavailable', () => {
    const resolved = buildLocalFallbackConfiguration({
      id: 1,
      name: 'Trà thử nghiệm',
      slug: 'tra-thu-nghiem',
      description: null,
      price: 30000,
      image_url: null,
      category_id: 1,
      fulfillment_lane: 'kitchen',
      stock_mode: 'made_to_order',
      variants: [{
        id: 31,
        sku: 'SKU-TEST',
        variant_signature: 'default',
        name_suffix: 'Tiêu chuẩn',
        price: 30000,
        compare_at_price: null,
        is_available: true,
        available_stock: null,
      }],
      attributes: [{
        id: 7,
        code: 'size',
        name: 'Kích cỡ',
        role: 'modifier',
        input_type: 'single_select',
        is_required: true,
        min_selections: 1,
        max_selections: 1,
        sort_order: 1,
        is_locked: false,
        values: [{
          id: 71,
          code: 'm',
          label: 'Size M',
          price_adjustment: 0,
          sort_order: 1,
          is_active: true,
        }],
      }],
    }, [], [71]);

    expect(resolved.product.slug).toBe('tra-thu-nghiem');
    expect(resolved.variant.sku).toBe('SKU-TEST');
    expect(resolved.unit_price).toBe(30000);
    expect(resolved.applied_modifiers[0]).toMatchObject({
      attribute_code: 'size',
      value_code: 'm',
      value_label: 'Size M',
    });
  });
});
