import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { createPublicCatalogV2Service } from '../../services/catalog/public-catalog-v2-service.js';

const router = Router();
const service = createPublicCatalogV2Service();

router.get('/categories/tree', asyncHandler(async (req, res) => {
  const tree = await service.getCategoryTree();
  res.json(tree);
}));

router.get('/products', asyncHandler(async (req, res) => {
  const products = await service.listProducts({
    storeId: req.query.store_id,
    categorySlug: req.query.category,
    search: req.query.search,
    limit: req.query.limit ? Number(req.query.limit) : 50,
    offset: req.query.offset ? Number(req.query.offset) : 0,
  });
  res.json(products);
}));

router.get('/products/:slug', asyncHandler(async (req, res) => {
  const product = await service.getProductBySlug(req.params.slug, {
    storeId: req.query.store_id,
  });
  if (!product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  res.json(product);
}));

router.post('/resolve-configuration', asyncHandler(async (req, res) => {
  const { store_id, product_slug, variant_value_ids, modifier_value_ids } = req.body;
  const resolved = await service.resolveConfiguration({
    storeId: store_id,
    productSlug: product_slug,
    selectedVariantValueIds: variant_value_ids || [],
    selectedModifierValueIds: modifier_value_ids || [],
  });
  res.json(resolved);
}));

export default router;
