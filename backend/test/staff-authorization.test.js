import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaffService } from '../services/staff/staff-service.js';
import { createEmailService, createFakeTransport } from '../services/email-service.js';

process.env.EMAIL_TOKEN_PEPPER = 'test-only-email-token-pepper';

/**
 * Mock repository for auth challenges (in-memory, for testing)
 */
function createMockChallengeRepo() {
  const challenges = [];
  let nextId = 1;

  return {
    challenges,
    async createChallenge({ userId, email, purpose, secretHash, maxAttempts, ttlMinutes, metadata }) {
      const now = new Date();
      const challenge = {
        id: nextId++,
        user_id: userId || null,
        email,
        purpose,
        secret_hash: secretHash,
        expires_at: new Date(now.getTime() + ttlMinutes * 60 * 1000),
        attempts: 0,
        max_attempts: maxAttempts,
        sent_at: null,
        consumed_at: null,
        revoked_at: null,
        created_at: now,
        metadata: metadata || null,
      };
      challenges.push(challenge);
      return challenge;
    },
    async revokeActiveChallenges({ userId, email, purpose }) {
      let count = 0;
      for (const c of challenges) {
        if (c.purpose === purpose && !c.consumed_at && !c.revoked_at) {
          if ((userId == null || c.user_id === userId) && (!email || c.email === email)) {
            c.revoked_at = new Date();
            count++;
          }
        }
      }
      return count;
    },
    async markSent(id) {
      const c = challenges.find(x => x.id === id);
      if (c) c.sent_at = new Date();
      return c || null;
    },
    async findLatestActive(userId, email, purpose, tx) {
      // Find the latest non-consumed, non-revoked, non-expired, sent challenge
      const now = Date.now();
      const matches = challenges
        .filter(c =>
          c.purpose === purpose &&
          c.email === email &&
          !c.consumed_at &&
          !c.revoked_at &&
          c.sent_at &&
          new Date(c.expires_at).getTime() > now &&
          (userId == null || c.user_id === userId)
        )
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return matches[0] || null;
    },
    async incrementAttempts(id) {
      const c = challenges.find(x => x.id === id);
      if (c) c.attempts += 1;
      return c?.attempts || 0;
    },
    async consume(id) {
      const c = challenges.find(x => x.id === id);
      if (c && !c.consumed_at) {
        c.consumed_at = new Date();
        return true;
      }
      return false;
    },
    async revoke(id) {
      const c = challenges.find(x => x.id === id);
      if (c && !c.revoked_at) {
        c.revoked_at = new Date();
        return true;
      }
      return false;
    },
  };
}

/**
 * Mock users repository
 */
function createMockUsersRepo() {
  const users = [
    { id: 1, fullname: 'Super Admin', email: 'super@teaplus.vn', phone: '0909000001', is_admin: true, admin_role: 'super', admin_branch_id: null, is_active: true, token_version: 0, password_hash: '$2a$12$LJ3m4ys3Lk0TSwHnbfOMiOXPm1QjqK5Vx8qy0J5l0d3v5f9e1a2bC', email_verified_at: null },
    { id: 2, fullname: 'Manager A', email: 'manager@branch1.com', phone: '0909000002', is_admin: true, admin_role: 'manager', admin_branch_id: 1, is_active: true, token_version: 0, password_hash: '$2a$12$LJ3m4ys3Lk0TSwHnbfOMiOXPm1QjqK5Vx8qy0J5l0d3v5f9e1a2bC', email_verified_at: null },
    { id: 3, fullname: 'Cashier B', email: 'cashier@branch1.com', phone: '0909000003', is_admin: true, admin_role: 'cashier', admin_branch_id: 1, is_active: true, token_version: 0, password_hash: '$2a$12$LJ3m4ys3Lk0TSwHnbfOMiOXPm1QjqK5Vx8qy0J5l0d3v5f9e1a2bC', email_verified_at: null },
    { id: 4, fullname: 'Kitchen C', email: 'kitchen@branch2.com', phone: '0909000004', is_admin: true, admin_role: 'kitchen', admin_branch_id: 2, is_active: true, token_version: 0, password_hash: '$2a$12$LJ3m4ys3Lk0TSwHnbfOMiOXPm1QjqK5Vx8qy0J5l0d3v5f9e1a2bC', email_verified_at: null },
    { id: 5, fullname: 'Pending Staff', email: 'pending@branch1.com', phone: '0909000005', is_admin: true, admin_role: 'cashier', admin_branch_id: 1, is_active: false, token_version: 0, password_hash: '', email_verified_at: null },
  ];
  let nextId = 6;

  return {
    users,
    async listStaff(branchId) {
      let result = users.filter(u => u.is_admin);
      if (branchId) result = result.filter(u => u.admin_branch_id === branchId);
      return result.map(u => ({
        id: u.id,
        fullname: u.fullname,
        email: u.email,
        role: u.admin_role,
        branch_id: u.admin_branch_id,
        branch_name: u.admin_branch_id ? `Branch ${u.admin_branch_id}` : 'Toàn hệ thống',
        is_active: u.is_active,
        email_verified_at: u.email_verified_at,
        created_at: u.created_at || new Date().toISOString(),
        token_version: u.token_version,
      }));
    },
    async findAdminById(id) {
      return users.find(u => u.id === id && u.is_admin) || null;
    },
    async findActiveUserByEmail(email) {
      const clean = (email || '').trim().toLowerCase();
      return users.find(u => u.email?.toLowerCase() === clean && u.is_active) || null;
    },
    async findActiveUserById(id) {
      return users.find(u => u.id === id && u.is_active) || null;
    },
    async createStaff({ fullname, email, adminRole, branchId }) {
      const newUser = {
        id: nextId++,
        fullname,
        email: email.trim().toLowerCase(),
        is_admin: true,
        admin_role: adminRole,
        admin_branch_id: branchId || null,
        is_active: false,
        token_version: 0,
        password_hash: '',
        email_verified_at: null,
      };
      users.push(newUser);
      return newUser;
    },
    async updateStaffStatus(userId, isActive) {
      const u = users.find(x => x.id === userId);
      if (u) {
        u.is_active = isActive;
        u.token_version += 1;
      }
      return u;
    },
    async findStaffByEmail(email) {
      const clean = (email || '').trim().toLowerCase();
      return users.find(u => u.email?.toLowerCase() === clean && u.is_admin) || null;
    },
    async findUserByEmail(email) {
      const clean = (email || '').trim().toLowerCase();
      return users.find(u => u.email?.toLowerCase() === clean) || null;
    },
    async updateStaffAccount(userId, { fullname, email, adminRole, branchId }) {
      const u = users.find(x => x.id === Number(userId) && x.is_admin);
      if (!u) return null;
      const emailChanged = u.email !== email;
      u.fullname = fullname;
      u.email = email;
      u.admin_role = adminRole;
      u.admin_branch_id = branchId;
      u.email_verified_at = emailChanged ? null : u.email_verified_at;
      u.token_version += 1;
      return u;
    },
    async incrementTokenVersion(userId) {
      const u = users.find(x => x.id === Number(userId));
      if (u) u.token_version += 1;
      return u || null;
    },
  };
}

test('Staff Service Authorization Suite', async (t) => {
  const fakeTransport = createFakeTransport();
  const emailService = createEmailService({ transport: fakeTransport });
  const mockChallengeRepo = createMockChallengeRepo();
  const mockUsersRepo = createMockUsersRepo();

  // Mock database with a simple transaction
  const mockDb = {
    async query(sqlText, params) {
      // For password_hash check
      if (sqlText.includes('password_hash')) {
        const user = mockUsersRepo.users.find(u => u.id === Number(params[0]));
        if (user) {
          return [[user], 1];
        }
        return [[], 0];
      }
      return [[], 0];
    },
    async transaction(callback) {
      const tx = {
        async query(sqlText, params) {
          if (sqlText.includes('FROM stores')) {
            return [[{ id: params[0] }], 1];
          }
          if (sqlText.includes('FOR UPDATE')) {
            return [[{ id: params[0] }], 1];
          }
          return [[], 0];
        },
      };
      return callback(tx, null);
    },
  };

  const staffService = createStaffService({
    emailService,
    challengeRepo: mockChallengeRepo,
    database: mockDb,
    usersRepo: mockUsersRepo,
    auditLogger: async () => {},
  });

  await t.test('Super can list all staff', async () => {
    const rows = await staffService.listStaff('super', null);
    assert.equal(rows.length, mockUsersRepo.users.filter(u => u.is_admin).length);
  });

  await t.test('Manager can list own branch staff', async () => {
    const rows = await staffService.listStaff('manager', 1);
    assert.ok(rows.every(r => r.branch_id === 1));
  });

  await t.test('createStaff: Manager can create cashier in own branch', async () => {
    const fakeTransport2 = createFakeTransport();
    const emailService2 = createEmailService({ transport: fakeTransport2 });
    const service = createStaffService({
      emailService: emailService2,
      challengeRepo: mockChallengeRepo,
      database: mockDb,
      usersRepo: mockUsersRepo,
      auditLogger: async () => {},
    });
    const user = await service.createStaff({
      actorId: 2,
      actorRole: 'manager',
      actorBranchId: 1,
      fullname: 'New Cashier',
      email: 'newcashier@branch1.com',
      role: 'cashier',
      branchId: 1,
    });
    assert.ok(user);
    assert.equal(user.admin_role, 'cashier');
    assert.equal(user.admin_branch_id, 1);
    assert.equal(user.is_active, false);
  });

  await t.test('createStaff: Manager cannot create manager', async () => {
    await assert.rejects(
      () => staffService.createStaff({
        actorId: 2,
        actorRole: 'manager',
        actorBranchId: 1,
        fullname: 'New Manager',
        email: 'newmanager@branch1.com',
        role: 'manager',
        branchId: 1,
      }),
      /không có quyền tạo tài khoản quản lý/,
    );
  });

  await t.test('createStaff: Super can create manager', async () => {
    const fakeTransport3 = createFakeTransport();
    const emailService3 = createEmailService({ transport: fakeTransport3 });
    const service = createStaffService({
      emailService: emailService3,
      challengeRepo: mockChallengeRepo,
      database: mockDb,
      usersRepo: mockUsersRepo,
      auditLogger: async () => {},
    });
    const user = await service.createStaff({
      actorId: 1,
      actorRole: 'super',
      actorBranchId: null,
      fullname: 'New Manager',
      email: 'newmanager2@branch1.com',
      role: 'manager',
      branchId: 1,
    });
    assert.ok(user);
    assert.equal(user.admin_role, 'manager');
  });

  await t.test('setStaffStatus: Manager can disable own-branch cashier', async () => {
    const result = await staffService.setStaffStatus({
      actorId: 2,
      actorRole: 'manager',
      actorBranchId: 1,
      targetUserId: 3, // Cashier B in branch 1
      isActive: false,
    });
    assert.ok(result);
    assert.equal(result.is_active, false);
  });

  await t.test('setStaffStatus: Manager cannot disable manager', async () => {
    // Add a test manager in branch 1
    mockUsersRepo.users.push({
      id: 99,
      fullname: 'Manager B',
      email: 'manager99@branch1.com',
      phone: '0909000099',
      is_admin: true,
      admin_role: 'manager',
      admin_branch_id: 1,
      is_active: true,
      token_version: 0,
      password_hash: '$2a$12$LJ3m4ys3Lk0TSwHnbfOMiOXPm1QjqK5Vx8qy0J5l0d3v5f9e1a2bC',
      email_verified_at: null,
    });
    await assert.rejects(
      () => staffService.setStaffStatus({
        actorId: 2,
        actorRole: 'manager',
        actorBranchId: 1,
        targetUserId: 99, // Manager B in branch 1
        isActive: false,
      }),
      /không có quyền vô hiệu hóa quản lý/,
    );
  });

  await t.test('setStaffStatus: Manager cannot self-disable', async () => {
    await assert.rejects(
      () => staffService.setStaffStatus({
        actorId: 2,
        actorRole: 'manager',
        actorBranchId: 1,
        targetUserId: 2,
        isActive: false,
      }),
      /không thể tự vô hiệu hóa/,
    );
  });

  await t.test('setStaffStatus: Manager cannot disable cross-branch staff', async () => {
    await assert.rejects(
      () => staffService.setStaffStatus({
        actorId: 2,
        actorRole: 'manager',
        actorBranchId: 1,
        targetUserId: 4, // Kitchen C in branch 2
        isActive: false,
      }),
      /chi nhánh khác/,
    );
  });

  await t.test('resendInvitation: Manager can resend to own branch', async () => {
    const result = await staffService.resendInvitation({
      actorId: 2,
      actorRole: 'manager',
      actorBranchId: 1,
      targetUserId: 5, // Pending Staff in branch 1
    });
    assert.ok(result.success);
  });

  await t.test('resendInvitation: Manager cannot resend to other branch', async () => {
    await assert.rejects(
      () => staffService.resendInvitation({
        actorId: 2,
        actorRole: 'manager',
        actorBranchId: 1,
        targetUserId: 4, // Kitchen C in branch 2
      }),
      /chi nhánh khác/,
    );
  });

  await t.test('Super can change staff name, email, role and branch while invalidating their session', async () => {
    const beforeVersion = mockUsersRepo.users.find((user) => user.id === 3).token_version;
    const updated = await staffService.updateStaffBySuper({
      actorId: 1,
      actorRole: 'super',
      targetUserId: 3,
      fullname: 'nguyễn văn a',
      email: 'cashier-new@branch2.com',
      role: 'packing',
      branchId: 2,
    });
    assert.equal(updated.fullname, 'Nguyễn Văn A');
    assert.equal(updated.email, 'cashier-new@branch2.com');
    assert.equal(updated.admin_role, 'packing');
    assert.equal(updated.admin_branch_id, 2);
    assert.equal(updated.emailChanged, true);
    assert.equal(mockUsersRepo.users.find((user) => user.id === 3).token_version, beforeVersion + 1);
  });

  await t.test('Manager cannot use Super account edit or password reset operations', async () => {
    await assert.rejects(
      () => staffService.updateStaffBySuper({
        actorId: 2, actorRole: 'manager', targetUserId: 3,
        fullname: 'Cashier B', email: 'cashier@branch1.com', role: 'cashier', branchId: 1,
      }),
      /Chỉ Super Admin/,
    );
    await assert.rejects(
      () => staffService.sendSuperPasswordReset({ actorId: 2, actorRole: 'manager', targetUserId: 3 }),
      /Chỉ Super Admin/,
    );
  });

  await t.test('Super cannot change a Super Admin role or branch', async () => {
    await assert.rejects(
      () => staffService.updateStaffBySuper({
        actorId: 1, actorRole: 'super', targetUserId: 1,
        fullname: 'Super Admin', email: 'super@teaplus.vn', role: 'manager', branchId: 1,
      }),
      /Không được thay đổi vai trò hoặc chi nhánh/,
    );
  });

  await t.test('Super password reset invalidates active staff sessions and sends no secret in the response', async () => {
    const beforeVersion = mockUsersRepo.users.find((user) => user.id === 2).token_version;
    const result = await staffService.sendSuperPasswordReset({ actorId: 1, actorRole: 'super', targetUserId: 2 });
    assert.deepEqual(result, { success: true });
    assert.equal(mockUsersRepo.users.find((user) => user.id === 2).token_version, beforeVersion + 1);
    assert.ok(fakeTransport.sentEmails.some((message) => message.to === 'manager@branch1.com'));
  });

  await t.test('forgotPasswordSendOtp: returns generic success for non-existing email', async () => {
    const result = await staffService.forgotPasswordSendOtp('nonexistent@test.com');
    assert.ok(result.success);
    assert.ok(result.message.includes('Nếu email'));
  });

  await t.test('forgotPasswordSendOtp: returns success for existing email', async () => {
    const result = await staffService.forgotPasswordSendOtp('super@teaplus.vn');
    assert.ok(result.success);
  });
});
