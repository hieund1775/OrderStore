import { createAdminCatalogV2Repository } from '../../repositories/postgres/admin-catalog-v2.js';
import { CatalogV2Error, createCatalogV2Repository } from '../../repositories/postgres/catalog-v2.js';
import {
  toCategoryTreeDto,
  toProductTypeDto,
  toSchemaDetailsDto,
  toProductV2Dto,
  toVariantDto,
} from '../../dto/catalog-v2-dto.js';
import {
  validateCategoryInput,
  validateProductTypeInput,
  validateAttributeDefinitionInput,
  validateAttributeValueInput,
  generateCanonicalVariantSignature,
} from '../../validation/catalog-v2-schemas.js';

export function createAdminCatalogV2Service({
  catalogRepository = createAdminCatalogV2Repository(),
  schemaRepository = createCatalogV2Repository(),
} = {}) {
  return {
    // -------------------------------------------------------------
    // CATEGORIES
    // -------------------------------------------------------------
    async listCategories(options) {
      const rows = await schemaRepository.listCategories(options);
      return rows.map(toCategoryTreeDto);
    },

    async createCategory(input) {
      const validated = validateCategoryInput(input);
      const row = await schemaRepository.createCategory(validated);
      return toCategoryTreeDto(row);
    },

    async updateCategory(id, input) {
      const validated = validateCategoryInput(input);
      const row = await schemaRepository.updateCategory(Number(id), validated);
      return toCategoryTreeDto(row);
    },

    async archiveCategory(id) {
      const row = await schemaRepository.archiveCategory(Number(id));
      return toCategoryTreeDto(row);
    },

    // -------------------------------------------------------------
    // PRODUCT TYPES & SCHEMAS
    // -------------------------------------------------------------
    async listProductTypes() {
      const rows = await schemaRepository.listProductTypes();
      return rows.map(toProductTypeDto);
    },

    async createProductType(input, context) {
      const validated = validateProductTypeInput(input);
      const result = await schemaRepository.createProductType(validated, context);
      return {
        productType: toProductTypeDto(result.productType),
        schema: result.schema,
      };
    },

    async createNextSchemaVersion(productTypeId, context) {
      const normalizedId = Number(productTypeId);
      if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
        throw new CatalogV2Error('Mã loại sản phẩm không hợp lệ', 400);
      }
      return await schemaRepository.createNextSchemaVersion(normalizedId, context);
    },

    async getSchemaDetails(schemaId) {
      const schema = await schemaRepository.getSchemaDetails(Number(schemaId));
      return toSchemaDetailsDto(schema);
    },

    async publishSchema(schemaId) {
      const schema = await schemaRepository.publishSchema(Number(schemaId));
      return schema;
    },

    async addAttributeToSchema(schemaId, input) {
      const validated = validateAttributeDefinitionInput(input);
      return await schemaRepository.addAttributeToSchema(Number(schemaId), validated);
    },

    async addAttributeValue(attrDefId, input) {
      const validated = validateAttributeValueInput(input);
      return await schemaRepository.addAttributeValue(Number(attrDefId), validated);
    },

    // -------------------------------------------------------------
    // PRODUCTS & VARIANTS
    // -------------------------------------------------------------
    async listProducts(filters) {
      const rows = await catalogRepository.listProducts(filters);
      return rows.map(toProductV2Dto);
    },

    async getProductDetails(id) {
      const row = await catalogRepository.getProductDetails(Number(id));
      if (!row) return null;
      return {
        ...toProductV2Dto(row),
        variants: (row.variants || []).map(toVariantDto),
      };
    },

    async createProduct(input, context) {
      if (!input.name || String(input.name).trim().length < 2) {
        throw new CatalogV2Error('Tên sản phẩm phải từ 2 ký tự trở lên', 400);
      }
      if (!input.category_id || Number(input.category_id) <= 0) {
        throw new CatalogV2Error('Vui lòng chọn danh mục hợp lệ', 400);
      }

      const slug = String(input.slug || '')
        .trim()
        .toLowerCase();
      if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new CatalogV2Error('Slug sản phẩm phải đúng định dạng kebab-case', 400);
      }
      const price = Number(input.price ?? 0);
      if (!Number.isInteger(price) || price < 0) {
        throw new CatalogV2Error('Giá sản phẩm phải là số nguyên không âm', 400);
      }
      if (input.status !== undefined && !['draft', 'active'].includes(input.status)) {
        throw new CatalogV2Error('Trạng thái sản phẩm không hợp lệ', 400);
      }

      const created = await catalogRepository.createProduct(
        {
          category_id: Number(input.category_id),
          product_type_schema_id: input.product_type_schema_id ? Number(input.product_type_schema_id) : null,
          name: String(input.name).trim(),
          slug,
          description: input.description || null,
          price,
          image_url: input.image_url || null,
          status: input.status || 'active',
          fulfillment_lane: input.fulfillment_lane || 'kitchen',
          stock_mode: input.stock_mode || 'made_to_order',
          media: input.media || [],
        },
        context,
      );

      return toProductV2Dto(created);
    },

    async updateProduct(id, input) {
      const normalized = {};
      if (input.name !== undefined) {
        const name = String(input.name).trim();
        if (name.length < 2 || name.length > 200) {
          throw new CatalogV2Error('Tên sản phẩm phải từ 2 đến 200 ký tự', 400);
        }
        normalized.name = name;
      }
      if (input.slug !== undefined) {
        const slug = String(input.slug).trim().toLowerCase();
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
          throw new CatalogV2Error('Slug sản phẩm phải đúng định dạng kebab-case', 400);
        }
        normalized.slug = slug;
      }
      if (input.category_id !== undefined) {
        const categoryId = Number(input.category_id);
        if (!Number.isInteger(categoryId) || categoryId <= 0) {
          throw new CatalogV2Error('Danh mục sản phẩm không hợp lệ', 400);
        }
        normalized.category_id = categoryId;
      }
      if (input.price !== undefined) {
        const price = Number(input.price);
        if (!Number.isInteger(price) || price < 0) {
          throw new CatalogV2Error('Giá sản phẩm phải là số nguyên không âm', 400);
        }
        normalized.price = price;
      }
      if (input.status !== undefined) {
        if (!['draft', 'active'].includes(input.status)) {
          throw new CatalogV2Error('Trạng thái sản phẩm không hợp lệ', 400);
        }
        normalized.status = input.status;
      }
      if (input.description !== undefined) normalized.description = input.description;
      if (input.image_url !== undefined) normalized.image_url = input.image_url;

      const updated = await catalogRepository.updateProduct(Number(id), normalized);
      return toProductV2Dto(updated);
    },

    async archiveProduct(id) {
      const archived = await catalogRepository.archiveProduct(Number(id));
      return toProductV2Dto(archived);
    },

    /**
     * Previews all combinatorial SKU variants for a product and its schema variant attributes
     */
    previewVariantCombinations(schemaAttributes = [], productSlug = 'product') {
      const variantAttrs = schemaAttributes.filter((a) => a.role === 'variant' && Array.isArray(a.values) && a.values.length > 0);
      if (variantAttrs.length === 0) {
        return [
          {
            sku: `${productSlug.toUpperCase()}-DEF`,
            variant_signature: 'default',
            name_suffix: 'Tiêu chuẩn',
            attribute_values: [],
          },
        ];
      }

      // Cartesian product generator
      function cartesian(arrays) {
        return arrays.reduce((acc, curr) => acc.flatMap((c) => curr.map((n) => [...c, n])), [[]]);
      }

      const attrArrays = variantAttrs.map((attr) =>
        attr.values.map((val) => ({
          attribute_definition_id: attr.id,
          attribute_code: attr.code,
          attribute_name: attr.name,
          attribute_value_id: val.id,
          value_code: val.code,
          value_label: val.label,
        })),
      );

      const combinations = cartesian(attrArrays);
      if (combinations.length > 500) {
        throw new CatalogV2Error('Số lượng tổ hợp biến thể vượt quá giới hạn tối đa (500 biến thể)', 400);
      }

      return combinations.map((combo) => {
        const signature = generateCanonicalVariantSignature(combo);
        const skuSuffix = combo.map((c) => c.value_code.toUpperCase()).join('-');
        const nameSuffix = combo.map((c) => c.value_label).join(' / ');
        return {
          sku: `${productSlug.toUpperCase()}-${skuSuffix}`,
          variant_signature: signature,
          name_suffix: nameSuffix,
          attribute_values: combo,
        };
      });
    },

    async createVariant(productId, variantData) {
      const normalizedProductId = Number(productId);
      if (!Number.isInteger(normalizedProductId) || normalizedProductId <= 0) {
        throw new CatalogV2Error('Mã sản phẩm không hợp lệ', 400);
      }
      const sku = String(variantData?.sku || '').trim().toUpperCase();
      if (!sku || sku.length > 100 || !/^[A-Z0-9._-]+$/.test(sku)) {
        throw new CatalogV2Error('SKU chỉ được chứa chữ in hoa, số, dấu chấm, gạch ngang hoặc gạch dưới', 400);
      }
      if (variantData.status !== undefined && !['active', 'archived'].includes(variantData.status)) {
        throw new CatalogV2Error('Trạng thái SKU không hợp lệ', 400);
      }
      const created = await catalogRepository.createVariant(normalizedProductId, {
        ...variantData,
        sku,
      });
      return toVariantDto(created);
    },
  };
}
