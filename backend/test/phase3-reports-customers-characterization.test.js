import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import { JWT_SECRET } from '../config/env.js';
import adminReportsRepository from '../repositories/postgres/admin-reports.js';
import adminManagementRepository from '../repositories/postgres/admin-management.js';
import engagementRepository from '../repositories/postgres/engagement.js';
import notificationService from '../services/notifications/notification-service.js';

const superToken = jwt.sign({ sub: 1, role: 'super' }, JWT_SECRET);
const user1Token = jwt.sign({ sub: 10, id: 10, role: 'customer' }, JWT_SECRET);

describe('Phase 3 Slice 4 Reports, Customers & Engagement Characterization Tests', () => {
  let server;
  let baseUrl;
  let originals;

  before(async () => {
    originals = {
      getKPI: adminReportsRepository.getKPI,
      getUrgent: adminReportsRepository.getUrgent,
      getReportsSummary: adminReportsRepository.getReportsSummary,
      listCustomers: adminManagementRepository.listCustomers,
      getCustomerDetail: adminManagementRepository.getCustomerDetail,
      listAccounts: adminManagementRepository.listAccounts,
      listNotifications: adminManagementRepository.listNotifications,
      listJobs: engagementRepository.listJobs,
      listTiers: engagementRepository.listTiers,
      getUserProfile: engagementRepository.getUserProfile,
      listUserWishlist: engagementRepository.listUserWishlist,
      listNotificationsForUser: notificationService.listForUser,
    };

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    Object.assign(adminReportsRepository, {
      getKPI: originals.getKPI,
      getUrgent: originals.getUrgent,
      getReportsSummary: originals.getReportsSummary,
    });
    Object.assign(adminManagementRepository, {
      listCustomers: originals.listCustomers,
      getCustomerDetail: originals.getCustomerDetail,
      listAccounts: originals.listAccounts,
      listNotifications: originals.listNotifications,
    });
    Object.assign(engagementRepository, {
      listJobs: originals.listJobs,
      listTiers: originals.listTiers,
      getUserProfile: originals.getUserProfile,
      listUserWishlist: originals.listUserWishlist,
    });
    notificationService.listForUser = originals.listNotificationsForUser;
    await new Promise((resolve) => server.close(resolve));
  });

  it('serves admin reports, dashboard, customers, settings, and notifications', async () => {
    adminReportsRepository.getKPI = async () => ({ todayRevenue: 5000000 });
    adminReportsRepository.getReportsSummary = async () => ({ totalRevenue: 10000000 });
    adminManagementRepository.listCustomers = async () => [{ id: 10, fullname: 'Nguyen Van A' }];
    adminManagementRepository.getCustomerDetail = async (id) => ({ id: Number(id), fullname: 'Nguyen Van A' });
    adminManagementRepository.listAccounts = async () => [{ id: 1, username: 'admin' }];
    adminManagementRepository.listNotifications = async () => [{ id: 1, title: 'Notice' }];
    notificationService.listForUser = async () => ({
      notifications: [{ id: 1, user_id: 1, type: 'system', title: 'Notice', is_read: false }],
      unread_count: 1,
    });

    const kpiRes = await fetch(`${baseUrl}/admin/dashboard/kpi`, {
      headers: { authorization: `Bearer ${superToken}` },
    });
    assert.equal(kpiRes.status, 200);
    assert.equal((await kpiRes.json()).todayRevenue, 5000000);

    const summaryRes = await fetch(`${baseUrl}/admin/reports/summary?from=2026-01-01&to=2026-08-01`, {
      headers: { authorization: `Bearer ${superToken}` },
    });
    assert.equal(summaryRes.status, 200);

    const custRes = await fetch(`${baseUrl}/admin/customers`, {
      headers: { authorization: `Bearer ${superToken}` },
    });
    assert.equal(custRes.status, 200);
    const customers = await custRes.json();
    assert.equal(customers[0].fullname, 'Nguyen Van A');

    const accountsRes = await fetch(`${baseUrl}/admin/settings/accounts`, {
      headers: { authorization: `Bearer ${superToken}` },
    });
    assert.equal(accountsRes.status, 200);

    const notifRes = await fetch(`${baseUrl}/admin/notifications`, {
      headers: { authorization: `Bearer ${superToken}` },
    });
    assert.equal(notifRes.status, 200);
  });

  it('serves public engagement endpoints (jobs, tiers, profile, wishlist)', async () => {
    engagementRepository.listJobs = async () => [{ id: 1, title: 'Barista' }];
    engagementRepository.listTiers = async () => [{ id: 1, name: 'Gold' }];
    engagementRepository.getUserProfile = async (id) => ({ id: Number(id), fullname: 'Nguyen Van A', phone: '0901234567' });
    engagementRepository.listUserWishlist = async () => [{ id: 1, product_id: 2, product_name: 'Tra dao' }];

    const jobsRes = await fetch(`${baseUrl}/api/jobs`);
    assert.equal(jobsRes.status, 200);
    assert.equal((await jobsRes.json())[0].title, 'Barista');

    const tiersRes = await fetch(`${baseUrl}/api/tiers`);
    assert.equal(tiersRes.status, 200);

    const profileRes = await fetch(`${baseUrl}/api/users/10`, {
      headers: { authorization: `Bearer ${user1Token}` },
    });
    assert.equal(profileRes.status, 200);
    const profile = await profileRes.json();
    assert.equal(profile.fullname, 'Nguyen Van A');

    const ownNotificationsRes = await fetch(`${baseUrl}/api/users/10/notifications`, {
      headers: { authorization: `Bearer ${user1Token}` },
    });
    assert.equal(ownNotificationsRes.status, 200);

    const otherCustomerNotificationsRes = await fetch(`${baseUrl}/api/users/11/notifications`, {
      headers: { authorization: `Bearer ${user1Token}` },
    });
    assert.equal(otherCustomerNotificationsRes.status, 403);

    const superReadingCustomerNotificationsRes = await fetch(`${baseUrl}/api/users/10/notifications`, {
      headers: { authorization: `Bearer ${superToken}` },
    });
    assert.equal(superReadingCustomerNotificationsRes.status, 403);

    const wishlistRes = await fetch(`${baseUrl}/api/users/10/wishlist`, {
      headers: { authorization: `Bearer ${user1Token}` },
    });
    assert.equal(wishlistRes.status, 200);
    assert.equal((await wishlistRes.json())[0].product_name, 'Tra dao');
  });
});
