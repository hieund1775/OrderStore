import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const canonicalSqlPath = path.join(here, 'verification', '0026_payment_attempts_legacy_blocker_audit_readonly.sql');
const CLASSIFICATIONS = new Set(['ACTIVE_PAYMENT_REQUIRES_REPAIR', 'SAFE_TO_SKIP_HISTORY', 'AMBIGUOUS_BLOCK']);

export const CANONICAL_CLASSIFIER_VERSION = '0026-canonical-legacy-v1';
export const PINNED_MANIFEST = Object.freeze({
  total: 174,
  counts: { ACTIVE_PAYMENT_REQUIRES_REPAIR: 100, SAFE_TO_SKIP_HISTORY: 47, AMBIGUOUS_BLOCK: 27 },
  fingerprints: {
    overall: 'ca7a42e94110932c30045e78bc9a0c05',
    ACTIVE_PAYMENT_REQUIRES_REPAIR: '679fef57136a74a4001be8af2e385193',
    SAFE_TO_SKIP_HISTORY: '1d60ee8c6bbc17452600c5730df05fb1',
    AMBIGUOUS_BLOCK: '4f879f6d43e7f779d471f4a545284324',
  },
});

export async function readCanonicalClassifierSql() { return fs.readFile(canonicalSqlPath, 'utf8'); }

function sortedTargets(targets) {
  return [...targets].sort((a, b) => String(a.target_kind).localeCompare(String(b.target_kind)) || Number(a.target_id) - Number(b.target_id));
}

export function manifestFingerprint(targets) {
  return crypto.createHash('md5').update(sortedTargets(targets).map((row) => `${row.target_kind}:${row.target_id}`).join('|')).digest('hex');
}

export function validateManifest(manifest) {
  if (!manifest || manifest.classifier_version !== CANONICAL_CLASSIFIER_VERSION || !Array.isArray(manifest.targets)) throw new Error('LEGACY MANIFEST: invalid schema/version.');
  const targets = sortedTargets(manifest.targets);
  const keys = new Set();
  for (const row of targets) {
    if (!['direct_order', 'checkout_group'].includes(row.target_kind) || !Number.isInteger(Number(row.target_id)) || !CLASSIFICATIONS.has(row.classification)) throw new Error('LEGACY MANIFEST: invalid target row.');
    const key = `${row.target_kind}:${row.target_id}`;
    if (keys.has(key)) throw new Error('LEGACY MANIFEST: duplicate target.');
    keys.add(key);
  }
  const counts = Object.fromEntries([...CLASSIFICATIONS].map((classification) => [classification, targets.filter((row) => row.classification === classification).length]));
  if (targets.length !== PINNED_MANIFEST.total || JSON.stringify(counts) !== JSON.stringify(PINNED_MANIFEST.counts) || manifestFingerprint(targets) !== PINNED_MANIFEST.fingerprints.overall) throw new Error('LEGACY MANIFEST: pinned count/fingerprint mismatch.');
  for (const classification of CLASSIFICATIONS) if (manifestFingerprint(targets.filter((row) => row.classification === classification)) !== PINNED_MANIFEST.fingerprints[classification]) throw new Error('LEGACY MANIFEST: pinned classification fingerprint mismatch.');
  return { ...manifest, targets, counts, fingerprints: PINNED_MANIFEST.fingerprints };
}

export function compareCanonicalRows(rows, manifest) {
  const expected = validateManifest(manifest).targets;
  const actual = sortedTargets(rows.map((row) => ({ target_kind: row.target_kind, target_id: Number(row.target_id), classification: row.classification })));
  if (actual.length !== expected.length || actual.some((row, index) => row.target_kind !== expected[index].target_kind || row.target_id !== expected[index].target_id || row.classification !== expected[index].classification)) throw new Error('LEGACY MANIFEST: canonical production set mismatch.');
  return { count: actual.length, fingerprints: PINNED_MANIFEST.fingerprints };
}

export async function loadLegacyManifest(manifestPath) {
  if (!manifestPath || !path.isAbsolute(manifestPath)) throw new Error('LEGACY MANIFEST: absolute --legacy-manifest path is required.');
  const bytes = await fs.readFile(manifestPath);
  const manifest = validateManifest(JSON.parse(bytes.toString('utf8')));
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== '55dffd0302812a5276da132d31c71af83e6ba2ebb509bdaf3e7f4590762e9112') throw new Error('LEGACY MANIFEST: SHA-256 mismatch.');
  return { ...manifest, sha256 };
}
