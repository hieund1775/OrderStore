import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import { JWT_SECRET } from '../config/env.js';
import adminReportsRepository from '../repositories/postgres/admin-reports.js';
import adminManagementRepository from '../repositories/postgres/admin-management.js';
import adminCatalogRepository from '../repositories/postgres/admin-catalog.js';
import engagementRepository from '../repositories/postgres/engagement.js';
import notificationService from '../services/notifications/notification-service.js';

const superToken = jwt.sign({ sub: 1, role: 'super' }, JWT_SECRET);
const managerToken = jwt.sign({ sub: 2, role: 'manager', branch_id: 1 }, JWT_SECRET);
const user1Token = jwt.sign({ sub: 10, id: 10, role: 'customer' }, JWT_SECRET);
const user2Token = jwt.sign({ sub: 11, id: 11, role: 'customer' }, JWT_SECRET);

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
      setProductAvailability: adminCatalogRepository.setProductAvailability,
      listJobs: engagementRepository.listJobs,
      listTiers: engagementRepository.listTiers,
      getUserProfile: engagementRepository.getUserProfile,
      listUserWishlist: engagementRepository.listUserWishlist,
      ensureUserWishlistItem: engagementRepository.ensureUserWishlistItem,
      removeUserWishlistItem: engagementRepository.removeUserWishlistItem,
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
      ensureUserWishlistItem: originals.ensureUserWishlistItem,
      removeUserWishlistItem: originals.removeUserWishlistItem,
    });
    adminCatalogRepository.setProductAvailability = originals.setProductAvailability;
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
    adminCatalogRepository.setProductAvailability = async (id, desiredState) => ({
      id: Number(id),
      is_available: desiredState,
      changed: true,
      removed_wishlist_count: desiredState ? 0 : 2,
      notification_count: desiredState ? 0 : 2,
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

    const managerAvailabilityRes = await fetch(`${baseUrl}/admin/menu/products/1/availability`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${managerToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ is_available: false }),
    });
    assert.equal(managerAvailabilityRes.status, 403);

    const invalidAvailabilityRes = await fetch(`${baseUrl}/admin/menu/products/1/availability`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${superToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ is_available: 0 }),
    });
    assert.equal(invalidAvailabilityRes.status, 400);

    const availabilityRes = await fetch(`${baseUrl}/admin/menu/products/1/availability`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${superToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ is_available: false }),
    });
    assert.equal(availabilityRes.status, 200);
    assert.deepEqual(await availabilityRes.json(), {
      id: 1,
      is_available: false,
      changed: true,
      removed_wishlist_count: 2,
      notification_count: 2,
      message: 'Món đã tạm ngưng phục vụ',
    });

    const removedToggleRoute = await fetch(`${baseUrl}/admin/menu/products/1/toggle`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${superToken}`, 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(removedToggleRoute.status, 404);
  });

  it('serves public engagement endpoints (jobs, tiers, profile, wishlist)', async () => {
    engagementRepository.listJobs = async () => [{ id: 1, title: 'Barista' }];
    engagementRepository.listTiers = async () => [{ id: 1, name: 'Gold' }];
    engagementRepository.getUserProfile = async (id) => ({ id: Number(id), fullname: 'Nguyen Van A', phone: '0901234567' });
    engagementRepository.listUserWishlist = async (id) => [{
      id: 1,
      user_id: Number(id),
      product_id: 2,
      product_name: 'Tra dao',
      product_slug: 'tra-dao',
      base_tea: 'Tra den',
      price: 45000,
      image_url: null,
      created_at: '2026-08-24T00:00:00.000Z',
    }];
    engagementRepository.ensureUserWishlistItem = async (id, productId) => ({
      created: true,
      item: {
        id: 2,
        user_id: Number(id),
        product_id: Number(productId),
        product_name: 'Tra dao',
        product_slug: 'tra-dao',
        base_tea: 'Tra den',
        price: 45000,
        image_url: null,
        created_at: '2026-08-24T00:00:00.000Z',
      },
    });
    engagementRepository.removeUserWishlistItem = async () => ({ removed: true });

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

    const wishlistWithoutToken = await fetch(`${baseUrl}/api/users/10/wishlist`);
    assert.equal(wishlistWithoutToken.status, 401);

    const otherCustomerWishlist = await fetch(`${baseUrl}/api/users/10/wishlist`, {
      headers: { authorization: `Bearer ${user2Token}` },
    });
    assert.equal(otherCustomerWishlist.status, 403);

    const superWishlist = await fetch(`${baseUrl}/api/users/10/wishlist`, {
      headers: { authorization: `Bearer ${superToken}` },
    });
    assert.equal(superWishlist.status, 403);

    const invalidWishlistOwner = await fetch(`${baseUrl}/api/users/not-a-number/wishlist`, {
      headers: { authorization: `Bearer ${user1Token}` },
    });
    assert.equal(invalidWishlistOwner.status, 400);

    const invalidWishlistProduct = await fetch(`${baseUrl}/api/users/10/wishlist/not-a-number`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${user1Token}` },
    });
    assert.equal(invalidWishlistProduct.status, 400);

    const addWishlist = await fetch(`${baseUrl}/api/users/10/wishlist/2`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${user1Token}` },
    });
    assert.equal(addWishlist.status, 201);
    const addWishlistBody = await addWishlist.json();
    assert.equal(addWishlistBody.present, true);
    assert.equal(addWishlistBody.created, true);
    assert.equal(addWishlistBody.item.base_tea, 'Tra den');

    const removeWishlist = await fetch(`${baseUrl}/api/users/10/wishlist/2`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${user1Token}` },
    });
    assert.equal(removeWishlist.status, 200);
    assert.deepEqual(await removeWishlist.json(), {
      present: false,
      removed: true,
      message: 'Đã xóa khỏi danh sách yêu thích',
    });
  });
});
