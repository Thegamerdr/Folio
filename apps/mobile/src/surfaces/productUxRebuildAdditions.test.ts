import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  buildLocalRouteSummary,
  confirmImportDraft,
  createEmptyLocalLedgerState,
  editImportDraft,
  stageStatementImport,
} from '../local/localLedger.js';
import { buildLocalTodayModel } from '../local/localTodayAdapter.js';

const mobileShellPath = fileURLToPath(new URL('./mobileShell.tsx', import.meta.url).href);
const appRoutePath = fileURLToPath(new URL('../../app/index.tsx', import.meta.url).href);

const mobileShellSource = readFileSync(mobileShellPath, 'utf8');
const appRouteSource = readFileSync(appRoutePath, 'utf8');

const reviewSource = sourceBetween(
  mobileShellSource,
  'function ImportReviewScreen',
  'function MeloScreen',
);
const routeSource = sourceBetween(
  mobileShellSource,
  'function BreathingHorizon',
  'function TimelineList',
);
const moreScreenSource = sourceBetween(
  mobileShellSource,
  'function MoreScreen',
  'function DogfoodModeScreen',
);

// Visible copy used for the financial/advice subset (whole rendered surface). Per-file extraction
// keeps each file's quotes balanced within itself, matching the existing rebuild guards.
const visibleCopy = `${quotedVisibleCopy(mobileShellSource)}\n${quotedVisibleCopy(appRouteSource)}`;

// Visible copy with `//` line comments removed first, and with the surfaceStateLabel function body
// removed. Some comments deliberately quote banned vocabulary while documenting the invariant that
// those tokens never reach a user; those documentation quotes are not rendered copy. The
// surfaceStateLabel lookup table also carries raw internal TOKENS as Record KEYS (e.g.
// 'user-confirmed' mapping to the rendered "Confirmed by you"). A key is never rendered — it only
// translates an engine token into plain English — so the function body is excised before the ban
// scan to avoid flagging the lookup keys while still scanning every other rendered string.
const commentStrippedVisibleCopy = `${quotedVisibleCopy(
  stripFunctionBody(stripLineComments(mobileShellSource), 'surfaceStateLabel'),
)}\n${quotedVisibleCopy(stripLineComments(appRouteSource))}`;

describe('product UX rebuild additions', () => {
  // (a) Review renders the rows first, then the "Add bank activity" reveal; the paste/file panels
  // live inside the showAddActivity block.
  it('renders the review rows before the Add bank activity reveal', () => {
    const reviewListIndex = reviewSource.indexOf('styles.reviewList');
    const addActivityIndex = reviewSource.indexOf('title="Add bank activity"');
    expect(reviewListIndex).toBeGreaterThanOrEqual(0);
    expect(addActivityIndex).toBeGreaterThanOrEqual(0);
    expect(reviewListIndex).toBeLessThan(addActivityIndex);

    // The header is always "Rows to check" / "Nothing has been added yet"; empty state invites
    // adding activity rather than leading with the import machinery.
    expect(reviewSource).toContain('Rows to check');
    expect(reviewSource).toContain('Nothing has been added yet.');
    expect(reviewSource).toContain('Choose what to keep.');

    // The paste panel ("Use a bank statement") is gated behind showAddActivity, after the reveal.
    const afterReveal = reviewSource.slice(addActivityIndex);
    expect(afterReveal).toMatch(/showAddActivity \?[\s\S]*Use a bank statement/u);
    expect(afterReveal).toContain('Paste statement text');
    // The paste panel must not appear before the reveal row.
    expect(reviewSource.slice(0, addActivityIndex)).not.toContain('Use a bank statement');
  });

  // (a, cont.) Each review row carries its ready/waiting state into the ReviewDecisionCard for the
  // visible badge, but the primary "Add to my money" is no longer gated by review state — the
  // confirm handler promotes a reviewed row to ready, then accepts it. The card still derives
  // rowReady for the badge state only.
  it('shows a per-row ready/waiting state without gating the primary add action', () => {
    expect(reviewSource).toContain("row.reviewState === 'ready-for-user-confirmation'");
    expect(reviewSource).toContain("state={rowReady ? 'ready' : 'waiting'}");
    // The Add action is always available; rowReady drives the badge, not a disabled prop.
    expect(reviewSource).not.toContain('addDisabled={!rowReady}');
    expect(reviewSource).toContain('label="Add to my money"');
  });

  // (b) Row actions are row-specific: one visible primary "Add to my money"; the rest hide behind
  // "More" (showMoreRowActions).
  it('keeps one primary row action and hides the rest behind More', () => {
    const primary = sourceBetween(reviewSource, 'styles.reviewPrimaryActions', 'FolioRevealRow');
    expect(primary).toContain('label="Add to my money"');
    for (const buried of ['Edit', 'Ignore', 'Duplicate', 'Transfer', 'Refund', 'Income', 'Later']) {
      expect(primary).not.toContain(`label="${buried}"`);
    }

    // The secondary actions render only when "More" is expanded.
    expect(reviewSource).toContain('title="More"');
    expect(reviewSource).toMatch(
      /showMoreRowActions \?[\s\S]*label="Edit"[\s\S]*label="Ignore"[\s\S]*label="Duplicate"[\s\S]*label="Later"/u,
    );
    // The sheet is bound to a single row and resets to the primary action when a new row opens.
    expect(reviewSource).toContain('setSelectedReviewDraftId(row.rowId)');
    expect(reviewSource).toContain('setShowMoreRowActions(false)');
  });

  // (c) The route point detail panel uses human language and drops per-line "Show why".
  it('uses human-language RoutePointSection rows in the route point panel', () => {
    const panel = routeSource.slice(routeSource.indexOf('styles.routePointPanel'));
    for (const copy of [
      'What happened',
      'Left after this',
      'What caused it',
      'Still waiting for review',
    ]) {
      expect(panel).toContain(copy);
    }
    expect(panel).toContain('RoutePointSection');
    // No per-line "Show why" control inside the panel (the lone "Show why" is the panel-level a11y
    // label, not a row affordance).
    expect(panel).not.toMatch(/label="Show why"|>Show why</u);
  });

  // (g) Internal/dev tools are hidden in a normal build.
  it('gates internal/dev tooling behind developer mode', () => {
    // The dogfood (internal test) screen renders only when developer mode is on.
    expect(appRouteSource).toContain("screen === 'dogfood' && developerModeEnabled ?");
    // Developer mode is only available in development builds, never a released app.
    expect(appRouteSource).toContain('const DEVELOPER_MODE_AVAILABLE = __DEV__;');

    // MoreScreen's internal rows ("Internal test mode" / "Replay first minute") are behind the
    // developerModeEnabled flag.
    expect(moreScreenSource).toMatch(/developerModeEnabled \?[\s\S]*title="Internal test mode"/u);
    expect(moreScreenSource).toMatch(/developerModeEnabled \?[\s\S]*title="Replay first minute"/u);
    // They are not rendered unconditionally.
    const beforeGate = moreScreenSource.slice(
      0,
      moreScreenSource.indexOf('developerModeEnabled ?'),
    );
    expect(beforeGate).not.toContain('title="Internal test mode"');
    expect(beforeGate).not.toContain('title="Replay first minute"');
  });

  // (h) Language gate: §11 banned vocabulary must not reach visible copy.
  it('keeps §11 banned financial/system vocabulary out of visible copy', () => {
    // Single technical tokens use word boundaries so camelCase identifiers (e.g.
    // ...ThroughCanonicalRepository, provenanceLabel) are not false positives; multi-word product
    // phrases match literally.
    const bannedFinancial = [
      /\bcanonical\b/iu,
      /\bparser\b/iu,
      /\bprovenance\b/iu,
      /\bindexed\b/iu,
      /financial reality/iu,
      /make real/iu,
      /event graph/iu,
      /object count/iu,
      /\bdiagnostic\b/iu,
      /local ledger/iu,
      /source record/iu,
      /already real/iu,
      /confirmed local calculation/iu,
      /confidence score/iu,
      /recovery scenario/iu,
      /reviewed meaning/iu,
      /staged locally/iu,
      /manual entry/iu,
      /\byou should\b/iu,
      /best decision/iu,
      /\bguaranteed\b/iu,
      /your score is/iu,
    ];
    for (const pattern of bannedFinancial) {
      expect(visibleCopy).not.toMatch(pattern);
    }

    // "user confirmed" / "not required" are internal engine state TOKENS. The source funnels every
    // raw token through surfaceStateLabel into plain English so the token never renders; the only
    // raw appearances are documentation comments (stripped here). Assert the token form is absent
    // from rendered copy. ("X is not required" as benign English reassurance — e.g. "Cloud and AI
    // are not required here" — is intentionally allowed and is not the banned state token.)
    expect(commentStrippedVisibleCopy).not.toMatch(/user[\s-]confirmed/iu);
    expect(commentStrippedVisibleCopy).not.toMatch(/['"`]\s*not[\s-]required\s*['"`]/iu);
  });

  // (h, cont.) Internal/test vocabulary must be absent from USER-FACING copy. Developer-mode-gated
  // surfaces and dev-only handlers legitimately use these words (exactly like DogfoodModeScreen),
  // so they are scoped out: gated JSX blocks, the dev-only dogfood ribbon data, and the dev-only
  // app/index callbacks are removed before extraction.
  it('keeps internal/test vocabulary out of always-visible user copy', () => {
    let userShell = mobileShellSource.slice(
      0,
      mobileShellSource.indexOf('function DogfoodModeScreen'),
    );
    userShell = stripNamedArrayLiteral(userShell, 'dogfoodInteractionSteps');
    userShell = stripDeveloperGatedBlocks(userShell);

    let userAppRoute = stripDeveloperGatedBlocks(appRouteSource);
    userAppRoute = stripNamedCallbacks(userAppRoute, [
      'openDogfoodMode',
      'resetDogfoodLocalData',
      'loadDogfoodScenario',
      'prepareDogfoodDiagnostic',
    ]);

    const userVisibleCopy = `${quotedVisibleCopy(userShell)}\n${quotedVisibleCopy(userAppRoute)}`;
    for (const pattern of [/internal test/iu, /\bdogfood\b/iu, /\breplay\b/iu, /test mode/iu]) {
      expect(userVisibleCopy).not.toMatch(pattern);
    }
  });

  // (i) No advice, shame or fake certainty in visible copy.
  it('keeps advice, shame and fake-certainty phrasing out of visible copy', () => {
    expect(visibleCopy).not.toMatch(/\byou should\b/iu);
    expect(visibleCopy).not.toMatch(/best (decision|strategy)/iu);
    expect(visibleCopy).not.toMatch(/recommended payment/iu);
    expect(visibleCopy).not.toMatch(/\bguaranteed\b/iu);
    expect(visibleCopy).not.toMatch(/your score is/iu);
  });

  // (j) Review-before-truth: staged (unreviewed) rows do not change Today; an added row does.
  it('keeps staged rows out of Today until they are added', () => {
    const empty = { ...createEmptyLocalLedgerState('2026-06-24'), cashOnHandMinor: 25_000 };
    const before = buildLocalTodayModel(empty, buildLocalRouteSummary(empty));

    const staged = stageStatementImport(
      empty,
      'Date,Description,Amount\n2026-06-24,Energy bill,-94.27',
    ).state;
    const stagedToday = buildLocalTodayModel(staged, buildLocalRouteSummary(staged));

    const draft = staged.importDrafts[0];
    expect(draft).toBeDefined();
    const edited = editImportDraft(staged, draft?.rowId ?? '', {
      amountText: '-94.27',
      date: '2026-06-24',
      interpretation: 'Bill: Energy bill',
    });
    const accepted = confirmImportDraft(edited, draft?.rowId ?? '');
    const acceptedToday = buildLocalTodayModel(accepted, buildLocalRouteSummary(accepted));

    // Staging changes nothing about Today's available position.
    expect(staged.transactions).toEqual([]);
    expect(stagedToday.position.availableMinor).toBe(before.position.availableMinor);
    // Adding the row does change Today.
    expect(accepted.transactions).toHaveLength(1);
    expect(acceptedToday.position.availableMinor).toBeLessThan(before.position.availableMinor);
  });

  // (k) Unsupported files do not claim OCR. The source renders a curly apostrophe (U+2019).
  it('keeps the unreadable-file panel honest with no OCR claim', () => {
    expect(reviewSource).toContain('can’t read this file automatically yet');
    expect(reviewSource).toContain('Add the numbers yourself');
    const panelCopy = quotedVisibleCopy(reviewSource);
    expect(panelCopy).not.toMatch(/\bOCR\b/iu);
    expect(panelCopy).not.toMatch(/read automatically/iu);
    expect(panelCopy).not.toMatch(/\bscanned\b/iu);
  });
});

function sourceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Could not find source range from ${start} to ${end}`);
  }

  return source.slice(startIndex, endIndex);
}

function quotedVisibleCopy(source: string): string {
  return Array.from(
    source.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/gu),
    (match) => match[2] ?? '',
  )
    .filter((copy) => /[A-Za-z]/u.test(copy))
    .filter((copy) => !copy.includes('../'))
    .filter((copy) => !/^[a-z0-9_-]+$/u.test(copy))
    .filter((copy) => /[\s.,;:!?]/u.test(copy) || /^[A-Z]/u.test(copy))
    .join('\n');
}

// Remove `// ...` line comments (never rendered). Skips lines containing a URL so `https://` is not
// truncated. Good enough for the documentation comments that quote banned state tokens.
function stripLineComments(source: string): string {
  return source
    .split('\n')
    .map((line) => {
      const index = line.indexOf('// ');
      if (index >= 0 && !/https?:\/\//u.test(line)) return line.slice(0, index);
      return line;
    })
    .join('\n');
}

function endOfBalanced(source: string, openIndex: number, open: string, close: string): number {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === open) depth += 1;
    else if (source[index] === close) {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return source.length;
}

// Remove `{developerModeEnabled ? ( ... ) : null}` and `{developerModeEnabled ? ( ... ) : ( ... )}`
// JSX blocks. These render only after the user explicitly turns on developer mode (dev builds
// only), so their dev-tooling vocabulary is not user-facing.
function stripDeveloperGatedBlocks(source: string): string {
  let out = source;
  let guard = 0;
  for (;;) {
    const marker = 'developerModeEnabled ? (';
    const start = out.indexOf(marker);
    if (start < 0 || guard > 200) break;
    guard += 1;
    const firstOpen = start + marker.length - 1;
    let cursor = endOfBalanced(out, firstOpen, '(', ')');
    const rest = out.slice(cursor);
    const nullBranch = rest.match(/^\s*:\s*null/u);
    if (nullBranch) {
      cursor += nullBranch[0].length;
    } else {
      const parenBranch = rest.match(/^\s*:\s*\(/u);
      if (parenBranch) {
        cursor = endOfBalanced(out, cursor + parenBranch[0].length - 1, '(', ')');
      }
    }
    const braceStart = out.lastIndexOf('{', start);
    const cutFrom = braceStart >= 0 && braceStart > start - 4 ? braceStart : start;
    out = out.slice(0, cutFrom) + out.slice(cursor);
  }
  return out;
}

// Remove a top-level `function <name>(...) { ... }` declaration including its balanced body. Used to
// drop the surfaceStateLabel translation table, whose Record KEYS hold raw engine state tokens (e.g.
// 'user-confirmed') that are never rendered — they only map to plain-English labels. Excising the
// body keeps the ban scan honest on rendered copy without flagging the internal lookup keys.
function stripFunctionBody(source: string, name: string): string {
  const declIndex = source.indexOf(`function ${name}`);
  if (declIndex < 0) return source;
  const bodyOpen = source.indexOf('{', declIndex);
  if (bodyOpen < 0) return source;
  const bodyEnd = endOfBalanced(source, bodyOpen, '{', '}');
  return source.slice(0, declIndex) + source.slice(bodyEnd);
}

// Remove a top-level `const <name> ... = [ ... ];` array literal (dev-only ribbon data).
function stripNamedArrayLiteral(source: string, name: string): string {
  const declIndex = source.indexOf(`const ${name}`);
  if (declIndex < 0) return source;
  const assignIndex = source.indexOf('=', declIndex);
  const openIndex = source.indexOf('[', assignIndex);
  if (assignIndex < 0 || openIndex < 0) return source;
  const endIndex = endOfBalanced(source, openIndex, '[', ']');
  return source.slice(0, declIndex) + source.slice(endIndex);
}

// Remove `const <name> = useCallback( ... )` declarations (dev-only handlers).
function stripNamedCallbacks(source: string, names: readonly string[]): string {
  let out = source;
  for (const name of names) {
    const declIndex = out.indexOf(`const ${name} = useCallback(`);
    if (declIndex < 0) continue;
    const openIndex = out.indexOf('(', out.indexOf('useCallback', declIndex));
    const endIndex = endOfBalanced(out, openIndex, '(', ')');
    out = out.slice(0, declIndex) + out.slice(endIndex);
  }
  return out;
}
