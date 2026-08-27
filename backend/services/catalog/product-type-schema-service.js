import { createCatalogV2Repository } from '../../repositories/postgres/catalog-v2.js';
import {
  validateCategoryInput,
  validateProductTypeInput,
  validateAttributeDefinitionInput,
  validateAttributeValueInput,
  generateCanonicalVariantSignature,
} from '../../validation/catalog-v2-schemas.js';

export function createProductTypeSchemaService(repository = createCatalogV2Repository()) {
  return {
    async listCategories(options) {
      return await repository.listCategories(options);
    },

    async createCategory(input) {
      const validated = validateCategoryInput(input);
      return await repository.createCategory(validated);
    },

    async updateCategory(id, input) {
      const validated = validateCategoryInput(input);
      return await repository.updateCategory(Number(id), validated);
    },

    async archiveCategory(id) {
      return await repository.archiveCategory(Number(id));
    },

    async listProductTypes() {
      return await repository.listProductTypes();
    },

    async createProductType(input, context = {}) {
      const validated = validateProductTypeInput(input);
      return await repository.createProductType(validated, context);
    },

    async getSchemaDetails(schemaId) {
      return await repository.getSchemaDetails(Number(schemaId));
    },

    async publishSchema(schemaId) {
      return await repository.publishSchema(Number(schemaId));
    },

    async addAttributeToSchema(schemaId, input) {
      const validated = validateAttributeDefinitionInput(input);
      return await repository.addAttributeToSchema(Number(schemaId), validated);
    },

    async addAttributeValue(attrDefId, input) {
      const validated = validateAttributeValueInput(input);
      return await repository.addAttributeValue(Number(attrDefId), validated);
    },

    generateVariantSignature(values) {
      return generateCanonicalVariantSignature(values);
    },
  };
}
