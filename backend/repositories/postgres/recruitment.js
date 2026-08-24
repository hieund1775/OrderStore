import postgresDb from '../../config/db-postgres.js';
import defaultNotificationsRepository from './notifications.js';

export class RecruitmentRepositoryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function createRecruitmentRepository(
  database = postgresDb,
  notifications = defaultNotificationsRepository,
) {
  return {
    async listJobs({ includeInactive = false, storeId } = {}) {
      const params = [];
      let where = 'WHERE TRUE';

      if (!includeInactive) {
        where += ' AND j.is_active = TRUE';
      }

      if (storeId) {
        params.push(storeId);
        where += ` AND (js.store_id = $${params.length} OR js.store_id IS NULL)`;
      }

      const [rows] = await database.query(
        `SELECT j.*,
                COALESCE(
                  json_agg(json_build_object('id', s.id, 'name', s.name)) FILTER (WHERE s.id IS NOT NULL),
                  '[]'
                ) AS stores
         FROM jobs j
         LEFT JOIN job_stores js ON js.job_id = j.id
         LEFT JOIN stores s ON js.store_id = s.id
         ${where}
         GROUP BY j.id
         ORDER BY j.created_at DESC`,
        params,
      );
      return rows;
    },

    async getJobById(id) {
      const [rows] = await database.query(
        `SELECT j.*,
                COALESCE(
                  json_agg(json_build_object('id', s.id, 'name', s.name)) FILTER (WHERE s.id IS NOT NULL),
                  '[]'
                ) AS stores
         FROM jobs j
         LEFT JOIN job_stores js ON js.job_id = j.id
         LEFT JOIN stores s ON js.store_id = s.id
         WHERE j.id = $1
         GROUP BY j.id`,
        [id],
      );
      return rows[0] || null;
    },

    async createJob({ title, type, salary, description, requirements, benefits, is_active = true, store_ids = [] }) {
      return database.transaction(async (tx) => {
        const [rows] = await tx.query(
          `INSERT INTO jobs (title, type, salary, description, requirements, benefits, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            title.trim(),
            type.trim(),
            salary.trim(),
            description.trim(),
            requirements.trim(),
            benefits ? benefits.trim() : null,
            Boolean(is_active),
          ],
        );
        const job = rows[0];

        if (Array.isArray(store_ids) && store_ids.length > 0) {
          for (const sId of store_ids) {
            await tx.query(
              `INSERT INTO job_stores (job_id, store_id)
               VALUES ($1, $2)
               ON CONFLICT (job_id, store_id) DO NOTHING`,
              [job.id, sId],
            );
          }
        }

        return job;
      });
    },

    async updateJob(id, fields) {
      return database.transaction(async (tx) => {
        const sets = [];
        const params = [];
        const allowed = ['title', 'type', 'salary', 'description', 'requirements', 'benefits', 'is_active'];

        for (const k of allowed) {
          if (fields[k] !== undefined) {
            params.push(fields[k]);
            sets.push(`${k} = $${params.length}`);
          }
        }

        if (sets.length > 0) {
          params.push(id);
          await tx.query(
            `UPDATE jobs SET ${sets.join(', ')} WHERE id = $${params.length}`,
            params,
          );
        }

        if (Array.isArray(fields.store_ids)) {
          await tx.query('DELETE FROM job_stores WHERE job_id = $1', [id]);
          for (const sId of fields.store_ids) {
            await tx.query(
              `INSERT INTO job_stores (job_id, store_id)
               VALUES ($1, $2)
               ON CONFLICT (job_id, store_id) DO NOTHING`,
              [id, sId],
            );
          }
        }

        const [rows] = await tx.query('SELECT * FROM jobs WHERE id = $1', [id]);
        return rows[0] || null;
      });
    },

    async deleteJob(id) {
      return database.transaction(async (tx) => {
        const [applicationRows] = await tx.query(
          'SELECT COUNT(*)::int AS count FROM job_applications WHERE job_id = $1',
          [id],
        );
        if (Number(applicationRows[0]?.count || 0) > 0) {
          const [, affected] = await tx.query(
            'UPDATE jobs SET is_active = FALSE WHERE id = $1',
            [id],
          );
          return Boolean(affected);
        }

        await tx.query('DELETE FROM job_stores WHERE job_id = $1', [id]);
        const [, affected] = await tx.query('DELETE FROM jobs WHERE id = $1', [id]);
        return Boolean(affected);
      });
    },

    async listApplications({ jobId, storeId, status } = {}) {
      const params = [];
      let where = 'WHERE TRUE';

      if (jobId) {
        params.push(jobId);
        where += ` AND ja.job_id = $${params.length}`;
      }

      if (storeId) {
        params.push(storeId);
        where += ` AND (ja.store_id = $${params.length} OR ja.store_id IS NULL)`;
      }

      if (status) {
        params.push(status);
        where += ` AND ja.status = $${params.length}`;
      }

      const [rows] = await database.query(
        `SELECT ja.*,
                j.title AS job_title,
                j.type AS job_type,
                s.name AS store_name
         FROM job_applications ja
         LEFT JOIN jobs j ON ja.job_id = j.id
         LEFT JOIN stores s ON ja.store_id = s.id
         ${where}
         ORDER BY ja.created_at DESC`,
        params,
      );
      return rows;
    },

    async updateApplicationStatus(id, { status, note }) {
      const sets = ['status = $1'];
      const params = [status];

      if (note !== undefined) {
        params.push(note);
        sets.push(`note = $${params.length}`);
      }

      params.push(id);
      const [rows] = await database.query(
        `UPDATE job_applications SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params,
      );
      return rows[0] || null;
    },

    async createApplication({ jobId, storeId, fullname, phone, email, cvUrl }) {
      return database.transaction(async (tx) => {
        const [rows] = await tx.query(
          `INSERT INTO job_applications (job_id, store_id, fullname, phone, email, cv_url, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'Mới')
           RETURNING *`,
          [jobId, storeId || null, fullname, phone, email, cvUrl || null],
        );
        const app = rows[0];
        const [jobs] = await tx.query('SELECT title FROM jobs WHERE id = $1', [jobId]);
        const jobTitle = jobs[0]?.title || 'vị trí tuyển dụng';
        await notifications.fanOutToRecruitmentAdmins(storeId, {
          type: 'staff',
          title: `Hồ sơ ứng tuyển mới — ${fullname}`,
          body: `Ứng viên ${fullname} (SĐT: ${phone}) vừa nộp hồ sơ ứng tuyển vị trí ${jobTitle}.`,
          link: '/admin/tuyen-dung',
        }, { tx });
        return app;
      });
    },
  };
}

export const recruitmentRepository = createRecruitmentRepository();
export default recruitmentRepository;
