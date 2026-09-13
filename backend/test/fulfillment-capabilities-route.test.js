import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createFulfillmentCapabilitiesRoutes } from '../routes/admin/fulfillment-capabilities.js';

async function start(user) {
  const app = express();
  app.use((req, _res, next) => { req.user = user; next(); });
  app.use('/admin', createFulfillmentCapabilitiesRoutes({
    repository: {
      storeExists: async () => true,
      listCapabilities: async () => [{ lane_code: 'kitchen', display_name: 'Kitchen', is_enabled: true }],
    },
  }));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test('capabilities uses canonical role and branch_id claims for Manager branch scope', async () => {
  const fixture = await start({ role: 'manager', branch_id: 3, sub: 7 });
  try {
    const allowed = await fetch(`${fixture.baseUrl}/admin/branches/3/capabilities`);
    assert.equal(allowed.status, 200);

    const denied = await fetch(`${fixture.baseUrl}/admin/branches/2/capabilities`);
    assert.equal(denied.status, 403);
  } finally {
    await fixture.close();
  }
});
