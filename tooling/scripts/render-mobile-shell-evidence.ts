import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  draftMeloLocalAiResponse,
  type MeloLocalAiDraft,
} from '../../packages/ai-contracts/src/index.ts';
import {
  buildLocalLedgerExportPayload,
  buildLocalRouteSummary,
  buildMeloSnapshotFromLocalState,
  createEmptyLocalLedgerState,
  formatMinorAmount,
} from '../../apps/mobile/src/local/localLedger.ts';
import {
  acceptImportDraftThroughCanonicalRepository,
  createPlannedCommitmentThroughCanonicalRepository,
  createQuickEstimateThroughCanonicalRepository,
  editImportDraftThroughCanonicalRepository,
  rejectImportDraftThroughCanonicalRepository,
  stageStatementImportThroughCanonicalRepository,
} from '../../apps/mobile/src/local/canonicalLedgerMutations.ts';
import { buildLocalTodayModel } from '../../apps/mobile/src/local/localTodayAdapter.ts';
import { buildLocalTimelineModel } from '../../apps/mobile/src/local/localTimelineAdapter.ts';
import { buildLocalCalendarModel } from '../../apps/mobile/src/local/localCalendarAdapter.ts';
import { buildLocalPlansModel } from '../../apps/mobile/src/local/localPlansAdapter.ts';
import { buildLocalRecoverySpendScenarioPreview } from '../../apps/mobile/src/local/localScenarioAdapter.ts';
import { gateMeloLocalAiDraft } from '../../apps/mobile/src/local/localMeloPolicyAdapter.ts';
import {
  dataControlTrustCopy,
  firstMinuteActions,
  firstMinuteMeloBriefing,
  firstMinutePrimaryMessage,
  importEntryTrustCopy,
  importReviewActionCopy,
  quickEstimateEnoughCopy,
  sampleBriefingCards,
  sampleBriefingMelo,
} from '../../apps/mobile/src/local/productExperienceLoop.ts';
import {
  firstValueMoments,
  guidedManualQuestions,
  productLenses,
} from '../../apps/mobile/src/local/productExperienceStandard.ts';

type EvidencePanel = Readonly<{
  id: string;
  title: string;
  eyebrow: string;
  body: string;
  content: string;
}>;

const asOfDate = '2026-06-22';
const outputDir = resolve(
  process.env.FOLIO_EVIDENCE_OUTPUT_DIR ?? 'apps/mobile/evidence/mobile-shell-visual-pass',
);
const pageDir = join(outputDir, 'pages');
const screenshotDir = join(outputDir, 'screenshots');
const xmlDir = join(outputDir, 'xml');
const sampleStatement = [
  'Date,Description,Amount',
  '2026-06-21,Bus fare,-3.20',
  '2026-06-22,Coffee,-3.25',
  '2026-06-27,Payday,1840.00',
].join('\n');

const emptyLedger = createEmptyLocalLedgerState(asOfDate);
const emptyRoute = buildLocalRouteSummary(emptyLedger);
const stagedImport = stageStatementImportThroughCanonicalRepository(emptyLedger, sampleStatement, {
  byteSize: sampleStatement.length,
  filename: 'pasted-statement.csv',
  mediaType: 'text/csv',
  storageState: 'pasted_text',
}).state;
const rejectedImport = rejectImportDraftThroughCanonicalRepository(
  stagedImport,
  stagedImport.importDrafts[0]?.rowId ?? '',
  { reason: 'duplicate' },
);
const acceptedDraftId = stagedImport.importDrafts[0]?.rowId ?? '';
const acceptedReadyImport = editImportDraftThroughCanonicalRepository(
  stagedImport,
  acceptedDraftId,
  {
    amountText: '3.20',
    date: '2026-06-21',
    interpretation: 'Bus fare',
  },
);
const acceptedImport = acceptImportDraftThroughCanonicalRepository(
  acceptedReadyImport,
  acceptedDraftId,
);
const manualLedger = createQuickEstimateThroughCanonicalRepository(asOfDate, {
  billAmountText: '875',
  billDate: '2026-07-01',
  billTitle: 'Rent',
  cashNowText: '1190.47',
  incomeAmountText: '1840',
  incomeDate: '2026-06-27',
  incomeTitle: 'Payday',
});
const plannedLedger = createPlannedCommitmentThroughCanonicalRepository(manualLedger, {
  amountText: '126.40',
  date: '2026-06-25',
  title: 'Council tax',
});
const realRoute = buildLocalRouteSummary(plannedLedger);
const today = buildLocalTodayModel(plannedLedger, realRoute);
const timeline = buildLocalTimelineModel(plannedLedger);
const calendar = buildLocalCalendarModel(plannedLedger, realRoute);
const plans = buildLocalPlansModel(plannedLedger, realRoute);
const recoveryPreview = buildLocalRecoverySpendScenarioPreview(plannedLedger, realRoute, {
  amountMinor: 39_000,
  label: 'Repair',
});
const dataExport = buildLocalLedgerExportPayload(plannedLedger, realRoute);
const exportRecordCount =
  dataExport.transactions.length +
  dataExport.importDrafts.length +
  dataExport.rejectedImports.length +
  dataExport.documentStages.length +
  dataExport.history.length;
const meloSnapshot = buildMeloSnapshotFromLocalState(plannedLedger, realRoute);
const meloDraft = gateMeloLocalAiDraft(
  draftMeloLocalAiResponse({
    cloudAiEnabled: false,
    cloudConsentGranted: false,
    prompt: 'Why is this available before payday?',
    snapshot: meloSnapshot,
    source: 'typed_prompt',
  }),
).draft;

const panels: readonly EvidencePanel[] = [
  {
    id: 'start',
    title: "Let's get your first useful picture.",
    eyebrow: 'Start',
    body: 'Start with a rough number, a bank row or the payment pressing first. Nothing is added until you review it.',
    content: [
      actionStack([
        ['Start with a few numbers', 'Money now, next income and what must be paid'],
        ['Add bank activity', 'Paste rows or choose a file'],
        ['Organise debts', 'Minimum payment, due date and pressure'],
        ['Check bills', 'One bill or must-pay item before income'],
        ['Try fake data', 'Open labelled fake data first'],
      ]),
      trustRail([
        ['Start', 'Add what you have'],
        ['Review', 'Check rows'],
        ['Today', 'See your picture'],
      ]),
    ].join(''),
  },
  {
    id: 'first-value-moments',
    title: 'Useful in under 60 seconds.',
    eyebrow: 'First value',
    body: 'Folio starts from the user job, not from a dashboard setup.',
    content: [
      cardGrid([
        ['Payday', firstValueMoments.payday, 'attention'],
        ['Debt', firstValueMoments.debt, 'estimated'],
        ['Bills', firstValueMoments.bills, 'estimated'],
        ['Bank activity', firstValueMoments.addBankActivity, 'confirmed'],
        ['Unsure', firstValueMoments.unsure, 'confirmed'],
      ]),
      note('Every first win stays review-first and inspectable.'),
    ].join(''),
  },
  {
    id: 'guide-me',
    title: 'Which feels most urgent right now?',
    eyebrow: 'Guide me',
    body: 'One question, then the smallest useful next step.',
    content: [
      actionStack([
        ['I need to make it to payday', 'Start with money now, next income and what must be paid'],
        ['A debt payment', 'Start with the payment that is worrying you'],
        ['My bank activity', 'Paste or choose a statement and check rows one by one'],
      ]),
      note('No six-option setup. One answer leads directly to the next action.'),
    ].join(''),
  },
  {
    id: 'payday-guided-step',
    title: 'What money do you have right now?',
    eyebrow: 'Make it to payday',
    body: 'Step 1 of 5. One question, one main input, skip and estimate available.',
    content: [
      guidedOneStepQuestion(guidedManualQuestions[0]!, 'Money available today', '0.00'),
      progress(1, guidedManualQuestions.length, 'guided steps complete'),
      buttonRow(['Rough estimate', 'Skip for now', 'Continue']),
      note('The route preview appears after enough information exists.'),
    ].join(''),
  },
  {
    id: 'debt-entry',
    title: 'Which debt payment is worrying you first?',
    eyebrow: 'Organise debts',
    body: 'Debt is first-class: lender, balance, minimum payment, due date, APR, status, note and pressure.',
    content: [
      formRows([
        ['Debt lender or name', 'Abound'],
        ['Debt balance', 'GBP 1,248.20'],
        ['Minimum payment', 'GBP 162.95'],
        ['Debt payment due date', '2026-06-25'],
        ['APR if known', '29.9%'],
        ['Status', 'Arrangement'],
        ['Pressure', 'Feels urgent'],
        ['Debt note', 'This payment is due before the next income.'],
      ]),
      cardGrid([
        ['Due before income', '2026-06-25', 'attention'],
        ['Before payday', 'GBP -162.95', 'attention'],
        ['Debt balance', 'GBP 1,248.20', 'confirmed'],
        ['Save effect', 'Protected debt payment', 'confirmed'],
      ]),
      buttonRow(['Find debt row', 'Save debt payment']),
    ].join(''),
  },
  {
    id: 'bill-entry',
    title: 'What must be paid before then?',
    eyebrow: 'Check bills',
    body: 'Add one bill or must-pay item. It becomes protected in the route.',
    content: [
      formRows([
        ['Bill name', 'Council tax'],
        ['Bill amount', 'GBP 126.40'],
        ['Bill due date', '2026-06-25'],
        ['Type', 'Must-pay'],
        ['Repeat', 'Recurring'],
      ]),
      note('This bill reduces what is available before payday when saved.'),
      buttonRow(['Find bill row', 'Save bill']),
    ].join(''),
  },
  {
    id: 'empty-first-launch',
    title: shortFirstMinuteTitle(firstMinutePrimaryMessage),
    eyebrow: 'Empty first launch',
    body: 'Start local. Review first. No account needed.',
    content: [
      melo('Start with an import, three facts, or a sample. Nothing writes without review.'),
      interactionRail([
        ['Preview', 'See picture movement before saving', 'preview'],
        ['Reveal', 'Open the details', 'reveal'],
        ['Save', 'Write only after review', 'commit'],
      ]),
      trustRail([
        ['Local', 'On this device'],
        ['Review', 'You confirm meaning'],
        ['No gate', 'No account needed'],
      ]),
      actionStack(firstMinuteActions.map((action) => [action.label, action.detail])),
    ].join(''),
  },
  {
    id: 'sample-briefing',
    title: 'See the loop without using your data.',
    eyebrow: 'Fake data briefing',
    body: 'Playable preview. Example only, not your data, nothing saved.',
    content: [
      chips(sampleBriefingMelo.labels),
      melo('Nothing here can become your picture or export.'),
      cardGrid(sampleBriefingCards.map((card) => [card.title, card.value, card.tone])),
      note('Fake data stays separate.'),
    ].join(''),
  },
  {
    id: 'import-entry',
    title: 'Choose a statement to start.',
    eyebrow: 'Import entry',
    body: 'Choose or paste a statement. Rows wait here until review.',
    content: [
      chips(importEntryTrustCopy),
      interactionRail([
        ['Rows found', 'Statement rows become questions', 'preview'],
        ['Original', 'Original wording stays attached', 'reveal'],
        ['Add', 'Keep one row at a time', 'commit'],
      ]),
      uploadBox('CSV/TXT statement', 'Choose a file or paste statement text'),
      cardGrid([
        ['Works now', 'Manual input, fake data, supported CSV/text', 'confirmed'],
        ['Review only', 'PDF, screenshots, unsupported files, uncertain rows', 'attention'],
      ]),
      buttonRow(['Choose CSV/TXT file', 'Paste statement text']),
    ].join(''),
  },
  {
    id: 'review-only-file',
    title: 'File saved for review.',
    eyebrow: 'Import truth',
    body: 'Automatic reading is not ready for this file yet. You can still add the important numbers from it.',
    content: [
      uploadBox('PDF or screenshot', 'Automatic reading is not ready for this file yet.'),
      buttonRow([
        'Add money from file',
        'Add income from file',
        'Add bill from file',
        'Add debt payment',
        'Keep file for later',
        'Remove file',
      ]),
      note('The file stays available for checking. No rows are added automatically.'),
    ].join(''),
  },
  {
    id: 'review-rows',
    title: 'Rows to check',
    eyebrow: 'Review rows',
    body: 'Nothing has been added yet. Choose what to keep.',
    content: [
      progress(stagedImport.importDrafts.length, stagedImport.importDrafts.length),
      interactionRail([
        ['Waiting', 'Rows wait here', 'preview'],
        ['Original', 'Original wording remains visible', 'reveal'],
        ['Add', 'Added rows update Today', 'commit'],
      ]),
      reviewRows(stagedImport.importDrafts.map((draft) => [draft.original, draft.interpretation])),
      buttonRow([
        'Add',
        'Edit',
        'Ignore',
        'Duplicate',
        'Transfer',
        'Income',
        'Bill',
        'Debt payment',
        'Refund',
        'Later',
      ]),
      decisionGuide(),
    ].join(''),
  },
  {
    id: 'row-accepted',
    title: 'Row added',
    eyebrow: 'Review row accepted',
    body: 'Today updates only after a row is added.',
    content: [
      stats([
        ['Accepted rows', acceptedImport.transactions.length],
        ['Waiting rows', acceptedImport.importDrafts.length],
        ['Today uses', 'Added rows only'],
      ]),
      rows(
        acceptedImport.transactions.map((row) => [
          'Added',
          row.title,
          formatMinorAmount(row.amountMinor),
        ]),
      ),
      note('What changed explains the accepted row and keeps original wording attached.'),
    ].join(''),
  },
  {
    id: 'row-ignored',
    title: 'Row ignored',
    eyebrow: 'Review row ignored',
    body: 'Ignored rows do not change Today.',
    content: [
      stats([
        ['Ignored evidence', rejectedImport.rejectedImports.length],
        ['Money rows added', rejectedImport.transactions.length],
        ['Today change', 'None'],
      ]),
      rows(
        rejectedImport.rejectedImports.map((row) => [
          'Ignored',
          row.original,
          row.rejectionReason.replaceAll('-', ' '),
        ]),
      ),
    ].join(''),
  },
  {
    id: 'duplicate-transfer-refund-states',
    title: 'Same row, different meaning.',
    eyebrow: 'Row action states',
    body: 'Duplicate, transfer and refund choices are row actions, not detached tiles.',
    content: [
      cardGrid([
        ['Duplicate', 'Kept out of your picture', 'attention'],
        ['Transfer', 'Excluded from spending', 'estimated'],
        ['Refund', 'Marked as money returned, waiting for Add', 'confirmed'],
        ['Later', 'Still waiting, nothing changed', 'estimated'],
      ]),
      buttonRow(['Duplicate', 'Transfer', 'Refund', 'Later']),
    ].join(''),
  },
  {
    id: 'rejected-import-state',
    title: 'Rejected evidence stays separate.',
    eyebrow: 'Rejected import state',
    body: 'Rejected rows remain proof, not money rows.',
    content: [
      stats([
        ['Accepted records', rejectedImport.transactions.length],
        ['Rejected evidence', rejectedImport.rejectedImports.length],
        ['Import drafts', rejectedImport.importDrafts.length],
      ]),
      list(
        rejectedImport.rejectedImports.map(
          (row) => `${row.original}: ${row.rejectionReason.replaceAll('-', ' ')}`,
        ),
      ),
    ].join(''),
  },
  {
    id: 'minimal-manual-path',
    title: 'When is money coming in next?',
    eyebrow: 'Guided manual input',
    body: 'Step 3 of 5. One question is active; previous answers stay in the preview.',
    content: [
      guidedOneStepQuestion(
        guidedManualQuestions[2]!,
        'Next income amount and date',
        'GBP 1,840 on 2026-06-27',
      ),
      cardGrid([
        ['Money now', 'GBP 1,190.47', 'confirmed'],
        ['Exactness', 'Rough estimate', 'estimated'],
        ['Preview', 'Waiting for must-pay item', 'attention'],
      ]),
      buttonRow(['Estimate income', 'No income to add', 'Continue']),
    ].join(''),
  },
  {
    id: 'completed-manual-first-picture',
    title: 'Payday picture preview',
    eyebrow: 'Completed manual first picture',
    body: quickEstimateEnoughCopy,
    content: [
      cardGrid([
        ['Money now', 'GBP 1,190.47', 'confirmed'],
        ['Next income', 'Payday, 27 Jun', 'estimated'],
        ['Must pay', 'Rent, 1 Jul', 'attention'],
        ['Debt note', 'No extra debt note yet', 'estimated'],
      ]),
      routeLine(buildLocalRouteSummary(manualLedger)),
      buttonRow(['Save first picture']),
    ].join(''),
  },
  {
    id: 'why-inspect-route',
    title: 'Pressure point',
    eyebrow: 'Trust layer',
    body: 'Every route point explains date, amount, cause, accepted items and waiting review.',
    content: [
      routeLine(realRoute),
      cardGrid([
        ['Date', '2026-06-25', 'confirmed'],
        ['Balance after', formatMinorAmount(realRoute.tightestBalanceMinor), 'attention'],
        ['What caused it', 'Council tax before payday', 'attention'],
        ['Waiting review', `${realRoute.pendingReviewCount} waiting`, 'estimated'],
      ]),
      note('Waiting rows stay visible here but do not change your picture until accepted.'),
    ].join(''),
  },
  {
    id: 'first-real-today-briefing',
    title: today.headline,
    eyebrow: 'First real Today briefing',
    body: 'A calm daily briefing from local records.',
    content: [
      heroMoney(
        formatMinorAmount(today.position.availableMinor),
        'breathing room after known bills',
      ),
      interactionRail([
        ['Preview', 'Picture updates first', 'preview'],
        ['Reveal', 'Details stay one tap away', 'reveal'],
        ['Save', 'Nothing changes until you choose', 'commit'],
      ]),
      lineSummary([
        ['Position', formatMinorAmount(today.position.availableMinor)],
        ['Next', 'Payday, 27 Jun'],
        ['Review', `${realRoute.pendingReviewCount} item(s)`],
      ]),
      disclosure('What changed?', shortText(today.whatChanged.summary)),
      routeLine(realRoute),
    ].join(''),
  },
  {
    id: 'what-changed',
    title: 'What changed?',
    eyebrow: 'Timeline explanation',
    body: 'Accepted rows and saved commitments explain the update.',
    content: [
      disclosure('Latest change', shortText(today.whatChanged.summary)),
      rows(today.whatChanged.items.map((item) => ['Change', item.title, item.summary])),
      note('Rows waiting in Review are not included until added.'),
    ].join(''),
  },
  {
    id: 'breathing-room-route',
    title: 'Will I make it to payday?',
    eyebrow: 'Breathing-room route',
    body: 'Today, income, bills, debt payments, protected buffer, lowest point and waiting rows are visible.',
    content: [
      routeLine(realRoute),
      stats([
        ['Current money', formatMinorAmount(realRoute.availableNowMinor)],
        ['Next income', realRoute.nextPaydayLabel],
        [
          'Lowest point',
          `${formatMinorAmount(realRoute.tightestBalanceMinor)} ${realRoute.tightestDay}`,
        ],
        ['Waiting review', `${realRoute.pendingReviewCount}`],
      ]),
    ].join(''),
  },
  {
    id: 'timeline',
    title: 'What changed, what is next.',
    eyebrow: 'Timeline',
    body: `${timeline.factCount} known, ${timeline.expectationCount} coming up, ${timeline.reviewCount} to review.`,
    content: [
      chips(['Now', 'Needs review', 'Coming up', 'Plan movement', 'History']),
      rows(
        timeline.events
          .slice(0, 7)
          .map((event) => [event.kindLabel, event.title, shortText(event.detail, 86)]),
      ),
    ].join(''),
  },
  {
    id: 'calendar',
    title: 'Your week reacts to the money picture.',
    eyebrow: 'Calendar',
    body: 'Important dates first. Details stay one tap away.',
    content: [
      weekStrip(),
      interactionRail([
        ['Preview', 'Week reacts to the money picture', 'preview'],
        ['Reveal', 'Full agenda stays one tap away', 'reveal'],
        ['Save', 'New commitments save after review', 'commit'],
      ]),
      routeLine(realRoute),
      rows(
        calendar.agenda
          .slice(0, 4)
          .map((event) => [event.day, event.title, shortText(event.detail, 78)]),
      ),
      disclosure(
        'Full agenda',
        `${calendar.calendarItemCount} calendar items, ${calendar.plannerItemCount} planner items.`,
      ),
    ].join(''),
  },
  {
    id: 'plans',
    title: 'Progress without pressure.',
    eyebrow: 'Plans',
    body: 'Plans show protected money, movement and next review.',
    content: [
      trustRail([
        ['Plans', `${plans.planRows.length}`],
        ['Review', `${plans.reviewRows.length}`],
        ['Based on', plans.sourceLabel],
      ]),
      interactionRail([
        ['Preview', 'Plan movement is simulated first', 'preview'],
        ['Protect', 'Protected money remains named', 'protect'],
        ['Save', 'Accepted recovery updates the plan', 'commit'],
      ]),
      rows(
        plans.planRows.length > 0
          ? plans.planRows.map((row) => [row.stateLabel, row.title, row.nextStep])
          : [['Draft projections', 'No plan projections yet', 'Add a dated commitment']],
      ),
      rows(plans.reviewRows.slice(0, 3).map((row) => [row.stateLabel, row.title, row.dueDate])),
    ].join(''),
  },
  {
    id: 'recovery-preview',
    title: 'Preview first. Save only after review.',
    eyebrow: 'Recovery preview',
    body: 'Nothing has changed yet. Folio shows the path before recording.',
    content: [
      melo('There is a path forward. Review the visible preview before saving.'),
      interactionRail([
        ['Preview', 'Try the change first', 'preview'],
        ['Protect', 'Protected items stay visible', 'protect'],
        ['Save', 'Record only after review', 'commit'],
      ]),
      stats([
        ['Now available', formatMinorAmount(realRoute.availableNowMinor)],
        ['After spend', formatMinorAmount(recoveryPreview.impact.remainingMinor)],
        ['Writes immediately', recoveryPreview.writesImmediately ? 'yes' : 'no'],
      ]),
      routeLine(recoveryPreview.previewRoute),
      note(recoveryPreview.scenario.title),
    ].join(''),
  },
  {
    id: 'data-control',
    title: 'Know what is here. Take it with you.',
    eyebrow: 'Data and privacy',
    body: 'Rows waiting for review, added rows and ignored rows stay separate.',
    content: [
      trustRail([
        ['Local', 'On this device'],
        ['Review', 'You choose what counts'],
        ['Portable', 'Export anytime'],
      ]),
      interactionRail([
        ['Reveal', 'See what is stored', 'reveal'],
        ['Protect', 'Export stays user-owned', 'protect'],
        ['Clear', 'Clear only after arming', 'commit'],
      ]),
      cardGrid([
        ['Local data', `${exportRecordCount} export rows`, 'confirmed'],
        ['Accepted money rows', `${plannedLedger.transactions.length} records`, 'confirmed'],
        ['Rows waiting', `${plannedLedger.importDrafts.length} drafts`, 'estimated'],
        ['Rejected evidence', `${plannedLedger.rejectedImports.length} retained`, 'attention'],
      ]),
      buttonRow(['Prepare export file', 'Arm clear']),
    ].join(''),
  },
  {
    id: 'more',
    title: 'More',
    eyebrow: 'Settings and support',
    body: 'Secondary actions stay out of the first decision path.',
    content: [
      actionStack([
        ['Data and privacy', 'See what is stored, export, and clear deliberately'],
        ['Try fake data', 'Open a sample without touching your picture'],
        ['Security check', 'Local lock, device storage and review status'],
        ['Evidence and support', 'Copy useful details without sharing money rows'],
      ]),
      note('More keeps settings and proof available without turning Start into a dashboard.'),
    ].join(''),
  },
  {
    id: 'melo-surface',
    title: 'Melo explains. You decide.',
    eyebrow: 'Melo surface',
    body: 'Records stay visible. Changes still need your tap.',
    content: [
      melo(shortText(meloDraft.answer)),
      interactionRail([
        ['Ask', 'One bounded question', 'melo'],
        ['Reveal', 'Local records stay visible', 'reveal'],
        ['Review', 'Changes still need your tap', 'preview'],
      ]),
      note(shortText(meloDraft.financialConclusion)),
      disclosure('Records Melo checked', 'Open for data used and guardrails.'),
      rows(
        meloDraft.actions.map((action) => [
          action.label,
          action.requiresUserReview ? 'Review' : 'Explain',
          action.detail,
        ]),
      ),
    ].join(''),
  },
];

rmSync(pageDir, { force: true, recursive: true });
rmSync(screenshotDir, { force: true, recursive: true });
rmSync(xmlDir, { force: true, recursive: true });
mkdirSync(pageDir, { recursive: true });
mkdirSync(screenshotDir, { recursive: true });
mkdirSync(xmlDir, { recursive: true });

for (const panel of panels) {
  writeFileSync(join(pageDir, `${panel.id}.html`), renderPage(panel), 'utf8');
  writeFileSync(join(xmlDir, `${panel.id}.xml`), renderXml(panel), 'utf8');
}

writeFileSync(join(outputDir, 'index.html'), renderBoard(panels), 'utf8');
writeFileSync(
  join(outputDir, 'manifest.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      method: 'static-html-render-harness-from-local-ledger-and-surface-copy',
      outputDir,
      pages: panels.map((panel) => ({
        id: panel.id,
        html: `pages/${panel.id}.html`,
        screenshot: `screenshots/${panel.id}.png`,
        xml: `xml/${panel.id}.xml`,
      })),
    },
    null,
    2,
  ),
  'utf8',
);

console.log(`Generated ${panels.length} evidence pages in ${outputDir}`);

function renderXml(panel: EvidencePanel): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<surface id="${escapeXml(panel.id)}">`,
    `  <eyebrow>${escapeXml(panel.eyebrow)}</eyebrow>`,
    `  <title>${escapeXml(panel.title)}</title>`,
    `  <body>${escapeXml(panel.body)}</body>`,
    `  <plainText>${escapeXml(stripHtml(panel.content))}</plainText>`,
    '</surface>',
    '',
  ].join('\n');
}

function renderPage(panel: EvidencePanel): string {
  return htmlShell(`<main class="single">${phone(panel)}</main>`, panel.title);
}

function renderBoard(allPanels: readonly EvidencePanel[]): string {
  return htmlShell(
    `<main class="board">
      <header class="boardHeader">
        <div class="boardBrand">${folioMark('boardMark')}<p>Folio V2 visual evidence</p></div>
        <h1>10/10 product experience standard</h1>
        <span>${allPanels.length} states rendered from local models and user-facing copy</span>
      </header>
      <section class="grid">${allPanels.map(phone).join('')}</section>
    </main>`,
    'Folio mobile evidence board',
  );
}

function phone(panel: EvidencePanel): string {
  return `<article class="phone" data-surface="${escapeHtml(panel.id)}">
    <div class="topbar"><span class="phoneBrand">${folioMark(
      'topbarMark',
    )}<span>Personal</span></span><span>Local</span></div>
    <p class="eyebrow">${escapeHtml(panel.eyebrow)}</p>
    <h2>${escapeHtml(panel.title)}</h2>
    <p class="body">${escapeHtml(panel.body)}</p>
    ${panel.content}
  </article>`;
}

function htmlShell(content: string, title: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #17231d;
      --muted: #617069;
      --line: #cfd8d2;
      --paper: #f6f3ea;
      --panel: #fffefa;
      --sunken: #e8eee8;
      --green: #1f7a5c;
      --greenSoft: #dceee5;
      --amber: #8a5a18;
      --amberSoft: #f2e2c6;
      --red: #a94332;
      --redSoft: #f0d6cf;
      --softWhite: rgba(255, 255, 255, 0.66);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background:
        linear-gradient(90deg, rgba(23, 35, 29, 0.035) 1px, transparent 1px),
        linear-gradient(180deg, rgba(23, 35, 29, 0.03) 1px, transparent 1px),
        #e8eee8;
      background-size: 28px 28px;
      color: var(--ink);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .single {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .board { padding: 32px; }
    .boardHeader {
      max-width: 1260px;
      margin: 0 auto 28px;
      display: grid;
      gap: 8px;
    }
    .boardHeader p,
    .eyebrow {
      margin: 0;
      color: var(--green);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .boardHeader h1 {
      margin: 0;
      font-size: 44px;
      line-height: 0.98;
      letter-spacing: 0;
    }
    .boardHeader span {
      color: var(--muted);
      font-size: 15px;
      line-height: 22px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 390px);
      gap: 22px;
      justify-content: center;
      align-items: start;
    }
    .phone {
      width: 390px;
      min-height: 844px;
      border: 1px solid rgba(23, 35, 29, 0.1);
      border-radius: 28px;
      background: linear-gradient(180deg, #fffefa 0%, var(--paper) 100%);
      box-shadow: 0 18px 40px rgba(23, 35, 29, 0.16);
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      overflow: hidden;
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
    }
    h2 {
      margin: 0;
      font-size: 30px;
      line-height: 34px;
      letter-spacing: 0;
    }
    .body {
      margin: 0;
      color: var(--muted);
      font-size: 15px;
      line-height: 22px;
    }
    .melo,
    .note,
    .upload,
    .route,
    .progress,
    .questions,
    .lensGrid,
    .row,
    .stat,
    .card {
      border: 1px solid transparent;
      background: var(--softWhite);
      border-radius: 8px;
    }
    .boardBrand,
    .phoneBrand {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .folioMark {
      width: 34px;
      height: 34px;
      border: 1.5px solid var(--ink);
      border-radius: 9px;
      display: inline-grid;
      place-items: center;
      background: #fffefb;
      color: var(--ink);
      flex: 0 0 auto;
    }
    .boardMark {
      width: 42px;
      height: 42px;
      border-radius: 10px;
    }
    .topbarMark {
      width: 22px;
      height: 22px;
      border-radius: 6px;
    }
    .folioMark svg {
      display: block;
      height: 68%;
      width: 68%;
    }
    .melo {
      display: grid;
      grid-template-columns: 34px 1fr;
      gap: 10px;
      padding: 14px;
    }
    .avatar {
      width: 34px;
      height: 34px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: var(--ink);
      color: #fff;
      font-weight: 900;
    }
    .melo p,
    .note,
    .upload {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 19px;
    }
    .note,
    .upload {
      padding: 14px;
      background: var(--greenSoft);
      color: var(--ink);
    }
    .trustRail,
    .interactionRail,
    .actionStack,
    .lineSummary,
    .questions,
    .lensGrid {
      display: grid;
      gap: 8px;
    }
    .trustRail {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .trustChip,
    .interactionStep,
    .action,
    .lineItem,
    .disclosure {
      background: var(--softWhite);
      border-radius: 8px;
      padding: 11px 12px;
    }
    .trustChip {
      display: grid;
      gap: 2px;
      border-radius: 999px;
    }
    .interactionRail {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.56);
      padding: 12px;
    }
    .interactionStep {
      align-items: center;
      display: grid;
      grid-template-columns: 10px 84px 1fr;
      gap: 10px;
      padding: 0 0 8px;
      border-bottom: 1px solid var(--line);
      background: transparent;
    }
    .interactionStep:last-child {
      padding-bottom: 0;
      border-bottom: 0;
    }
    .interactionDot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: var(--green);
    }
    .mode-preview { background: var(--amber); }
    .mode-reveal { background: var(--green); }
    .mode-commit { background: var(--ink); }
    .mode-melo {
      background: var(--green);
      outline: 2px solid var(--ink);
    }
    .mode-protect {
      background: var(--greenSoft);
      border: 2px solid var(--green);
    }
    .trustChip strong,
    .interactionStep strong,
    .action strong,
    .lineItem strong,
    .disclosure strong {
      color: var(--ink);
      font-size: 13px;
      line-height: 18px;
    }
    .trustChip span,
    .interactionStep span,
    .action span,
    .lineItem span,
    .disclosure span {
      color: var(--muted);
      font-size: 12px;
      line-height: 17px;
    }
    .action {
      display: grid;
      gap: 2px;
      min-height: 64px;
    }
    .lensGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      padding: 12px;
    }
    .lens,
    .question {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 8px;
      display: grid;
      gap: 4px;
      min-height: 74px;
      padding: 10px;
    }
    .lens.selected {
      background: var(--ink);
      border-color: var(--ink);
      color: #fff;
    }
    .lens strong,
    .question strong {
      font-size: 13px;
      line-height: 18px;
    }
    .lens span,
    .question span,
    .question p,
    .question em {
      color: var(--muted);
      font-size: 11px;
      line-height: 15px;
      margin: 0;
    }
    .lens.selected span {
      color: #dce6e0;
    }
    .questions {
      padding: 12px;
    }
    .question {
      min-height: 92px;
    }
    .actionPrimary {
      background: var(--ink);
    }
    .actionPrimary strong,
    .actionPrimary span {
      color: #fff;
    }
    .lineItem,
    .disclosure {
      align-items: center;
      display: flex;
      gap: 12px;
      justify-content: space-between;
    }
    .disclosure b {
      color: var(--muted);
      font-size: 20px;
      line-height: 20px;
    }
    .chips,
    .buttons,
    .stats,
    .cards {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .chip,
    .button {
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      border-radius: 8px;
      border: 1px solid transparent;
      padding: 9px 12px;
      font-size: 12px;
      font-weight: 800;
      background: #fff;
    }
    .button:first-child {
      background: var(--ink);
      border-color: var(--ink);
      color: #fff;
    }
    .stats,
    .cards {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .stat,
    .card {
      padding: 12px;
      min-height: 82px;
    }
    .label {
      color: var(--muted);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      line-height: 15px;
    }
    .value {
      margin-top: 4px;
      color: var(--ink);
      font-size: 14px;
      font-weight: 800;
      line-height: 19px;
    }
    .tone-attention { border-color: var(--red); background: var(--redSoft); }
    .tone-estimated { border-color: transparent; background: var(--amberSoft); }
    .tone-confirmed { border-color: transparent; background: var(--greenSoft); }
    .rows { display: grid; gap: 8px; }
    .row {
      display: grid;
      gap: 4px;
      padding: 12px;
    }
    .row strong {
      font-size: 13px;
      line-height: 18px;
    }
    .row span {
      color: var(--muted);
      font-size: 12px;
      line-height: 17px;
    }
    .progress {
      padding: 14px;
      display: grid;
      gap: 8px;
    }
    .bar {
      height: 8px;
      border-radius: 4px;
      background: var(--line);
      overflow: hidden;
    }
    .fill {
      height: 100%;
      background: var(--green);
    }
    .route {
      padding: 14px;
      display: grid;
      gap: 10px;
    }
    .routeSvg {
      width: 100%;
      height: 96px;
    }
    .money {
      font-size: 46px;
      line-height: 50px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
    .week {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 6px;
    }
    .day {
      min-height: 54px;
      border-radius: 8px;
      background: var(--sunken);
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 12px;
    }
    .day:first-child {
      background: var(--ink);
      color: #fff;
    }
  </style>
</head>
<body>${content}</body>
</html>`;
}

function melo(text: string): string {
  return `<div class="melo"><div class="avatar">M</div><p>${escapeHtml(text)}</p></div>`;
}

function folioMark(className = ''): string {
  return `<span class="folioMark ${escapeHtml(
    className,
  )}" role="img" aria-label="Folio temporary brand mark: folded local record with a money line"><svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M14 6h18l8 8v28H14z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="3.4"/><path d="M32 6v10h8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3.4"/><path d="M19 29c3.8-3.6 7.6-3.6 11.4 0 2 1.8 4.3 2.8 6.6 2.9" fill="none" stroke="#2E7D67" stroke-linecap="round" stroke-linejoin="round" stroke-width="3.8"/><path d="M19 36h18" fill="none" stroke="currentColor" stroke-linecap="round" stroke-opacity=".38" stroke-width="3.4"/></svg></span>`;
}

function interactionRail(items: readonly (readonly [string, string, string])[]): string {
  return `<div class="interactionRail">${items
    .map(([label, detail, mode]) => {
      const modeClass = mode.replace(/[^a-z-]/gu, '');
      return `<div class="interactionStep"><i class="interactionDot mode-${escapeHtml(
        modeClass,
      )}"></i><strong>${escapeHtml(label)}</strong><span>${escapeHtml(detail)}</span></div>`;
    })
    .join('')}</div>`;
}

function list(items: readonly string[]): string {
  return `<div class="rows">${items
    .map((item) => `<div class="row"><strong>${escapeHtml(item)}</strong></div>`)
    .join('')}</div>`;
}

function actionStack(items: readonly (readonly [string, string])[]): string {
  return `<div class="actionStack">${items
    .map(
      ([label, detail], index) =>
        `<div class="action ${index === 0 ? 'actionPrimary' : ''}"><strong>${escapeHtml(
          label,
        )}</strong><span>${escapeHtml(detail)}</span></div>`,
    )
    .join('')}</div>`;
}

function rows(items: readonly (readonly [string, string, string])[]): string {
  return `<div class="rows">${items
    .map(
      ([label, title, detail]) =>
        `<div class="row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(
          title,
        )}</strong><span>${escapeHtml(detail)}</span></div>`,
    )
    .join('')}</div>`;
}

function reviewRows(items: readonly (readonly [string, string])[]): string {
  return rows(items.map(([original, interpretation]) => ['Review row', original, interpretation]));
}

function chips(items: readonly string[]): string {
  return `<div class="chips">${items.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join('')}</div>`;
}

function trustRail(items: readonly (readonly [string, string])[]): string {
  return `<div class="trustRail">${items
    .map(
      ([label, value]) =>
        `<div class="trustChip"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(
          value,
        )}</span></div>`,
    )
    .join('')}</div>`;
}

function lineSummary(items: readonly (readonly [string, string])[]): string {
  return `<div class="lineSummary">${items
    .map(
      ([label, value]) =>
        `<div class="lineItem"><span>${escapeHtml(label)}</span><strong>${escapeHtml(
          value,
        )}</strong></div>`,
    )
    .join('')}</div>`;
}

function disclosure(label: string, value: string): string {
  return `<div class="disclosure"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span><b>›</b></div>`;
}

function buttonRow(items: readonly string[]): string {
  return `<div class="buttons">${items
    .map((item) => `<span class="button">${escapeHtml(item)}</span>`)
    .join('')}</div>`;
}

function stats(items: readonly (readonly [string, string | number])[]): string {
  return `<div class="stats">${items
    .map(
      ([label, value]) =>
        `<div class="stat"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(
          String(value),
        )}</div></div>`,
    )
    .join('')}</div>`;
}

function cardGrid(items: readonly (readonly [string, string, string])[]): string {
  return `<div class="cards">${items
    .map(
      ([label, value, tone]) =>
        `<div class="card tone-${escapeHtml(tone)}"><div class="label">${escapeHtml(
          label,
        )}</div><div class="value">${escapeHtml(value)}</div></div>`,
    )
    .join('')}</div>`;
}

function uploadBox(label: string, value: string): string {
  return `<div class="upload"><strong>${escapeHtml(label)}</strong><br />${escapeHtml(value)}</div>`;
}

function note(text: string): string {
  return `<div class="note">${escapeHtml(text)}</div>`;
}

function progress(done: number, total: number, label = 'rows ready for review'): string {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return `<div class="progress"><div class="label">${done} of ${total} ${escapeHtml(label)}</div><div class="bar"><div class="fill" style="width:${percent}%"></div></div></div>`;
}

function heroMoney(value: string, caption: string): string {
  return `<div><div class="money">${escapeHtml(value)}</div><p class="body">${escapeHtml(caption)}</p></div>`;
}

function routeLine(route: ReturnType<typeof buildLocalRouteSummary>): string {
  const points = route.points.length > 0 ? route.points : emptyRoute.points;
  const balances = points.map((point) => point.balanceMinor);
  const min = Math.min(...balances, 0);
  const max = Math.max(...balances, 1);
  const range = Math.max(1, max - min);
  const width = 318;
  const height = 76;
  const coords = points.map((point, index) => {
    const x = 8 + (index / Math.max(1, points.length - 1)) * width;
    const y = 10 + height - ((point.balanceMinor - min) / range) * height;
    return [Math.round(x), Math.round(y)] as const;
  });
  const path = coords.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');

  return `<div class="route">
    <div class="label">Will I make it to payday?</div>
    <svg class="routeSvg" viewBox="0 0 340 100" role="img" aria-label="Money picture chart">
      <path d="${path}" fill="none" stroke="#c4d3cb" stroke-width="14" stroke-linecap="round" />
      <path d="${path}" fill="none" stroke="#1f7a5c" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
      ${coords
        .map(
          ([x, y]) =>
            `<circle cx="${x}" cy="${y}" r="6" fill="#fffefa" stroke="#17231d" stroke-width="3" />`,
        )
        .join('')}
    </svg>
    ${stats([
      ['Available now', formatMinorAmount(route.availableNowMinor)],
      ['Lowest point', `${formatMinorAmount(route.tightestBalanceMinor)} ${route.tightestDay}`],
      ['Still checking', `${route.pendingReviewCount} waiting`],
    ])}
    <div class="note">Show why: accepted items, dates, estimates, waiting review rows and assumptions stay visible.</div>
  </div>`;
}

function weekStrip(): string {
  return `<div class="week">${['Today', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    .map((day) => `<div class="day">${day}</div>`)
    .join('')}</div>`;
}

function decisionGuide(): string {
  return cardGrid(
    importReviewActionCopy
      .filter((action) =>
        ['accept', 'edit', 'reject', 'income', 'bill', 'debt_payment', 'refund', 'later'].includes(
          action.id,
        ),
      )
      .map((action) => [
        action.label,
        action.consequence,
        action.id === 'accept' || action.id === 'income' ? 'confirmed' : 'attention',
      ]),
  );
}

function lensGrid(): string {
  return `<div class="lensGrid">${productLenses
    .map(
      (lens, index) =>
        `<div class="lens ${index === 0 ? 'selected' : ''}"><strong>${escapeHtml(
          lens.label,
        )}</strong><span>${escapeHtml(lens.homeEmphasis)}</span></div>`,
    )
    .join('')}</div>`;
}

function formRows(items: readonly (readonly [string, string])[]): string {
  return `<div class="rows">${items
    .map(
      ([label, value]) =>
        `<div class="row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`,
    )
    .join('')}</div>`;
}

function guidedOneStepQuestion(
  question: (typeof guidedManualQuestions)[number],
  label: string,
  value: string,
): string {
  return `<div class="questions"><div class="question"><span>${escapeHtml(
    label,
  )}</span><strong>${escapeHtml(question.question)}</strong><p>${escapeHtml(
    question.why,
  )}</p><em>${escapeHtml(value)} - ${escapeHtml(question.estimateLabel)} / ${escapeHtml(
    question.skipLabel,
  )}</em></div></div>`;
}

function guidedQuestionList(): string {
  return `<div class="questions">${guidedManualQuestions
    .map(
      (question, index) =>
        `<div class="question"><span>${index + 1} of 5</span><strong>${escapeHtml(
          question.question,
        )}</strong><p>${escapeHtml(question.why)}</p><em>${escapeHtml(
          question.estimateLabel,
        )} / ${escapeHtml(question.skipLabel)}</em></div>`,
    )
    .join('')}</div>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/giu, ' ')
    .replace(/<script[\s\S]*?<\/script>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function shortFirstMinuteTitle(value: string): string {
  return value.includes('where you stand') ? 'Know where you stand.' : value;
}

function shortText(value: string, maxLength = 220): string {
  const cleaned = value.replace(/\s+/gu, ' ').trim();
  return cleaned.length <= maxLength ? cleaned : `${cleaned.slice(0, maxLength - 3)}...`;
}
