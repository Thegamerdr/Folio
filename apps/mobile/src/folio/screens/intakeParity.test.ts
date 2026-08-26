import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { classifyPdfImportOutcome } from '../../local/pdfImportTransaction';

const source = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), './IntakeScreen.tsx'),
  'utf8',
);

describe('IntakeScreen — canonical acquisition parity', () => {
  it('keeps the pinned acquisition hierarchy and real native picker routes', () => {
    expect(source).toContain("'Let Melo '");
    expect(source).toContain('understand');
    expect(source).toContain("title: 'Statement or sheet'");
    expect(source).toContain("title: 'Photo or screenshot'");
    expect(source).toContain("title: 'Paste rows'");
    expect(source).toContain("title: 'Type it yourself'");
    expect(source).toContain("pick: 'document'");
    expect(source).toContain("pick: 'photo'");
    expect(source).toContain('runClipboardPaste');
  });

  it('shows Open Banking as unavailable while keeping its doorway navigable', () => {
    expect(source).toContain("title: 'Connect an account'");
    expect(source).toContain(
      "hint: 'a read-only feed from your bank — not available in this build'",
    );
    expect(source).toContain("to: 'connections'");
    expect(source).toContain('unavailable: true');
    // The option still goes through onSelect's normal navigation branch; it is not a dead/disabled
    // press target, and ConnectionsScreen owns the honest provider explanation.
    expect(source).toContain('nav.go(option.to)');
  });

  it('keeps waiting items grouped by source and routes each group to review', () => {
    expect(source).toContain('const waiting = useAppStore((current) => current.reviewQueue ?? [])');
    expect(source).toContain('suggested · not added');
    expect(source).toContain("nav.go('review')");
    expect(source).toContain('function waitingSourceLabel');
  });

  it('keeps terminal classification independent from intake copy changes', () => {
    expect(classifyPdfImportOutcome({ kind: 'parsed', reviewItemCount: 2 })).toBe(
      'parsed-with-review-items',
    );
    expect(classifyPdfImportOutcome({ kind: 'parsed', reviewItemCount: 0 })).toBe(
      'parsed-no-review-needed',
    );
  });
});
