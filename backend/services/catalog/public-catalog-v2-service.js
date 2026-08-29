import { createPublicCatalogV2Repository } from '../../repositories/postgres/public-catalog-v2.js';
import { createBranchOffersRepository } from '../../repositories/postgres/branch-offers.js';
import { CatalogV2Error } from '../../repositories/postgres/catalog-v2.js';
import { generateCanonicalVariantSignature } from '../../validation/catalog-v2-schemas.js';

function normalizeSelectedIds(values, fieldName) {
  if (!Array.isArray(values)) {
    throw new CatalogV2Error(`${fieldName} phải là một mảng`, 400);
  }

  const normalized = values.map(Number);
  if (normalized.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new CatalogV2Error(`${fieldName} chứa mã giá trị không hợp lệ`, 400);
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new CatalogV2Error(`${fieldName} không được chứa giá trị trùng lặp`, 400);
  }
  return normalized;
}

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

    async getSections({ storeId, limitPerRoot = 12 } = {}) {
      const normalizedStoreId = Number(storeId);
      if (!Number.isInteger(normalizedStoreId) || normalizedStoreId <= 0) {
        throw new CatalogV2Error('Vui lòng chọn chi nhánh hợp lệ', 400);
      }
      return await catalogRepository.getGroupedSections({ storeId: normalizedStoreId, limitPerRoot });
    },

    async listSubtreeProducts({ storeId, categorySlug, search, limit = 50, offset = 0 } = {}) {
      const normalizedStoreId = Number(storeId);
      if (!Number.isInteger(normalizedStoreId) || normalizedStoreId <= 0) {
        throw new CatalogV2Error('Vui lòng chọn chi nhánh hợp lệ', 400);
      }

      let resolvedCategory = null;
      if (categorySlug) {
        resolvedCategory = await catalogRepository.findCategoryBySlug(categorySlug);
        if (!resolvedCategory) {
          throw new CatalogV2Error('Không tìm thấy danh mục hoặc danh mục đã ngừng phục vụ', 404);
        }
      }

      const result = await catalogRepository.listProducts({
        storeId: normalizedStoreId,
        categorySlug: resolvedCategory ? (resolvedCategory.canonical_slug || resolvedCategory.slug) : categorySlug,
        categoryId: resolvedCategory ? resolvedCategory.id : undefined,
        search,
        limit,
        offset,
      });

      if (resolvedCategory) {
        result.category = {
          id: resolvedCategory.id,
          name: resolvedCategory.name,
          slug: resolvedCategory.canonical_slug || resolvedCategory.slug,
          is_alias_resolved: Boolean(resolvedCategory.is_alias_resolved),
        };
      }

      return result;
    },

    async listProducts(filters) {
      return await catalogRepository.listProducts(filters);
    },

    async getProductBySlug(slug, { storeId } = {}) {
      const normalizedStoreId = Number(storeId);
      if (!Number.isInteger(normalizedStoreId) || normalizedStoreId <= 0) {
        throw new CatalogV2Error('Vui lòng chọn chi nhánh hợp lệ', 400);
      }
      return await catalogRepository.getProductBySlug(slug, { storeId: normalizedStoreId });
    },

    /**
     * Resolves the exact server price and SKU given selected variant attributes and modifiers.
     */
    async resolveConfiguration({ storeId, productSlug, selectedVariantValueIds = [], selectedModifierValueIds = [] }) {
      const normalizedStoreId = Number(storeId);
      if (!Number.isInteger(normalizedStoreId) || normalizedStoreId <= 0) {
        throw new CatalogV2Error('Vui lòng chọn chi nhánh hợp lệ trước khi cấu hình sản phẩm', 400);
      }

      const variantValueIds = normalizeSelectedIds(selectedVariantValueIds, 'variant_value_ids');
      const modifierValueIds = normalizeSelectedIds(selectedModifierValueIds, 'modifier_value_ids');
      const product = await catalogRepository.getProductBySlug(productSlug, { storeId });
      if (!product) throw new CatalogV2Error('Sản phẩm không tồn tại hoặc đã ngừng bán', 404);

      const attributes = product.attributes || [];
      const variantAttributes = attributes.filter((attr) => attr.role === 'variant');
      const modifierAttributes = attributes.filter((attr) => attr.role === 'modifier');

      // 1. Resolve Variant SKU & Base Price
      const variantPairs = [];
      const consumedVariantIds = new Set();
      for (const attr of variantAttributes) {
        const selectedForAttribute = (attr.values || []).filter((value) =>
          variantValueIds.includes(Number(value.id)),
        );
        if (selectedForAttribute.length !== 1) {
          throw new CatalogV2Error(`Vui lòng chọn đúng một giá trị cho ${attr.name}`, 400);
        }
        const selectedValue = selectedForAttribute[0];
        consumedVariantIds.add(Number(selectedValue.id));
        variantPairs.push({
          attribute_definition_id: attr.id,
          attribute_value_id: selectedValue.id,
        });
      }

      if (consumedVariantIds.size !== variantValueIds.length) {
        throw new CatalogV2Error('Biến thể đã chọn không thuộc sản phẩm này hoặc đã ngừng sử dụng', 400);
      }

      const signature = generateCanonicalVariantSignature(variantPairs);
      const matchedVariant = (product.variants || []).find(
        (variant) => variant.variant_signature === signature,
      );
      if (!matchedVariant) {
        throw new CatalogV2Error('Tổ hợp biến thể này không tồn tại hoặc đã ngừng bán', 409);
      }

      const rawPrice = matchedVariant.price;
      const variantPrice = (rawPrice === null || rawPrice === undefined) ? NaN : Number(rawPrice);
      if (!Number.isInteger(variantPrice) || variantPrice < 0) {
        throw new CatalogV2Error('Chi nhánh chưa thiết lập giá bán cho biến thể này', 409);
      }

      // 2. Sum Modifiers Price Adjustments
      let modifierExtraTotal = 0;
      const appliedModifiers = [];
      const consumedModifierIds = new Set();

      for (const attr of modifierAttributes) {
        const selectedForAttribute = (attr.values || []).filter((value) =>
          modifierValueIds.includes(Number(value.id)),
        );
        const minimum = Number(attr.min_selections ?? (attr.is_required ? 1 : 0));
        const maximum = attr.input_type === 'single_select'
          ? 1
          : attr.max_selections == null
            ? Number.POSITIVE_INFINITY
            : Number(attr.max_selections);

        if (selectedForAttribute.length < minimum || selectedForAttribute.length > maximum) {
          throw new CatalogV2Error(
            `${attr.name} yêu cầu chọn từ ${minimum} đến ${Number.isFinite(maximum) ? maximum : 'nhiều'} giá trị`,
            400,
          );
        }

        for (const selectedVal of selectedForAttribute) {
          consumedModifierIds.add(Number(selectedVal.id));
          const extra = Number(selectedVal.price_adjustment || 0);
          modifierExtraTotal += extra;
          appliedModifiers.push({
            attribute_definition_id: attr.id,
            attribute_name: attr.name,
            attribute_value_id: selectedVal.id,
            attribute_label: selectedVal.label,
            price_adjustment: extra,
          });
        }
      }

      if (consumedModifierIds.size !== modifierValueIds.length) {
        throw new CatalogV2Error('Một số tùy chọn topping/đường/đá đã chọn không hợp lệ', 400);
      }

      const finalPrice = variantPrice + modifierExtraTotal;

      return {
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          fulfillment_lane: product.fulfillment_lane,
          stock_mode: product.stock_mode,
        },
        variant: {
          id: matchedVariant.id,
          sku: matchedVariant.sku,
          variant_signature: matchedVariant.variant_signature,
          name_suffix: matchedVariant.name_suffix,
          base_price: variantPrice,
          compare_at_price: matchedVariant.compare_at_price ? Number(matchedVariant.compare_at_price) : null,
          is_available: matchedVariant.is_available,
          available_stock: matchedVariant.available_stock,
        },
        applied_modifiers: appliedModifiers,
        pricing: {
          variant_base_price: variantPrice,
          modifiers_extra_total: modifierExtraTotal,
          final_price: finalPrice,
        },
        base_price: variantPrice,
        modifier_extra: modifierExtraTotal,
        unit_price: finalPrice,
      };
    },
  };
}

export default createPublicCatalogV2Service();
