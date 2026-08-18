import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');

const PRODUCTION_SCAN_DIRS = [
  'routes',
  'repositories',
  'services',
  'middleware',
  'config',
  'commands',
];

const PRODUCTION_ENTRY_FILES = [
  'app.js',
  'server.js',
  'index.js',
];

const FORBIDDEN_PATTERNS = [
  { name: 'SQL Server Driver Import', regex: /import\s+.*from\s+['"](mssql|msnodesqlv8)[\/'"]/ },
  { name: 'SQL Server Driver Require', regex: /require\(['"](mssql|msnodesqlv8)[\/'"]\)/ },
  { name: 'T-SQL TOP clause', regex: /(?<!\.)\bTOP\s*(?:\(\s*\d+\s*\)|\d+)/i },
  { name: 'T-SQL GETDATE()', regex: /(?<!\.)\bGETDATE\s*\(\s*\)/i },
  { name: 'T-SQL OUTPUT INSERTED', regex: /\bOUTPUT\s+INSERTED\b/i },
  { name: 'T-SQL Lock Hints', regex: /WITH\s*\([^)]*(?:UPDLOCK|ROWLOCK|HOLDLOCK|NOLOCK|READPAST)[^)]*\)/i },
  { name: 'T-SQL FOR JSON PATH', regex: /\bFOR\s+JSON\s+PATH\b/i },
  { name: 'T-SQL System Views (sys.*)', regex: /(?<!\.)\bsys\.(?:dm_|objects|indexes|tables|columns)/i },
];

function getFilesRecursively(dir) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files = files.concat(getFilesRecursively(fullPath));
    } else if (item.isFile() && item.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('Static Production Code Guard: Zero SQL Server / T-SQL in Production Runtime', () => {
  it('strictly prohibits SQL Server driver dependencies from package.json production dependencies', () => {
    const pkgPath = path.join(backendRoot, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const prodDeps = pkg.dependencies || {};

    assert.equal(
      prodDeps.mssql,
      undefined,
      'mssql MUST NOT be present in production dependencies in package.json'
    );
    assert.equal(
      prodDeps.msnodesqlv8,
      undefined,
      'msnodesqlv8 MUST NOT be present in production dependencies in package.json'
    );
  });

  it('scans all production runtime files and guarantees NO T-SQL keywords or SQL Server driver imports', () => {
    const filesToScan = [];

    // Add entry files
    for (const entry of PRODUCTION_ENTRY_FILES) {
      const fullPath = path.join(backendRoot, entry);
      if (fs.existsSync(fullPath)) {
        filesToScan.push(fullPath);
      }
    }

    // Add directory files
    for (const dir of PRODUCTION_SCAN_DIRS) {
      const fullDir = path.join(backendRoot, dir);
      filesToScan.push(...getFilesRecursively(fullDir));
    }

    assert.ok(filesToScan.length >= 10, `Expected to scan at least 10 production files, got ${filesToScan.length}`);

    const violations = [];

    for (const filePath of filesToScan) {
      const relativePath = path.relative(backendRoot, filePath).replace(/\\/g, '/');
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        // Ignore single-line comments in JavaScript
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
          continue;
        }

        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.regex.test(line)) {
            violations.push({
              file: relativePath,
              line: lineIndex + 1,
              rule: pattern.name,
              content: trimmed,
            });
          }
        }
      }
    }

    assert.deepEqual(
      violations,
      [],
      `Found forbidden SQL Server / T-SQL patterns in production source files:\n${violations
        .map((v) => `  - [${v.file}:${v.line}] (${v.rule}): ${v.content}`)
        .join('\n')}`
    );
  });
});
