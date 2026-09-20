import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { DeliveryAddressSelector } from '../DeliveryAddressSelector';

describe('DeliveryAddressSelector Component Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders 3-tier administrative selectors and street address input', () => {
    const html = renderToString(
      <DeliveryAddressSelector
        value=""
        onChange={() => {}}
      />,
    );

    // Labels
    expect(html).toContain('Địa chỉ giao hàng');
    expect(html).toContain('Tỉnh / Thành phố');
    expect(html).toContain('Quận / Huyện');
    expect(html).toContain('Phường / Xã / Thị trấn');
    expect(html).toContain('Số nhà, tên đường, khu phố / tòa nhà');

    // Placeholders
    expect(html).toContain('Chọn Tỉnh/Thành...');
    expect(html).toContain('Chọn Tỉnh/Thành trước');
    expect(html).toContain('VD: 123 Lê Lợi, Căn hộ A12-04 Tòa nhà Landmark...');
  });
});
