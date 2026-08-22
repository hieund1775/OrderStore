import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { resolveStoreScope } from '../../middleware/branch-scope.js';
import { logAudit } from '../../services/audit.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import {
  validateJobId,
  validateJobInput,
  validateApplicationId,
  validateApplicationStatusInput,
} from '../../validation/recruitment-schemas.js';
import { toJobDto, toJobApplicationDto } from '../../dto/recruitment-dto.js';
import recruitmentService from '../../services/recruitment/recruitment-service.js';

const router = Router();

// ═══════════ QUẢN LÝ TIN TUYỂN DỤNG ═══════════

router.get('/jobs', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user);
    const rows = await recruitmentService.listJobs({
      includeInactive: true,
      storeId: scopedStoreId,
    });
    res.json(rows.map(toJobDto));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.post('/jobs', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const validated = validateJobInput(req.body, { isUpdate: false });
    const created = await recruitmentService.createJob(validated);
    await logAudit(req.user.sub, 'Tạo tin tuyển dụng', validated.title, req);
    res.status(201).json(toJobDto(created));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.put('/jobs/:id', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const id = validateJobId(req.params.id);
    const validated = validateJobInput(req.body, { isUpdate: true });
    const updated = await recruitmentService.updateJob(id, validated);
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy tin tuyển dụng' });
    await logAudit(req.user.sub, `Cập nhật tin tuyển dụng #${id}`, validated.title || '', req);
    res.json(toJobDto(updated));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.delete('/jobs/:id', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const id = validateJobId(req.params.id);
    const deleted = await recruitmentService.deleteJob(id);
    if (!deleted) return res.status(404).json({ error: 'Không tìm thấy tin tuyển dụng' });
    await logAudit(req.user.sub, `Xóa tin tuyển dụng #${id}`, '', req);
    res.json({ message: 'Đã xóa tin tuyển dụng thành công' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

// ═══════════ QUẢN LÝ DANH SÁCH ỨNG VIÊN ═══════════

router.get('/job-applications', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user);
    const jobId = req.query.job_id ? Number(req.query.job_id) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;

    const rows = await recruitmentService.listApplications({
      jobId,
      storeId: scopedStoreId,
      status,
    });
    res.json(rows.map(toJobApplicationDto));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.patch('/job-applications/:id/status', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const id = validateApplicationId(req.params.id);
    const validated = validateApplicationStatusInput(req.body);
    const updated = await recruitmentService.updateApplicationStatus(id, validated);
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy hồ sơ ứng tuyển' });
    await logAudit(req.user.sub, `Cập nhật trạng thái hồ sơ #${id}`, validated.status, req);
    res.json(toJobApplicationDto(updated));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

export default router;
