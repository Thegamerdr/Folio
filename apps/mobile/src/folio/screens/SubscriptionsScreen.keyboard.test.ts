import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// The native regression hid both decisions whenever the amount keyboard opened. This pins
// their shared keyboard-safe host; actual IME geometry still needs a rebuilt-device replay.
describe('bill editor keyboard actions', () => {
  it('keeps Save and Cancel in the Sheet footer while the fields scroll independently', () => {
    const source = ts.createSourceFile(
      'SubscriptionsScreen.tsx',
      readFileSync(new URL('./SubscriptionsScreen.tsx', import.meta.url), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const sheets: ts.JsxElement[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'Sheet') {
        sheets.push(node);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(sheets).toHaveLength(1);
    const sheet = sheets[0]!;
    const footer = sheet.openingElement.attributes.properties.find(
      (attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === 'footer',
    );
    expect(footer).toBeDefined();
    const footerText = footer!.getText(source);
    const body = sheet.children.map((child) => child.getText(source)).join('\n');
    for (const label of ['Save bill changes', 'Cancel editing']) {
      expect(footerText).toContain(`label="${label}"`);
      expect(body).not.toContain(`label="${label}"`);
    }
    for (const label of ['Bill name', 'Future bill amount']) {
      expect(body).toContain(`accessibilityLabel="${label}"`);
      expect(footerText).not.toContain(`accessibilityLabel="${label}"`);
    }
  });
});
