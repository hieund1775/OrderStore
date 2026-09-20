import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { StreetAutocompleteInput } from '../StreetAutocompleteInput';

describe('StreetAutocompleteInput Component', () => {
  it('renders input with placeholder and value', () => {
    const html = renderToString(
      <StreetAutocompleteInput
        value="123 Lê Lợi"
        onChange={() => {}}
        placeholder="Nhập tên đường..."
      />,
    );

    expect(html).toContain('value="123 Lê Lợi"');
    expect(html).toContain('placeholder="Nhập tên đường..."');
  });

  it('renders disabled state correctly', () => {
    const html = renderToString(
      <StreetAutocompleteInput
        value=""
        onChange={() => {}}
        disabled={true}
      />,
    );

    expect(html).toContain('disabled');
  });
});
