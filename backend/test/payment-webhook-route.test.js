import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPayOSWebhookHandler } from '../routes/payments.js';

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

describe('PayOS payment-attempt webhook route', () => {
  it('accepts paid/idempotent attempt outcomes but never treats ambiguous resolution as paid', async () => {
    const paidResponse = responseRecorder();
    await createPayOSWebhookHandler({ processWebhook: async () => ({ kind: 'paid' }) })(
      { body: { data: { orderCode: 9001 } } }, paidResponse,
    );
    assert.equal(paidResponse.statusCode, 200);
    assert.deepEqual(paidResponse.body, { ok: true, message: 'Thanh toán thành công' });

    const ambiguousResponse = responseRecorder();
    await createPayOSWebhookHandler({ processWebhook: async () => ({ kind: 'ambiguous' }) })(
      { body: { data: { orderCode: 9001 } } }, ambiguousResponse,
    );
    assert.equal(ambiguousResponse.statusCode, 200);
    assert.equal(ambiguousResponse.body.ok, false);
  });

  it('returns a non-retryable response for invalid signatures and 500 only for infrastructure failures', async () => {
    const invalidSignature = responseRecorder();
    await createPayOSWebhookHandler({ processWebhook: async () => ({ kind: 'signature_invalid' }) })(
      { body: { data: { orderCode: 9002 } } }, invalidSignature,
    );
    assert.equal(invalidSignature.statusCode, 200);
    assert.equal(invalidSignature.body.ok, false);

    const infrastructure = responseRecorder();
    await createPayOSWebhookHandler({ processWebhook: async () => { throw new Error('database unavailable'); } })(
      { body: { data: { orderCode: 9002 } } }, infrastructure,
    );
    assert.equal(infrastructure.statusCode, 500);
    assert.equal(infrastructure.body.ok, false);
  });
});
