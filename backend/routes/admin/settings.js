import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { toAccountDto, toAuditLogDto } from '../../dto/customer-dto.js';
import { createStaffService } from '../../services/staff/staff-service.js';
import { usersRepository } from '../../repositories/postgres/users.js';
import { adminManagementRepository } from '../../repositories/postgres/admin-management.js';

const router = Router();
const staffService = createStaffService();

/**
 * GET /admin/settings/accounts
 * Super: all staff accounts. Manager: own branch only.
 */
router.get('/accounts', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const actorRole = req.user.role;
    const actorBranchId = req.user.branch_id ?? null;
    const rows = await staffService.listStaff(actorRole, actorBranchId);
    res.json(rows.map((r) => ({
      id: r.id,
      fullname: r.fullname,
      email: r.email,
      role: r.role,
      branch: r.branch_name,
      branch_id: r.branch_id,
      active: r.is_active,
      email_verified_at: r.email_verified_at,
      created_at: r.created_at,
    })));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

/**
 * POST /admin/settings/accounts
 * Create a new staff account and send invitation
 */
router.post('/accounts', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const { fullname, email, role, branch_id } = req.body || {};
    const actorId = req.user.sub;
    const actorRole = req.user.role;
    const actorBranchId = req.user.branch_id ?? null;

    const user = await staffService.createStaff({
      actorId,
      actorRole,
      actorBranchId,
      fullname,
      email,
      role,
      branchId: branch_id || actorBranchId,
    });

    res.status(201).json({
      id: user.id,
      fullname: user.fullname,
      email: user.email,
      role: user.admin_role,
      branch_id: user.admin_branch_id,
      message: 'Tài khoản đã được tạo. Email mời đã được gửi.',
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

/**
 * POST /admin/settings/accounts/:id/resend-invitation
 * Resend invitation to a pending staff account
 */
router.post('/accounts/:id/resend-invitation', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const targetUserId = Number(req.params.id);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: 'ID tài khoản không hợp lệ' });
    }

    const actorId = req.user.sub;
    const actorRole = req.user.role;
    const actorBranchId = req.user.branch_id ?? null;

    const result = await staffService.resendInvitation({
      actorId,
      actorRole,
      actorBranchId,
      targetUserId,
    });

    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

/**
 * PATCH /admin/settings/accounts/:id/status
 * Enable or disable a staff account
 */
router.patch('/accounts/:id/status', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const targetUserId = Number(req.params.id);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: 'ID tài khoản không hợp lệ' });
    }

    const { is_active } = req.body || {};
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'Vui lòng cung cấp trạng thái (is_active)' });
    }

    const actorId = req.user.sub;
    const actorRole = req.user.role;
    const actorBranchId = req.user.branch_id ?? null;

    const updated = await staffService.setStaffStatus({
      actorId,
      actorRole,
      actorBranchId,
      targetUserId,
      isActive: is_active,
    });

    res.json({
      id: updated.id,
      fullname: updated.fullname,
      email: updated.email,
      role: updated.admin_role,
      is_active: updated.is_active,
      message: is_active ? 'Tài khoản đã được kích hoạt' : 'Tài khoản đã bị vô hiệu hóa',
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

/**
 * GET /admin/settings/audit-logs
 * View audit logs
 */
router.get('/audit-logs', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const rows = await adminManagementRepository.listAuditLogs({ limit: 100 });
    res.json(rows.map((r) => ({
      id: r.id,
      user_name: r.user_name || r.fullname || 'Unknown',
      action: r.action,
      detail: r.detail || null,
      user_agent: r.user_agent || null,
      created_at: r.created_at,
    })));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

export default router;