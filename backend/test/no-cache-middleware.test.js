import test from 'node:test';
import assert from 'node:assert/strict';
import { noCache } from '../middleware/no-cache.js';

test('noCache sets anti-cache headers and continues', () => {
  const headers = {};
  let continued = false;
  const res = {
    set(values) {
      Object.assign(headers, values);
    },
  };

  noCache({}, res, () => {
    continued = true;
  });

  assert.equal(continued, true);
  assert.deepEqual(headers, {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store',
  });
});
