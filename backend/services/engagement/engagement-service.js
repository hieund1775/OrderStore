import defaultEngagementRepository from '../../repositories/postgres/engagement.js';

function validateStoreId(storeId) {
  if (storeId === null || storeId === undefined || storeId === '') return null;
  const num = Number(storeId);
  if (!Number.isInteger(num) || num <= 0) {
    const err = new Error('Mã chi nhánh không hợp lệ');
    err.status = 400;
    err.expose = true;
    throw err;
  }
  return num;
}

export function createEngagementService(repository = defaultEngagementRepository) {
  return {
    async getUserProfile(userId) {
      return repository.getUserProfile(userId);
    },

    async listUserWishlist(userId, storeId = null) {
      const validatedStoreId = validateStoreId(storeId);
      return repository.listUserWishlist(userId, validatedStoreId);
    },

    async ensureUserWishlistItem(userId, productId, storeId = null) {
      const validatedStoreId = validateStoreId(storeId);
      return repository.ensureUserWishlistItem(userId, productId, validatedStoreId);
    },

    async removeUserWishlistItem(userId, productId) {
      return repository.removeUserWishlistItem(userId, productId);
    },

    async listUserNotifications(userId) {
      return repository.listUserNotifications(userId);
    },

    async listUserVouchers(userId) {
      return repository.listUserVouchers(userId);
    },

    async listProductReviews(productId) {
      return repository.listProductReviews(productId);
    },

    async createProductReview(userId, { productId, orderItemId, rating, comment, imageUrls }) {
      return repository.createProductReview(userId, { productId, orderItemId, rating, comment, imageUrls });
    },

    async listJobs() {
      return repository.listJobs();
    },

    async applyJob({ jobId, storeId, fullname, phone, email, cvUrl }) {
      return repository.applyJob({ jobId, storeId, fullname, phone, email, cvUrl });
    },

    async listTiers() {
      return repository.listTiers();
    },

    async listRewards() {
      return repository.listRewards();
    },
  };
}

export const engagementService = createEngagementService();
export default engagementService;
