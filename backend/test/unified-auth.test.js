import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import { JWT_SECRET } from '../config/env.js';
import usersRepository from '../repositories/postgres/users.js';

describe('Unified Customer & Admin Auth Suite', () => {
  let server;
  let baseUrl;
  let originalFindActiveUserByPhone;

  before(async () => {
    const passwordHash = await bcrypt.hash('admin123', 10);
    originalFindActiveUserByPhone = usersRepository.findActiveUserByPhone;

    usersRepository.findActiveUserByPhone = async (phone) => {
      if (phone === '0909000001') {
        return {
          id: 1,
          fullname: 'Super Admin',
          phone: '0909000001',
          email: 'admin@teaplus.vn',
          password_hash: passwordHash,
          tier: 'Kim Cương',
          points: 1000,
          is_admin: true,
          admin_role: 'super',
          admin_branch_id: null,
          is_active: true,
          token_version: 0,
        };
      }
      if (phone === '0901234567') {
        return {
          id: 2,
          fullname: 'Khách Hàng Thân Thiết',
          phone: '0901234567',
          email: 'customer@gmail.com',
          password_hash: passwordHash,
          tier: 'Vàng',
          points: 250,
          is_admin: false,
          admin_role: null,
          admin_branch_id: null,
          is_active: true,
          token_version: 0,
        };
      }
      return null;
    };

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    usersRepository.findActiveUserByPhone = originalFindActiveUserByPhone;
    await new Promise((resolve) => server.close(resolve));
  });

  it('allows Admin to log in via public /api/auth/login and receives token with admin claims', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0909000001', password: 'admin123' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.user.is_admin, true);
    assert.equal(body.user.admin_role, 'super');
    assert.equal(body.user.fullname, 'Super Admin');

    const decoded = jwt.verify(body.token, JWT_SECRET);
    assert.equal(decoded.sub, 1);
    assert.equal(decoded.role, 'super');
  });

  it('allows Customer to log in via public /api/auth/login and receives customer token', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0901234567', password: 'admin123' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.user.is_admin, false);
    assert.equal(body.user.fullname, 'Khách Hàng Thân Thiết');

    const decoded = jwt.verify(body.token, JWT_SECRET);
    assert.equal(decoded.sub, 2);
    assert.equal(decoded.role, 'customer');
  });

  it('rejects wrong password with 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0909000001', password: 'sai-mat-khau' }),
    });

    assert.equal(res.status, 401);
  });
});
