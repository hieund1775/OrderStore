import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { logAudit } from '../../services/audit.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { createAdminCatalogV2Service } from '../../services/catalog/admin-catalog-v2-service.js';
import { CatalogV2Error } from '../../repositories/postgres/catalog-v2.js';

const router = Router();
const service = createAdminCatalogV2Service();

// =============================================================
// CATEGORIES TREE
// =============================================================
router.get('/categories', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  const categories = await service.listCategories({ includeArchived: req.query.include_archived === 'true' });
  res.json(categories);
}));

router.post('/categories', requireRole('super'), asyncHandler(async (req, res) => {
  const category = await service.createCategory(req.body);
  await logAudit(req.user.sub, 'Tạo danh mục', category.name, req);
  res.status(201).json(category);
}));

router.put('/categories/:id', requireRole('super'), asyncHandler(async (req, res) => {
  const category = await service.updateCategory(req.params.id, req.body);
  await logAudit(req.user.sub, 'Cập nhật danh mục', category.name, req);
  res.json(category);
}));

router.delete('/categories/:id', requireRole('super'), asyncHandler(async (req, res) => {
  const category = await service.archiveCategory(req.params.id);
  await logAudit(req.user.sub, 'Lưu trữ danh mục', category.name, req);
  res.json(category);
}));

// =============================================================
// PRODUCT TYPES & SCHEMAS
// =============================================================
router.get('/product-types', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  const types = await service.listProductTypes();
  res.json(types);
}));

router.post('/product-types', requireRole('super'), asyncHandler(async (req, res) => {
  const result = await service.createProductType(req.body, { createdBy: req.user.sub });
  await logAudit(req.user.sub, 'Tạo loại sản phẩm', result.productType.name, req);
  res.status(201).json(result);
}));

router.get('/product-type-schemas/:id', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  const schema = await service.getSchemaDetails(req.params.id);
  if (!schema) return res.status(404).json({ error: 'Không tìm thấy cấu hình schema' });
  res.json(schema);
}));

router.post('/product-type-schemas/:id/publish', requireRole('super'), asyncHandler(async (req, res) => {
  const published = await service.publishSchema(req.params.id);
  await logAudit(req.user.sub, 'Xuất bản schema thuộc tính', `Schema ID: ${req.params.id}`, req);
  res.json(published);
}));

router.post('/product-type-schemas/:id/attributes', requireRole('super'), asyncHandler(async (req, res) => {
  const attribute = await service.addAttributeToSchema(req.params.id, req.body);
  await logAudit(req.user.sub, 'Thêm thuộc tính vào schema', attribute.name, req);
  res.status(201).json(attribute);
}));

router.post('/attributes/:id/values', requireRole('super'), asyncHandler(async (req, res) => {
  const value = await service.addAttributeValue(req.params.id, req.body);
  await logAudit(req.user.sub, 'Thêm giá trị thuộc tính', value.label, req);
  res.status(201).json(value);
}));

// =============================================================
// PRODUCTS & VARIANTS
// =============================================================
router.get('/products', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  const products = await service.listProducts({
    categoryId: req.query.category_id,
    status: req.query.status,
    search: req.query.search,
    limit: req.query.limit ? Number(req.query.limit) : 50,
    offset: req.query.offset ? Number(req.query.offset) : 0,
  });
  res.json(products);
}));

router.get('/products/:id', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  const product = await service.getProductDetails(req.params.id);
  if (!product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  res.json(product);
}));

router.post('/products', requireRole('super'), asyncHandler(async (req, res) => {
  const product = await service.createProduct(req.body, { createdBy: req.user.sub });
  await logAudit(req.user.sub, 'Tạo sản phẩm mới', product.name, req);
  res.status(201).json(product);
}));

router.put('/products/:id', requireRole('super'), asyncHandler(async (req, res) => {
  const product = await service.updateProduct(req.params.id, req.body);
  await logAudit(req.user.sub, 'Cập nhật sản phẩm', product.name, req);
  res.json(product);
}));

router.delete('/products/:id', requireRole('super'), asyncHandler(async (req, res) => {
  const product = await service.archiveProduct(req.params.id);
  await logAudit(req.user.sub, 'Lưu trữ sản phẩm', product.name, req);
  res.json(product);
}));

router.post('/products/preview-variants', requireRole('super'), asyncHandler(async (req, res) => {
  const { attributes, product_slug } = req.body;
  const preview = service.previewVariantCombinations(attributes, product_slug);
  res.json(preview);
}));

router.post('/products/:id/variants', requireRole('super'), asyncHandler(async (req, res) => {
  const variant = await service.createVariant(req.params.id, req.body);
  await logAudit(req.user.sub, 'Tạo biến thể SKU', variant.sku, req);
  res.status(201).json(variant);
}));

router.post('/product-types/:id/schemas', requireRole('super'), asyncHandler(async (req, res) => {
  const schema = await service.createNextSchemaVersion(req.params.id, { createdBy: req.user.sub });
  await logAudit(req.user.sub, 'Tạo phiên bản schema mới', `Product Type: ${req.params.id}, v${schema.version}`, req);
  res.status(201).json(schema);
}));

function positiveId(value, field) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new CatalogV2Error(`${field} không hợp lệ`, 400);
  return id;
}

function normalizeScopeInput(input = {}) {
  const minSelected = input.min_selected == null ? null : Number(input.min_selected);
  const maxSelected = input.max_selected == null ? null : Number(input.max_selected);
  if (minSelected != null && (!Number.isInteger(minSelected) || minSelected < 0)) {
    throw new CatalogV2Error('min_selected không hợp lệ', 400);
  }
  if (maxSelected != null && (!Number.isInteger(maxSelected) || maxSelected < 0)) {
    throw new CatalogV2Error('max_selected không hợp lệ', 400);
  }
  if (minSelected != null && maxSelected != null && minSelected > maxSelected) {
    throw new CatalogV2Error('min_selected không được lớn hơn max_selected', 400);
  }
  const sortOrder = input.sort_order == null ? 0 : Number(input.sort_order);
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    throw new CatalogV2Error('sort_order không hợp lệ', 400);
  }
  return {
    attributeDefinitionId: positiveId(input.attribute_definition_id, 'attribute_definition_id'),
    isEnabled: input.is_enabled === undefined ? true : Boolean(input.is_enabled),
    inheritToDescendants: input.inherit_to_descendants === undefined
      ? true
      : Boolean(input.inherit_to_descendants),
    sortOrder,
    isRequired: input.is_required == null ? null : Boolean(input.is_required),
    minSelected,
    maxSelected,
  };
}

router.get('/categories/:id/option-assignments', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  res.json(await service.listCategoryAssignments(positiveId(req.params.id, 'category_id')));
}));

router.put('/categories/:id/option-assignments', requireRole('super'), asyncHandler(async (req, res) => {
  const categoryId = positiveId(req.params.id, 'category_id');
  const assignment = await service.upsertCategoryAssignment(categoryId, normalizeScopeInput(req.body));
  await logAudit(req.user.sub, 'Cập nhật tùy chọn danh mục', `Category ID: ${categoryId}`, req);
  res.json(assignment);
}));

router.delete('/categories/:id/option-assignments/:attributeId', requireRole('super'), asyncHandler(async (req, res) => {
  const removed = await service.deleteCategoryAssignment(
    positiveId(req.params.id, 'category_id'),
    positiveId(req.params.attributeId, 'attribute_definition_id'),
  );
  res.json({ removed });
}));

router.get('/products/:id/option-overrides', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  res.json(await service.listProductOverrides(positiveId(req.params.id, 'product_id')));
}));

router.put('/products/:id/option-overrides', requireRole('super'), asyncHandler(async (req, res) => {
  const productId = positiveId(req.params.id, 'product_id');
  const override = await service.upsertProductOverride(productId, normalizeScopeInput(req.body));
  await logAudit(req.user.sub, 'Cập nhật tùy chọn sản phẩm', `Product ID: ${productId}`, req);
  res.json(override);
}));

router.delete('/products/:id/option-overrides/:attributeId', requireRole('super'), asyncHandler(async (req, res) => {
  const removed = await service.deleteProductOverride(
    positiveId(req.params.id, 'product_id'),
    positiveId(req.params.attributeId, 'attribute_definition_id'),
  );
  res.json({ removed });
}));

router.use((err, req, res, next) => {
  if (err?.code === '23505') {
    return next(new CatalogV2Error('Mã, slug, SKU hoặc tổ hợp biến thể đã tồn tại', 409));
  }
  return next(err);
});

export default router;
