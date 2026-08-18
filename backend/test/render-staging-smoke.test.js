import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import { runStagingSmoke } from './render-staging-smoke.js';

async function withServer(handler, fn) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function mockApi({ catalogStatus = 200, readyStatus = 200 } = {}) {
  return (req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/live' || req.url === '/api/health') {
      res.setHeader('x-content-type-options', 'nosniff');
      return res.end(JSON.stringify({ status: 'ok' }));
    }
    if (req.url === '/ready') {
      res.statusCode = readyStatus;
      return res.end(JSON.stringify(readyStatus === 200 ? { status: 'ready', database: 'connected' } : { status: 'not_ready' }));
    }
    if (['/api/stores', '/api/categories', '/api/products'].includes(req.url)) {
      res.statusCode = catalogStatus;
      return res.end(JSON.stringify(catalogStatus === 200 ? [] : { error: 'database unavailable' }));
    }
    res.statusCode = 404;
    return res.end(JSON.stringify({ error: 'not found' }));
  };
}

describe('Render staging smoke strictness', () => {
  it('requires remote readiness and catalog endpoints, and writes a deterministic safe report', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'teaplus-smoke-'));
    const outputFile = join(directory, 'report.json');
    try {
      await withServer(mockApi(), async (targetUrl) => {
        const report = await runStagingSmoke({ targetUrl, outputFile });
        assert.equal(report.success, true);
      });
      const report = JSON.parse(await readFile(outputFile, 'utf8'));
      assert.equal(report.mode, 'remote');
      assert.equal(report.success, true);
      assert.ok(report.started_at);
      assert.ok(report.finished_at);
      assert.equal(report.tests.length, 7);
      assert.ok(report.tests.every((step) => step.status === 'PASS' && Number.isFinite(step.duration_ms)));
      assert.equal(report.target.includes('127.0.0.1'), true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('fails remote mode for a catalog outage but permits the same no-DB response locally', async () => {
    await withServer(mockApi({ readyStatus: 503 }), async (targetUrl) => {
      await assert.rejects(() => runStagingSmoke({ targetUrl }), /503/);
    });
    await withServer(mockApi({ catalogStatus: 500 }), async (targetUrl) => {
      await assert.rejects(() => runStagingSmoke({ targetUrl }), /500/);
    });
    await withServer((req, res) => {
      if (req.url === '/live' || req.url === '/api/health') {
        res.setHeader('content-type', 'application/json');
        res.setHeader('x-content-type-options', 'nosniff');
        return res.end(JSON.stringify({ status: 'ok' }));
      }
      if (req.url === '/ready') {
        res.statusCode = 503;
        return res.end(JSON.stringify({ status: 'not_ready' }));
      }
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ error: 'database unavailable' }));
    }, async (baseUrl) => {
      const localProxy = (req, res) => fetch(`${baseUrl}${req.url}`).then(async (response) => {
        res.statusCode = response.status;
        for (const [key, value] of response.headers) res.setHeader(key, value);
        res.end(await response.text());
      });
      const report = await runStagingSmoke({ appInstance: localProxy });
      assert.equal(report.mode, 'local');
      assert.equal(report.success, true);
    });
  });
});
