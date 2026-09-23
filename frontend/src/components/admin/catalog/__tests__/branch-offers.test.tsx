import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { BranchOfferTable, isBranchOfferPriceValid, type BranchOfferRow } from '../BranchOfferTable';

describe('Branch Offers & Inventory UI Suite', () => {
  const sampleOffers: BranchOfferRow[] = [
    {
      variant_id: 101,
      sku: 'AO-THUN-COTTON-L',
      name_suffix: 'Size L',
      variant_signature: '1:10',
      product_id: 10,
      product_name: 'Áo Thun Cotton',
      product_slug: 'ao-thun-cotton',
      base_price: 150000,
      image_url: '/images/ao-thun.jpg',
      stock_mode: 'tracked',
      fulfillment_lane: 'packing',
      category_id: 2,
      category_name: 'Thời Trang Nam',
      offer_id: 1,
      price: 145000,
      compare_at_price: 160000,
      is_available: true,
      version: 1,
      updated_at: '2026-08-27T10:00:00Z',
      on_hand: 50,
      reserved: 5,
      available_quantity: 45,
    },
    {
      variant_id: 102,
      sku: 'TRA-DAO-DEF',
      name_suffix: 'Tiêu chuẩn',
      variant_signature: 'default',
      product_id: 20,
      product_name: 'Trà Đào Cam Sả',
      product_slug: 'tra-dao-cam-sa',
      base_price: 45000,
      image_url: '/images/tra-dao.jpg',
      stock_mode: 'made_to_order',
      fulfillment_lane: 'kitchen',
      category_id: 1,
      category_name: 'Trà Trái Cây',
      offer_id: 2,
      price: 45000,
      compare_at_price: null,
      is_available: true,
      version: 1,
      updated_at: '2026-08-27T10:00:00Z',
      on_hand: 0,
      reserved: 0,
      available_quantity: 0,
    },
  ];

  it('renders BranchOfferTable with SKU list, product names, and fulfillment lane badges', () => {
    const html = renderToString(
      <BranchOfferTable
        offers={sampleOffers}
        storeId={1}
        onRefresh={() => {}}
      />,
    );

    expect(html).toContain('Áo Thun Cotton');
    expect(html).toContain('AO-THUN-COTTON-L');
    expect(html).toContain('Trà Đào Cam Sả');
    expect(html).toContain('Khu vực thực hiện');
    expect(html).toContain('Bếp pha chế');
    expect(html).toContain('Đóng gói');
  });

  it('verifies visible price edit action and category name', () => {
    const html = renderToString(
      <BranchOfferTable
        offers={sampleOffers}
        storeId={1}
        onRefresh={() => {}}
      />,
    );

    expect(html).toContain((145000).toLocaleString('vi-VN'));
    expect(html).toContain('Sửa giá bán chi nhánh');
    expect(html).toContain('Thời Trang Nam');
  });

  it('validates branch offer price input (rejects empty, zero, sub-1000 and accepts >= 1000)', () => {
    expect(isBranchOfferPriceValid('')).toBe(false);
    expect(isBranchOfferPriceValid('   ')).toBe(false);
    expect(isBranchOfferPriceValid('0')).toBe(false);
    expect(isBranchOfferPriceValid('-1000')).toBe(false);
    expect(isBranchOfferPriceValid('500')).toBe(false);
    expect(isBranchOfferPriceValid('999')).toBe(false);
    expect(isBranchOfferPriceValid('abc')).toBe(false);
    expect(isBranchOfferPriceValid('1000.5')).toBe(false);

    expect(isBranchOfferPriceValid('1000')).toBe(true);
    expect(isBranchOfferPriceValid('35000')).toBe(true);
  });
});
