import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import paymentProfilesRepository, { PaymentProfileError } from '../../repositories/postgres/payment-profiles.js';
import notificationsRepository from '../../repositories/postgres/notifications.js';

const router = Router();

// Middleware: Strictly enforce Super Admin role for all payment profile management
export function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'super') {
    return res.status(403).json({ error: 'Chỉ Super Admin mới có quyền truy cập cấu hình Payment Profiles' });
  }
  next();
}

router.use(requireSuperAdmin);

/**
 * GET /api/admin/payment-profiles
 * Danh sách payment profiles (Đã mask số tài khoản, không chứa secret)
 */
router.get('/', asyncHandler(async (req, res) => {
  const { status } = req.query;
  const profiles = await paymentProfilesRepository.listProfiles({ status });
  res.json({ profiles });
}));

/**
 * GET /api/admin/payment-profiles/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const profile = await paymentProfilesRepository.getProfileById(req.params.id);
  if (!profile) {
    return res.status(404).json({ error: 'Payment profile không tồn tại' });
  }
  res.json({ profile });
}));

/**
 * POST /api/admin/payment-profiles
 * Tạo mới payment profile (Yêu cầu purpose; không nhận thông tin ngân hàng nhập tay)
 */
router.post('/', asyncHandler(async (req, res) => {
  const { code, display_name, purpose, bank_name, bank_bin, account_number, account_holder } = req.body || {};
  if (!code || !display_name) {
    return res.status(400).json({ error: 'Mã code và tên hiển thị là bắt buộc' });
  }

  if (bank_name || bank_bin || account_number || account_holder) {
    return res.status(400).json({
      error: 'API không còn nhận thông tin ngân hàng nhập tay. Nguồn sự thật thanh toán dựa trên bộ key PayOS (ENV) trên server.',
    });
  }

  if (!purpose || !['industry', 'grouped_checkout'].includes(purpose)) {
    return res.status(400).json({
      error: 'Mục đích profile (purpose) là bắt buộc và phải là "industry" hoặc "grouped_checkout"',
    });
  }

  try {
    const profile = await paymentProfilesRepository.createProfile({
      code,
      displayName: display_name,
      purpose,
      createdBy: req.user.id,
    });

    // Notify all super admins about new profile and required ENV variables (no secrets)
    try {
      await notificationsRepository.fanOutToSuperAdmins({
        type: 'system',
        title: 'Payment Profile mới được tạo',
        body: `Profile ${profile.display_name} (${profile.code}) - [${profile.purpose}] đã được tạo. Vui lòng cấu hình ENV: ${profile.env_keys.client_id}, ${profile.env_keys.api_key}, ${profile.env_keys.checksum_key} trên server.`,
      });
    } catch (err) {
      console.warn('Không thể gửi thông báo tạo payment profile:', err.message);
    }

    res.status(201).json({ profile });
  } catch (err) {
    if (err instanceof PaymentProfileError) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
}));

/**
 * PUT /api/admin/payment-profiles/:id
 * Cập nhật payment profile (Không nhận thông tin ngân hàng)
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { display_name, purpose, status, bank_name, bank_bin, account_number, account_holder } = req.body || {};

  if (bank_name !== undefined || bank_bin !== undefined || account_number !== undefined || account_holder !== undefined) {
    return res.status(400).json({
      error: 'API không còn nhận thông tin ngân hàng nhập tay. Nguồn sự thật thanh toán dựa trên bộ key PayOS (ENV) trên server.',
    });
  }

  try {
    const updated = await paymentProfilesRepository.updateProfile(req.params.id, {
      displayName: display_name,
      purpose,
      status,
      updatedBy: req.user.id,
    });

    try {
      await notificationsRepository.fanOutToSuperAdmins({
        type: 'system',
        title: 'Payment Profile đã được cập nhật',
        body: `Profile ${updated.display_name} (${updated.code}) (v${updated.version}) đã được cập nhật trạng thái: ${updated.status}.`,
      });
    } catch (err) {
      console.warn('Không thể gửi thông báo cập nhật payment profile:', err.message);
    }

    res.json({ profile: updated });
  } catch (err) {
    if (err instanceof PaymentProfileError) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
}));

/**
 * POST /api/admin/payment-profiles/:id/assign-root
 * Gán payment profile cho root category (ngành hàng gốc)
 */
router.post('/:id/assign-root', asyncHandler(async (req, res) => {
  const { root_category_id } = req.body || {};
  if (!root_category_id) {
    return res.status(400).json({ error: 'Thiếu root_category_id' });
  }

  try {
    const mapping = await paymentProfilesRepository.assignProfileToRootCategory({
      rootCategoryId: root_category_id,
      profileId: req.params.id,
      createdBy: req.user.id,
    });

    try {
      await notificationsRepository.fanOutToSuperAdmins({
        type: 'system',
        title: 'Gán Payment Profile cho ngành hàng',
        body: `Ngành hàng "${mapping.category_name}" đã được gán vào profile "${mapping.profile_name}" (${mapping.profile_code}).`,
      });
    } catch (err) {
      console.warn('Không thể gửi thông báo gán ngành hàng:', err.message);
    }

    res.json({ mapping });
  } catch (err) {
    if (err instanceof PaymentProfileError) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
}));

/**
 * DELETE /api/admin/payment-profiles/assign-root/:rootId
 * Hủy gán payment profile khỏi root category
 */
router.delete('/assign-root/:rootId', asyncHandler(async (req, res) => {
  const deleted = await paymentProfilesRepository.unassignProfileFromRootCategory({
    rootCategoryId: req.params.rootId,
  });
  if (!deleted) {
    return res.status(404).json({ error: 'Không tìm thấy mapping cho ngành hàng này' });
  }
  res.json({ ok: true, message: 'Đã hủy gán payment profile' });
}));

export default router;
