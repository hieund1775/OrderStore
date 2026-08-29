import { CatalogV2Error } from '../repositories/postgres/catalog-v2.js';

export function validateCapabilityInput(input) {
  if (!input || typeof input !== 'object') {
    throw new CatalogV2Error('Dữ liệu thiết lập capability không hợp lệ', 400);
  }

  const { lane_code, is_enabled } = input;
  if (!lane_code || typeof lane_code !== 'string') {
    throw new CatalogV2Error('lane_code là bắt buộc', 400);
  }

  const normalizedLane = lane_code.trim().toLowerCase();
  if (!['kitchen', 'packing'].includes(normalizedLane)) {
    throw new CatalogV2Error(`Luồng xử lý "${normalizedLane}" không được hỗ trợ`, 400);
  }

  if (typeof is_enabled !== 'boolean') {
    throw new CatalogV2Error('is_enabled phải là boolean (true/false)', 400);
  }

  return {
    lane_code: normalizedLane,
    is_enabled,
  };
}
