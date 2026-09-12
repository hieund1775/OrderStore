import { apiGet } from './api';

export type PreorderStoreAvailability = {
  store_id: number;
  is_available: boolean;
};

export function hasAvailablePreorderStore(stores: PreorderStoreAvailability[]) {
  return Array.isArray(stores) && stores.some((store) => store.is_available === true);
}

export function isPreorderAvailableForStore(stores: PreorderStoreAvailability[], storeId: number) {
  return stores.some((store) => Number(store.store_id) === Number(storeId) && store.is_available === true);
}

export async function fetchPreorderStoreAvailability() {
  const response = await apiGet<{ stores?: PreorderStoreAvailability[] }>('/api/preorders/stores');
  return Array.isArray(response.stores) ? response.stores : [];
}
