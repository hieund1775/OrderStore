export const PAYMENT_MODES = Object.freeze({
  QA_SANDBOX: 'qa_sandbox',
  PAYOS: 'payos',
});

export const VALID_PAYMENT_MODES = Object.freeze([
  PAYMENT_MODES.QA_SANDBOX,
  PAYMENT_MODES.PAYOS,
]);

export class PaymentModeConfigurationError extends Error {
  constructor(message, status = 500, code = 'PAYMENT_MODE_CONFIGURATION_ERROR') {
    super(message);
    this.name = 'PaymentModeConfigurationError';
    this.status = status;
    this.code = code;
    this.expose = true;
  }
}

export function resolvePaymentMode(envVars = process.env, isProd = false) {
  const rawMode = envVars?.PAYMENT_MODE?.trim();

  if (!rawMode) {
    throw new PaymentModeConfigurationError(
      isProd
        ? '[FATAL] Production requires PAYMENT_MODE to be explicitly set to "qa_sandbox" or "payos".'
        : '[FATAL] Cấu hình PAYMENT_MODE không hợp lệ: Phải cung cấp PAYMENT_MODE là "qa_sandbox" hoặc "payos".'
    );
  }

  if (!VALID_PAYMENT_MODES.includes(rawMode)) {
    throw new PaymentModeConfigurationError(
      `[FATAL] PAYMENT_MODE không hợp lệ: "${rawMode}". Chỉ chấp nhận "qa_sandbox" hoặc "payos".`
    );
  }

  return rawMode;
}

export function isSandboxPaymentMode(envVars = process.env) {
  try {
    return resolvePaymentMode(envVars) === PAYMENT_MODES.QA_SANDBOX;
  } catch {
    return false;
  }
}

export function assertSandboxPaymentMode(envVars = process.env) {
  const mode = resolvePaymentMode(envVars);
  if (mode !== PAYMENT_MODES.QA_SANDBOX) {
    const error = new Error('Cổng thanh toán sandbox không khả dụng');
    error.status = 404;
    error.code = 'SANDBOX_PAYMENT_UNAVAILABLE';
    throw error;
  }
  return true;
}
