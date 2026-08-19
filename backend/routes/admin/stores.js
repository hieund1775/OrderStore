import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { resolveStoreScope } from '../../middleware/branch-scope.js';
import { logAudit } from '../../services/audit.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { validateStoreId, validateTableId, validateBranchInput, validateTableInput } from '../../validation/store-schemas.js';
import { toStoreDto, toTableDto } from '../../dto/store-dto.js';
import adminStoreService from '../../services/stores/admin-store-service.js';

export const branchesRouter = Router();
export const tablesRouter = Router();

// ═══════════ BRANCHES / STORES ═══════════

branchesRouter.get('/', requireRole('super', 'manager', 'cashier', 'kitchen'), asyncHandler(async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user);
    const rows = await adminStoreService.listBranches({ scopedStoreId });
    res.json(rows.map(toStoreDto));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

branchesRouter.post('/', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const validated = validateBranchInput(req.body, { isUpdate: false });
    const created = await adminStoreService.createBranch(validated);
    await logAudit(req.user.sub, 'Tạo chi nhánh', validated.name, req);
    res.status(201).json(toStoreDto(created));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

branchesRouter.put('/:id', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const id = validateStoreId(req.params.id);
    resolveStoreScope(req.user, id);
    const validated = validateBranchInput(req.body, { isUpdate: true });
    const updated = await adminStoreService.updateBranch(id, validated);
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy chi nhánh' });
    await logAudit(req.user.sub, `Cập nhật chi nhánh #${id}`, validated.name || '', req);
    res.json({ message: 'Đã cập nhật chi nhánh' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

branchesRouter.delete('/:id', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const id = validateStoreId(req.params.id);
    await adminStoreService.deleteBranch(id);
    await logAudit(req.user.sub, `Xóa chi nhánh #${id}`, '', req);
    res.json({ message: 'Đã xóa chi nhánh' });
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
}));

// ═══════════ TABLES ═══════════

tablesRouter.get('/', requireRole('super', 'manager', 'cashier'), asyncHandler(async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user, req.query.store_id);
    const rows = await adminStoreService.listAllTables({ scopedStoreId });
    res.json(rows.map(toTableDto));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

tablesRouter.post('/', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const validated = validateTableInput(req.body, { isUpdate: false });
    const targetStoreId = resolveStoreScope(req.user, validated.store_id);
    const created = await adminStoreService.createTable({ store_id: targetStoreId, name: validated.name }, { scopedStoreId: targetStoreId });
    await logAudit(req.user.sub, 'Tạo vị trí bàn', `${validated.name} (store ${targetStoreId})`, req);
    res.status(201).json(toTableDto(created));
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
}));

tablesRouter.put('/:id', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const id = validateTableId(req.params.id);
    const validated = validateTableInput(req.body, { isUpdate: true });
    const scopedStoreId = resolveStoreScope(req.user);
    await adminStoreService.updateTable(id, validated, { scopedStoreId });
    await logAudit(req.user.sub, `Cập nhật vị trí bàn #${id}`, validated.name || '', req);
    res.json({ message: 'Đã cập nhật bàn' });
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
}));

tablesRouter.delete('/:id', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const id = validateTableId(req.params.id);
    const scopedStoreId = resolveStoreScope(req.user);
    await adminStoreService.deleteTable(id, { scopedStoreId });
    await logAudit(req.user.sub, `Xóa vị trí bàn #${id}`, '', req);
    res.json({ message: 'Đã xóa bàn' });
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
}));
