import { apiFetch } from './api';

export interface CartAvailabilityItem {
  product_id: number | string;
  product_name: string;
  is_available: boolean;
}

export interface CartAvailabilityResult {
  items: CartAvailabilityItem[];
  hasUnavailable: boolean;
  unavailableItems: CartAvailabilityItem[];
}

export async function checkCartAvailability(
  storeId: number | string,
  productIds: (number | string)[],
): Promise<CartAvailabilityResult> {
  if (!storeId || !productIds.length) {
    return {
      items: [],
      hasUnavailable: false,
      unavailableItems: [],
    };
  }

  const uniqueProductIds = Array.from(
    new Set(
      productIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );

  if (uniqueProductIds.length === 0) {
    return {
      items: [],
      hasUnavailable: false,
      unavailableItems: [],
    };
  }

  try {
    const res = await apiFetch<{ items: CartAvailabilityItem[] }>('/api/catalog/check-availability', {
      method: 'POST',
      body: JSON.stringify({
        store_id: Number(storeId) || storeId,
        product_ids: uniqueProductIds,
      }),
    });

    const items = Array.isArray(res?.items) ? res.items : [];
    const unavailableItems = items.filter((item) => !item.is_available);

    return {
      items,
      hasUnavailable: unavailableItems.length > 0,
      unavailableItems,
    };
  } catch (err) {
    console.warn('Failed to check cart availability:', err);
    return {
      items: [],
      hasUnavailable: false,
      unavailableItems: [],
    };
  }
}
