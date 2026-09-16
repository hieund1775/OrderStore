import { resolvePaymentMode, isSandboxPaymentMode, PAYMENT_MODES } from '../config/payment-mode.js';
import directPayOSAttemptService from './direct-payos-attempt.js';
import groupedPayOSAttemptService from './grouped-payos-attempt.js';
import sandboxPaymentAttemptService from './sandbox-payment-attempt.js';

export function getActivePaymentProvider(envVars = process.env) {
  const mode = resolvePaymentMode(envVars);
  return mode === PAYMENT_MODES.QA_SANDBOX ? 'sandbox' : 'payos';
}

export function createPaymentProviderService({
  directPayOS = directPayOSAttemptService,
  groupedPayOS = groupedPayOSAttemptService,
  sandbox = sandboxPaymentAttemptService,
  getMode = () => resolvePaymentMode(process.env),
} = {}) {
  function getDelegate() {
    const mode = getMode();
    return mode === PAYMENT_MODES.QA_SANDBOX ? sandbox : null;
  }

  async function createForOrder(params) {
    const sandboxService = getDelegate();
    if (sandboxService) {
      return sandboxService.createForOrder(params);
    }
    return directPayOS.createForOrder(params);
  }

  async function createForGroup(params) {
    const sandboxService = getDelegate();
    if (sandboxService) {
      return sandboxService.createForGroup(params);
    }
    return groupedPayOS.createForGroup(params);
  }

  async function regenerateForCustomer(params) {
    const sandboxService = getDelegate();
    if (sandboxService) {
      return sandboxService.regenerateForCustomer(params);
    }
    const targetCode = String(params.code || params.groupCode || params.orderCode || '').trim();
    if (targetCode.startsWith('GRP')) {
      return groupedPayOS.regenerateForCustomer(params);
    }
    return directPayOS.regenerateForCustomer(params);
  }

  async function getStatus(params) {
    const sandboxService = getDelegate();
    if (sandboxService) {
      return sandboxService.getStatus(params);
    }
    // In PayOS mode, status is handled by legacy status endpoints or payos-reconciliation
    throw new Error('Status lookup for PayOS must use canonical PayOS reconciliation');
  }

  return {
    createForOrder,
    createForGroup,
    regenerateForCustomer,
    getStatus,
    getActiveProvider: () => (getMode() === PAYMENT_MODES.QA_SANDBOX ? 'sandbox' : 'payos'),
  };
}

export const paymentProviderService = createPaymentProviderService();
export default paymentProviderService;
