export function toStoreDto(store) {
  if (!store) return null;
  let parsedAmenities = [];
  if (store.amenities) {
    if (Array.isArray(store.amenities)) {
      parsedAmenities = store.amenities;
    } else {
      try {
        parsedAmenities = JSON.parse(store.amenities);
      } catch {
        parsedAmenities = [String(store.amenities)];
      }
    }
  }

  return {
    id: Number(store.id),
    name: store.name,
    city: store.city,
    district: store.district,
    address: store.address,
    lat: store.lat == null ? null : Number(store.lat),
    lng: store.lng == null ? null : Number(store.lng),
    hours: store.hours || '07:00 - 22:30',
    phone: store.phone,
    amenities: parsedAmenities,
    is_active: store.is_active !== false,
    total_orders: store.total_orders == null ? undefined : Number(store.total_orders),
    revenue: store.revenue == null ? undefined : Number(store.revenue),
    created_at: store.created_at,
    updated_at: store.updated_at,
  };
}

export function toTableDto(table) {
  if (!table) return null;
  return {
    id: Number(table.id),
    store_id: Number(table.store_id),
    name: table.name,
    is_active: table.is_active !== false,
    created_at: table.created_at,
    updated_at: table.updated_at,
    store_name: table.store_name || undefined,
    store_address: table.store_address || undefined,
  };
}
