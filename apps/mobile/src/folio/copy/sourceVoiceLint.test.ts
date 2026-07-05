// Source-level voice-lint gate for the files shipped today.
//
// copyLint.test.ts checks the copy DECK (the `copy` object). This test checks the actual SOURCE of
// the user-facing files that carry today's honest-claims + voice work: it reads each file as text
// (no react-native runtime needed — plain string scan, Node-safe), extracts string literals, and
// asserts none of them trip the shared BANNED_PATTERNS from @folio/melo-engine (negative "again",
// "you failed", "you should have", "treat yourself", ALL-CAPS panic words, etc).
//
// Reuses BANNED_PATTERNS rather than redefining the list, so this gate can never drift from the
// engine's canonical banned-voice rules.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { BANNED_PATTERNS } from '@folio/melo-engine';

// The user-facing files shipped today. Exported so a future addition to this batch only needs one
// line here, not a new test file.
export const SOURCE_VOICE_LINT_FILES: readonly string[] = [
  '../ui/Toast.tsx',
  '../sheets/SignInSheet.tsx',
  '../widget/SafeZoneWidget.tsx',
  '../screens/today/TodayNudges.tsx',
  '../screens/PrivacyScreen.tsx',
] as const;

function read(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url).href), 'utf8');
}

// Strip `//` line comments and `/* */` block comments before scanning for literals, so comment
// prose (which often uses ALL-CAPS emphasis like "REAL" or "OS") never masquerades as a banned
// user-visible string.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');
}

// Extract string-literal contents (single/double/template-quoted) from source text, one line at a
// time so a literal can never accidentally span a comment or an unrelated later line. Good enough
// to catch banned words in visible copy without needing a full TS parser.
function extractStringLiterals(source: string): string[] {
  const literals: string[] = [];
  const pattern = /(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/gu;
  for (const line of stripComments(source).split('\n')) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(line)) !== null) {
      const value = match[2] ?? '';
      if (value.trim().length > 0) literals.push(value);
    }
  }
  return literals;
}

describe('source voice-lint — shipped-today files', () => {
  for (const file of SOURCE_VOICE_LINT_FILES) {
    it(`${file} carries no banned voice patterns in its string literals`, () => {
      const source = read(file);
      const literals = extractStringLiterals(source);

      const violations: string[] = [];
      for (const literal of literals) {
        for (const banned of BANNED_PATTERNS) {
          if (banned.re.test(literal)) {
            violations.push(`"${literal}" matches banned pattern "${banned.name}"`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  }
});
