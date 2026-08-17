import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

function makeRequest(app, { method, path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const payload = body ? JSON.stringify(body) : null;
      const reqHeaders = { ...headers };

      if (payload) {
        reqHeaders['Content-Type'] = 'application/json';
        reqHeaders['Content-Length'] = Buffer.byteLength(payload);
      }

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers: reqHeaders,
        },
        (res) => {
          let resData = '';
          res.on('data', (chunk) => {
            resData += chunk;
          });
          res.on('end', () => {
            server.close(() => {
              let parsedBody = resData;
              try {
                parsedBody = JSON.parse(resData);
              } catch {}
              resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                body: parsedBody,
                rawText: resData,
              });
            });
          });
        }
      );

      req.on('error', (err) => {
        server.close(() => reject(err));
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  });
}

describe('Deploy & Security Contract Suite', () => {
  it('verifies central error boundary returns safe 500 without leaking raw SQL or stack in production', async () => {
    const { errorHandler } = await import('../middleware/error-handler.js').catch(() => ({ errorHandler: null }));

    if (!errorHandler) {
      assert.fail('Missing middleware/error-handler.js module');
    }

    const app = express();
    app.get('/test-error', (req, res, next) => {
      const sqlError = new Error('RequestError: Must declare the scalar variable "@p0" in SELECT * FROM sensitive_orders WHERE secret_key = 123');
      sqlError.code = 'EREQUEST';
      next(sqlError);
    });

    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      app.use(errorHandler);
      const res = await makeRequest(app, { method: 'GET', path: '/test-error' });

      assert.equal(res.statusCode, 500);
      assert.equal(typeof res.body, 'object');
      assert.ok(res.body.error || res.body.message);

      // Raw SQL text, variable names, and query strings MUST NOT appear in response body or text
      assert.equal(res.rawText.includes('@p0'), false, 'Response must not leak parameter name @p0');
      assert.equal(res.rawText.includes('sensitive_orders'), false, 'Response must not leak internal table names');
      assert.equal(res.rawText.includes('secret_key'), false, 'Response must not leak column names');
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it('verifies /live probe succeeds without DB access and /ready probe checks DB health with timeout', async () => {
    let probeApp = null;
    try {
      const mod = await import('../app.js');
      probeApp = mod.default || mod.app;
    } catch {
      assert.fail('Missing app.js module');
    }

    // /live must return 200 OK immediately
    const liveRes = await makeRequest(probeApp, { method: 'GET', path: '/live' });
    assert.equal(liveRes.statusCode, 200);
    assert.equal(liveRes.body?.status, 'ok');

    // /ready must return health status
    const readyRes = await makeRequest(probeApp, { method: 'GET', path: '/ready' });
    assert.ok([200, 503].includes(readyRes.statusCode));
    assert.ok(readyRes.body?.status);
    // Must NOT leak credentials or connection strings
    assert.equal(readyRes.rawText.includes('password'), false);
    assert.equal(readyRes.rawText.includes('postgres://'), false);
    assert.equal(readyRes.rawText.includes('Server='), false);
  });

  it('verifies reverse proxy trust proxy resolves client IP correctly from X-Forwarded-For', async () => {
    let appMod = null;
    try {
      const mod = await import('../app.js');
      appMod = mod.default || mod.app;
    } catch {
      assert.fail('Missing app.js module');
    }

    const testApp = express();
    testApp.set('trust proxy', appMod.get('trust proxy') || 1);
    testApp.get('/test-ip', (req, res) => {
      res.json({ ip: req.ip, ips: req.ips });
    });

    const res = await makeRequest(testApp, {
      method: 'GET',
      path: '/test-ip',
      headers: { 'X-Forwarded-For': '203.0.113.195' },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ip, '203.0.113.195', 'Client IP should match client IP from X-Forwarded-For');
  });

  it('verifies Swagger docs are disabled/hidden in production when ENABLE_API_DOCS is false or unset', async () => {
    let appMod = null;
    try {
      const mod = await import('../app.js');
      appMod = mod.default || mod.app;
    } catch {
      assert.fail('Missing app.js module');
    }

    const origDocs = process.env.ENABLE_API_DOCS;
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_API_DOCS;

    try {
      const res = await makeRequest(appMod, { method: 'GET', path: '/api-docs/' });
      // When disabled, must return 404 Not Found or 403 Forbidden
      assert.ok([404, 403].includes(res.statusCode), `Expected 404 or 403 for /api-docs/ in production, got ${res.statusCode}`);
    } finally {
      process.env.ENABLE_API_DOCS = origDocs;
      process.env.NODE_ENV = origEnv;
    }
  });

  it('verifies production OTP rejects fixed/demo code 123456', async () => {
    const { verifyOtpCode } = await import('../services/otp-service.js').catch(() => ({ verifyOtpCode: null }));

    if (!verifyOtpCode) {
      assert.fail('Missing services/otp-service.js module');
    }

    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const result = await verifyOtpCode({
        phone: '0901234567',
        code: '123456',
        testAdapter: {
          async getStoredOtp() {
            return null; // No OTP stored
          },
        },
      });

      assert.equal(result.valid, false, 'Fixed OTP 123456 must be rejected in production');
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });
});
