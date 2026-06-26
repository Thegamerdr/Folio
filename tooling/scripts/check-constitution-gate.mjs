import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'docs/product-constitution-gate.md',
  '.github/pull_request_template.md',
  'docs/source-package/02_PRODUCT_CONSTITUTION.md',
];

const requiredPhrases = [
  'local-first',
  'financial advice',
  'integer minor-unit money',
  'personal/business',
  'typed commands',
  'accessibility',
];

const missing = [];
let combined = '';

for (const file of requiredFiles) {
  try {
    combined += `\n${await readFile(join(root, file), 'utf8')}`;
  } catch {
    missing.push(file);
  }
}

for (const phrase of requiredPhrases) {
  if (!combined.toLowerCase().includes(phrase.toLowerCase())) {
    missing.push(`phrase: ${phrase}`);
  }
}

if (missing.length > 0) {
  console.error('Product constitution gate is incomplete:');
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log('Product constitution gate passed.');
