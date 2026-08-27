import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { logAudit } from '../../services/audit.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { createAdminCatalogV2Service } from '../../services/catalog/admin-catalog-v2-service.js';

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

export default router;
