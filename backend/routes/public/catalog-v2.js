import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { createPublicCatalogV2Service } from '../../services/catalog/public-catalog-v2-service.js';
import { validateSectionsQuery, validateSubtreeProductsQuery } from '../../validation/catalog-v2-schemas.js';
import { toCatalogSectionDto } from '../../dto/catalog-v2-dto.js';

const router = Router();
const service = createPublicCatalogV2Service();

router.get('/categories/tree', asyncHandler(async (req, res) => {
  const storeId = req.query.store_id ? Number(req.query.store_id) : null;
  const tree = await service.getCategoryTree({ storeId });
  res.json(tree);
}));

router.get('/sections', asyncHandler(async (req, res) => {
  const { storeId, limitPerRoot } = validateSectionsQuery(req.query);
  const sections = await service.getSections({ storeId, limitPerRoot });
  res.json({ sections: sections.map(toCatalogSectionDto) });
}));

router.get('/products', asyncHandler(async (req, res) => {
  const { storeId, categorySlug, search, limit, offset } = validateSubtreeProductsQuery(req.query);
  const result = await service.listSubtreeProducts({
    storeId,
    categorySlug,
    search,
    limit,
    offset,
  });
  res.json(result);
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
