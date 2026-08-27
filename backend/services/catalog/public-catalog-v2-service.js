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

      const variantPrice = Number(matchedVariant.price);
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

        for (const matchedValue of selectedForAttribute) {
          consumedModifierIds.add(Number(matchedValue.id));
          const extra = Number(matchedValue.price_adjustment || 0);
          modifierExtraTotal += extra;
          appliedModifiers.push({
            attribute_code: attr.code,
            attribute_name: attr.name,
            value_code: matchedValue.code,
            value_label: matchedValue.label,
            price_adjustment: extra,
          });
        }
      }

      if (consumedModifierIds.size !== modifierValueIds.length) {
        throw new CatalogV2Error('Tùy chọn đã chọn không thuộc sản phẩm này hoặc đã ngừng sử dụng', 400);
      }

      const unitPrice = variantPrice + modifierExtraTotal;
      const availableStock = matchedVariant.available_stock == null
        ? null
        : Number(matchedVariant.available_stock);
      const isAvailable = matchedVariant.is_available === true
        && (product.stock_mode !== 'tracked' || (availableStock != null && availableStock > 0));

      return {
        product_id: product.id,
        product_name: product.name,
        product_slug: product.slug,
        fulfillment_lane: product.fulfillment_lane,
        stock_mode: product.stock_mode,
        variant_id: matchedVariant.id,
        sku: matchedVariant.sku,
        variant_name: matchedVariant.name_suffix || null,
        is_available: isAvailable,
        available_stock: availableStock,
        base_price: variantPrice,
        modifier_extra: modifierExtraTotal,
        unit_price: unitPrice,
        applied_modifiers: appliedModifiers,
      };
    },
  };
}
