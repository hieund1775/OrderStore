import defaultAdminManagementRepository from '../../repositories/postgres/admin-management.js';

export function createCustomerService(repository = defaultAdminManagementRepository) {
  return {
    async listCustomers({ scopedStoreId, search, tier, limit = 50, offset = 0 } = {}) {
      return repository.listCustomers({ scopedStoreId, search, tier, limit, offset });
    },

    async getCustomerDetail(id, { scopedStoreId } = {}) {
      return repository.getCustomerDetail(id, { scopedStoreId });
    },

    async listAccounts() {
      return repository.listAccounts();
    },

    async listAuditLogs({ limit = 100 } = {}) {
      return repository.listAuditLogs({ limit });
    },

    async listNotifications({ userId, role, limit = 50 } = {}) {
      return repository.listNotifications({ userId, role, limit });
    },

    async createNotification({ user_id, type, title, body, link }) {
      return repository.createNotification({ user_id, type, title, body, link });
    },
  };
}

export const customerService = createCustomerService();
export default customerService;
