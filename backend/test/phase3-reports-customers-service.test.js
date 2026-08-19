import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createReportService } from '../services/reports/report-service.js';
import { createCustomerService } from '../services/customers/customer-service.js';
import { createEngagementService } from '../services/engagement/engagement-service.js';

describe('Phase 3 Slice 4 Reports, Customers & Engagement Service Unit Tests', () => {
  it('delegates report service calls', async () => {
    const reportService = createReportService({
      async getKPI() { return { kpi: 'ok' }; },
      async getUrgent() { return { urgent: 0 }; },
      async getRevenueByHour() { return []; },
      async getRevenueByCategory() { return []; },
      async getRevenueByBranch() { return []; },
      async getTopProducts() { return [{ name: 'Trà sen vàng' }]; },
      async getReportsKPISummary() { return { total: 100 }; },
      async getReportsSummary() { return { summary: 'ok' }; },
    });

    assert.equal((await reportService.getKPI()).kpi, 'ok');
    assert.equal((await reportService.getTopProducts()).length, 1);
    assert.equal((await reportService.getReportsSummary()).summary, 'ok');
  });

  it('delegates customer and settings service calls', async () => {
    let createdNotif = null;
    const custService = createCustomerService({
      async listCustomers() { return [{ id: 1 }]; },
      async getCustomerDetail(id) { return { id: Number(id) }; },
      async listAccounts() { return [{ id: 1, username: 'admin' }]; },
      async listAuditLogs() { return [{ id: 1, action: 'LOGIN' }]; },
      async listNotifications() { return []; },
      async createNotification(data) { createdNotif = data; return { id: 100, ...data }; },
    });

    assert.equal((await custService.listCustomers()).length, 1);
    assert.equal((await custService.getCustomerDetail('5')).id, 5);
    assert.equal((await custService.listAccounts()).length, 1);
    await custService.createNotification({ title: 'Welcome' });
    assert.equal(createdNotif.title, 'Welcome');
  });

  it('delegates engagement service calls', async () => {
    let reviewData = null;
    let jobData = null;
    const engService = createEngagementService({
      async getUserProfile(id) { return { id: Number(id) }; },
      async listUserWishlist(id) { return []; },
      async toggleUserWishlist(id, pId) { return { added: true }; },
      async listUserNotifications(id) { return []; },
      async listUserVouchers(id) { return []; },
      async listProductReviews(pId) { return []; },
      async createProductReview(userId, data) { reviewData = { userId, ...data }; return { message: 'ok' }; },
      async listJobs() { return [{ id: 1 }]; },
      async applyJob(data) { jobData = data; return { id: 1, ...data }; },
      async listTiers() { return [{ name: 'Silver' }]; },
      async listRewards() { return [{ name: 'Voucher 50k' }]; },
    });

    assert.equal((await engService.getUserProfile('7')).id, 7);
    assert.equal((await engService.toggleUserWishlist(1, 2)).added, true);
    await engService.createProductReview(10, { productId: 1, rating: 5, comment: 'Ngon' });
    assert.equal(reviewData.rating, 5);
    await engService.applyJob({ jobId: 1, fullname: 'Nguyen Van B' });
    assert.equal(jobData.fullname, 'Nguyen Van B');
    assert.equal((await engService.listTiers()).length, 1);
    assert.equal((await engService.listRewards()).length, 1);
  });
});
