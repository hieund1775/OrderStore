import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { DynamicProductConfigurator } from '../DynamicProductConfigurator';

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
});
