import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '..', '..', '..');
const assetRoot = join(mobileRoot, 'assets', 'canonical');
const registrySource = readFileSync(join(here, 'canonicalAssets.ts'), 'utf8');

function bundledFiles(directory: string): string[] {
  const files: string[] = [];
  const walk = (current: string) => {
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      if (statSync(path).isDirectory()) walk(path);
      else files.push(relative(directory, path).replaceAll('\\', '/'));
    }
  };
  walk(directory);
  return files.sort();
}

describe('frozen canonical asset bundle', () => {
  it('contains exactly 42 offline PNG binaries', () => {
    const files = bundledFiles(assetRoot);
    expect(files).toHaveLength(42);
    expect(files.every((file) => file.endsWith('.png'))).toBe(true);
  });

  it('registers every binary through a literal Metro require', () => {
    const files = bundledFiles(assetRoot);
    const required = [
      ...registrySource.matchAll(/require\('\.\.\/\.\.\/\.\.\/assets\/canonical\/([^']+)'\)/gu),
    ]
      .map((match) => match[1])
      .sort();
    expect(required).toEqual(files);
  });
});
