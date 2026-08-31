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
        `SELECT pp.id, pp.code, pp.display_name, pp.bank_name, pp.bank_bin,
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
          bank_name: r.bank_name || null,
          bank_bin: r.bank_bin || null,
          account_number_masked: maskAccountNumber(r.account_number),
          account_holder: r.account_holder || null,
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
        bank_name: r.bank_name || null,
        bank_bin: r.bank_bin || null,
        account_number_masked: maskAccountNumber(r.account_number),
        account_holder: r.account_holder || null,
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
         LIMIT 1`,
        [Number(rootCategoryId)],
      );
      const r = rows[0];
      if (!r) return null;
      return {
        ...r,
        id: Number(r.id),
        version: Number(r.version),
        is_env_configured: checkEnvConfigured(r.env_prefix, r.code),
      };
    },

    async createProfile({ code, displayName, bankName = null, bankBin = null, accountNumber = null, accountHolder = null, createdBy = null }) {
      if (!code || !String(code).trim()) {
        throw new PaymentProfileError('Mã code profile không được để trống');
      }
      if (!displayName || !String(displayName).trim()) {
        throw new PaymentProfileError('Tên hiển thị profile không được để trống');
      }

      const normalizedCode = String(code).toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_');
      const envPrefix = generateEnvPrefix(normalizedCode);

      const [existing] = await database.query('SELECT id FROM payment_profiles WHERE code = $1', [normalizedCode]);
      if (existing[0]) {
        throw new PaymentProfileError(`Payment profile với mã code "${normalizedCode}" đã tồn tại`, 409);
      }

      const [rows] = await database.query(
        `INSERT INTO payment_profiles
           (code, display_name, bank_name, bank_bin, account_number, account_holder, env_prefix, status, version, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 1, $8)
         RETURNING *`,
        [normalizedCode, displayName.trim(), bankName?.trim() || null, bankBin?.trim() || null, accountNumber?.trim() || null, accountHolder?.trim() || null, envPrefix, createdBy],
      );

      const r = rows[0];
      return {
        ...r,
        id: Number(r.id),
        account_number: undefined,
        account_number_masked: maskAccountNumber(r.account_number),
        env_keys: {
          client_id: `${r.env_prefix}_CLIENT_ID`,
          api_key: `${r.env_prefix}_API_KEY`,
          checksum_key: `${r.env_prefix}_CHECKSUM_KEY`,
        },
        is_env_configured: checkEnvConfigured(r.env_prefix, r.code),
      };
    },

    async updateProfile(id, { displayName, bankName, bankBin, accountNumber, accountHolder, status, updatedBy = null }) {
      const [existing] = await database.query('SELECT * FROM payment_profiles WHERE id = $1', [Number(id)]);
      if (!existing[0]) {
        throw new PaymentProfileError('Payment profile không tồn tại', 404);
      }

      const current = existing[0];
      const newDisplayName = displayName !== undefined ? displayName.trim() : current.display_name;
      const newBankName = bankName !== undefined ? (bankName?.trim() || null) : current.bank_name;
      const newBankBin = bankBin !== undefined ? (bankBin?.trim() || null) : current.bank_bin;
      const newAccountNumber = accountNumber !== undefined ? (accountNumber?.trim() || null) : current.account_number;
      const newAccountHolder = accountHolder !== undefined ? (accountHolder?.trim() || null) : current.account_holder;
      const newStatus = status !== undefined ? status : current.status;

      if (newStatus === 'active') {
        const isConfigured = checkEnvConfigured(current.env_prefix, current.code);
        if (!isConfigured) {
          throw new PaymentProfileError(
            'Không thể kích hoạt profile khi chưa cấu hình đủ 3 biến môi trường trên server',
            400,
            'ENV_NOT_CONFIGURED',
          );
        }
      }

      // Version increments when banking details change
      const bankChanged =
        newBankName !== current.bank_name ||
        newBankBin !== current.bank_bin ||
        newAccountNumber !== current.account_number ||
        newAccountHolder !== current.account_holder;

      const nextVersion = bankChanged ? Number(current.version) + 1 : Number(current.version);

      const [rows] = await database.query(
        `UPDATE payment_profiles
         SET display_name = $2, bank_name = $3, bank_bin = $4,
             account_number = $5, account_holder = $6, status = $7,
             version = $8, updated_by = $9, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [Number(id), newDisplayName, newBankName, newBankBin, newAccountNumber, newAccountHolder, newStatus, nextVersion, updatedBy],
      );

      const r = rows[0];
      return {
        ...r,
        id: Number(r.id),
        account_number_masked: maskAccountNumber(r.account_number),
        env_keys: {
          client_id: `${r.env_prefix}_CLIENT_ID`,
          api_key: `${r.env_prefix}_API_KEY`,
          checksum_key: `${r.env_prefix}_CHECKSUM_KEY`,
        },
        is_env_configured: checkEnvConfigured(r.env_prefix, r.code),
      };
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

        // 2. Verify profile
        const [profRows] = await tx.query(
          `SELECT id, code, display_name, status FROM payment_profiles WHERE id = $1`,
          [Number(profileId)],
        );
        if (!profRows[0]) {
          throw new PaymentProfileError('Payment profile không tồn tại', 404);
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
