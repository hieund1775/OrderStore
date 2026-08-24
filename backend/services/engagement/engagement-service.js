import defaultEngagementRepository from '../../repositories/postgres/engagement.js';

export function createEngagementService(repository = defaultEngagementRepository) {
  return {
    async getUserProfile(userId) {
      return repository.getUserProfile(userId);
    },

    async listUserWishlist(userId) {
      return repository.listUserWishlist(userId);
    },

    async ensureUserWishlistItem(userId, productId) {
      return repository.ensureUserWishlistItem(userId, productId);
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
