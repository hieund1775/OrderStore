import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateJobId,
  validateJobInput,
  validateJobApplyInput,
  validateApplicationStatusInput,
  RecruitmentValidationError,
} from '../validation/recruitment-schemas.js';
import { toJobDto, toJobApplicationDto } from '../dto/recruitment-dto.js';
import { createRecruitmentService } from '../services/recruitment/recruitment-service.js';

test('Recruitment Lifecycle Suite', async (t) => {
  await t.test('validates job creation input properly', () => {
    const validated = validateJobInput({
      title: 'Nhân viên Pha Chế',
      type: 'Full-time',
      salary: '8 - 10 triệu',
      description: 'Pha chế trà và bảo quản hoa quả',
      requirements: 'Kinh nghiệm 6 tháng',
      benefits: 'Thưởng doanh số, phụ cấp gửi xe',
      is_active: true,
      store_ids: [1, 2],
    });

    assert.equal(validated.title, 'Nhân viên Pha Chế');
    assert.equal(validated.type, 'Full-time');
    assert.equal(validated.salary, '8 - 10 triệu');
    assert.deepEqual(validated.store_ids, [1, 2]);
    assert.equal(validated.is_active, true);
  });

  await t.test('rejects job creation with missing required fields', () => {
    assert.throws(
      () => {
        validateJobInput({
          title: 'Nhân viên',
          type: '',
        });
      },
      (err) => err instanceof RecruitmentValidationError,
    );
  });

  await t.test('validates candidate application input with VN name & phone', () => {
    const validated = validateJobApplyInput({
      fullname: 'Nguyễn Văn Nam',
      phone: '0901234567',
      email: 'nam.nguyen@example.com',
      store_id: '1',
      cv_url: 'https://example.com/cv.pdf',
    });

    assert.equal(validated.fullname, 'Nguyễn Văn Nam');
    assert.equal(validated.phone, '0901234567');
    assert.equal(validated.email, 'nam.nguyen@example.com');
    assert.equal(validated.store_id, 1);
  });

  await t.test('rejects candidate application with invalid phone or name', () => {
    assert.throws(
      () => {
        validateJobApplyInput({
          fullname: 'nguyen 123',
          phone: '12345',
          email: 'test@example.com',
        });
      },
      (err) => err instanceof Error,
    );
  });

  await t.test('validates application status transitions', () => {
    const validated = validateApplicationStatusInput({
      status: 'Phỏng vấn',
      note: 'Ứng viên tiềm năng, hẹn PV 14h',
    });
    assert.equal(validated.status, 'Phỏng vấn');
    assert.equal(validated.note, 'Ứng viên tiềm năng, hẹn PV 14h');

    assert.throws(
      () => validateApplicationStatusInput({ status: 'InvalidStatus' }),
      (err) => err instanceof RecruitmentValidationError,
    );
  });

  await t.test('maps job DTO and job application DTO correctly', () => {
    const jobDto = toJobDto({
      id: 5,
      title: 'Thu Ngân',
      type: 'Part-time',
      salary: '25k/h',
      description: 'Order món và thu tiền',
      requirements: 'Trung thực',
      benefits: null,
      is_active: true,
      stores: [{ id: 1, name: 'Chi nhánh 1' }],
      created_at: new Date().toISOString(),
    });
    assert.equal(jobDto.id, 5);
    assert.equal(jobDto.title, 'Thu Ngân');
    assert.equal(jobDto.stores.length, 1);

    const appDto = toJobApplicationDto({
      id: 12,
      job_id: 5,
      job_title: 'Thu Ngân',
      store_id: 1,
      store_name: 'Chi nhánh 1',
      fullname: 'Lê Hoàng Anh',
      phone: '0987654321',
      email: 'hoanganh@example.com',
      cv_url: null,
      status: 'Mới',
      note: null,
      created_at: new Date().toISOString(),
    });
    assert.equal(appDto.id, 12);
    assert.equal(appDto.job_title, 'Thu Ngân');
    assert.equal(appDto.fullname, 'Lê Hoàng Anh');
  });

  await t.test('recruitment service prevents applying to inactive job', async () => {
    const mockRepo = {
      getJobById: async () => ({ id: 1, is_active: false }),
    };
    const service = createRecruitmentService(mockRepo);
    await assert.rejects(
      () => service.applyJob({ jobId: 1, fullname: 'Trần Văn A', phone: '0912345678', email: 'a@b.com' }),
      (err) => err.message.includes('không tồn tại hoặc đã đóng'),
    );
  });
});
