import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lookupPaymentLinkForRecovery, setPayOSForTest } from '../services/payos.js';

afterEach(() => setPayOSForTest(null));

describe('PayOS payment-attempt recovery lookup', () => {
  it('treats only a confirmed 404 as safe to create with a reserved code', async () => {
    setPayOSForTest({
      paymentRequests: {
        get: async () => {
          const error = new Error('not found');
          error.statusCode = 404;
          throw error;
        },
      },
    });

    assert.deepEqual(await lookupPaymentLinkForRecovery(91234567890123, 'DIRECT_A'), { kind: 'not_found' });
  });

  it('treats timeout and 5xx lookup failures as uncertain and keeps the attempt recoverable', async () => {
    for (const error of [Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }), Object.assign(new Error('upstream'), { status: 502 })]) {
      setPayOSForTest({ paymentRequests: { get: async () => { throw error; } } });
      const result = await lookupPaymentLinkForRecovery(91234567890123, 'DIRECT_A');
      assert.equal(result.kind, 'unknown');
      setPayOSForTest(null);
    }
  });
});
