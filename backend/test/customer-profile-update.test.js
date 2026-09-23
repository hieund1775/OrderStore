import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import { JWT_SECRET } from '../config/env.js';
import usersRepository from '../repositories/postgres/users.js';

describe('Customer Profile Update Route Suite', () => {
  let server;
  let baseUrl;
  let originalUpdateCustomerProfile;

  const customerToken = jwt.sign({ id: 10, sub: 10, role: 'customer', phone: '0901234567', token_version: 0 }, JWT_SECRET);
  const otherCustomerToken = jwt.sign({ id: 11, sub: 11, role: 'customer', phone: '0909876543', token_version: 0 }, JWT_SECRET);

  let originalFindActiveUserById;

  before(async () => {
    originalFindActiveUserById = usersRepository.findActiveUserById;
    usersRepository.findActiveUserById = async (id) => ({
      id: Number(id),
      fullname: 'Khách Test',
      phone: '0901234567',
      is_active: true,
      token_version: 0,
      is_admin: false,
    });

    originalUpdateCustomerProfile = usersRepository.updateCustomerProfile;
    usersRepository.updateCustomerProfile = async (userId, { fullname }) => {
      if (userId === 9999) return null;
      return {
        id: userId,
        fullname,
        phone: '0901234567',
        email: 'customer@example.com',
        tier: 'Đồng',
        points: 150,
        is_active: true,
        token_version: 0,
        is_admin: false,
        admin_role: null,
        admin_branch_id: null,
        email_verified_at: null,
      };
    };

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    usersRepository.findActiveUserById = originalFindActiveUserById;
    usersRepository.updateCustomerProfile = originalUpdateCustomerProfile;
    await new Promise((resolve) => server.close(resolve));
  });

  it('rejects unauthenticated request with 401', async () => {
    const res = await fetch(`${baseUrl}/api/users/10`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullname: 'Nguyễn Văn An' }),
    });
    assert.equal(res.status, 401);
  });

  it('rejects cross-customer update with 403', async () => {
    const res = await fetch(`${baseUrl}/api/users/10`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${otherCustomerToken}`,
      },
      body: JSON.stringify({ fullname: 'Nguyễn Văn An' }),
    });
    assert.equal(res.status, 403);
  });

  it('rejects invalid names with 400 (empty or single word)', async () => {
    const emptyRes = await fetch(`${baseUrl}/api/users/10`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ fullname: '   ' }),
    });
    assert.equal(emptyRes.status, 400);

    const singleWordRes = await fetch(`${baseUrl}/api/users/10`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ fullname: 'An' }),
    });
    assert.equal(singleWordRes.status, 400);
  });

  it('updates customer profile successfully and normalizes name', async () => {
    const res = await fetch(`${baseUrl}/api/users/10`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ fullname: 'nguyễn văn an' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.user.fullname, 'Nguyễn Văn An');
    assert.equal(body.user.id, 10);
  });

  it('supports PATCH /api/auth/profile route as well', async () => {
    const res = await fetch(`${baseUrl}/api/auth/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ fullname: 'Trần Thị Bình' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.user.fullname, 'Trần Thị Bình');
  });
});
