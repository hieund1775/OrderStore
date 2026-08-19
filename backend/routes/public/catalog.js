import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { validateCatalogFilters } from '../../validation/catalog-schemas.js';
import { toProductDto, toCategoryDto, toOptionDto } from '../../dto/catalog-dto.js';
import catalogService from '../../services/catalog/catalog-service.js';

const router = Router();

router.get('/products', asyncHandler(async (req, res) => {
  const filters = validateCatalogFilters(req.query);
  const rows = await catalogService.listProducts(filters);
  res.json(rows.map(toProductDto));
}));

router.get('/products/:slug', asyncHandler(async (req, res) => {
  const product = await catalogService.findProductBySlug(req.params.slug);
  if (!product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  res.json(toProductDto(product));
}));

router.get('/categories', asyncHandler(async (req, res) => {
  const rows = await catalogService.listCategories();
  res.json(rows.map(toCategoryDto));
}));

const VALID_OPTION_KINDS = ['sizes', 'bases', 'sugars', 'ices', 'toppings'];
for (const optionKind of VALID_OPTION_KINDS) {
  router.get(`/options/${optionKind}`, asyncHandler(async (req, res) => {
    const rows = await catalogService.listOptions(optionKind);
    res.json(rows.map(toOptionDto));
  }));
}

router.get('/search/suggestions', asyncHandler(async (req, res) => {
  const suggestions = await catalogService.listSearchSuggestions(req.query.q);
  res.json(suggestions);
}));

export default router;
