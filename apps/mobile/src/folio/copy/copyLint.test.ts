// Copy-lint gate — ported 1:1 from the design worktree's COPY_LINT.md + COPY_DECK.md.
//
// This is the RN port of the web prototype's copy-lint check. It imports the real `copy`
// object (the single source of truth, COPY_DECK.md transcribed verbatim), recursively
// flattens every string value it produces — calling function entries with placeholder
// args so parameterized lines are exercised too — and asserts that NONE of them:
//   • contains any BANNED string (case-insensitive, the union of the two source lists), or
//   • matches any BANNED claim-shape regex (the honesty rules from COPY_LINT.md).
//
// Node-safe: it touches only the string module, so no DOM / react-native runtime is needed
// and the file is a plain `.test.ts` (the runner collects apps/**/*.test.ts, not *.tsx).
//
// BANNED_STRINGS and BANNED_CLAIM_SHAPES are exported so future per-screen tests can reuse
// the exact same gate against their own rendered copy.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { copy } from './copy';

// ---------------------------------------------------------------------------
// Banned strings — case-insensitive. Union of:
//   • COPY_LINT.md "Banned strings (case-insensitive)"
//   • COPY_DECK.md "Banned words (hard fail)"
// Deduplicated, lower-cased (the check lower-cases the copy before comparing).
// ---------------------------------------------------------------------------
export const BANNED_STRINGS: readonly string[] = [
  // shared by both lists
  'import',
  'rows',
  'parser',
  'extraction',
  'ocr',
  'provenance',
  'indexed',
  'source record',
  'bank-grade',
  // COPY_LINT.md only
  'encrypted at rest',
  'stays on this device',
  '100% private',
  'zero-knowledge',
  'military-grade',
  // COPY_DECK.md only
  'parse',
  'extract',
  'sync',
  'dashboard',
  'analytics',
  'users',
  '100%',
  'ai-powered',
  'smart',
  // COPY_DECK.md "Honest claims only" — phrasings to avoid
  'fully private',
  'bank-level security',
];

// ---------------------------------------------------------------------------
// Banned claim shapes — COPY_LINT.md "Banned claim shapes (regex)".
// Honesty rules: the app must actually do what the copy says, so these claim
// shapes are forbidden unless literally true (we forbid them outright here).
// ---------------------------------------------------------------------------
export const BANNED_CLAIM_SHAPES: readonly RegExp[] = [
  /we (never|don't) (see|store|read|sell|share) your/i,
  /your data (never|doesn't) leave/i,
  /runs entirely on (your )?(device|phone)/i,
  // "encrypted"/"encryption" claims — only allowed if literally true at write time.
  /(end[- ]to[- ]end )?encrypt(ed|ion)/i,
];

// ---------------------------------------------------------------------------
// Flatten every string the copy object can produce.
// Function entries are parameterized lines: call them with placeholder args so
// the resolved string is checked too. Placeholders cover the param shapes used
// in the deck: a name/label ('X') and an amount/count ('5').
// ---------------------------------------------------------------------------
type CopyNode = string | ((...args: string[]) => string) | { readonly [key: string]: CopyNode };

const PLACEHOLDER_ARGS: readonly string[] = ['X', '5', 'X'];

function flattenCopy(node: CopyNode, trail: string, out: { path: string; value: string }[]): void {
  if (typeof node === 'string') {
    out.push({ path: trail, value: node });
    return;
  }

  if (typeof node === 'function') {
    // Resolve with placeholder args. Up to 3 params are used across the deck.
    const resolved = node(...PLACEHOLDER_ARGS);
    out.push({ path: trail, value: resolved });
    return;
  }

  for (const key of Object.keys(node)) {
    // node[key] is typed CopyNode | undefined under noUncheckedIndexedAccess, but every key
    // comes from Object.keys(node), so the value is always present. Skip the impossible undefined.
    const child = node[key];
    if (child === undefined) continue;
    flattenCopy(child, trail ? `${trail}.${key}` : key, out);
  }
}

function collectStrings(): { path: string; value: string }[] {
  const out: { path: string; value: string }[] = [];
  flattenCopy(copy as unknown as CopyNode, '', out);
  return out;
}

const COPY_ROOT = dirname(fileURLToPath(import.meta.url));
const FOLIO_ROOT = join(COPY_ROOT, '..');
const USER_FACING_SOURCE_ROOTS = ['screens', 'sheets', 'ui', 'shell', 'melo', 'widget'] as const;
const VISIBLE_PROPERTY_NAMES = new Set([
  'accessibilityHint',
  'accessibilityLabel',
  'body',
  'copy',
  'description',
  'empty',
  'eyebrow',
  'headline',
  'help',
  'hint',
  'label',
  'message',
  'placeholder',
  'subline',
  'subtitle',
  'tagline',
  'text',
  'title',
]);
const VISIBLE_JSX_ATTRIBUTE_NAMES = new Set([
  'accessibilityHint',
  'accessibilityLabel',
  'label',
  'placeholder',
  'subtitle',
  'title',
]);
const VISIBLE_CALL_NAMES = new Set(['alert', 'setError', 'setNotice', 'showToast', 'toast']);

type SourceCopy = Readonly<{
  claimBacked: boolean;
  file: string;
  line: number;
  value: string;
}>;

function walkUserFacingSource(): string[] {
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(?:ts|tsx)$/u.test(name) && !/\.test\.(?:ts|tsx)$/u.test(name)) files.push(path);
    }
  };
  for (const root of USER_FACING_SOURCE_ROOTS) walk(join(FOLIO_ROOT, root));
  return files;
}

function propertyName(node: ts.PropertyName): string | null {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  return null;
}

function isInsideVisibleText(node: ts.Node): boolean {
  let current = node.parent;
  while (current !== undefined) {
    if (ts.isJsxElement(current)) {
      return current.openingElement.tagName.getText() === 'Text';
    }
    if (ts.isSourceFile(current)) return false;
    current = current.parent;
  }
  return false;
}

function isTechnicalControlLiteral(node: ts.Node): boolean {
  let current = node.parent;
  while (current !== undefined && !ts.isJsxExpression(current)) {
    if (
      ts.isBinaryExpression(current) ||
      ts.isCaseClause(current) ||
      ts.isPropertyAccessExpression(current)
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function callName(node: ts.CallExpression): string | null {
  if (ts.isIdentifier(node.expression)) return node.expression.text;
  if (ts.isPropertyAccessExpression(node.expression)) return node.expression.name.text;
  return null;
}

function literalFragments(node: ts.Node): string[] {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isTemplateExpression(node)) {
    return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)];
  }
  return [];
}

function visibleSourceCopy(file: string): SourceCopy[] {
  const source = readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: SourceCopy[] = [];
  const add = (node: ts.Node, value: string) => {
    const trimmed = value.replace(/\s+/gu, ' ').trim();
    if (trimmed.length === 0) return;
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;
    const sourceLines = source.split('\n');
    const claimWindow = sourceLines.slice(Math.max(0, line - 5), line + 1).join('\n');
    found.push({
      claimBacked: /\bCLAIM:/u.test(claimWindow),
      file: relative(FOLIO_ROOT, file).replaceAll('\\', '/'),
      line: line + 1,
      value: trimmed,
    });
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) add(node, node.text);

    const fragments = literalFragments(node);
    if (fragments.length > 0) {
      let visible = isInsideVisibleText(node) && !isTechnicalControlLiteral(node);
      const parent = node.parent;
      if (
        ts.isJsxAttribute(parent) &&
        VISIBLE_JSX_ATTRIBUTE_NAMES.has(parent.name.getText(sourceFile))
      ) {
        visible = true;
      }
      if (
        ts.isPropertyAssignment(parent) &&
        VISIBLE_PROPERTY_NAMES.has(propertyName(parent.name) ?? '')
      ) {
        visible = true;
      }
      if (ts.isCallExpression(parent) && VISIBLE_CALL_NAMES.has(callName(parent) ?? '')) {
        visible = true;
      }
      if (visible) {
        for (const fragment of fragments) add(node, fragment);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function escapedPattern(value: string): RegExp {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const startsWithWord = /^\w/u.test(value);
  const endsWithWord = /\w$/u.test(value);
  return new RegExp(`${startsWithWord ? '\\b' : ''}${escaped}${endsWithWord ? '\\b' : ''}`, 'iu');
}

describe('copy-lint gate', () => {
  const strings = collectStrings();

  it('flattens at least one visible string from the copy deck', () => {
    expect(strings.length).toBeGreaterThan(0);
  });

  it('contains no banned strings (case-insensitive)', () => {
    const hits: string[] = [];
    for (const entry of strings) {
      const lower = entry.value.toLowerCase();
      for (const banned of BANNED_STRINGS) {
        if (lower.includes(banned)) {
          hits.push(`${entry.path}: "${entry.value}" contains banned word "${banned}"`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('matches no banned claim-shape regexes', () => {
    const hits: string[] = [];
    for (const entry of strings) {
      for (const shape of BANNED_CLAIM_SHAPES) {
        if (shape.test(entry.value)) {
          hits.push(
            `${entry.path}: "${entry.value}" matches banned claim shape ${shape.toString()}`,
          );
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('scans every shipped RN screen, sheet and shared user-facing primitive', () => {
    const files = walkUserFacingSource();
    expect(files.length).toBeGreaterThan(60);
  });

  it('keeps banned vocabulary and claims out of shipped RN source copy', () => {
    const bannedPatterns = BANNED_STRINGS.map((value) => ({
      value,
      pattern: escapedPattern(value),
    }));
    const hits: string[] = [];
    for (const file of walkUserFacingSource()) {
      for (const entry of visibleSourceCopy(file)) {
        for (const banned of bannedPatterns) {
          if (banned.pattern.test(entry.value)) {
            hits.push(
              `${entry.file}:${entry.line}: "${entry.value}" contains banned copy "${banned.value}"`,
            );
          }
        }
        for (const shape of BANNED_CLAIM_SHAPES) {
          if (shape.test(entry.value) && !entry.claimBacked) {
            hits.push(
              `${entry.file}:${entry.line}: "${entry.value}" makes an unbacked claim matching ${shape.toString()}`,
            );
          }
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
