import defaultRecruitmentRepository from '../../repositories/postgres/recruitment.js';

export function createRecruitmentService(repository = defaultRecruitmentRepository) {
  return {
    async listJobs({ includeInactive = false, storeId } = {}) {
      return repository.listJobs({ includeInactive, storeId });
    },

    async getJobById(id) {
      return repository.getJobById(id);
    },

    async createJob(data) {
      return repository.createJob(data);
    },

    async updateJob(id, data) {
      return repository.updateJob(id, data);
    },

    async deleteJob(id) {
      return repository.deleteJob(id);
    },

    async listApplications({ jobId, storeId, status } = {}) {
      return repository.listApplications({ jobId, storeId, status });
    },

    async updateApplicationStatus(id, { status, note }) {
      return repository.updateApplicationStatus(id, { status, note });
    },

    async applyJob({ jobId, storeId, fullname, phone, email, cvUrl }) {
      const job = await repository.getJobById(jobId);
      if (!job || !job.is_active) {
        const err = new Error('Vị trí tuyển dụng không tồn tại hoặc đã đóng');
        err.status = 404;
        throw err;
      }
      return repository.createApplication({ jobId, storeId, fullname, phone, email, cvUrl });
    },
  };
}

export const recruitmentService = createRecruitmentService();
export default recruitmentService;
