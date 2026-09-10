import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

// Execute the production date-selection callbacks with controlled React setters. The Node runner
// cannot mount React Native, so layout assertions only pin the collision-prevention contract;
// a native Month -> Full day -> Week replay remains required for rendered verification.
const source = ts.createSourceFile(
  'CalendarScreen.tsx',
  readFileSync(new URL('./CalendarScreen.tsx', import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function findOne(root: ts.Node, predicate: (node: ts.Node) => boolean): ts.Node {
  const found: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    if (predicate(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  expect(found).toHaveLength(1);
  return found[0]!;
}

function component(name: string) {
  return findOne(source, (node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
}

function run(node: ts.Node, bindings: Record<string, unknown>, ...args: unknown[]) {
  const js = ts.transpileModule(`const callback = ${node.getText(source)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(...Object.keys(bindings), `${js}\nreturn callback;`)(
    ...Object.values(bindings),
  )(...args);
}

function variableCallback(owner: string, name: string) {
  const node = findOne(
    component(owner),
    (node) => ts.isVariableDeclaration(node) && node.name.getText(source) === name,
  ) as ts.VariableDeclaration;
  return node.initializer!;
}

function dateEffect(owner: string) {
  return findOne(
    component(owner),
    (node) =>
      ts.isArrowFunction(node) &&
      ts.isCallExpression(node.parent) &&
      node.parent.expression.getText(source) === 'useEffect' &&
      node.getText(source).includes('setOffset('),
  );
}

const isoDay = (date: Date) => run(component('isoDay'), {}, date) as string;
const shiftIso = (date: string, days: number) =>
  run(component('shiftIso'), {}, date, days) as string;

function isPressHandler(node: ts.Node): node is ts.ArrowFunction {
  return (
    ts.isArrowFunction(node) &&
    ts.isJsxExpression(node.parent) &&
    ts.isJsxAttribute(node.parent.parent) &&
    node.parent.parent.name.getText(source) === 'onPress'
  );
}

describe('Calendar selected date survives view changes', () => {
  const today = new Date(2026, 8, 10);

  it.each(['WeekView', 'MonthView'])(
    '%s does not replay a stale pulse as a jump to 8 October',
    (owner) => {
      const setOffset = vi.fn();
      run(dateEffect(owner), {
        today,
        jumpDate: null,
        jumpPulse: 7,
        tightestDate: '2026-10-08',
        setOffset,
      });
      expect(setOffset).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['WeekView', 1],
    ['MonthView', 0],
  ] as const)(
    '%s opens the selected 15 September even after an older tight-point request',
    (owner, expected) => {
      const setOffset = vi.fn();
      run(dateEffect(owner), {
        today,
        jumpDate: '2026-09-15',
        jumpPulse: 7,
        tightestDate: '2026-10-08',
        setOffset,
      });
      expect(setOffset).toHaveBeenCalledExactlyOnceWith(expected);
    },
  );

  it('keeps the selected date when switching tabs, and ignores the already active tab', () => {
    const handler = findOne(
      component('CalendarScreen'),
      (node) => isPressHandler(node) && node.getText(source).includes('setView(v)'),
    );
    const setView = vi.fn();
    const setJumpPulse = vi.fn();
    const setJumpDate = vi.fn();
    const bindings = {
      view: 'month',
      v: 'week',
      jumpDate: '2026-09-15',
      setView,
      setJumpPulse,
      setJumpDate,
    };
    run(handler, bindings);
    expect(setView).toHaveBeenCalledExactlyOnceWith('week');
    expect(setJumpDate).not.toHaveBeenCalled();
    expect(setJumpPulse.mock.calls[0]![0](7)).toBe(8);
    vi.clearAllMocks();
    run(handler, { ...bindings, v: 'month' });
    expect(setView).not.toHaveBeenCalled();
    expect(setJumpPulse).not.toHaveBeenCalled();
  });

  it.each([
    ['WeekView', 4],
    ['MonthView', 1],
  ] as const)('still follows an explicit Go there request in %s', (owner, expected) => {
    const setOffset = vi.fn();
    run(dateEffect(owner), {
      today,
      jumpDate: '2026-10-08',
      jumpPulse: 8,
      setOffset,
    });
    expect(setOffset).toHaveBeenCalledExactlyOnceWith(expected);
  });

  it('promotes a Month cell selection to the parent before opening its unchanged Full day', () => {
    const handler = findOne(
      component('MonthView'),
      (node) => isPressHandler(node) && node.getText(source).includes('if (isSelected)'),
    );
    const onSelectDate = vi.fn();
    const nav = { openSheet: vi.fn() };
    const bindings = { iso: '2026-09-15', isSelected: false, onSelectDate, nav };
    run(handler, bindings);
    expect(onSelectDate).toHaveBeenCalledExactlyOnceWith('2026-09-15');
    expect(nav.openSheet).not.toHaveBeenCalled();
    run(handler, { ...bindings, isSelected: true });
    expect(nav.openSheet).toHaveBeenCalledExactlyOnceWith('day-detail', { date: '2026-09-15' });
  });

  it('keeps a Week Full day selection for the next Month or Agenda view', () => {
    const handler = findOne(
      component('WeekView'),
      (node) => isPressHandler(node) && node.getText(source).includes("nav.openSheet('day-detail'"),
    );
    const onSelectDate = vi.fn();
    const nav = { openSheet: vi.fn() };
    run(handler, { iso: '2026-09-15', onSelectDate, nav });
    expect(onSelectDate).toHaveBeenCalledExactlyOnceWith('2026-09-15');
    expect(nav.openSheet).toHaveBeenCalledExactlyOnceWith('day-detail', { date: '2026-09-15' });
  });

  it.each([
    [1, '2026-09-22'],
    [-1, '2026-09-08'],
  ] as const)(
    'moves the selected weekday coherently with week direction %s',
    (direction, expected) => {
      const onSelectDate = vi.fn();
      run(
        variableCallback('WeekView', 'moveWeek'),
        {
          jumpDate: '2026-09-15',
          weekStart: new Date(2026, 8, 14),
          shiftIso,
          isoDay,
          onSelectDate,
          setOffset: vi.fn(),
        },
        direction,
      );
      expect(onSelectDate).toHaveBeenCalledExactlyOnceWith(expected);
    },
  );

  it.each([
    ['2026-09-15', 1, '2026-10-15'],
    ['2026-01-31', 1, '2026-02-28'],
    ['2026-01-15', -1, '2025-12-15'],
  ] as const)('moves %s by %s month with a valid selected day', (selected, direction, expected) => {
    const anchor = new Date(selected + 'T00:00:00');
    anchor.setDate(1);
    const onSelectDate = vi.fn();
    run(
      variableCallback('MonthView', 'moveMonth'),
      {
        selected,
        monthAnchor: anchor,
        isoDay,
        onSelectDate,
        setOffset: vi.fn(),
      },
      direction,
    );
    expect(onSelectDate).toHaveBeenCalledExactlyOnceWith(expected);
  });
});

describe('Calendar narrow header layout contract', () => {
  const style = (name: string) =>
    findOne(
      source,
      (node) => ts.isPropertyAssignment(node) && node.name.getText(source) === name,
    ).getText(source);

  it('gives date and trend summaries separate lines, with wrapping balance/action controls', () => {
    expect(style('dayHead')).not.toContain("flexDirection: 'row'");
    expect(style('trendHead')).not.toContain("flexDirection: 'row'");
    expect(style('dayHeadRight')).toContain("flexWrap: 'wrap'");
    expect(style('dayHeadLeft')).toContain("flexWrap: 'wrap'");
    expect(style('spareRight')).toContain('flexShrink: 1');
  });

  it('keeps Full day and month/week arrows at least 48dp without fixing the heading width', () => {
    expect(style('fullDayAction')).toContain('minHeight: 48');
    expect(style('fullDayAction')).toContain('minWidth: 48');
    expect(style('navRound')).toContain('width: 48');
    expect(style('navRound')).toContain('height: 48');
    expect(style('monthLabelUpper')).toContain('flex: 1');
    expect(style('monthLabelDisplay')).toContain('flex: 1');
  });
});
