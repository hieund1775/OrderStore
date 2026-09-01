import postgresDb from '../../config/db-postgres.js';

export class PaymentProfileError extends Error {
  constructor(message, status = 400, code = 'PAYMENT_PROFILE_ERROR') {
    super(message);
    this.name = 'PaymentProfileError';
    this.status = status;
    this.code = code;
    this.expose = true;
  }
}

export function maskAccountNumber(acc) {
  if (!acc) return null;
  const trimmed = acc.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 4) return trimmed;
  return `${'*'.repeat(trimmed.length - 4)}${trimmed.slice(-4)}`;
}

export function generateEnvPrefix(code) {
  const normalized = String(code || '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9_]/g, '_');
  return `PAYOS_PROFILE_${normalized}`;
}

export function checkEnvConfigured(envPrefix, code) {
  const cid = process.env[`${envPrefix}_CLIENT_ID`]?.trim();
  const key = process.env[`${envPrefix}_API_KEY`]?.trim();
  const cs = process.env[`${envPrefix}_CHECKSUM_KEY`]?.trim();
  if (cid && key && cs) return true;

  // Fallback check for system default profiles if standard root PAYOS_* is configured
  if (code === 'LONG_GROUPED_CHECKOUT' || code === 'DEFAULT_LONG') {
    const rootCid = process.env.PAYOS_CLIENT_ID?.trim();
    const rootKey = process.env.PAYOS_API_KEY?.trim();
    const rootCs = process.env.PAYOS_CHECKSUM_KEY?.trim();
    return Boolean(rootCid && rootKey && rootCs);
  }

  return false;
}

export function createPaymentProfilesRepository(database = postgresDb) {
  return {
    async listProfiles({ status = null } = {}) {
      const params = [];
      let whereClause = '';
      if (status) {
        params.push(status);
        whereClause = `WHERE pp.status = $${params.length}`;
      }

      const [rows] = await database.query(
        `SELECT pp.id, pp.code, pp.display_name, pp.purpose, pp.bank_name, pp.bank_bin,
                pp.account_number, pp.account_holder, pp.env_prefix, pp.status,
                pp.version, pp.created_at, pp.updated_at,
                JSONB_AGG(
                  JSONB_BUILD_OBJECT(
                    'category_id', c.id,
                    'category_name', c.name,
                    'category_slug', c.slug
                  )
                ) FILTER (WHERE c.id IS NOT NULL) AS assigned_categories
         FROM payment_profiles pp
         LEFT JOIN category_payment_profiles cpp ON cpp.payment_profile_id = pp.id AND cpp.is_active = TRUE
         LEFT JOIN categories c ON c.id = cpp.root_category_id AND c.archived_at IS NULL
         ${whereClause}
         GROUP BY pp.id
         ORDER BY pp.id ASC`,
        params,
      );

      return rows.map((r) => {
        const isConfigured = checkEnvConfigured(r.env_prefix, r.code);
        return {
          id: Number(r.id),
          code: r.code,
          display_name: r.display_name,
          purpose: r.purpose || 'industry',
          env_prefix: r.env_prefix,
          env_keys: {
            client_id: `${r.env_prefix}_CLIENT_ID`,
            api_key: `${r.env_prefix}_API_KEY`,
            checksum_key: `${r.env_prefix}_CHECKSUM_KEY`,
          },
          is_env_configured: isConfigured,
          status: r.status,
          version: Number(r.version),
          assigned_categories: Array.isArray(r.assigned_categories) ? r.assigned_categories : [],
          created_at: r.created_at,
          updated_at: r.updated_at,
        };
      });
    },

    async getProfileById(id) {
      const [rows] = await database.query(
        `SELECT pp.*,
                JSONB_AGG(
                  JSONB_BUILD_OBJECT(
                    'category_id', c.id,
                    'category_name', c.name,
                    'category_slug', c.slug
                  )
                ) FILTER (WHERE c.id IS NOT NULL) AS assigned_categories
         FROM payment_profiles pp
         LEFT JOIN category_payment_profiles cpp ON cpp.payment_profile_id = pp.id AND cpp.is_active = TRUE
         LEFT JOIN categories c ON c.id = cpp.root_category_id AND c.archived_at IS NULL
         WHERE pp.id = $1
         GROUP BY pp.id`,
        [Number(id)],
      );
      const r = rows[0];
      if (!r) return null;
      return {
        id: Number(r.id),
        code: r.code,
        display_name: r.display_name,
        purpose: r.purpose || 'industry',
        env_prefix: r.env_prefix,
        env_keys: {
          client_id: `${r.env_prefix}_CLIENT_ID`,
          api_key: `${r.env_prefix}_API_KEY`,
          checksum_key: `${r.env_prefix}_CHECKSUM_KEY`,
        },
        is_env_configured: checkEnvConfigured(r.env_prefix, r.code),
        status: r.status,
        version: Number(r.version),
        assigned_categories: Array.isArray(r.assigned_categories) ? r.assigned_categories : [],
        created_at: r.created_at,
        updated_at: r.updated_at,
      };
    },

    async getProfileByCode(code) {
      const normalizedCode = String(code || '').toUpperCase().trim();
      const [rows] = await database.query(
        `SELECT * FROM payment_profiles WHERE code = $1 LIMIT 1`,
        [normalizedCode],
      );
      const r = rows[0];
      if (!r) return null;
      return {
        ...r,
        id: Number(r.id),
        purpose: r.purpose || 'industry',
        version: Number(r.version),
        is_env_configured: checkEnvConfigured(r.env_prefix, r.code),
      };
    },

    async getActiveGroupedProfile() {
      const [rows] = await database.query(
        `SELECT * FROM payment_profiles
         WHERE purpose = 'grouped_checkout' AND status = 'active'
         LIMIT 1`,
      );
      const r = rows[0];
      if (!r) return null;
      return {
        ...r,
        id: Number(r.id),
        purpose: r.purpose || 'grouped_checkout',
        version: Number(r.version),
        is_env_configured: checkEnvConfigured(r.env_prefix, r.code),
      };
    },

    async getActiveProfileByRootCategoryId(rootCategoryId) {
      const [rows] = await database.query(
        `SELECT pp.*
         FROM category_payment_profiles cpp
         JOIN payment_profiles pp ON pp.id = cpp.payment_profile_id
         WHERE cpp.root_category_id = $1
           AND cpp.is_active = TRUE
           AND pp.status = 'active'
           AND pp.purpose = 'industry'
         LIMIT 1`,
        [Number(rootCategoryId)],
      );
      const r = rows[0];
      if (!r) return null;
      return {
        ...r,
        id: Number(r.id),
        purpose: r.purpose || 'industry',
        version: Number(r.version),
        is_env_configured: checkEnvConfigured(r.env_prefix, r.code),
      };
    },

    async createProfile({ code, displayName, purpose = 'industry', createdBy = null }) {
      if (!code || !String(code).trim()) {
        throw new PaymentProfileError('Mã code profile không được để trống');
      }
      if (!displayName || !String(displayName).trim()) {
        throw new PaymentProfileError('Tên hiển thị profile không được để trống');
      }

      const validPurposes = ['industry', 'grouped_checkout'];
      const normalizedPurpose = String(purpose || 'industry').trim();
      if (!validPurposes.includes(normalizedPurpose)) {
        throw new PaymentProfileError('Mục đích profile phải là "industry" hoặc "grouped_checkout"', 400, 'INVALID_PURPOSE');
      }

      const normalizedCode = String(code).toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_');
      const envPrefix = generateEnvPrefix(normalizedCode);

      const [existing] = await database.query('SELECT id FROM payment_profiles WHERE code = $1', [normalizedCode]);
      if (existing[0]) {
        throw new PaymentProfileError(`Payment profile với mã code "${normalizedCode}" đã tồn tại`, 409);
      }

      const [rows] = await database.query(
        `INSERT INTO payment_profiles
           (code, display_name, purpose, env_prefix, status, version, created_by)
         VALUES ($1, $2, $3, $4, 'disabled', 1, $5)
         RETURNING *`,
        [normalizedCode, displayName.trim(), normalizedPurpose, envPrefix, createdBy],
      );

      const r = rows[0];
      return {
        id: Number(r.id),
        code: r.code,
        display_name: r.display_name,
        purpose: r.purpose,
        env_prefix: r.env_prefix,
        env_keys: {
          client_id: `${r.env_prefix}_CLIENT_ID`,
          api_key: `${r.env_prefix}_API_KEY`,
          checksum_key: `${r.env_prefix}_CHECKSUM_KEY`,
        },
        is_env_configured: checkEnvConfigured(r.env_prefix, r.code),
        status: r.status,
        version: Number(r.version),
        assigned_categories: [],
        created_at: r.created_at,
        updated_at: r.updated_at,
      };
    },

    async updateProfile(id, { displayName, purpose, status, updatedBy = null }) {
      return database.transaction(async (tx) => {
        const [existing] = await tx.query('SELECT * FROM payment_profiles WHERE id = $1 FOR UPDATE', [Number(id)]);
        if (!existing[0]) {
          throw new PaymentProfileError('Payment profile không tồn tại', 404);
        }

        const current = existing[0];
        const newDisplayName = displayName !== undefined ? displayName.trim() : current.display_name;
        const newPurpose = purpose !== undefined ? String(purpose).trim() : current.purpose;
        const newStatus = status !== undefined ? status : current.status;

        // Purpose change validations
        if (purpose !== undefined && newPurpose !== current.purpose) {
          const validPurposes = ['industry', 'grouped_checkout'];
          if (!validPurposes.includes(newPurpose)) {
            throw new PaymentProfileError('Mục đích profile phải là "industry" hoặc "grouped_checkout"', 400, 'INVALID_PURPOSE');
          }
          if (current.status === 'active') {
            throw new PaymentProfileError('Không thể thay đổi mục đích khi profile đang bật. Vui lòng tắt profile trước khi đổi mục đích.', 400);
          }
          const [catMappings] = await tx.query(
            'SELECT id FROM category_payment_profiles WHERE payment_profile_id = $1 AND is_active = TRUE LIMIT 1',
            [Number(id)],
          );
          if (catMappings[0]) {
            throw new PaymentProfileError('Không thể thay đổi mục đích khi profile đang được gán cho ngành hàng. Vui lòng bỏ gán trước.', 400);
          }
        }

        // Active status validations
        if (newStatus === 'active') {
          const isConfigured = checkEnvConfigured(current.env_prefix, current.code);
          if (!isConfigured) {
            throw new PaymentProfileError(
              'Không thể kích hoạt profile khi chưa cấu hình đủ 3 biến môi trường trên server',
              400,
              'ENV_NOT_CONFIGURED',
            );
          }

          // If activating a grouped profile, ensure any other active grouped profile is disabled
          if (newPurpose === 'grouped_checkout') {
            await tx.query(
              `UPDATE payment_profiles
               SET status = 'disabled', updated_at = CURRENT_TIMESTAMP
               WHERE purpose = 'grouped_checkout' AND id <> $1 AND status = 'active'`,
              [Number(id)],
            );
          }
        }

        // Disable grouped profile validation: must not disable last active grouped profile
        if (newStatus === 'disabled' && current.status === 'active' && current.purpose === 'grouped_checkout') {
          const [otherActive] = await tx.query(
            `SELECT id FROM payment_profiles
             WHERE purpose = 'grouped_checkout' AND status = 'active' AND id <> $1
             LIMIT 1`,
            [Number(id)],
          );
          if (!otherActive[0]) {
            throw new PaymentProfileError(
              'Không thể tắt tài khoản thanh toán gộp duy nhất đang hoạt động. Vui lòng kích hoạt tài khoản thanh toán gộp thay thế trước khi tắt tài khoản này.',
              400,
              'CANNOT_DISABLE_LAST_GROUPED_PROFILE',
            );
          }
        }

        const [rows] = await tx.query(
          `UPDATE payment_profiles
           SET display_name = $2, purpose = $3, status = $4,
               updated_by = $5, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1
           RETURNING *`,
          [Number(id), newDisplayName, newPurpose, newStatus, updatedBy],
        );

        const r = rows[0];
        return {
          id: Number(r.id),
          code: r.code,
          display_name: r.display_name,
          purpose: r.purpose,
          env_prefix: r.env_prefix,
          env_keys: {
            client_id: `${r.env_prefix}_CLIENT_ID`,
            api_key: `${r.env_prefix}_API_KEY`,
            checksum_key: `${r.env_prefix}_CHECKSUM_KEY`,
          },
          is_env_configured: checkEnvConfigured(r.env_prefix, r.code),
          status: r.status,
          version: Number(r.version),
          assigned_categories: [],
          created_at: r.created_at,
          updated_at: r.updated_at,
        };
      });
    },

    async assignProfileToRootCategory({ rootCategoryId, profileId, createdBy = null }) {
      return database.transaction(async (tx) => {
        // 1. Verify root category
        const [catRows] = await tx.query(
          `SELECT id, parent_id, depth, name FROM categories WHERE id = $1 AND archived_at IS NULL`,
          [Number(rootCategoryId)],
        );
        if (!catRows[0]) {
          throw new PaymentProfileError('Danh mục không tồn tại hoặc đã bị lưu trữ', 404);
        }
        if (catRows[0].parent_id != null || Number(catRows[0].depth) !== 0) {
          throw new PaymentProfileError('Chỉ danh mục gốc (ngành hàng depth = 0) mới được gán payment profile', 400);
        }

        // 2. Verify profile and purpose
        const [profRows] = await tx.query(
          `SELECT id, code, display_name, purpose, status FROM payment_profiles WHERE id = $1`,
          [Number(profileId)],
        );
        if (!profRows[0]) {
          throw new PaymentProfileError('Payment profile không tồn tại', 404);
        }

        if (profRows[0].purpose !== 'industry') {
          throw new PaymentProfileError(
            'Chỉ payment profile có mục đích "industry" (nhận tiền ngành hàng) mới được gán cho ngành hàng',
            400,
            'INVALID_PROFILE_PURPOSE',
          );
        }

        // 3. Upsert mapping (1 root category only has 1 active mapping)
        const [mappingRows] = await tx.query(
          `INSERT INTO category_payment_profiles
             (root_category_id, payment_profile_id, is_active, created_by, updated_at)
           VALUES ($1, $2, TRUE, $3, CURRENT_TIMESTAMP)
           ON CONFLICT (root_category_id)
           DO UPDATE SET
             payment_profile_id = EXCLUDED.payment_profile_id,
             is_active = TRUE,
             updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [Number(rootCategoryId), Number(profileId), createdBy],
        );

        return {
          ...mappingRows[0],
          id: Number(mappingRows[0].id),
          category_name: catRows[0].name,
          profile_name: profRows[0].display_name,
          profile_code: profRows[0].code,
        };
      });
    },

    async unassignProfileFromRootCategory({ rootCategoryId }) {
      const [rows] = await database.query(
        `DELETE FROM category_payment_profiles WHERE root_category_id = $1 RETURNING *`,
        [Number(rootCategoryId)],
      );
      return rows[0] || null;
    },
  };
}

export const paymentProfilesRepository = createPaymentProfilesRepository();
export default paymentProfilesRepository;
