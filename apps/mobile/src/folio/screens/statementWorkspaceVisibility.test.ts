import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Node cannot render React Native's Flow entry point. Pin the production JSX boundary:
// a stalled reader entrance (opacity 0, translateX 28) must never own the interactive
// statement workspace. Native selection/keyboard behavior is verified separately.
describe('statement workspace visibility after an interrupted reader entrance', () => {
  it.each(['PasteSuccessScreen', 'PdfSuccessScreen', 'ImageSuccessScreen'])(
    '%s keeps account selection and bulk review outside the entrance animation',
    (name) => {
      const source = ts.createSourceFile(
        name,
        readFileSync(new URL(`./${name}.tsx`, import.meta.url), 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const bulkBranches: ts.IfStatement[] = [];
      const visit = (node: ts.Node) => {
        if (ts.isIfStatement(node) && node.expression.getText(source) === 'isBulk') {
          bulkBranches.push(node);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
      expect(bulkBranches).toHaveLength(1);
      const branch = bulkBranches[0]!;
      expect(ts.isBlock(branch.thenStatement)).toBe(true);
      const block = branch.thenStatement as ts.Block;
      const result = block.statements.find(ts.isReturnStatement);
      expect(result?.expression).toBeDefined();
      const expression = result!.expression!;
      const root = ts.isParenthesizedExpression(expression) ? expression.expression : expression;
      expect(ts.isJsxElement(root)).toBe(true);
      const frame = root as ts.JsxElement;
      expect(frame.openingElement.tagName.getText(source)).toBe('View');
      expect(frame.openingElement.attributes.getText(source)).not.toMatch(
        /enterStyle|opacity|transform/,
      );
      const children = frame.children.filter(ts.isJsxSelfClosingElement);
      expect(children.map((child) => child.tagName.getText(source))).toContain(
        'BulkStatementLanding',
      );
      // Ordinary one-item success pages retain their established entrance motion.
      expect(source.text).toContain(
        '<Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}',
      );
    },
  );
});
