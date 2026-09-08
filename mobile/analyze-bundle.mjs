import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const bundle = Buffer.concat(chunks).toString('utf8');
  const tmpFile = join(tmpdir(), 'bundle.js');
  writeFileSync(tmpFile, bundle);
  console.log('Bundle size:', bundle.length, 'bytes');
  console.log('Saved to:', tmpFile);

  const lines = bundle.split('\n');
  let moduleCount = 0;
  for (const line of lines) {
    if (line.includes('__d(') || line.includes('__d (')) {
      moduleCount++;
    }
  }
  console.log('Module count:', moduleCount);
  console.log('First 5 lines:');
  for (let i = 0; i < 5; i++) console.log(lines[i]);
});