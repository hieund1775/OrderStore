import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import bcrypt from 'bcryptjs';
import authRouter from '../routes/auth.js';
import postgresDb from '../config/db-postgres.js';
import usersRepository from '../repositories/postgres/users.js';

test('admin auth returns the assigned branch name with the PostgreSQL adapter tuple contract', async (t) => {
  const passwordHash = await bcrypt.hash('admin123', 4);
  const manager = {
    id: 22,
    fullname: 'QA Manager A',
    phone: '0999000002',
    email: 'manager@example.test',
    password_hash: passwordHash,
    is_admin: true,
    is_active: true,
    admin_role: 'manager',
    admin_branch_id: 2,
    token_version: 0,
    email_verified_at: null,
  };

  const originalFindActiveAdminByPhone = usersRepository.findActiveAdminByPhone;
  const originalFindActiveUserById = usersRepository.findActiveUserById;
  usersRepository.findActiveAdminByPhone = async (phone) => phone === manager.phone ? manager : null;
  usersRepository.findActiveUserById = async (id) => Number(id) === manager.id ? manager : null;
  postgresDb.setMockAdapter({
    async query(sql, params) {
      if (sql.includes('SELECT name FROM stores WHERE id = $1')) {
        assert.deepEqual(params, [manager.admin_branch_id]);
        return [[{ name: 'TeaPlus Bình Thạnh - D2' }], 1];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  });

  const app = express();
  app.use(express.json());
  app.use('/admin', authRouter);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    usersRepository.findActiveAdminByPhone = originalFindActiveAdminByPhone;
    usersRepository.findActiveUserById = originalFindActiveUserById;
    postgresDb.resetMockAdapter();
    await new Promise((resolve) => server.close(resolve));
  });

  const loginResponse = await fetch(`${baseUrl}/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: manager.phone, password: 'admin123' }),
  });
  assert.equal(loginResponse.status, 200);
  const loginBody = await loginResponse.json();
  assert.equal(loginBody.user.branch_id, manager.admin_branch_id);
  assert.equal(loginBody.user.branch_name, 'TeaPlus Bình Thạnh - D2');

  const meResponse = await fetch(`${baseUrl}/admin/me`, {
    headers: { authorization: `Bearer ${loginBody.token}` },
  });
  assert.equal(meResponse.status, 200);
  const meBody = await meResponse.json();
  assert.equal(meBody.branch_id, manager.admin_branch_id);
  assert.equal(meBody.branch_name, 'TeaPlus Bình Thạnh - D2');
});
