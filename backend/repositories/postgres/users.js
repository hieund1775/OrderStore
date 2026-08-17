import postgresDb from '../../config/db-postgres.js';
import { IdentityError, isUniqueViolation } from './errors.js';

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
  };
}

export const usersRepository = createUsersRepository();
export default usersRepository;
