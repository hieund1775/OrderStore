export class InventoryValidationError extends Error {
  constructor(message, code = 'INVENTORY_VALIDATION_ERROR', status = 400) {
    super(message);
    this.name = 'InventoryValidationError';
    this.code = code;
    this.status = status;
    this.expose = true;
  }
}

function positiveInteger(value, field, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new InventoryValidationError(`${field} phải là số nguyên dương`, 'INVENTORY_INVALID_IDENTIFIER');
    return null;
  }
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw new InventoryValidationError(`${field} phải là số nguyên dương`, 'INVENTORY_INVALID_IDENTIFIER');
  }
  return numericValue;
}

function boundedText(value, field, maxLength = 255, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new InventoryValidationError(`${field} không được để trống`, 'INVENTORY_REQUIRED_FIELD');
    return null;
  }
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maxLength) {
    throw new InventoryValidationError(`${field} không hợp lệ hoặc vượt quá ${maxLength} ký tự`, 'INVENTORY_INVALID_TEXT');
  }
  return value.trim();
}

export function validateIngredientId(value) {
  return positiveInteger(value, 'ID nguyên liệu');
}

export function validateProductId(value) {
  return positiveInteger(value, 'ID sản phẩm');
}

export function validateIngredientInput(body = {}, { isUpdate = false } = {}) {
  if (typeof body !== 'object' || body === null) {
    throw new InventoryValidationError('Dữ liệu nguyên liệu không hợp lệ');
  }
  const { name, unit, stock_quantity, min_threshold, cost_per_unit } = body;
  if (!isUpdate || name !== undefined) boundedText(name, 'Tên nguyên liệu', 100, { required: !isUpdate });
  if (!isUpdate || unit !== undefined) boundedText(unit, 'Đơn vị tính', 20, { required: !isUpdate });

  return {
    name: name ? name.trim() : undefined,
    unit: unit ? unit.trim() : undefined,
    stock_quantity: stock_quantity !== undefined ? Number(stock_quantity) || 0 : undefined,
    min_threshold: min_threshold !== undefined ? Number(min_threshold) || 0 : undefined,
    cost_per_unit: cost_per_unit !== undefined ? Number(cost_per_unit) || 0 : undefined,
  };
}

export function validateStockAdjustmentInput(body = {}) {
  if (typeof body !== 'object' || body === null) {
    throw new InventoryValidationError('Dữ liệu điều chỉnh kho không hợp lệ');
  }
  const { change_amount, reason } = body;
  const numChange = Number(change_amount);
  if (Number.isNaN(numChange) || numChange === 0) {
    throw new InventoryValidationError('Số lượng thay đổi kho phải khác 0');
  }
  return {
    change_amount: numChange,
    reason: reason ? String(reason).trim() : 'Điều chỉnh thủ công',
  };
}

export function validateRecipeInput(body = {}) {
  if (typeof body !== 'object' || body === null) {
    throw new InventoryValidationError('Dữ liệu công thức không hợp lệ');
  }
  const { ingredients } = body;
  if (!Array.isArray(ingredients)) {
    throw new InventoryValidationError('Danh sách nguyên liệu phải là mảng');
  }
  return {
    ingredients: ingredients.map((item) => ({
      ingredient_id: positiveInteger(item.ingredient_id, 'ingredient_id'),
      amount: Number(item.amount) || 0,
      unit: item.unit ? String(item.unit).trim() : undefined,
    })),
  };
}
