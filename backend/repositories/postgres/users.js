import postgresDb from '../../config/db-postgres.js';
import { IdentityError, isUniqueViolation } from './errors.js';
import bcrypt from 'bcryptjs';

const CUSTOMER_FIELD_NAMES = ['id', 'fullname', 'phone', 'email', 'tier', 'points', 'is_active', 'token_version', 'is_admin', 'admin_role', 'admin_branch_id'];
const CUSTOMER_COLUMNS = CUSTOMER_FIELD_NAMES.join(', ');
const CUSTOMER_COLUMNS_FOR_USER = CUSTOMER_FIELD_NAMES.map((field) => `u.${field}`).join(', ');
const ADMIN_COLUMNS = 'id, fullname, phone, email, password_hash, admin_role, admin_branch_id, is_active, token_version';

export function createUsersRepository(database = postgresDb) {
  return {
    async findActiveAdminByPhone(phone) {
      const [rows] = await database.query(
        `SELECT ${ADMIN_COLUMNS}
         FROM users
         WHERE phone = $1 AND is_admin = TRUE AND is_active = TRUE
         LIMIT 1`,
        [phone],
      );
      return rows[0] || null;
    },

    async findActiveUserById(id) {
      const [rows] = await database.query(
        `SELECT ${CUSTOMER_COLUMNS}
         FROM users
         WHERE id = $1 AND is_active = TRUE
         LIMIT 1`,
        [id],
      );
      return rows[0] || null;
    },

    async registerCustomer({ phone, fullname, password }) {
      const passwordHash = await bcrypt.hash(password, 12);
      return database.transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`customer-phone:${phone}`]);
        const [existingRows] = await tx.query(
          'SELECT id, is_admin, password_hash FROM users WHERE phone = $1 LIMIT 1 FOR UPDATE',
          [phone],
        );
        const existing = existingRows[0];
        if (existing?.is_admin) {
          throw new IdentityError('PHONE_RESERVED', 'Số điện thoại này đã được dùng cho tài khoản quản trị', 409);
        }
        if (existing?.password_hash) {
          throw new IdentityError('PHONE_EXISTS', 'Số điện thoại đã được đăng ký', 409);
        }

        if (existing) {
          const [updatedRows] = await tx.query(
            `UPDATE users SET fullname = $2, password_hash = $3, is_active = TRUE, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 RETURNING ${CUSTOMER_COLUMNS}`,
            [existing.id, fullname, passwordHash],
          );
          return updatedRows[0];
        }

        const [createdRows] = await tx.query(
          `INSERT INTO users (phone, fullname, password_hash, is_admin)
           VALUES ($1, $2, $3, FALSE)
           RETURNING ${CUSTOMER_COLUMNS}`,
          [phone, fullname, passwordHash],
        );
        return createdRows[0];
      });
    },

    async findActiveCustomerByPhone(phone) {
      const [rows] = await database.query(
        `SELECT ${CUSTOMER_COLUMNS}, password_hash
         FROM users WHERE phone = $1 AND is_admin = FALSE AND is_active = TRUE LIMIT 1`,
        [phone],
      );
      return rows[0] || null;
    },

    async findActiveUserByPhone(phone) {
      const [rows] = await database.query(
        `SELECT ${CUSTOMER_COLUMNS}, password_hash
         FROM users WHERE phone = $1 AND is_active = TRUE LIMIT 1`,
        [phone],
      );
      return rows[0] || null;
    },

    async findOrCreateCustomerByPhone({ phone, fullname }) {
      return database.transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`customer-phone:${phone}`]);
        const [existingRows] = await tx.query(
          `SELECT ${CUSTOMER_COLUMNS} FROM users WHERE phone = $1 LIMIT 1 FOR UPDATE`,
          [phone],
        );
        const existing = existingRows[0];
        if (existing) {
          if (existing.is_admin) {
            throw new IdentityError('PHONE_RESERVED', 'Số điện thoại này đã được dùng cho tài khoản quản trị', 409);
          }
          return existing;
        }

        const [createdRows] = await tx.query(
          `INSERT INTO users (phone, fullname, is_admin)
           VALUES ($1, $2, FALSE)
           RETURNING ${CUSTOMER_COLUMNS}`,
          [phone, fullname],
        );
        return createdRows[0];
      });
    },

    async findOrCreateGoogleCustomer({ subject, email, fullname }) {
      return database.transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`google-subject:${subject}`]);
        const [identityRows] = await tx.query(
          `SELECT ${CUSTOMER_COLUMNS_FOR_USER}
           FROM user_identities i
           JOIN users u ON u.id = i.user_id
           WHERE i.provider = 'google' AND i.provider_subject = $1
           LIMIT 1 FOR UPDATE`,
          [subject],
        );
        const identifiedUser = identityRows[0];
        if (identifiedUser) {
          if (identifiedUser.is_admin) {
            throw new IdentityError('IDENTITY_RESERVED', 'Tài khoản Google này không thể dùng để đăng nhập khách hàng', 409);
          }
          return identifiedUser;
        }

        let user;
        try {
          const [createdRows] = await tx.query(
            `INSERT INTO users (fullname, email, is_admin)
             VALUES ($1, $2, FALSE)
             RETURNING ${CUSTOMER_COLUMNS}`,
            [fullname, email],
          );
          user = createdRows[0];
        } catch (error) {
          if (!isUniqueViolation(error)) throw error;
          // Email is contact data, never an identity key. Keep the Google
          // subject as the unique login identity even if another profile owns it.
          const [createdRows] = await tx.query(
            `INSERT INTO users (fullname, is_admin)
             VALUES ($1, FALSE)
             RETURNING ${CUSTOMER_COLUMNS}`,
            [fullname],
          );
          user = createdRows[0];
        }

        await tx.query(
          `INSERT INTO user_identities (user_id, provider, provider_subject, email)
           VALUES ($1, 'google', $2, $3)`,
          [user.id, subject, email],
        );
        return user;
      });
    },

    async findActiveUserByEmail(email) {
      if (!email || typeof email !== 'string') return null;
      const cleanEmail = email.trim().toLowerCase();
      const [rows] = await database.query(
        `SELECT ${CUSTOMER_COLUMNS}, password_hash
         FROM users
         WHERE LOWER(email) = $1 AND is_active = TRUE
         LIMIT 1`,
        [cleanEmail],
      );
      return rows[0] || null;
    },

    async updatePassword(userId, passwordHash) {
      const [rows] = await database.query(
        `UPDATE users
         SET password_hash = $2, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING ${CUSTOMER_COLUMNS}`,
        [userId, passwordHash],
      );
      return rows[0] || null;
    },

    async updateUserEmail(userId, email) {
      const cleanEmail = email ? email.trim().toLowerCase() : null;
      const [rows] = await database.query(
        `UPDATE users
         SET email = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING ${CUSTOMER_COLUMNS}`,
        [userId, cleanEmail],
      );
      return rows[0] || null;
    },
  };
}

export const usersRepository = createUsersRepository();
export default usersRepository;
