import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeGoogleClientId } from '../google-signin';

const root = path.resolve(process.cwd(), 'src');
const header = fs.readFileSync(path.join(root, 'components/site/Header.tsx'), 'utf8');

describe('Google Sign-In frontend configuration', () => {
  it('only accepts a non-empty configured public client id', () => {
    expect(normalizeGoogleClientId('  client.apps.googleusercontent.com  ')).toBe('client.apps.googleusercontent.com');
    expect(normalizeGoogleClientId('')).toBe('');
    expect(normalizeGoogleClientId(undefined)).toBe('');
  });

  it('does not hard-code an OAuth client id or render GSI without configuration', () => {
    expect(header).toContain("from '@/lib/google-signin'");
    expect(header).toContain('if (typeof window === \'undefined\' || !hasGoogleSignIn) return;');
    expect(header).toContain('{hasGoogleSignIn && <>');
    expect(header).not.toMatch(/\d+-[a-z0-9]+\.apps\.googleusercontent\.com/);
  });
});
