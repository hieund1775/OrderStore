import defaultPromotionsRepository from '../../repositories/postgres/promotions.js';

export function createPromotionService(repository = defaultPromotionsRepository) {
  return {
    async listActivePromotions() {
      return repository.listActivePromotions();
    },

    async previewVoucher({ code, subtotal, phone, storeId, checkoutChannel = 'normal', userId = null }) {
      return repository.preview({ code, subtotal, phone, storeId, checkoutChannel, userId });
    },
  };
}

export const promotionService = createPromotionService();
export default promotionService;
