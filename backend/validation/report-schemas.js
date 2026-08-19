export class ReportValidationError extends Error {
  constructor(message, code = 'REPORT_VALIDATION_ERROR', status = 400) {
    super(message);
    this.name = 'ReportValidationError';
    this.code = code;
    this.status = status;
    this.expose = true;
  }
}

export function validateDateRange(from, to, { required = true } = {}) {
  if (!from || !to) {
    if (required) {
      throw new ReportValidationError('Thiếu tham số khoảng thời gian (from, to)');
    }
    return { from: null, to: null };
  }
  return { from: String(from).trim(), to: String(to).trim() };
}
