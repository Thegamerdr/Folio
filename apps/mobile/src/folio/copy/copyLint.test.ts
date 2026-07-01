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
});
