export class CatalogValidationError extends Error {
  constructor(message, code = 'CATALOG_VALIDATION_ERROR', status = 400) {
    super(message);
    this.name = 'CatalogValidationError';
    this.code = code;
    this.status = status;
    this.expose = true;
  }
}

function positiveInteger(value, field, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new CatalogValidationError(`${field} phải là số nguyên dương`, 'CATALOG_INVALID_IDENTIFIER');
    return null;
  }
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw new CatalogValidationError(`${field} phải là số nguyên dương`, 'CATALOG_INVALID_IDENTIFIER');
  }
  return numericValue;
}

function boundedText(value, field, maxLength = 500, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new CatalogValidationError(`${field} không được để trống`, 'CATALOG_REQUIRED_FIELD');
    return null;
  }
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maxLength) {
    throw new CatalogValidationError(`${field} không hợp lệ hoặc vượt quá ${maxLength} ký tự`, 'CATALOG_INVALID_TEXT');
  }
  return value.trim();
}

export function validateCategoryId(value) {
  return positiveInteger(value, 'ID danh mục');
}

export function validateProductId(value) {
  return positiveInteger(value, 'ID sản phẩm');
}

export function validateOptionId(value) {
  return positiveInteger(value, 'ID tùy chọn');
}

export function validateCategoryInput(body = {}, { isUpdate = false } = {}) {
  if (typeof body !== 'object' || body === null) {
    throw new CatalogValidationError('Dữ liệu danh mục không hợp lệ');
  }
  const { name, slug, sort_order, is_visible } = body;
  if (!isUpdate || name !== undefined) boundedText(name, 'Tên danh mục', 100, { required: !isUpdate });
  if (!isUpdate || slug !== undefined) boundedText(slug, 'Slug danh mục', 100, { required: !isUpdate });

  return {
    name: name ? name.trim() : undefined,
    slug: slug ? slug.trim() : undefined,
    sort_order: sort_order !== undefined ? Number(sort_order) || 0 : undefined,
    is_visible: is_visible !== undefined ? Boolean(is_visible) : undefined,
  };
}

export function validateProductInput(body = {}, { isUpdate = false } = {}) {
  if (typeof body !== 'object' || body === null) {
    throw new CatalogValidationError('Dữ liệu sản phẩm không hợp lệ');
  }
  const { category_id, name, slug, price, base_tea, description, image_url, calories, fruit_group, tags } = body;

  if (!isUpdate || category_id !== undefined) positiveInteger(category_id, 'category_id', { required: !isUpdate });
  if (!isUpdate || name !== undefined) boundedText(name, 'Tên sản phẩm', 150, { required: !isUpdate });
  if (!isUpdate || slug !== undefined) boundedText(slug, 'Slug sản phẩm', 150, { required: !isUpdate });

  if (!isUpdate || price !== undefined) {
    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      throw new CatalogValidationError('Giá sản phẩm không hợp lệ', 'CATALOG_INVALID_PRICE');
    }
  }

  return {
    category_id: category_id !== undefined ? Number(category_id) : undefined,
    name: name ? name.trim() : undefined,
    slug: slug ? slug.trim() : undefined,
    price: price !== undefined ? Number(price) : undefined,
    base_tea: base_tea ? base_tea.trim() : undefined,
    description: description ? description.trim() : undefined,
    image_url: image_url || undefined,
    calories: calories !== undefined ? Number(calories) || null : undefined,
    fruit_group: fruit_group ? fruit_group.trim() : undefined,
    tags: tags ? (Array.isArray(tags) ? JSON.stringify(tags) : String(tags).trim()) : undefined,
  };
}

export function validateToppingInput(body = {}, { isUpdate = false } = {}) {
  if (typeof body !== 'object' || body === null) {
    throw new CatalogValidationError('Dữ liệu topping không hợp lệ');
  }
  const { name, price, is_available, sort_order } = body;
  if (!isUpdate || name !== undefined) boundedText(name, 'Tên topping', 100, { required: !isUpdate });
  if (!isUpdate || price !== undefined) {
    const numPrice = Number(price);
    if (Number.isNaN(numPrice) || numPrice < 0) {
      throw new CatalogValidationError('Giá topping không hợp lệ');
    }
  }
  return {
    name: name ? name.trim() : undefined,
    price: price !== undefined ? Number(price) : undefined,
    is_available: is_available !== undefined ? Boolean(is_available) : undefined,
    sort_order: sort_order !== undefined ? Number(sort_order) || 0 : undefined,
  };
}

export function validateBaseOptionInput(body = {}, { isUpdate = false } = {}) {
  if (typeof body !== 'object' || body === null) {
    throw new CatalogValidationError('Dữ liệu cốt trà không hợp lệ');
  }
  const { name, description, is_active, sort_order } = body;
  if (!isUpdate || name !== undefined) boundedText(name, 'Tên cốt trà', 100, { required: !isUpdate });
  return {
    name: name ? name.trim() : undefined,
    description: description ? description.trim() : undefined,
    is_active: is_active !== undefined ? Boolean(is_active) : undefined,
    sort_order: sort_order !== undefined ? Number(sort_order) || 0 : undefined,
  };
}

export function validateCatalogFilters({ category, search, tag, category_id } = {}) {
  if (search !== undefined && (typeof search !== 'string' || search.length > 200)) {
    throw new CatalogValidationError('Từ khóa tìm kiếm không hợp lệ');
  }
  return {
    category: category ? String(category).trim() : undefined,
    search: search ? String(search).trim() : undefined,
    tag: tag ? String(tag).trim() : undefined,
    category_id: category_id ? positiveInteger(category_id, 'category_id', { required: false }) : undefined,
  };
}
