import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), './MoreScreen.tsx'),
  'utf8',
);

describe('MoreScreen — pinned ScreenMore parity contract', () => {
  it('names the immutable source owner', () => {
    expect(source).toContain('ad90b4fee36c58be156e145e8663d8c6be1bf0eb');
    expect(source).toContain('src/components/folio/screens/ScreenMore.tsx');
  });

  it('keeps the exact five-section hierarchy and ten rows in source order', () => {
    const sectionStart = source.indexOf('const sections: MoreSection[] = [');
    const sectionEnd = source.indexOf("if (state === 'empty'", sectionStart);
    const composition = source.slice(sectionStart, sectionEnd);
    const orderedCopy = [
      "eyebrow: 'Find'",
      "title: 'Go straight there'",
      "label: 'Search Melo'",
      "eyebrow: 'Workspace'",
      "title: 'Switch workspace'",
      "label: 'Switch to Business'",
      "eyebrow: 'Your Melo'",
      "title: 'Looks, alerts and behaviour'",
      "label: 'Appearance'",
      "label: 'Notifications'",
      "label: 'Accessibility'",
      "label: 'Melo'",
      "eyebrow: 'Account & money'",
      "title: 'Identity and sources'",
      "label: 'Account and plan'",
      "label: 'Money sources'",
      "eyebrow: 'Privacy & control'",
      "title: 'Data and decisions'",
      "label: 'Data and privacy'",
      "label: 'AI and automation'",
    ];

    let cursor = -1;
    for (const copy of orderedCopy) {
      const next = composition.indexOf(copy, cursor + 1);
      expect(next, `${copy} should follow the preceding source element`).toBeGreaterThan(cursor);
      cursor = next;
    }
    expect(composition.match(/\blabel: '/g)).toHaveLength(10);
    expect(composition).toContain(
      "note: 'Nothing is connected, shared or deleted without an explicit step from you.'",
    );
  });

  it('removes the superseded implementation-index rows and wordmark', () => {
    expect(source).not.toContain("title: 'Your money'");
    expect(source).not.toContain("label: 'Timeline'");
    expect(source).not.toContain("label: 'Chart style'");
    expect(source).not.toContain("label: 'Hidden from Review'");
    expect(source).not.toContain("label: 'Fast-forward 1 month'");
    expect(source).not.toContain('styles.wordmark');
  });

  it('ports the source geometry instead of the stale shared Surface defaults', () => {
    expect(source).toContain('paddingTop: insets.top + gap.sm');
    expect(source).toContain('height: 64');
    expect(source).toContain('width: 64');
    expect(source).toContain('fontSize: 28');
    expect(source).toContain('lineHeight: 32.2');
    expect(source).toContain('marginTop: gap.xxl');
    expect(source).toContain('borderRadius: radius.lg');
    expect(source).toContain('borderWidth: 1');
    expect(source).toContain('paddingHorizontal: gap.lg');
    expect(source).toContain('fontSize: 12.5');
    expect(source).not.toContain('<Surface');
  });

  it('keeps the current native settings and trust authorities reachable', () => {
    expect(source).toContain("sheet: 'appearance'");
    expect(source).toContain('onPress: reminders.toggleEnabled');
    expect(source).toContain('onPress: describeAccessibility');
    expect(source).toContain("to: 'account'");
    expect(source).toContain("to: 'privacy'");
    expect(source).toContain('onPress: describeAiAutomation');
  });
});
