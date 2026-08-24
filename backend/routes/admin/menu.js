import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { logAudit } from '../../services/audit.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import {
  validateCategoryId,
  validateProductId,
  validateOptionId,
  validateCategoryInput,
  validateProductInput,
  validateToppingInput,
  validateBaseOptionInput,
  validateCatalogFilters,
  validateProductAvailabilityInput,
} from '../../validation/catalog-schemas.js';
import { toCategoryDto, toProductDto } from '../../dto/catalog-dto.js';
import adminMenuService from '../../services/catalog/admin-menu-service.js';

const router = Router();

// ═══════════ CATEGORIES ═══════════

router.get('/categories', requireRole('super', 'manager', 'cashier', 'kitchen'), asyncHandler(async (req, res) => {
  try {
    const rows = await adminMenuService.listCategories();
    res.json(rows.map(toCategoryDto));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.post('/categories', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const validated = validateCategoryInput(req.body, { isUpdate: false });
    const created = await adminMenuService.createCategory(validated);
    await logAudit(req.user.sub, 'Tạo danh mục', validated.name, req);
    res.status(201).json(toCategoryDto(created));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.put('/categories/:id', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const id = validateCategoryId(req.params.id);
    const validated = validateCategoryInput(req.body, { isUpdate: true });
    const updated = await adminMenuService.updateCategory(id, validated);
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy danh mục' });
    await logAudit(req.user.sub, `Cập nhật danh mục #${id}`, validated.name || '', req);
    res.json({ message: 'Đã cập nhật danh mục' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.delete('/categories/:id', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const id = validateCategoryId(req.params.id);
    await adminMenuService.deleteCategory(id);
    await logAudit(req.user.sub, `Xóa danh mục #${id}`, '', req);
    res.json({ message: 'Đã xóa danh mục' });
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
}));

// ═══════════ PRODUCTS ═══════════

router.get('/products', requireRole('super', 'manager', 'cashier', 'kitchen'), asyncHandler(async (req, res) => {
  try {
    const filters = validateCatalogFilters(req.query);
    const rows = await adminMenuService.listProducts(filters);
    res.json(rows.map(toProductDto));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.post('/products', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const validated = validateProductInput(req.body, { isUpdate: false });
    const created = await adminMenuService.createProduct(validated);
    await logAudit(req.user.sub, 'Thêm sản phẩm', validated.name, req);
    res.status(201).json(toProductDto(created));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.put('/products/:id', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const id = validateProductId(req.params.id);
    const validated = validateProductInput(req.body, { isUpdate: true });
    const updated = await adminMenuService.updateProduct(id, validated);
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy món' });
    await logAudit(req.user.sub, `Cập nhật sản phẩm #${id}`, validated.name || '', req);
    res.json({ message: 'Đã cập nhật sản phẩm' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.put('/products/:id/availability', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const id = validateProductId(req.params.id);
    const is_available = validateProductAvailabilityInput(req.body);
    const result = await adminMenuService.setProductAvailability(id, is_available);
    await logAudit(
      req.user.sub,
      `Cập nhật khả dụng món #${id}`,
      `is_available: ${result.is_available}, removed_wishlists: ${result.removed_wishlist_count}, notified: ${result.notification_count}`,
      req,
    );
    res.json({
      id: result.id,
      is_available: result.is_available,
      changed: result.changed,
      removed_wishlist_count: result.removed_wishlist_count,
      notification_count: result.notification_count,
      message: `Món đã ${result.is_available ? 'bật phục vụ' : 'tạm ngưng phục vụ'}`,
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.delete('/products/:id', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const id = validateProductId(req.params.id);
    await adminMenuService.deleteProduct(id);
    await logAudit(req.user.sub, `Xóa món #${id}`, '', req);
    res.json({ message: 'Đã xóa món' });
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
}));

// ═══════════ OPTIONS ═══════════

router.get('/options', requireRole('super', 'manager', 'cashier', 'kitchen'), asyncHandler(async (req, res) => {
  try {
    const options = await adminMenuService.listOptions();
    res.json(options);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.post('/toppings', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const validated = validateToppingInput(req.body, { isUpdate: false });
    const created = await adminMenuService.createTopping(validated);
    await logAudit(req.user.sub, 'Thêm topping', validated.name, req);
    res.status(201).json(created);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.put('/toppings/:id', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const id = validateOptionId(req.params.id);
    const validated = validateToppingInput(req.body, { isUpdate: true });
    const updated = await adminMenuService.updateTopping(id, validated);
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy topping' });
    await logAudit(req.user.sub, `Cập nhật topping #${id}`, validated.name || '', req);
    res.json({ message: 'Đã cập nhật topping' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.delete('/toppings/:id', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const id = validateOptionId(req.params.id);
    await adminMenuService.deleteTopping(id);
    await logAudit(req.user.sub, `Xóa topping #${id}`, '', req);
    res.json({ message: 'Đã xóa topping' });
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
}));

router.post('/bases', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const validated = validateBaseOptionInput(req.body, { isUpdate: false });
    const created = await adminMenuService.createBase(validated);
    await logAudit(req.user.sub, 'Thêm cốt trà', validated.name, req);
    res.status(201).json(created);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.put('/bases/:id', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const id = validateOptionId(req.params.id);
    const validated = validateBaseOptionInput(req.body, { isUpdate: true });
    const updated = await adminMenuService.updateBase(id, validated);
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy cốt trà' });
    await logAudit(req.user.sub, `Cập nhật cốt trà #${id}`, validated.name || '', req);
    res.json({ message: 'Đã cập nhật cốt trà' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.delete('/bases/:id', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const id = validateOptionId(req.params.id);
    await adminMenuService.deleteBase(id);
    await logAudit(req.user.sub, `Xóa cốt trà #${id}`, '', req);
    res.json({ message: 'Đã xóa cốt trà' });
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
}));

export default router;
