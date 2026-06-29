import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoutePath = fileURLToPath(new URL('../../app/index.tsx', import.meta.url).href);
const appRouteSource = readFileSync(appRoutePath, 'utf8');
const mobileShellPath = fileURLToPath(new URL('../surfaces/mobileShell.tsx', import.meta.url).href);
const mobileShellSource = readFileSync(mobileShellPath, 'utf8');
const liveMobileSurfaceSource = `${appRouteSource}\n${mobileShellSource}`;
const localSecurityPath = fileURLToPath(new URL('./nativeLocalSecurity.ts', import.meta.url).href);
const localSecuritySource = readFileSync(localSecurityPath, 'utf8');
const documentImportPath = fileURLToPath(
  new URL('./nativeDocumentImport.ts', import.meta.url).href,
);
const documentImportSource = readFileSync(documentImportPath, 'utf8');
const nativeLedgerStorePath = fileURLToPath(
  new URL('./nativeLedgerStore.ts', import.meta.url).href,
);
// The pure snapshot-blob parser (the `corrupt` distinction) was extracted into its own native-free
// module so it is unit-testable; the persistence corruption contract now spans both files.
const nativeLedgerSnapshotBlobPath = fileURLToPath(
  new URL('./nativeLedgerSnapshotBlob.ts', import.meta.url).href,
);
const nativeLedgerStoreSource =
  readFileSync(nativeLedgerStorePath, 'utf8') +
  '\n' +
  readFileSync(nativeLedgerSnapshotBlobPath, 'utf8');
const localTodayAdapterPath = fileURLToPath(
  new URL('./localTodayAdapter.ts', import.meta.url).href,
);
const localTodayAdapterSource = readFileSync(localTodayAdapterPath, 'utf8');
const localTimelineAdapterPath = fileURLToPath(
  new URL('./localTimelineAdapter.ts', import.meta.url).href,
);
const localTimelineAdapterSource = readFileSync(localTimelineAdapterPath, 'utf8');
const localCalendarAdapterPath = fileURLToPath(
  new URL('./localCalendarAdapter.ts', import.meta.url).href,
);
const localCalendarAdapterSource = readFileSync(localCalendarAdapterPath, 'utf8');
const localPlansAdapterPath = fileURLToPath(
  new URL('./localPlansAdapter.ts', import.meta.url).href,
);
const localPlansAdapterSource = readFileSync(localPlansAdapterPath, 'utf8');
const localScenarioAdapterPath = fileURLToPath(
  new URL('./localScenarioAdapter.ts', import.meta.url).href,
);
const localScenarioAdapterSource = readFileSync(localScenarioAdapterPath, 'utf8');
const localMeloPolicyAdapterPath = fileURLToPath(
  new URL('./localMeloPolicyAdapter.ts', import.meta.url).href,
);
const localMeloPolicyAdapterSource = readFileSync(localMeloPolicyAdapterPath, 'utf8');
const productExperienceLoopPath = fileURLToPath(
  new URL('./productExperienceLoop.ts', import.meta.url).href,
);
const productExperienceLoopSource = readFileSync(productExperienceLoopPath, 'utf8');
const productGatePath = fileURLToPath(
  new URL('../../../../tooling/scripts/check-product-canonical-gates.mjs', import.meta.url).href,
);
const productGateSource = readFileSync(productGatePath, 'utf8');
const canonicalLedgerAdapterPath = fileURLToPath(
  new URL('./canonicalLedgerAdapter.ts', import.meta.url).href,
);
const canonicalLedgerAdapterSource = readFileSync(canonicalLedgerAdapterPath, 'utf8');
const canonicalLedgerMutationsPath = fileURLToPath(
  new URL('./canonicalLedgerMutations.ts', import.meta.url).href,
);
const canonicalLedgerMutationsSource = readFileSync(canonicalLedgerMutationsPath, 'utf8');
const aiContractsPath = fileURLToPath(
  new URL('../../../../packages/ai-contracts/src/index.ts', import.meta.url).href,
);
const aiContractsSource = readFileSync(aiContractsPath, 'utf8');

describe('mobile product route surface truth guard', () => {
  it('does not import synthetic phase evidence routes into the tester app surface', () => {
    expect(appRouteSource).not.toMatch(/from ['"]\.\.\/src\/phase\d+\//);
    expect(appRouteSource).not.toContain("type ProductScreen = 'evidence'");
  });

  it('keeps stale prototype and overclaiming route copy out of the visible app route', () => {
    expect(appRouteSource).not.toMatch(/Live route|live rows|Live what-if/i);
    expect(appRouteSource).not.toMatch(/Undo remains|Undo rules|playable proof/i);
    expect(appRouteSource).not.toContain('Starter_statement.csv');
    expect(appRouteSource).not.toContain('Starter record');
    expect(appRouteSource).not.toContain('Private_example_statement');
    expect(appRouteSource).not.toContain('Building the private example route');
    expect(appRouteSource).not.toContain('% confirmed');
    expect(appRouteSource).not.toContain('confidence_percent');
    expect(appRouteSource).not.toMatch(/Native save|native storage|Data version|Proof/);
    expect(appRouteSource).not.toContain('SecureStore');
    expect(appRouteSource).not.toContain('audit entries');
    expect(appRouteSource).not.toMatch(/Digest|local-text:|fingerprint/i);
    expect(appRouteSource).not.toMatch(/Record spend today|Recorded test spend/);
    expect(appRouteSource).not.toContain('searchable rows');
    expect(appRouteSource).not.toMatch(/local rows/i);
    expect(appRouteSource).not.toContain('without saving the repair');
  });

  it('routes product writes through canonical repository mutation wrappers', () => {
    expect(appRouteSource).toContain("from '../src/local/canonicalLedgerMutations'");
    expect(appRouteSource).toContain('recordManualTransactionThroughCanonicalRepository');
    expect(appRouteSource).toContain('createQuickEstimateThroughCanonicalRepository');
    expect(appRouteSource).toContain('stageStatementImportThroughCanonicalRepository');
    expect(appRouteSource).toContain('acceptImportDraftThroughCanonicalRepository');
    expect(appRouteSource).not.toMatch(
      /import\s*\{[\s\S]*(?:addManualTransaction|addPlannedCommitment|addRecoverySpend|createQuickEstimateLocalLedgerState|stageStatementImport|confirmImportDraft|dismissImportDraft|editImportDraft|applyMeloImportSuggestion)[\s\S]*\}\s*from ['"]\.\.\/src\/local\/localLedger['"]/,
    );
  });

  it('surfaces snapshot-blob corruption instead of silently wiping pots/subscriptions/cycles', () => {
    // FIX 3: the durable containers live ONLY in the JSON snapshot blob, so a corrupt blob is
    // unrecoverable loss. The load must no longer swallow it through a bare catch that returns an
    // empty set silently — it must distinguish corrupt from empty and warn so the loss is detectable.
    expect(nativeLedgerStoreSource).toContain('parseDurableContainersBlob');
    expect(nativeLedgerStoreSource).toMatch(/corrupt:\s*boolean/);
    expect(nativeLedgerStoreSource).toContain('console.warn');
    // The old silent bare catch that just `return empty;` must be gone from the loader.
    expect(nativeLedgerStoreSource).not.toMatch(/}\s*catch\s*\{\s*return empty;\s*}/);
  });

  it('derives the native history allowlist from the single source of truth so it cannot drift', () => {
    // FIX 2: pot/subscription/cycle history entries were silently dropped on reload because the
    // store's isHistoryKind hardcoded only ~half the kinds. The allowlist must now be derived from
    // LOCAL_HISTORY_KINDS, not a hand-maintained literal list that can fall out of sync.
    expect(nativeLedgerStoreSource).toContain('LOCAL_HISTORY_KINDS');
    expect(nativeLedgerStoreSource).toMatch(/new Set<string>\(LOCAL_HISTORY_KINDS\)/);
    // The old per-kind literal allowlist must be gone (this is the bug shape that dropped data).
    expect(nativeLedgerStoreSource).not.toContain("value === 'planner_added'");
    expect(nativeLedgerStoreSource).not.toContain("value === 'document_staged'");
  });

  it('keeps native security implementation names out of user-facing copy', () => {
    expect(localSecuritySource).not.toContain('SecureStore is storing');
    expect(localSecuritySource).not.toContain('SecureStore-protected');
    expect(localSecuritySource).not.toContain(
      'SecureStore and device authentication are unavailable',
    );
    expect(localSecuritySource).not.toContain('tester session');
    expect(documentImportSource).not.toContain('tester APK');
  });

  it('keeps deterministic Melo actions from overstating planner capability', () => {
    expect(aiContractsSource).not.toMatch(
      /Build a recovery route|Build recovery route|sketch a recovery route|Show recovery route|Move flexible spend|Move a flexible item|Try timing changes/,
    );
    expect(aiContractsSource).not.toMatch(/Ask one more question|Ask a clearer question/);
  });

  it('routes a fresh local install into Start', () => {
    expect(appRouteSource).toContain("from '../src/local/canonicalLedgerStore'");
    expect(appRouteSource).not.toContain("from '../src/local/nativeLedgerStore'");
    expect(appRouteSource).toContain('createEmptyLocalLedgerState(currentLocalIsoDate())');
    expect(appRouteSource).not.toContain('createInitialLocalLedgerState');
    expect(appRouteSource).toMatch(
      /savedLedger !== null[\s\S]*setPersistenceStatus\('saved'\)[\s\S]*else \{[\s\S]*setScreen\('start'\)/,
    );
    expect(appRouteSource).toMatch(
      /if \(isPrivateExampleLedger\(refreshedLedger\)\)[\s\S]*setScreen\('start'\)/,
    );
  });

  it('uses extracted product surface modules for live mobile UX', () => {
    const extractedSurfaces = [
      'CalendarPlannerIntro',
      'FirstMinuteWelcomeSurface',
      'ImportReviewDecisionGuide',
      'MeloBoundarySurface',
      'PlansPathSurface',
      'RecoveryPathSurface',
      'SampleBriefingValueSurface',
      'TimelineMeaningSurface',
    ];

    for (const surface of extractedSurfaces) {
      expect(mobileShellSource).toContain(surface);
    }

    expect(productGateSource).toContain("'apps/mobile/src/surfaces'");
    expect(appRouteSource).toContain("from '../src/surfaces/mobileShell'");
    expect(mobileShellSource).toContain("from './firstMinuteSurface'");
    expect(liveMobileSurfaceSource).not.toContain('<ChoiceRow');
  });

  it('shows the cold-user Start choices and keeps sample briefing out of ledger writes', () => {
    expect(mobileShellSource).toContain('{firstMinutePrimaryMessage}');
    expect(productExperienceLoopSource).toContain(
      'Folio helps you understand where you stand, what changed, and what happens next.',
    );
    expect(mobileShellSource).toContain('See where you stand');
    expect(mobileShellSource).toContain('Organise debts');
    expect(mobileShellSource).toContain('Check bills');
    expect(mobileShellSource).toContain('Use a bank statement');
    expect(mobileShellSource).toContain('Guide me');
    expect(appRouteSource).toContain("screen === 'debtFlow'");
    expect(appRouteSource).toContain("screen === 'billFlow'");
    expect(appRouteSource).toContain("screen === 'guideFlow'");
    expect(productExperienceLoopSource).toContain("label: 'Use a bank statement'");
    expect(productExperienceLoopSource).toContain("label: 'Add a few numbers'");
    expect(productExperienceLoopSource).toContain("label: 'Try fake data'");
    expect(appRouteSource).toContain("screen === 'sampleBriefing'");
    expect(appRouteSource).toContain('<SampleBriefingScreen');
    expect(appRouteSource).toContain('setLastReviewAction');
    expect(liveMobileSurfaceSource).not.toContain('exampleStatementText');
    expect(mobileShellSource).toContain('sampleBriefingMelo.labels');
    expect(productExperienceLoopSource).toContain('buildFirstMinuteBriefing');
    expect(productExperienceLoopSource).toContain('buildSampleBriefing');
  });

  it('persists canonical SQLite repository rows before legacy local ledger compatibility tables', () => {
    expect(nativeLedgerStoreSource).toContain('migrateCanonicalSnapshotToSqliteRepository');
    expect(nativeLedgerStoreSource).toContain('createCanonicalRepositoryForMobileSnapshot');
    expect(nativeLedgerStoreSource).toContain('OpSqliteDatabaseDriver');
    expect(nativeLedgerStoreSource).toMatch(
      /migrateCanonicalSnapshotToSqliteRepository[\s\S]*INSERT OR REPLACE INTO local_ledger_snapshot[\s\S]*saveNormalizedLedgerState/,
    );
    expect(appRouteSource).not.toMatch(/local_ledger_/);
  });

  it('keeps private example data out of user-owned local actions', () => {
    expect(appRouteSource).toMatch(
      /const userOwnedLedgerBase = useCallback[\s\S]*isPrivateExampleLedger\(localLedger\)[\s\S]*createEmptyLocalLedgerState\(currentLocalIsoDate\(\)\)/,
    );
    expect(mobileShellSource).toMatch(
      /const showPrivateExampleRows = !\(privateExampleMode && importSurfaceMode === 'user_statement'\)/,
    );
    expect(appRouteSource).toContain('onStartImportDiscovery={openUserStatementImport}');
    expect(liveMobileSurfaceSource).not.toContain("useState('Groceries')");
    expect(liveMobileSurfaceSource).not.toContain("useState('40.00')");
  });

  it('keeps Business out of the live mobile route while preserving Personal context', () => {
    expect(appRouteSource).toContain('Current workspace: Personal');
    expect(appRouteSource).toContain('<Text style={styles.contextChipText}>Personal</Text>');
    expect(appRouteSource).not.toContain("| 'business'");
    expect(appRouteSource).not.toContain("label: 'Business'");
    expect(appRouteSource).not.toContain("screen === 'business'");
  });

  it('simplifies primary navigation to Start, Review, Today and More', () => {
    expect(mobileShellSource).toContain("{ id: 'start', label: 'Start'");
    expect(mobileShellSource).toContain("{ id: 'import', label: 'Review'");
    expect(mobileShellSource).toContain("{ id: 'today', label: 'Today'");
    expect(mobileShellSource).toContain("{ id: 'more', label: 'More'");
    expect(mobileShellSource).not.toContain("{ id: 'calendar', label: 'Calendar'");
    expect(mobileShellSource).not.toContain("{ id: 'timeline', label: 'Timeline'");
    expect(mobileShellSource).not.toContain("{ id: 'plans', label: 'Plans'");
    expect(mobileShellSource).not.toContain("{ id: 'melo', label: 'Melo'");
    expect(mobileShellSource).not.toContain("{ id: 'money', label: 'Money'");
    expect(appRouteSource).toContain('<StartScreen');
    expect(appRouteSource).toContain('const primaryNavActive');
  });

  it('exposes rejected imports only through evidence and history surfaces', () => {
    expect(mobileShellSource).toContain('searchLocalLedgerEvidenceRecords');
    expect(mobileShellSource).toContain('ledger.rejectedImports.length');
    expect(mobileShellSource).toContain("source: 'Rejected evidence'");
    expect(mobileShellSource).toContain(
      'Non-financial evidence; not counted in Today, Timeline or Plans.',
    );
    expect(mobileShellSource).toContain('importReviewActionCopy');
    expect(mobileShellSource).toContain('importDraftSourceName');
    expect(mobileShellSource).toContain('From your statement:');
    expect(productExperienceLoopSource).toContain(
      'Keeps this one out of your money view and leaves Today, Timeline and Plans unchanged.',
    );
    expect(mobileShellSource).toContain("onDismissDraft(selectedReviewDraft.rowId, 'duplicate')");
    expect(mobileShellSource).toContain(
      "onDismissDraft(selectedReviewDraft.rowId, 'transfer-internal', 'Excluded')",
    );
  });

  it('shows grounded Melo record lookups instead of generic local chat copy', () => {
    expect(mobileShellSource).toContain('buildMeloLocalRecordLookup');
    expect(mobileShellSource).toContain('gateMeloLocalAiDraft');
    expect(mobileShellSource).toContain('gateMeloText');
    expect(liveMobileSurfaceSource).not.toContain("from '@folio/melo-policy'");
    expect(mobileShellSource).toContain('const displayDraft = useMemo<MeloLocalAiDraft>');
    expect(mobileShellSource).toContain('const safeDisplayDraft = useMemo<MeloLocalAiDraft>');
    expect(mobileShellSource).toContain('const displayedEvidenceRecords = recordLookup?.records');
    expect(mobileShellSource).toContain('Melo local rules answered: ${safeDisplayDraft.answer}');
    expect(mobileShellSource).toContain('Melo response is ready for review.');
    expect(localMeloPolicyAdapterSource).toContain('validateMeloRenderableOutput');
    expect(localMeloPolicyAdapterSource).toContain('renderableDraftText');
  });

  it('does not truncate current local route rows before route, source or calendar filtering', () => {
    expect(mobileShellSource).toContain(
      'searchLocalLedgerEvidenceRecords(ledger, route, query, Number.MAX_SAFE_INTEGER)',
    );
    expect(liveMobileSurfaceSource).not.toMatch(
      /function routeTimelineEvents[\s\S]*return \[\.\.\.pointRows, \.\.\.reviewRows\]\.slice/,
    );
    expect(liveMobileSurfaceSource).not.toMatch(
      /function buildCalendarTimelineEvents[\s\S]*const transactionRows = ledger\.transactions[\s\S]*\.slice\(0, 8\)/,
    );
    expect(liveMobileSurfaceSource).not.toMatch(
      /function buildCalendarTimelineEvents[\s\S]*const draftRows = ledger\.importDrafts[\s\S]*\.slice\(0, 5\)/,
    );
    expect(liveMobileSurfaceSource).not.toMatch(
      /function buildCalendarTimelineEvents[\s\S]*return \[routeRow, \.\.\.routePointRows, \.\.\.transactionRows, \.\.\.draftRows\]\.slice/,
    );
  });

  it('bases Today headline truth on the full route, not only available cash today', () => {
    // The rebuilt Today rich-home is presentation-only and reads the FULL route directly: the
    // container passes route={localRoute}, and the hero "spare" figure is the magnitude at the
    // tightest point — not available cash today.
    expect(appRouteSource).toContain('route={localRoute}');
    expect(appRouteSource).toContain('spareMinor={todaySpareMinor}');
    expect(appRouteSource).toContain(
      'const todaySpareMinor = Math.abs(localRoute.tightestBalanceMinor)',
    );
    // The Today verdict itself is derived from the full route's tightest balance (in todayPath),
    // and the legacy mobileShell route-completeness verdict still backs MoneyHero where it renders.
    expect(mobileShellSource).toMatch(
      /const routeComplete =[\s\S]*route\.points\.some\(\(point\) => point\.deltaMinor < 0\)/u,
    );
    expect(mobileShellSource).toContain('headline={verdict}');
    expect(localTodayAdapterSource).toContain(
      "if (projection.riskDetected) return 'This route needs attention.'",
    );
    expect(localTodayAdapterSource).toContain("return 'The known route stays above zero.'");
    expect(liveMobileSurfaceSource).not.toContain(
      'route.availableNowMinor >= 0\n            ? "You\'re covered through payday."',
    );
  });

  it('keeps Timeline available from More instead of the primary nav', () => {
    expect(mobileShellSource).toContain("| 'timeline'");
    expect(mobileShellSource).not.toContain("{ id: 'timeline', label: 'Timeline'");
    expect(mobileShellSource).toContain('title="Timeline"');
    expect(appRouteSource).toContain("onOpenTimeline={() => setScreen('timeline')}");
    expect(liveMobileSurfaceSource).toContain('buildLocalTimelineModel');
    expect(appRouteSource).toContain("screen === 'timeline'");
    expect(appRouteSource).toContain('<TimelineScreen');
    expect(mobileShellSource).toContain('humanEvidenceLine(');
    expect(liveMobileSurfaceSource).not.toContain('event.evidence.reviewState.replaceAll');
    expect(localTimelineAdapterSource).toContain('createCanonicalRepositoryForLocalLedgerState');
    expect(localTimelineAdapterSource).toContain('buildCanonicalTimelineModel');
    expect(localTimelineAdapterSource).toContain('canonical.transactions');
    expect(localTimelineAdapterSource).toContain('canonical.importDrafts');
    expect(localTimelineAdapterSource).toContain('canonical.meloProposals');
  });

  it('routes Calendar through canonical calendar items and the calendar engine', () => {
    expect(liveMobileSurfaceSource).toContain('buildLocalCalendarModel');
    expect(mobileShellSource).toContain('filterLocalCalendarEventsForDate');
    expect(appRouteSource).toContain('calendar={calendarModel}');
    expect(liveMobileSurfaceSource).not.toContain('function buildCalendarTimelineEvents');
    expect(localCalendarAdapterSource).toContain("from '@folio/calendar-engine'");
    expect(localCalendarAdapterSource).toContain('createCanonicalRepositoryForLocalLedgerState');
    expect(localCalendarAdapterSource).toContain('canonical.calendarItems');
    expect(localCalendarAdapterSource).toContain('localDateTimeToUtc');
  });

  it('keeps Plans available from More through repository-backed plan objects', () => {
    expect(mobileShellSource).toContain("| 'plans'");
    expect(mobileShellSource).not.toContain("{ id: 'plans', label: 'Plans'");
    expect(mobileShellSource).toContain('title="Plans"');
    expect(liveMobileSurfaceSource).toContain('buildLocalPlansModel');
    expect(appRouteSource).toContain("screen === 'plans'");
    expect(appRouteSource).toContain('<PlansScreen');
    expect(localPlansAdapterSource).toContain("from '@folio/plan-engine'");
    expect(localPlansAdapterSource).toContain('createCanonicalRepositoryForLocalLedgerState');
    expect(localPlansAdapterSource).toContain('createPlanDraft');
    expect(localPlansAdapterSource).toContain("contractState: 'repository-backed'");
  });

  it('keeps purchase and recovery previews behind hypothetical scenario objects', () => {
    expect(liveMobileSurfaceSource).toContain('buildLocalPurchaseScenarioPreview');
    expect(mobileShellSource).toContain('buildLocalRecoverySpendScenarioPreview');
    expect(appRouteSource).toContain('scenario={purchaseScenario}');
    expect(liveMobileSurfaceSource).not.toContain('function buildWhatIfRoute');
    expect(localScenarioAdapterSource).toContain("from '@folio/domain'");
    expect(localScenarioAdapterSource).toContain('createScenarioId');
    expect(localScenarioAdapterSource).toContain("authorityState: 'hypothetical'");
    expect(localScenarioAdapterSource).toContain('writesImmediately: false');
    expect(localScenarioAdapterSource).toContain('confirmationRequired: true');
  });

  it('records Recovery as a scenario decision with plan and commitment context', () => {
    expect(appRouteSource).toContain('recordRecoverySpendThroughCanonicalRepository');
    expect(appRouteSource).toContain('handleRecordRecoverySpend');
    expect(appRouteSource).toContain('plans={plansModel}');
    expect(mobileShellSource).toContain('Protected items');
    expect(canonicalLedgerMutationsSource).toContain('addRecoverySpend');
    expect(canonicalLedgerMutationsSource).toContain(
      'createCanonicalRepositoryForLocalLedgerState',
    );
    expect(canonicalLedgerAdapterSource).toContain("case 'recovery_recorded'");
    expect(canonicalLedgerAdapterSource).toContain("return 'accept-scenario'");
    expect(canonicalLedgerAdapterSource).toContain('createCanonicalAuditEntry');
  });

  it('projects Melo suggestions into reviewable memory and proposal records', () => {
    expect(canonicalLedgerAdapterSource).toContain('createMeloProposalFromHistory');
    expect(canonicalLedgerAdapterSource).toContain('createMeloMemoryFromHistory');
    expect(canonicalLedgerAdapterSource).toContain("entry.kind !== 'import_suggested'");
    expect(canonicalLedgerAdapterSource).toContain("status: 'needs-review'");
    expect(canonicalLedgerAdapterSource).toContain('canWriteDirectly: false');
    expect(canonicalLedgerAdapterSource).toContain("reviewState: 'needs-review'");
  });

  it('compacts route chart axis labels instead of rendering overlapping duplicate dates', () => {
    expect(mobileShellSource).toContain('function routeChartAxisLabels');
    expect(mobileShellSource).toContain('duplicatesText');
    expect(mobileShellSource).toContain('collidesWithPrevious');
    expect(mobileShellSource).not.toMatch(
      /<SvgText[^>]*x="0"[\s\S]*routeChartPointLabel\(chart\.points\[0\]\?\.point\)[\s\S]*<SvgText[\s\S]*middleAxis[\s\S]*<SvgText[\s\S]*finalAxis/,
    );
  });
});
