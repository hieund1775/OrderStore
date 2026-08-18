import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import { JWT_SECRET } from '../config/env.js';
import postgresDb from '../config/db-postgres.js';
import adminOrdersRepository from '../repositories/postgres/admin-orders.js';
import ordersRepository from '../repositories/postgres/orders.js';
import paymentsRepository from '../repositories/postgres/payments.js';
import { setPayOSForTest } from '../services/payos.js';

const order = {
  id: 11, order_code: 'TP-11', store_id: 1, user_id: 7, order_type: 'Take-away',
  payment_method: 'COD', payment_status: 'unpaid', payment_provider: 'cod', customer_name: 'Nguyen Van A',
  customer_phone: '0901234567', delivery_addr: '1 Test Street', subtotal: 50000, discount_amount: 0,
  total: 50000, store_name: 'Store One', current_status: 'Đang chuẩn bị', created_at: new Date('2026-08-17T10:00:00Z'),
};

function token(role, claims = {}) {
  return jwt.sign({ sub: claims.sub || 1, username: role, role, ...claims }, JWT_SECRET);
}

function error(message, status) {
  const result = new Error(message);
  result.status = status;
  return result;
}

describe('Phase 3 slice 1 Orders/KDS HTTP characterization', () => {
  let server;
  let baseUrl;
  let calls;
  let originals;
  let payosEnv;

  before(async () => {
    calls = { admin: [], public: [], payment: [] };
    originals = {
      admin: Object.fromEntries(['list', 'detail', 'transition', 'cancel', 'confirmPayment', 'markPrinted', 'listKitchen'].map((name) => [name, adminOrdersRepository[name]])),
      orders: Object.fromEntries(['findPublicOrder', 'loadPublicDetails', 'loadStatusHistory', 'cancelCustomerOrder', 'listCustomerOrders', 'createPublicOrder'].map((name) => [name, ordersRepository[name]])),
      payments: Object.fromEntries(['reservePayOSOrder', 'attachPaymentLink'].map((name) => [name, paymentsRepository[name]])),
    };
    payosEnv = {
      clientId: process.env.PAYOS_CLIENT_ID, apiKey: process.env.PAYOS_API_KEY, checksum: process.env.PAYOS_CHECKSUM_KEY,
    };
    postgresDb.setMockAdapter({
      async query(sql) {
        if (sql.includes('audit_logs')) return [[], 1];
        if (sql.includes('FROM order_items')) return [[{ id: 101, order_id: 11, product_name: 'Milk tea', qty: 1, size_label: 'M', unit_price: 50000, line_total: 50000 }], 1];
        if (sql.includes('FROM order_item_toppings')) return [[], 0];
        return [[], 0];
      },
    });
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    Object.assign(adminOrdersRepository, originals.admin);
    Object.assign(ordersRepository, originals.orders);
    Object.assign(paymentsRepository, originals.payments);
    postgresDb.resetMockAdapter();
    setPayOSForTest();
    for (const [name, value] of Object.entries(payosEnv)) {
      const envName = name === 'clientId' ? 'PAYOS_CLIENT_ID' : name === 'apiKey' ? 'PAYOS_API_KEY' : 'PAYOS_CHECKSUM_KEY';
      if (value === undefined) delete process.env[envName]; else process.env[envName] = value;
    }
    await new Promise((resolve) => server.close(resolve));
  });

  before(() => {
    calls.admin.length = 0;
    calls.public.length = 0;
    calls.payment.length = 0;
    adminOrdersRepository.list = async (args) => {
      calls.admin.push({ name: 'list', args });
      return [{ ...order, id: 12, created_at: new Date('2026-08-17T11:00:00Z') }, order];
    };
    adminOrdersRepository.detail = async ({ orderId, scopedStoreId }) => {
      calls.admin.push({ name: 'detail', orderId, scopedStoreId });
      return Number(orderId) === 11 && (!scopedStoreId || scopedStoreId === 1) ? { ...order, items: [], status_history: [] } : null;
    };
    adminOrdersRepository.transition = async (args) => {
      calls.admin.push({ name: 'transition', args });
      if (args.targetStatus === 'Đã hủy') return { order_id: Number(args.orderId), status: args.targetStatus, idempotent: true };
      return { order_id: Number(args.orderId), status: args.targetStatus };
    };
    adminOrdersRepository.cancel = async (args) => {
      calls.admin.push({ name: 'cancel', args });
      if (args.actorRole === 'cashier' && Number(args.orderId) === 11) throw error('Đơn hàng đã thanh toán, chỉ Quản lý hoặc Super Admin mới có quyền hủy đơn', 403);
      return { order_id: Number(args.orderId), status: 'Đã hủy', already_cancelled: true };
    };
    adminOrdersRepository.confirmPayment = async (args) => {
      calls.admin.push({ name: 'confirmPayment', args });
      if (Number(args.orderId) === 99) throw error('Không tìm thấy đơn hàng hoặc không có quyền thao tác', 404);
      return { alreadyPaid: Number(args.orderId) === 12 };
    };
    adminOrdersRepository.markPrinted = async ({ orderId, scopedStoreId }) => {
      calls.admin.push({ name: 'markPrinted', orderId, scopedStoreId });
      return Number(orderId) === 11;
    };
    adminOrdersRepository.listKitchen = async ({ scopedStoreId }) => {
      calls.admin.push({ name: 'listKitchen', scopedStoreId });
      return [{ ...order, payment_status: 'paid', items: [{ product_name: 'Milk tea', toppings: [] }] }];
    };
    ordersRepository.findPublicOrder = async (code) => (code === 'TP-11' ? { ...order } : null);
    ordersRepository.loadPublicDetails = async () => [{ product_name: 'Milk tea', qty: 1, size_label: 'M', toppings: [] }];
    ordersRepository.loadStatusHistory = async () => [{ status: 'Đang chuẩn bị', note: null, created_at: order.created_at }];
    ordersRepository.cancelCustomerOrder = async (args) => {
      calls.public.push({ name: 'cancel', args });
      if (args.identifier === 'forbidden') throw error('Bạn không có quyền hủy đơn hàng này', 403);
      return { order_id: 11, order_code: 'TP-11', status: 'Đã hủy', already_cancelled: args.identifier === '11' };
    };
    ordersRepository.listCustomerOrders = async ({ userId }) => {
      calls.public.push({ name: 'history', userId });
      return [{ ...order, id: 13, user_id: Number(userId) }];
    };
    ordersRepository.createPublicOrder = async (args) => {
      calls.public.push({ name: 'create', args });
      return { replay: args.idempotencyKey === 'replay-key', id: 77, order_code: 'TP-77', subtotal: 50000, discount_amount: 0, total: 50000, payment_status: 'unpaid', payment_provider: args.paymentProvider };
    };
    paymentsRepository.reservePayOSOrder = async (args) => {
      calls.payment.push({ name: 'reserve', args });
      return { id: args.orderId, order_code: 'TP-77', total: 50000, payos_order_code: 900077, payment_expires_at: new Date('2026-08-18T10:00:00Z') };
    };
    paymentsRepository.attachPaymentLink = async (args) => {
      calls.payment.push({ name: 'attach', args });
      return { payment_link_id: args.paymentLinkId, payos_order_code: args.payosOrderCode, payment_expires_at: args.paymentExpiresAt };
    };
  });

  it('locks admin list legacy/cursor modes plus detail and branch isolation', async () => {
    const superToken = token('super');
    const managerToken = token('manager', { branch_id: 1 });
    const legacy = await fetch(`${baseUrl}/admin/orders`, { headers: { authorization: `Bearer ${superToken}` } });
    assert.equal(legacy.status, 200);
    assert.equal(Array.isArray(await legacy.json()), true);
    const cursor = await fetch(`${baseUrl}/admin/orders?limit=1`, { headers: { authorization: `Bearer ${superToken}` } });
    const cursorBody = await cursor.json();
    assert.equal(cursor.status, 200);
    assert.equal(cursorBody.orders.length, 1);
    assert.equal(typeof cursorBody.page_info.has_more, 'boolean');
    const detail = await fetch(`${baseUrl}/admin/orders/11`, { headers: { authorization: `Bearer ${managerToken}` } });
    assert.equal(detail.status, 200);
    assert.equal((await detail.json()).order_code, 'TP-11');
    const missing = await fetch(`${baseUrl}/admin/orders/22`, { headers: { authorization: `Bearer ${managerToken}` } });
    assert.equal(missing.status, 404);
    assert.equal(calls.admin.find((call) => call.name === 'detail').scopedStoreId, 1);
  });

  it('locks admin status, cancel, payment and KDS role/scope contracts', async () => {
    const managerToken = token('manager', { branch_id: 1 });
    const kitchenToken = token('kitchen', { branch_id: 1 });
    const cashierToken = token('cashier', { branch_id: 1 });
    const status = await fetch(`${baseUrl}/admin/orders/11/status`, { method: 'PATCH', headers: { authorization: `Bearer ${managerToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ status: 'Đang giao' }) });
    assert.equal(status.status, 200);
    assert.equal((await status.json()).status, 'Đang giao');
    const invalid = await fetch(`${baseUrl}/admin/orders/11/status`, { method: 'PUT', headers: { authorization: `Bearer ${managerToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ status: 'unknown' }) });
    assert.equal(invalid.status, 400);
    const kitchenCancel = await fetch(`${baseUrl}/admin/orders/11/cancel`, { method: 'PUT', headers: { authorization: `Bearer ${kitchenToken}`, 'content-type': 'application/json' }, body: '{}' });
    assert.equal(kitchenCancel.status, 403);
    const cashierCancel = await fetch(`${baseUrl}/admin/orders/11/cancel`, { method: 'PUT', headers: { authorization: `Bearer ${cashierToken}`, 'content-type': 'application/json' }, body: '{}' });
    assert.equal(cashierCancel.status, 403);
    const managerCancel = await fetch(`${baseUrl}/admin/orders/11/cancel`, { method: 'PUT', headers: { authorization: `Bearer ${managerToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'out of stock' }) });
    assert.equal(managerCancel.status, 200);
    assert.equal((await managerCancel.json()).already_cancelled, true);
    const cashierUnpaidCancel = await fetch(`${baseUrl}/admin/orders/12/cancel`, { method: 'PUT', headers: { authorization: `Bearer ${cashierToken}`, 'content-type': 'application/json' }, body: '{}' });
    assert.equal(cashierUnpaidCancel.status, 200);
    const payment = await fetch(`${baseUrl}/admin/orders/12/payment/confirm`, { method: 'PUT', headers: { authorization: `Bearer ${managerToken}` } });
    assert.equal(payment.status, 200);
    assert.match((await payment.json()).message, /trước đó/i);
    const printed = await fetch(`${baseUrl}/admin/orders/11/print`, { method: 'POST', headers: { authorization: `Bearer ${managerToken}` } });
    assert.equal(printed.status, 200);
    assert.match((await printed.json()).message, /đánh dấu in/i);
    const kds = await fetch(`${baseUrl}/admin/kitchen/orders`, { headers: { authorization: `Bearer ${kitchenToken}` } });
    assert.equal(kds.status, 200);
    assert.equal((await kds.json())[0].payment_status, 'paid');
    assert.equal(calls.admin.find((call) => call.name === 'listKitchen').scopedStoreId, 1);
    assert.equal(calls.admin.find((call) => call.name === 'markPrinted').scopedStoreId, 1);
  });

  it('locks public lookup masking, customer ownership, cancel routes and history modes', async () => {
    const guest = await fetch(`${baseUrl}/api/orders/lookup?code=TP-11`);
    assert.equal(guest.status, 200);
    assert.match((await guest.json()).order.customer_phone, /\*\*\*/);
    const customerToken = token('customer', { sub: 7, id: 7 });
    const owner = await fetch(`${baseUrl}/api/orders/lookup?code=TP-11`, { headers: { authorization: `Bearer ${customerToken}` } });
    assert.equal((await owner.json()).order.customer_phone, '0901234567');
    const tokenCancel = await fetch(`${baseUrl}/api/orders/TP-11/cancel`, { method: 'POST', headers: { 'x-cancel-token': 'guest-token', 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'changed mind' }) });
    assert.equal(tokenCancel.status, 200);
    const bodyCancel = await fetch(`${baseUrl}/api/orders/cancel`, { method: 'POST', headers: { authorization: `Bearer ${customerToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ order_id: '11' }) });
    assert.equal(bodyCancel.status, 200);
    const legacyHistory = await fetch(`${baseUrl}/api/users/7/orders`, { headers: { authorization: `Bearer ${customerToken}` } });
    assert.equal(Array.isArray(await legacyHistory.json()), true);
    const cursorHistory = await fetch(`${baseUrl}/api/users/7/orders?limit=1`, { headers: { authorization: `Bearer ${customerToken}` } });
    assert.equal((await cursorHistory.json()).orders.length, 1);
  });

  it('locks public create validation, idempotency and PayOS provider mapping', async () => {
    const customerToken = token('customer', { sub: 7, id: 7 });
    const required = { source: 'online', payment_method: 'COD', store_id: 1, customer_name: 'Customer', customer_phone: '0901234567', items: [{ product_id: 1, qty: 1, price: 1 }] };
    const missingDelivery = await fetch(`${baseUrl}/api/orders`, { method: 'POST', headers: { authorization: `Bearer ${customerToken}`, 'content-type': 'application/json', 'idempotency-key': 'delivery-key' }, body: JSON.stringify({ ...required, order_type: 'Delivery' }) });
    assert.equal(missingDelivery.status, 400);
    const pos = await fetch(`${baseUrl}/api/orders`, { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'pos-key' }, body: JSON.stringify({ ...required, source: 'pos' }) });
    assert.equal(pos.status, 201);
    assert.equal(calls.public.find((call) => call.name === 'create').args.paymentProvider, 'cod');
    const replay = await fetch(`${baseUrl}/api/orders`, { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'replay-key' }, body: JSON.stringify({ ...required, source: 'pos' }) });
    assert.equal(replay.status, 200);
    const unconfigured = await fetch(`${baseUrl}/api/orders`, { method: 'POST', headers: { authorization: `Bearer ${customerToken}`, 'content-type': 'application/json', 'idempotency-key': 'payos-off' }, body: JSON.stringify({ ...required, payment_method: 'VietQR' }) });
    assert.equal(unconfigured.status, 400);
    process.env.PAYOS_CLIENT_ID = 'test-client'; process.env.PAYOS_API_KEY = 'test-key'; process.env.PAYOS_CHECKSUM_KEY = 'test-checksum';
    setPayOSForTest({ paymentRequests: { create: async () => ({ checkoutUrl: 'https://payos.test/checkout', qrCode: 'qr-77', paymentLinkId: 'link-77' }) } });
    const configured = await fetch(`${baseUrl}/api/orders`, { method: 'POST', headers: { authorization: `Bearer ${customerToken}`, 'content-type': 'application/json', 'idempotency-key': 'payos-on' }, body: JSON.stringify({ ...required, payment_method: 'VietQR' }) });
    const configuredBody = await configured.json();
    assert.equal(configured.status, 201);
    assert.equal(configuredBody.payment_provider, 'payos');
    assert.equal(configuredBody.checkout_url, 'https://payos.test/checkout');
  });
});
