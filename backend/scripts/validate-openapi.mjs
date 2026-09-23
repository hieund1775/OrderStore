import fs from 'fs';
import yaml from '../node_modules/yaml/index.js';

console.log('Validating docs/openapi.yaml...');
const content = fs.readFileSync('docs/openapi.yaml', 'utf8');
const doc = yaml.parse(content);

console.log('YAML parsed successfully.');
console.log('OpenAPI version:', doc.openapi);
console.log('Title:', doc.info?.title);
console.log('Servers:', doc.servers?.map(s => s.url));

let opCount = 0;
const errors = [];
const missingRefs = new Set();

const allSchemaKeys = new Set(Object.keys(doc.components?.schemas || {}));
const allParamKeys = new Set(Object.keys(doc.components?.parameters || {}));
const allSecKeys = new Set(Object.keys(doc.components?.securitySchemes || {}));

function checkRef(ref) {
  if (ref.startsWith('#/components/schemas/')) {
    const key = ref.replace('#/components/schemas/', '');
    if (!allSchemaKeys.has(key)) missingRefs.add(ref);
  } else if (ref.startsWith('#/components/parameters/')) {
    const key = ref.replace('#/components/parameters/', '');
    if (!allParamKeys.has(key)) missingRefs.add(ref);
  } else if (ref.startsWith('#/components/securitySchemes/')) {
    const key = ref.replace('#/components/securitySchemes/', '');
    if (!allSecKeys.has(key)) missingRefs.add(ref);
  } else {
    missingRefs.add(ref);
  }
}

function walkObj(obj) {
  if (!obj || typeof obj !== 'object') return;
  if (obj['$ref']) checkRef(obj['$ref']);
  for (const v of Object.values(obj)) {
    walkObj(v);
  }
}

walkObj(doc);

const tagCounts = {};

for (const [p, pItem] of Object.entries(doc.paths || {})) {
  const pathParams = (p.match(/\{([a-zA-Z0-9_]+)\}/g) || []).map(m => m.slice(1, -1));
  for (const [m, op] of Object.entries(pItem)) {
    if (['get', 'post', 'put', 'delete', 'patch'].includes(m)) {
      opCount++;
      (op.tags || []).forEach(t => {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
      // Check path params
      const declaredParams = (op.parameters || []).map(param => param.name || (param.$ref ? param.$ref.split('/').pop() : ''));
      for (const reqP of pathParams) {
        if (!declaredParams.includes(reqP)) {
          errors.push(`Path ${p} [${m}] missing declared path parameter: ${reqP}`);
        }
      }
      if (!op.responses || Object.keys(op.responses).length === 0) {
        errors.push(`Path ${p} [${m}] missing responses`);
      }
    }
  }
}

console.log('Total operations counted:', opCount);
console.log('Errors found:', errors.length);
if (errors.length > 0) console.log('Sample errors:', errors.slice(0, 5));
console.log('Missing $refs found:', missingRefs.size);
if (missingRefs.size > 0) console.log('Missing refs:', Array.from(missingRefs));

console.log('\n=== Operation Counts per Tag ===');
for (const [tag, count] of Object.entries(tagCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${tag.padEnd(25)}: ${count} operations`);
}

if (opCount === 217 && errors.length === 0 && missingRefs.size === 0) {
  console.log('\n🎉 VALIDATION PASSED: 100% of 217 endpoints verified with zero errors and zero broken references!');
  process.exit(0);
} else {
  console.error('\n❌ VALIDATION FAILED!');
  process.exit(1);
}
