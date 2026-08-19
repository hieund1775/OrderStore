import defaultAdminReportsRepository from '../../repositories/postgres/admin-reports.js';

export function createReportService(repository = defaultAdminReportsRepository) {
  return {
    async getKPI({ scopedStoreId } = {}) {
      return repository.getKPI({ scopedStoreId });
    },

    async getUrgent({ scopedStoreId } = {}) {
      return repository.getUrgent({ scopedStoreId });
    },

    async getRevenueByHour({ scopedStoreId } = {}) {
      return repository.getRevenueByHour({ scopedStoreId });
    },

    async getRevenueByCategory({ scopedStoreId, dateFrom, dateTo } = {}) {
      return repository.getRevenueByCategory({ scopedStoreId, dateFrom, dateTo });
    },

    async getRevenueByBranch({ dateFrom, dateTo } = {}) {
      return repository.getRevenueByBranch({ dateFrom, dateTo });
    },

    async getTopProducts({ scopedStoreId, limit = 10 } = {}) {
      return repository.getTopProducts({ scopedStoreId, limit });
    },

    async getReportsKPISummary({ dateFrom, dateTo, scopedStoreId } = {}) {
      return repository.getReportsKPISummary({ dateFrom, dateTo, scopedStoreId });
    },

    async getReportsSummary({ dateFrom, dateTo, scopedStoreId } = {}) {
      return repository.getReportsSummary({ dateFrom, dateTo, scopedStoreId });
    },
  };
}

export const reportService = createReportService();
export default reportService;
