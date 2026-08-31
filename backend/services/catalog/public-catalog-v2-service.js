import { createPublicCatalogV2Repository } from '../../repositories/postgres/public-catalog-v2.js';
import { createBranchOffersRepository } from '../../repositories/postgres/branch-offers.js';
import { CatalogV2Error } from '../../repositories/postgres/catalog-v2.js';
import { generateCanonicalVariantSignature } from '../../validation/catalog-v2-schemas.js';
import { createCatalogOptionScopesRepository } from '../../repositories/postgres/catalog-option-scopes.js';
import { resolveProductOptions } from './catalog-option-resolver.js';
import { resolveFulfillmentLane } from './fulfillment-lane-resolver.js';

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

export function createPublicCatalogV2Service(options = {}) {
  const catalogRepository = options.catalogRepository || createPublicCatalogV2Repository();
  const branchOffersRepository = options.branchOffersRepository || createBranchOffersRepository();
  const optionScopesRepository = options.optionScopesRepository === undefined
    ? (options.catalogRepository ? null : createCatalogOptionScopesRepository())
    : options.optionScopesRepository;

  async function loadResolvedProduct(slug, storeId, { includeInactiveValues = false } = {}) {
    const product = await catalogRepository.getProductBySlug(slug, { storeId });
    if (!product) return null;

    const scopeData = optionScopesRepository
      ? await optionScopesRepository.getOptionScopesForProduct(product.id)
      : null;
    const schemaAttributes = (product.attributes || []).filter((attribute) => attribute.is_active !== false);
    let attributes = schemaAttributes;

    if (scopeData && (
      (scopeData.categoryAssignments && scopeData.categoryAssignments.length > 0) ||
      (scopeData.productOverrides && scopeData.productOverrides.length > 0) ||
      (scopeData.categoryPresets && scopeData.categoryPresets.length > 0) ||
      (scopeData.productPresets && scopeData.productPresets.length > 0)
    )) {
      const resolvedScopes = resolveProductOptions({
        categoryAssignments: scopeData.categoryAssignments,
        productOverrides: scopeData.productOverrides,
        categoryPresets: scopeData.categoryPresets,
        productPresets: scopeData.productPresets,
      });
      const attributesById = new Map(schemaAttributes.map((attribute) => [Number(attribute.id), attribute]));
      attributes = resolvedScopes
        .map((scope) => {
          const attribute = attributesById.get(Number(scope.attribute_definition_id));
          if (!attribute) return null;
          return {
            ...attribute,
            is_required: scope.is_required == null ? attribute.is_required : Boolean(scope.is_required),
            min_selections: scope.min_selected == null ? attribute.min_selections : Number(scope.min_selected),
            max_selections: scope.max_selected == null ? attribute.max_selections : Number(scope.max_selected),
            sort_order: scope.sort_order,
            preset_value_ids: scope.preset_value_ids || [],
            is_locked: Boolean(scope.is_locked),
            source: {
              type: scope.source_type,
              id: scope.source_id,
              name: scope.source_name,
              is_overridden: scope.is_overridden,
            },
            values: includeInactiveValues
              ? (attribute.values || [])
              : (attribute.values || []).filter((value) => value.is_active !== false),
          };
        })
        .filter(Boolean);
    } else {
      attributes = schemaAttributes.map((attribute) => ({
        ...attribute,
        preset_value_ids: attribute.preset_value_ids || [],
        is_locked: Boolean(attribute.is_locked),
        values: includeInactiveValues
          ? (attribute.values || [])
          : (attribute.values || []).filter((value) => value.is_active !== false),
      }));
    }

    const laneProduct = {
      ...product,
      fulfillment_lane: scopeData?.product?.product_lane ?? product.fulfillment_lane,
    };
    const fulfillmentLane = optionScopesRepository || laneProduct.fulfillment_lane
      ? resolveFulfillmentLane({ product: laneProduct, lineage: scopeData?.lineage || [] })
      : null;

    return { ...product, fulfillment_lane: fulfillmentLane, attributes };
  }

  return {
    async getCategoryTree({ storeId } = {}) {
      const normalizedStoreId = storeId ? Number(storeId) : null;
      const rows = await catalogRepository.getCategoryTree(normalizedStoreId);
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
      return await loadResolvedProduct(slug, normalizedStoreId);
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
      const product = await loadResolvedProduct(productSlug, normalizedStoreId, {
        includeInactiveValues: true,
      });
      if (!product) throw new CatalogV2Error('Sản phẩm không tồn tại hoặc đã ngừng bán', 404);

      const attributes = product.attributes || [];
      const variantAttributes = attributes.filter((attr) => attr.role === 'variant' && attr.is_active !== false);
      const modifierAttributes = attributes.filter((attr) => attr.role === 'modifier' && attr.is_active !== false);

      // Check locked attributes and validate / auto-inject full preset values
      for (const attr of attributes) {
        if (attr.is_locked && Array.isArray(attr.preset_value_ids) && attr.preset_value_ids.length > 0) {
          const lockedValueIds = attr.preset_value_ids.map(Number);
          if (attr.role === 'modifier') {
            const userSelectedForThisAttr = (attr.values || [])
              .filter((v) => modifierValueIds.includes(Number(v.id)))
              .map((v) => Number(v.id));

            // 1. Reject if client sent any value outside the locked preset
            const invalidSelection = userSelectedForThisAttr.some((id) => !lockedValueIds.includes(id));
            if (invalidSelection) {
              throw new CatalogV2Error(`Tùy chọn "${attr.name}" đã bị khóa cố định theo công thức của món`, 400);
            }

            // 2. Always ensure full locked preset values are applied (auto-complete partial selection)
            for (const lId of lockedValueIds) {
              if (!modifierValueIds.includes(lId)) {
                modifierValueIds.push(lId);
              }
            }
          }
        }
      }

      // Check if user selected any value belonging to inactive modifier values
      for (const attr of attributes) {
        for (const val of attr.values || []) {
          if (modifierValueIds.includes(Number(val.id)) && val.is_active === false) {
            const err = new CatalogV2Error(`Tùy chọn "${val.label || val.code}" đã tạm ngừng bán`, 400);
            err.code = 'OPTION_VALUE_INACTIVE';
            throw err;
          }
        }
      }

      // 1. Resolve Variant SKU & Base Price
      const variantPairs = [];
      const consumedVariantIds = new Set();
      for (const attr of variantAttributes) {
        const selectedForAttribute = (attr.values || []).filter((value) =>
          variantValueIds.includes(Number(value.id)) && value.is_active !== false,
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
          modifierValueIds.includes(Number(value.id)) && value.is_active !== false,
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
