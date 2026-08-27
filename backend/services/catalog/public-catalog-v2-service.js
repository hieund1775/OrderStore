import { createPublicCatalogV2Repository } from '../../repositories/postgres/public-catalog-v2.js';
import { createBranchOffersRepository } from '../../repositories/postgres/branch-offers.js';
import { generateCanonicalVariantSignature } from '../../validation/catalog-v2-schemas.js';

export function createPublicCatalogV2Service({
  catalogRepository = createPublicCatalogV2Repository(),
  branchOffersRepository = createBranchOffersRepository(),
} = {}) {
  return {
    async getCategoryTree() {
      const rows = await catalogRepository.getCategoryTree();
      // Build nested hierarchy
      const roots = rows.filter((r) => !r.parent_id);
      const getChildren = (parentId) =>
        rows
          .filter((r) => Number(r.parent_id) === Number(parentId))
          .map((child) => ({
            ...child,
            children: getChildren(child.id),
          }));

      return roots.map((root) => ({
        ...root,
        children: getChildren(root.id),
      }));
    },

    async listProducts(filters) {
      return await catalogRepository.listProducts(filters);
    },

    async getProductBySlug(slug, options) {
      return await catalogRepository.getProductBySlug(slug, options);
    },

    /**
     * Resolves the exact server price and SKU given selected variant attributes and modifiers.
     */
    async resolveConfiguration({ storeId, productSlug, selectedVariantValueIds = [], selectedModifierValueIds = [] }) {
      const product = await catalogRepository.getProductBySlug(productSlug, { storeId });
      if (!product) throw new Error('Sản phẩm không tồn tại');

      // 1. Resolve Variant SKU & Base Price
      let matchedVariant = null;
      if (selectedVariantValueIds.length > 0) {
        // Build signature
        const variantPairs = [];
        for (const valId of selectedVariantValueIds) {
          for (const attr of product.attributes || []) {
            if (attr.role === 'variant') {
              const matchedVal = (attr.values || []).find((v) => Number(v.id) === Number(valId));
              if (matchedVal) {
                variantPairs.push({
                  attribute_definition_id: attr.id,
                  attribute_value_id: matchedVal.id,
                });
              }
            }
          }
        }
        const signature = generateCanonicalVariantSignature(variantPairs);
        matchedVariant = (product.variants || []).find((v) => v.variant_signature === signature);
      } else {
        // Default variant
        matchedVariant = (product.variants || []).find((v) => v.variant_signature === 'default') || product.variants?.[0];
      }

      const variantPrice = matchedVariant?.price != null ? Number(matchedVariant.price) : Number(product.price || 0);

      // 2. Sum Modifiers Price Adjustments
      let modifierExtraTotal = 0;
      const appliedModifiers = [];

      for (const valId of selectedModifierValueIds) {
        for (const attr of product.attributes || []) {
          if (attr.role === 'modifier') {
            const matchedVal = (attr.values || []).find((v) => Number(v.id) === Number(valId));
            if (matchedVal) {
              const extra = Number(matchedVal.price_adjustment || 0);
              modifierExtraTotal += extra;
              appliedModifiers.push({
                attribute_code: attr.code,
                attribute_name: attr.name,
                value_code: matchedVal.code,
                value_label: matchedVal.label,
                price_adjustment: extra,
              });
            }
          }
        }
      }

      const unitPrice = variantPrice + modifierExtraTotal;

      return {
        product_id: product.id,
        product_name: product.name,
        product_slug: product.slug,
        fulfillment_lane: product.fulfillment_lane,
        stock_mode: product.stock_mode,
        variant_id: matchedVariant?.id || null,
        sku: matchedVariant?.sku || `SKU-${product.id}-DEF`,
        variant_name: matchedVariant?.name_suffix || null,
        is_available: matchedVariant?.is_available !== false,
        available_stock: matchedVariant?.available_stock != null ? Number(matchedVariant.available_stock) : null,
        base_price: variantPrice,
        modifier_extra: modifierExtraTotal,
        unit_price: unitPrice,
        applied_modifiers: appliedModifiers,
      };
    },
  };
}
