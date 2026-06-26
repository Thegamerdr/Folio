import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const config = JSON.parse(await readFile(join(root, 'tooling/config/boundaries.json'), 'utf8'));
const importPattern =
  /(?:import|export)\s+(?:type\s+)?(?:[^'"]*from\s+)?['"]([^'"]+)['"]|import\(['"]([^'"]+)['"]\)/g;

const forbidden = config.forbiddenImportPatterns.map((pattern) => new RegExp(pattern, 'i'));
const violations = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'dist' || entry.name === 'node_modules') continue;
      files.push(...(await walk(path)));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(path);
    }
  }
  return files;
}

for (const packageName of config.purePackages) {
  const packageRoot = join(root, 'packages', packageName, 'src');
  const allowedFolioImports = new Set(config.allowedFolioImports[packageName] ?? []);
  let files = [];
  try {
    files = await walk(packageRoot);
  } catch {
    continue;
  }

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1] ?? match[2];
      if (!specifier) continue;

      const forbiddenMatch = forbidden.find((pattern) => pattern.test(specifier));
      if (forbiddenMatch) {
        violations.push(
          `${relative(root, file)} imports forbidden dependency "${specifier}" (${forbiddenMatch})`,
        );
      }

      if (specifier.startsWith('@folio/') && !allowedFolioImports.has(specifier)) {
        violations.push(
          `${relative(root, file)} imports "${specifier}", which is not allowed for ${packageName}`,
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Dependency boundary violations found:\n');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Dependency boundaries passed.');
