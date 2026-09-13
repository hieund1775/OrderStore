import defaultAdminPromotionsRepository from '../../repositories/postgres/admin-promotions.js';

export function createAdminPromotionService(repository = defaultAdminPromotionsRepository) {
  return {
    async listPromotions({ scopedStoreId } = {}) {
      return repository.listPromotions({ scopedStoreId });
    },

    async createPromotion(data) {
      return repository.createPromotion(data);
    },

    async updatePromotion(id, data) {
      return repository.updatePromotion(id, data);
    },

    async deletePromotion(id) {
      return repository.deletePromotion(id);
    },

    async assignPromotionToUser(data) {
      return repository.assignPromotionToUser(data);
    },
  };
}

export const adminPromotionService = createAdminPromotionService();
export default adminPromotionService;
