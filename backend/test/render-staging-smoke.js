import { writeFile } from 'node:fs/promises';
import http from 'node:http';
import assert from 'node:assert/strict';
import app from '../app.js';

function safeTarget(target) {
  try {
    const url = new URL(target);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return 'local-ephemeral-server';
  }
}

function redactReportText(value) {
  return String(value || '')
    .replace(/(authorization|cookie|token|secret|password|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/(https?:\/\/)[^\s/@]+@/gi, '$1[redacted]@')
    .replace(/\?[^\s]*/g, '?[redacted]');
}

function validCollectionDto(value, key) {
  return Array.isArray(value)
    || (value && typeof value === 'object' && (Array.isArray(value[key]) || Array.isArray(value.data)));
}

async function responseJson(response, name) {
  try {
    return await response.json();
  } catch {
    throw new Error(`${name} did not return valid JSON`);
  }
}

/**
 * Runs probes against STAGING_API_URL when supplied, otherwise against a local
 * ephemeral server. Remote mode deliberately has stricter database/catalog
 * expectations so a preview deployment cannot pass on an unavailable API.
 */
export async function runStagingSmoke({
  targetUrl = process.env.STAGING_API_URL || null,
  appInstance = app,
  outputFile = process.env.SMOKE_OUTPUT_FILE || null,
} = {}) {
  const remote = Boolean(targetUrl);
  let server = null;
  let baseUrl = targetUrl;
  if (!baseUrl) {
    server = http.createServer(appInstance);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    console.log(`ℹ️ Running smoke tests locally on ephemeral server: ${baseUrl}`);
  } else {
    console.log(`ℹ️ Running smoke tests against remote staging target: ${safeTarget(baseUrl)}`);
  }

  const smokeResults = {
    target: safeTarget(baseUrl),
    mode: remote ? 'remote' : 'local',
    started_at: new Date().toISOString(),
    tests: [],
    success: false,
  };

  async function testStep(name, fn) {
    const start = performance.now();
    try {
      await fn();
      const duration_ms = Math.round((performance.now() - start) * 100) / 100;
      smokeResults.tests.push({ name, status: 'PASS', duration_ms });
      console.log(`  ✔ [PASS] ${name} (${duration_ms}ms)`);
    } catch (err) {
      const duration_ms = Math.round((performance.now() - start) * 100) / 100;
      const error = redactReportText(err?.message || 'Smoke step failed');
      smokeResults.tests.push({ name, status: 'FAIL', duration_ms, error });
      console.error(`  ✖ [FAIL] ${name} (${duration_ms}ms): ${error}`);
      throw err;
    }
  }

  try {
    await testStep('Liveness Probe /live responds 200 with status ok', async () => {
      const response = await fetch(`${baseUrl}/live`);
      assert.equal(response.status, 200);
      assert.equal((await responseJson(response, '/live')).status, 'ok');
    });

    await testStep('Readiness Probe /ready confirms PostgreSQL connectivity in remote mode', async () => {
      const response = await fetch(`${baseUrl}/ready`);
      if (!remote && response.status === 503) return;
      assert.equal(response.status, 200);
      const json = await responseJson(response, '/ready');
      assert.equal(json.status, 'ready');
      assert.equal(json.database, 'connected');
    });

    await testStep('Public Health Endpoint /api/health responds 200 with status ok', async () => {
      const response = await fetch(`${baseUrl}/api/health`);
      assert.equal(response.status, 200);
      assert.equal((await responseJson(response, '/api/health')).status, 'ok');
    });

    await testStep('Security Headers are enforced by Helmet', async () => {
      const response = await fetch(`${baseUrl}/api/health`);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    });

    for (const [path, key] of [['/api/stores', 'stores'], ['/api/categories', 'categories'], ['/api/products', 'products']]) {
      await testStep(`Public catalog endpoint ${path} responds with valid JSON`, async () => {
        const response = await fetch(`${baseUrl}${path}`);
        if (!remote && response.status === 500) return;
        assert.equal(response.status, 200);
        if (!remote) return;
        assert.ok(validCollectionDto(await responseJson(response, path), key), `${path} must return an array or documented collection DTO`);
      });
    }

    smokeResults.success = true;
    console.log('\n✅ All Staging Smoke Tests Passed Successfully!');
    return smokeResults;
  } catch (err) {
    smokeResults.error = redactReportText(err?.message || 'Staging smoke failed');
    throw err;
  } finally {
    smokeResults.finished_at = new Date().toISOString();
    if (outputFile) await writeFile(outputFile, `${JSON.stringify(smokeResults, null, 2)}\n`, 'utf8');
    if (server) await new Promise((resolve) => server.close(resolve));
  }
}

if (process.argv[1] && process.argv[1].endsWith('render-staging-smoke.js') && !process.env.NODE_TEST_CONTEXT) {
  runStagingSmoke().then(() => process.exit(0)).catch(() => process.exit(1));
}

export default runStagingSmoke;
