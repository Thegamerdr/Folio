import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const source = ts.createSourceFile(
  'BulkStatementLanding.tsx',
  readFileSync(new URL('./BulkStatementLanding.tsx', import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function walk(node: ts.Node, visit: (child: ts.Node) => void) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function style(name: string): Record<string, string> {
  let result: Record<string, string> | undefined;
  walk(source, (node) => {
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(source) === name &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      result = Object.fromEntries(
        node.initializer.properties
          .filter(ts.isPropertyAssignment)
          .map((property) => [property.name.getText(source), property.initializer.getText(source)]),
      );
    }
  });
  expect(result).toBeDefined();
  return result!;
}

function pressablesUsing(styleName: string): ts.JsxOpeningElement[] {
  const matches: ts.JsxOpeningElement[] = [];
  walk(source, (node) => {
    if (
      ts.isJsxOpeningElement(node) &&
      node.tagName.getText(source) === 'Pressable' &&
      node.attributes.properties.some(
        (attribute) =>
          ts.isJsxAttribute(attribute) &&
          attribute.name.getText(source) === 'style' &&
          attribute.initializer?.getText(source) === `{styles.${styleName}}`,
      )
    ) {
      matches.push(node);
    }
  });
  return matches;
}

// Node cannot render React Native's Flow entry point. These source contracts prevent
// the exact 24dp checkbox / narrow Edit / 33dp footer regressions seen in332/337;
// actual touch bounds and keyboard room still require a rebuilt native capture.
describe('statement review actionable targets', () => {
  it('keeps the24dp checkbox visual inside a real48dp clickable target', () => {
    expect(style('check')).toMatchObject({ width: '24', height: '24' });
    expect(style('checkTarget')).toMatchObject({
      minWidth: '48',
      minHeight: '48',
      flexShrink: '0',
    });
    const targets = pressablesUsing('checkTarget');
    expect(targets).toHaveLength(1);
    expect(targets[0]!.attributes.getText(source)).toContain('accessibilityRole="checkbox"');
    expect(pressablesUsing('check')).toHaveLength(0);
  });

  it('gives Edit48dp width and height without relying on hitSlop outside the row', () => {
    expect(style('editButton')).toMatchObject({ minWidth: '48', minHeight: '48', flexShrink: '0' });
    const targets = pressablesUsing('editButton');
    expect(targets).toHaveLength(1);
    expect(targets[0]!.attributes.getText(source)).not.toContain('hitSlop');
  });

  it('gives all three batch actions48dp while avoiding extra primary spacing above the IME', () => {
    expect(style('batchButton')).toMatchObject({ minWidth: '48', minHeight: '48' });
    expect(pressablesUsing('batchButton')).toHaveLength(3);
    expect(style('footerPrimary')).toMatchObject({ marginTop: '0' });
    expect(source.text).toContain('styles.footerPrimary,');
  });
});
