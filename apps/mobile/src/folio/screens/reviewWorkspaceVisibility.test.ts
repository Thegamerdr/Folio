import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { reviewMatch } from '../lib/reviewDedupe';
import type { Transaction } from '../store';

// The native failure left the entire form transparent after an edited merchant stopped matching
// an existing row, while the keyboard and Review tabs stayed visible. Node cannot run Reanimated's
// native UI thread: assert the production visibility boundary, then exercise the actual proposal
// transition separately. A new native keyboard replay remains required.
describe('Review visibility through a duplicate-to-new-item edit', () => {
  const source = ts.createSourceFile(
    'ReviewScreen.tsx',
    readFileSync(new URL('./ReviewScreen.tsx', import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  it('keeps both embedded and standalone populated/empty frames independent of animation', () => {
    const roots: ts.JsxOpeningElement[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node)) {
        const attributes = node.attributes.getText(source);
        if (/\b(?:sourceStyles|styles)\.root\b/.test(attributes)) roots.push(node);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(roots).toHaveLength(4);
    for (const root of roots) {
      expect(root.tagName.getText(source)).toBe('View');
      expect(root.attributes.getText(source)).not.toMatch(/enterStyle|opacity|transform/);
    }
  });

  it('limits animated visibility to non-interactive acceptance stamps', () => {
    const animations: ts.JsxElement[] = [];
    const visit = (node: ts.Node) => {
      if (
        ts.isJsxElement(node) &&
        node.openingElement.tagName.getText(source) === 'Animated.View'
      ) {
        animations.push(node);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(animations).toHaveLength(2);
    for (const animation of animations) {
      expect(animation.openingElement.attributes.getText(source)).toContain('stampStyle');
      expect(animation.getText(source)).not.toMatch(/TextInput|Pressable|ScrollView/);
    }
  });

  it('changes a shared-name proposal into a new-item decision without changing recorded history', () => {
    const existing: Transaction[] = [
      {
        id: 'recorded',
        merchant: 'Evidence batch',
        amount: -1.23,
        when: '2026-09-10T00:00:00Z',
        category: 'other',
        source: 'manual',
      },
    ];
    const before = structuredClone(existing);
    const candidate = {
      id: 'candidate',
      merchant: 'Evidence ordinary',
      amount: -8.76,
      dateIso: '2026-09-10',
    };
    expect(reviewMatch(candidate, existing, '2026-09-10')?.kind).toBe('propose-amount-changed');
    expect(
      reviewMatch({ ...candidate, merchant: 'Zebra clinic' }, existing, '2026-09-10'),
    ).toBeNull();
    expect(reviewMatch(candidate, existing, '2026-09-10')?.kind).toBe('propose-amount-changed');
    expect(existing).toEqual(before);
  });
});
