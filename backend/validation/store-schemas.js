export class StoreValidationError extends Error {
  constructor(message, code = 'STORE_VALIDATION_ERROR', status = 400) {
    super(message);
    this.name = 'StoreValidationError';
    this.code = code;
    this.status = status;
    this.expose = true;
  }
}

function positiveInteger(value, field, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new StoreValidationError(`${field} phải là số nguyên dương`, 'STORE_INVALID_IDENTIFIER');
    return null;
  }
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw new StoreValidationError(`${field} phải là số nguyên dương`, 'STORE_INVALID_IDENTIFIER');
  }
  return numericValue;
}

function boundedText(value, field, maxLength = 255, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new StoreValidationError(`${field} không được để trống`, 'STORE_REQUIRED_FIELD');
    return null;
  }
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maxLength) {
    throw new StoreValidationError(`${field} không hợp lệ hoặc vượt quá ${maxLength} ký tự`, 'STORE_INVALID_TEXT');
  }
  return value.trim();
}

export function validateStoreId(value) {
  return positiveInteger(value, 'ID chi nhánh');
}

export function validateTableId(value) {
  return positiveInteger(value, 'ID bàn');
}

export function validateBranchInput(body = {}, { isUpdate = false } = {}) {
  if (typeof body !== 'object' || body === null) {
    throw new StoreValidationError('Dữ liệu chi nhánh không hợp lệ');
  }
  const { name, city, district, address, lat, lng, hours, phone, amenities, is_active } = body;
  if (!isUpdate || name !== undefined) boundedText(name, 'Tên chi nhánh', 100, { required: !isUpdate });
  if (!isUpdate || city !== undefined) boundedText(city, 'Thành phố', 100, { required: !isUpdate });
  if (!isUpdate || district !== undefined) boundedText(district, 'Quận/Huyện', 100, { required: !isUpdate });
  if (!isUpdate || address !== undefined) boundedText(address, 'Địa chỉ', 255, { required: !isUpdate });
  if (!isUpdate || phone !== undefined) boundedText(phone, 'Số điện thoại', 20, { required: !isUpdate });

  return {
    name: name ? name.trim() : undefined,
    city: city ? city.trim() : undefined,
    district: district ? district.trim() : undefined,
    address: address ? address.trim() : undefined,
    lat: lat != null ? Number(lat) : undefined,
    lng: lng != null ? Number(lng) : undefined,
    hours: hours ? String(hours).trim() : undefined,
    phone: phone ? phone.trim() : undefined,
    amenities: amenities ? (Array.isArray(amenities) ? JSON.stringify(amenities) : String(amenities).trim()) : undefined,
    is_active: is_active !== undefined ? Boolean(is_active) : undefined,
  };
}

export function validateTableInput(body = {}, { isUpdate = false } = {}) {
  if (typeof body !== 'object' || body === null) {
    throw new StoreValidationError('Dữ liệu bàn không hợp lệ');
  }
  const { store_id, name, is_active } = body;
  if (!isUpdate || store_id !== undefined) positiveInteger(store_id, 'store_id', { required: !isUpdate });
  if (!isUpdate || name !== undefined) boundedText(name, 'Tên bàn', 50, { required: !isUpdate });

  return {
    store_id: store_id !== undefined ? Number(store_id) : undefined,
    name: name ? name.trim() : undefined,
    is_active: is_active !== undefined ? Boolean(is_active) : undefined,
  };
}
