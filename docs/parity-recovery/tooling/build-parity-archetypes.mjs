#!/usr/bin/env node

/**
 * Build the non-Business family-parity execution manifest from the checked
 * shipping crosswalk. The rules intentionally use stable ids/kinds rather
 * than display copy so this remains an executable batching contract.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CROSSWALK_RELATIVE_PATH = 'docs/parity-recovery/registries/parity-crosswalk.json';
const OUTPUT_RELATIVE_PATH = 'docs/parity-recovery/registries/parity-archetypes.json';
const CAPTURE_OUTPUT_RELATIVE_PATH = 'docs/parity-recovery/registries/capture-batches.json';
const CROSSWALK_PATH = path.join(ROOT, CROSSWALK_RELATIVE_PATH);
const OUTPUT_PATH = path.join(ROOT, OUTPUT_RELATIVE_PATH);
const CAPTURE_OUTPUT_PATH = path.join(ROOT, CAPTURE_OUTPUT_RELATIVE_PATH);

const crosswalk = JSON.parse(await readFile(CROSSWALK_PATH, 'utf8'));

const screenGroups = {
  'editorial-money-hero': new Set([
    'screen.pots',
    'screen.recovery',
    'screen.shortfall',
    'screen.today',
    'screen.today-after',
    'screen.today-mode',
    'screen.today-stability',
    'screen.whatif',
  ]),
  'plan-calendar-history': new Set([
    'screen.calendar',
    'screen.plan',
    'screen.plans',
    'screen.review',
    'screen.review-item',
    'screen.ritual',
    'screen.subs',
    'screen.timeline',
  ]),
  'intake-result-state': new Set([
    'screen.image-fallback',
    'screen.image-success',
    'screen.intake',
    'screen.paste-success',
    'screen.pdf-fallback',
    'screen.pdf-success',
    'screen.start',
    'screen.visualizer',
  ]),
  'form-edit-sheet': new Set(['screen.add-bill', 'screen.add-debt']),
  'account-privacy-trust': new Set([
    'screen.account',
    'screen.more',
    'screen.paywall',
    'screen.privacy',
  ]),
  'melo-led': new Set(['screen.guided', 'screen.insights', 'screen.melo']),
};

const sheetGroups = {
  'plan-calendar-history': new Set([
    'sheet.day-detail',
    'sheet.hidden-review',
    'sheet.pots-open-pot',
    'sheet.pots-reallocate',
    'sheet.route-detail',
  ]),
  'intake-result-state': new Set([
    'sheet.annual-caught',
    'sheet.bill-caught',
    'sheet.drift-caught',
    'sheet.income-caught',
    'sheet.onboarding',
    'sheet.sub-caught',
  ]),
  'form-edit-sheet': new Set([
    'sheet.add-event',
    'sheet.add-plan',
    'sheet.afford-check',
    'sheet.declare-debt',
    'sheet.edit-txn',
    'sheet.household-setup',
    'sheet.log-spend',
    'sheet.safe-zone',
    'sheet.visualizer-edit-candidate',
  ]),
  'account-privacy-trust': new Set([
    'sheet.account-bank-connection',
    'sheet.account-cloud-backup',
    'sheet.account-sign-in',
    'sheet.appearance',
    'sheet.calendar-connect',
    'sheet.calendar-export',
    'sheet.chart-style',
    'sheet.lens-picker',
    'sheet.share',
    'sheet.shelf',
    'sheet.workspace',
  ]),
  'melo-led': new Set(['sheet.melo-chat', 'sheet.melo-context', 'sheet.melo-intro']),
};

const decisionDialogPattern =
  /(confirm|gate-|choice|replace|unlink|disconnect|clear-result|restore-result)/;

const archetypeDefinitions = [
  {
    id: 'decision-dialog',
    label: 'Decision and destructive dialogs',
    visualContract:
      'Native modal title/body/action hierarchy for confirmation, staged gates, source choices, replacement and unlink flows.',
    representatives: [
      'dialog.account-delete-gate-1',
      'dialog.edit-txn-receipt-source-choice',
      'dialog.cloud-backup-local-replace-confirm',
    ],
    sharedRoots: [
      'React Native Alert.alert',
      'apps/mobile/src/folio/screens/AccountScreen.tsx',
      'apps/mobile/src/folio/screens/PrivacyScreen.tsx',
    ],
    rootCauseCandidates: [
      'Alert action order and destructive/cancel emphasis are repeated at call sites.',
      'Gate copy hierarchy and title/body punctuation are not centrally normalized.',
      'Platform alert chrome must be evaluated separately from app-rendered source sheets.',
    ],
    propagationStrategy:
      'Calibrate a shared decision-alert contract, migrate sibling call sites mechanically, then batch exercise every decision route; inspect only copy/action-order outliers.',
  },
  {
    id: 'status-dialog',
    label: 'Status, error and permission dialogs',
    visualContract:
      'Native informational modal chrome for success, failure, unavailable, pending, permission and recovery outcomes.',
    representatives: [
      'dialog.account-bank-unavailable',
      'dialog.paywall-purchase-succeeded',
      'dialog.privacy-app-lock-auth-failed',
    ],
    sharedRoots: [
      'React Native Alert.alert',
      'apps/mobile/src/folio/screens/PaywallScreen.tsx',
      'apps/mobile/src/folio/screens/PrivacyScreen.tsx',
    ],
    rootCauseCandidates: [
      'Informational alert title/body/button conventions vary by owning screen.',
      'Success, warning and error semantics currently rely on platform-default chrome.',
      'Source sheets and native OS alerts need an explicit true-exception policy where chrome cannot be controlled.',
    ],
    propagationStrategy:
      'Normalize shared status-alert semantics and batch-trigger all call sites; compare representative OS variants and inspect only wording, wrapping or action-count failures.',
  },
  {
    id: 'editorial-money-hero',
    label: 'Editorial money hero screens',
    visualContract:
      'Full-height money narratives with eyebrow, serif display/verdict, primary amount, explanatory copy and supporting cards.',
    representatives: ['screen.today', 'screen.whatif', 'screen.pots'],
    sharedRoots: [
      'apps/mobile/src/surfaces/pressureMap/kit.tsx#PressureScreen',
      'apps/mobile/src/surfaces/pressureMap/kit.tsx#Eyebrow',
      'apps/mobile/src/surfaces/pressureMap/kit.tsx#Display',
      'apps/mobile/src/surfaces/pressureMap/kit.tsx#HeroMoney',
      'apps/mobile/src/surfaces/pressureMap/kit.tsx#Surface',
    ],
    rootCauseCandidates: [
      'Shared screen horizontal inset and top rhythm.',
      'Serif font metrics, amount baseline and display line height.',
      'Hero-to-supporting-card vertical spacing and surface radius/border tokens.',
    ],
    propagationStrategy:
      'Calibrate the shared pressure-screen typography and spacing primitives on three pressure/data states, propagate automatically, then inspect exceptional chart geometry only.',
  },
  {
    id: 'plan-calendar-history',
    label: 'Plan, calendar, timeline and detail surfaces',
    visualContract:
      'Time-ordered screens and sheets composed from period headers, event/list rows, markers, amounts and route/detail summaries.',
    representatives: ['screen.calendar', 'screen.timeline', 'sheet.route-detail'],
    sharedRoots: [
      'apps/mobile/src/surfaces/pressureMap/kit.tsx#PressureScreen',
      'apps/mobile/src/surfaces/pressureMap/kit.tsx#Surface',
      'apps/mobile/src/surfaces/pressureMap/Sheet.tsx#Sheet',
      'apps/mobile/src/folio/screens/CalendarScreen.tsx#EventRow',
    ],
    rootCauseCandidates: [
      'Section header, date label and amount-column alignment.',
      'Hairline, row minimum height and timeline-marker geometry.',
      'Sheet content inset differs from full-screen list inset.',
    ],
    propagationStrategy:
      'Calibrate shared time/list row measurements on calendar, timeline and route detail; propagate to sibling histories and inspect only dense/empty state outliers.',
  },
  {
    id: 'intake-result-state',
    label: 'Intake, recognition and result states',
    visualContract:
      'Capture/import entry points and the recognized, fallback, empty or caught result hierarchy that follows them.',
    representatives: ['screen.start', 'screen.intake', 'screen.pdf-success'],
    sharedRoots: [
      'apps/mobile/src/surfaces/pressureMap/kit.tsx#PressureScreen',
      'apps/mobile/src/surfaces/pressureMap/kit.tsx#PrimaryAction',
      'apps/mobile/src/surfaces/pressureMap/Sheet.tsx#Sheet',
      'apps/mobile/src/folio/screens/IntakeScreen.tsx',
    ],
    rootCauseCandidates: [
      'Intro/result icon scale and hero-to-action rhythm.',
      'Result card padding, source metadata rows and confidence treatment.',
      'Primary/secondary action width, height and bottom spacing.',
    ],
    propagationStrategy:
      'Fix the common entry/result composition from start, intake and one successful import, batch-capture success/fallback/caught siblings, and inspect only content-density failures.',
  },
  {
    id: 'form-edit-sheet',
    label: 'Form and edit sheets',
    visualContract:
      'Keyboard-aware create/edit flows with a sheet header, labeled fields, selectors, amount/date inputs and primary action.',
    representatives: ['screen.add-bill', 'sheet.edit-txn', 'sheet.household-setup'],
    sharedRoots: [
      'apps/mobile/src/surfaces/pressureMap/Sheet.tsx#Sheet',
      'apps/mobile/src/surfaces/pressureMap/kit.tsx#PrimaryAction',
      'apps/mobile/src/surfaces/pressureMap/kit.tsx#ChipToggle',
      'apps/mobile/src/surfaces/pressureMap/kit.tsx#MoneyPad',
    ],
    rootCauseCandidates: [
      'Sheet top inset, drag affordance and title/action anchoring.',
      'Field label/input spacing, control height and focus border tokens.',
      'Keyboard-safe bottom action spacing and scroll content inset.',
    ],
    propagationStrategy:
      'Calibrate Sheet and shared controls against short, long and amount-heavy forms; propagate first, then inspect only keyboard overflow and bespoke picker outliers.',
  },
  {
    id: 'account-privacy-trust',
    label: 'Account, privacy, trust and settings surfaces',
    visualContract:
      'Settings-oriented screens and sheets built from section labels, rows, value/status text, dividers, toggles and trust copy.',
    representatives: ['screen.account', 'screen.privacy', 'sheet.appearance'],
    sharedRoots: [
      'apps/mobile/src/surfaces/pressureMap/kit.tsx#PressureScreen',
      'apps/mobile/src/surfaces/pressureMap/kit.tsx#Surface',
      'apps/mobile/src/surfaces/pressureMap/kit.tsx#Hairline',
      'apps/mobile/src/surfaces/pressureMap/kit.tsx#ChevronRight',
      'apps/mobile/src/surfaces/pressureMap/Sheet.tsx#Sheet',
    ],
    rootCauseCandidates: [
      'Settings row height, divider inset and trailing control alignment.',
      'Section spacing and muted status/value typography.',
      'Trust copy measure and destructive-action separation.',
    ],
    propagationStrategy:
      'Calibrate one dense account screen, one trust screen and one compact settings sheet; apply row/section token fixes across the family and inspect destructive or long-copy outliers.',
  },
  {
    id: 'melo-led',
    label: 'Melo-led surfaces',
    visualContract:
      'Melo presence, guidance, insight and conversational surfaces using character state, editorial prompts, chips and tool/action cards.',
    representatives: ['screen.melo', 'sheet.melo-chat', 'sheet.melo-intro'],
    sharedRoots: [
      'apps/mobile/src/surfaces/pressureMap/melo/MeloPresence.tsx',
      'apps/mobile/src/surfaces/pressureMap/melo/MeloFigure.tsx',
      'apps/mobile/src/surfaces/pressureMap/kit.tsx#PressureScreen',
      'apps/mobile/src/surfaces/pressureMap/Sheet.tsx#Sheet',
    ],
    rootCauseCandidates: [
      'Melo figure scale/anchor and reserved breathing room.',
      'Prompt, response and chip typography/radius.',
      'Conversation sheet top/bottom inset and tool-card hierarchy.',
    ],
    propagationStrategy:
      'Calibrate shared Melo figure/presence primitives and chip treatments on one screen plus two sheet modes; batch-propagate and inspect tool-card/chat-density outliers.',
  },
  {
    id: 'shell-global-chrome',
    label: 'Shell, navigation and global states',
    visualContract:
      'App root, tab bar, route frame, boot/lock/error notices and transient global overlays shared by every workspace.',
    representatives: ['global.app-lock-gate', 'global.toast', 'tab.today'],
    sharedRoots: [
      'apps/mobile/src/surfaces/pressureMap/kit.tsx#ThemeProvider',
      'apps/mobile/src/surfaces/pressureMap/kit.tsx#BottomNav',
      'apps/mobile/src/folio/shell/FolioShell.tsx',
      'apps/mobile/app/_layout.tsx',
    ],
    rootCauseCandidates: [
      'Safe-area, route-frame and bottom-navigation height/inset contract.',
      'Tab icon/label baseline and active-state treatment.',
      'Global notice/toast width, elevation and animation anchoring.',
    ],
    propagationStrategy:
      'Calibrate root safe areas and tab chrome once, then bulk-render every representative screen with the same shell; independently inspect boot, lock, error and toast overlays.',
  },
  {
    id: 'native-platform-chrome',
    label: 'Native platform-owned chrome',
    visualContract:
      'Android-owned authentication, picker, billing, sharing and permission interfaces outside React Native layout control.',
    representatives: [
      'platform.device-authentication',
      'platform.native-share',
      'platform.notification-permission',
    ],
    sharedRoots: [
      'Android framework and Google Play UI',
      'apps/mobile/src/folio/lib/appLock.ts',
      'apps/mobile/src/folio/lib/billing/iap.ts',
      'apps/mobile/src/folio/lib/notifications.ts',
    ],
    rootCauseCandidates: [
      'Chrome is OS/service-version dependent and cannot be made pixel-identical to Lovable markup.',
      'App-controlled launch context and pre/post-platform transition remain parity scope.',
      'Each route needs an explicit true-exception record plus physical-S9 evidence.',
    ],
    propagationStrategy:
      'Treat platform chrome as explicit true-exception candidates, validate invocation/context on S9, and compare only app-owned transitions rather than attempting markup imitation.',
    parityMode: 'platform-owned-true-exception-candidate',
  },
];

const implementationWaveDefinitions = [
  {
    id: 'wave-1-decision-dialogs',
    archetypes: ['decision-dialog'],
    sharedFixTarget: 'Central decision-alert action order, emphasis and copy hierarchy.',
  },
  {
    id: 'wave-2-status-dialogs',
    archetypes: ['status-dialog'],
    sharedFixTarget: 'Central informational/status alert semantics and exception handling.',
  },
  {
    id: 'wave-3-structured-sheets-and-settings',
    archetypes: ['form-edit-sheet', 'account-privacy-trust'],
    sharedFixTarget: 'Sheet frame, field/control, section and settings-row geometry.',
  },
  {
    id: 'wave-4-editorial-time-and-detail',
    archetypes: ['editorial-money-hero', 'plan-calendar-history'],
    sharedFixTarget: 'Pressure-screen typography/insets plus time/list row geometry.',
  },
  {
    id: 'wave-5-intake-and-melo',
    archetypes: ['intake-result-state', 'melo-led'],
    sharedFixTarget: 'Entry/result action rhythm plus Melo presence and chip treatments.',
  },
  {
    id: 'wave-6-shell-and-platform',
    archetypes: ['shell-global-chrome', 'native-platform-chrome'],
    sharedFixTarget: 'Root safe areas/tab chrome and explicit platform-owned exceptions.',
  },
];

const archetypeDefinitionIds = new Set(archetypeDefinitions.map((entry) => entry.id));
if (archetypeDefinitionIds.size !== archetypeDefinitions.length) {
  throw new Error('Archetype ids must be unique');
}
for (const definition of archetypeDefinitions) {
  if (definition.representatives.length < 2 || definition.representatives.length > 3) {
    throw new Error(`${definition.id} must define 2–3 representative pairs`);
  }
}

function archetypeFor(entry) {
  if (entry.stableId.startsWith('platform.')) return 'native-platform-chrome';
  if (entry.kind === 'dialog') {
    return decisionDialogPattern.test(entry.stableId) ? 'decision-dialog' : 'status-dialog';
  }
  if (['global-state', 'stack-route', 'tab'].includes(entry.kind)) {
    return 'shell-global-chrome';
  }
  const groups = entry.kind === 'screen' ? screenGroups : entry.kind === 'sheet' ? sheetGroups : {};
  const matches = Object.entries(groups)
    .filter(([, ids]) => ids.has(entry.stableId))
    .map(([id]) => id);
  if (matches.length !== 1) {
    throw new Error(
      `${entry.stableId} (${entry.kind}) must match exactly one archetype; matched ${matches.length}: ${matches.join(', ')}`,
    );
  }
  return matches[0];
}

const businessEntries = crosswalk.entries.filter((entry) => entry.native.workspace === 'business');
const includedEntries = crosswalk.entries.filter((entry) => entry.native.workspace !== 'business');
const definitionById = new Map(archetypeDefinitions.map((entry) => [entry.id, entry]));
const waveByArchetype = new Map();

for (const wave of implementationWaveDefinitions) {
  for (const archetypeId of wave.archetypes) {
    if (!definitionById.has(archetypeId)) {
      throw new Error(`${wave.id} references unknown archetype ${archetypeId}`);
    }
    if (waveByArchetype.has(archetypeId)) {
      throw new Error(`${archetypeId} is assigned to more than one implementation wave`);
    }
    waveByArchetype.set(archetypeId, wave.id);
  }
}

for (const definition of archetypeDefinitions) {
  if (!waveByArchetype.has(definition.id)) {
    throw new Error(`${definition.id} is not assigned to an implementation wave`);
  }
}

const assignments = includedEntries
  .map((entry) => {
    const archetypeId = archetypeFor(entry);
    return {
      stableId: entry.stableId,
      kind: entry.kind,
      workspace: entry.native.workspace,
      routeKey: entry.native.routeKey,
      componentSource: entry.native.componentSource,
      archetypeId,
      implementationWaveId: waveByArchetype.get(archetypeId),
      designOwnerStatus: entry.design.ownerStatus,
      designOwnerIds: entry.design.owners.map((owner) => owner.stableId).filter(Boolean),
      matchedFixtures: entry.matchedFixtures,
      directComparisonCount: entry.evidence.comparisonCount,
      evidenceStatus:
        entry.evidence.comparisonCount > 0 ? 'direct-evidence-present' : 'direct-evidence-pending',
    };
  })
  .sort((left, right) => left.stableId.localeCompare(right.stableId));

const assignmentIds = new Set(assignments.map((entry) => entry.stableId));
if (assignmentIds.size !== assignments.length) {
  throw new Error('A non-Business shipping surface was assigned more than once');
}
if (assignments.length + businessEntries.length !== crosswalk.counts.nativeShippingSurfaces) {
  throw new Error(
    `Coverage mismatch: ${assignments.length} included + ${businessEntries.length} Business != ${crosswalk.counts.nativeShippingSurfaces} shipping`,
  );
}

const archetypes = archetypeDefinitions.map((definition) => {
  const members = assignments.filter((entry) => entry.archetypeId === definition.id);
  if (members.length === 0) throw new Error(`${definition.id} has no assigned surfaces`);
  for (const representativeId of definition.representatives) {
    if (!members.some((entry) => entry.stableId === representativeId)) {
      throw new Error(`${definition.id} representative ${representativeId} is not a family member`);
    }
  }
  return {
    ...definition,
    implementationWaveId: waveByArchetype.get(definition.id),
    counts: {
      surfaces: members.length,
      directlyEvidenced: members.filter((entry) => entry.directComparisonCount > 0).length,
      pendingDirectEvidence: members.filter((entry) => entry.directComparisonCount === 0).length,
      resolvedDesignOwners: members.filter((entry) => entry.designOwnerStatus === 'resolved')
        .length,
      unresolvedDesignOwners: members.filter((entry) => entry.designOwnerStatus !== 'resolved')
        .length,
    },
    representativePairs: definition.representatives.map((stableId) => {
      const member = members.find((entry) => entry.stableId === stableId);
      return {
        stableId,
        routeKey: member.routeKey,
        componentSource: member.componentSource,
        designOwnerStatus: member.designOwnerStatus,
        designOwnerIds: member.designOwnerIds,
        matchedFixtures: member.matchedFixtures,
      };
    }),
  };
});

const implementationWaves = implementationWaveDefinitions.map((definition) => {
  const members = assignments.filter((entry) => entry.implementationWaveId === definition.id);
  if (members.length < 20 || members.length > 40) {
    throw new Error(
      `${definition.id} has ${members.length} surfaces; required implementation-wave size is 20–40`,
    );
  }
  return {
    ...definition,
    counts: {
      surfaces: members.length,
      directlyEvidenced: members.filter((entry) => entry.directComparisonCount > 0).length,
      pendingDirectEvidence: members.filter((entry) => entry.directComparisonCount === 0).length,
      resolvedDesignOwners: members.filter((entry) => entry.designOwnerStatus === 'resolved')
        .length,
      unresolvedDesignOwners: members.filter((entry) => entry.designOwnerStatus !== 'resolved')
        .length,
    },
    inspectionPolicy:
      'Batch-render every member after the shared fix; inspect representatives plus automated metric/contact-sheet outliers, not every passing sibling.',
  };
});

const manifest = {
  $schema: 'melo-family-parity-archetypes/v1',
  generatedFrom: {
    crosswalk: CROSSWALK_RELATIVE_PATH,
    designSha: crosswalk.generatedFrom.designSha,
    nativeBranch: crosswalk.generatedFrom.nativeBranch,
    generatedOn: '2026-08-25',
  },
  scope: {
    inclusionRule: "native.workspace !== 'business'",
    includesDualWorkspaceSurfaces: true,
    excludedBusinessSurfaces: businessEntries.length,
    note: 'This is the actual registry-derived non-Business scope. The separate 157 figure is not a workspace count: it subtracts seven named Business routes from the whole-app missing-evidence total while leaving other Business entries in the remainder.',
  },
  counts: {
    shippingSurfaces: crosswalk.counts.nativeShippingSurfaces,
    includedNonBusinessSurfaces: assignments.length,
    excludedBusinessSurfaces: businessEntries.length,
    directlyEvidencedNonBusinessSurfaces: assignments.filter(
      (entry) => entry.directComparisonCount > 0,
    ).length,
    pendingDirectEvidenceNonBusinessSurfaces: assignments.filter(
      (entry) => entry.directComparisonCount === 0,
    ).length,
    archetypes: archetypes.length,
    implementationWaves: implementationWaves.length,
  },
  executionPolicy: {
    familyFirst: true,
    targetSurfacesPerImplementationWave: { min: 20, max: 40 },
    representativePairsPerArchetype: { min: 2, max: 3 },
    evidenceMode: 'bulk-render-contact-sheet-overlay-outliers',
    passingSiblingReview: 'automated-batch-only',
  },
  implementationWaves,
  archetypes,
  assignments,
};

const captureableAssignments = assignments.filter((entry) => entry.kind === 'screen');
const captureFixtureGroups = new Map();
for (const assignment of captureableAssignments) {
  const fixture = assignment.matchedFixtures[0];
  if (!fixture) throw new Error(`${assignment.stableId} has no matched capture fixture`);
  const group = captureFixtureGroups.get(fixture) ?? [];
  group.push({ screen: assignment.routeKey, themes: ['light', 'dark'] });
  captureFixtureGroups.set(fixture, group);
}

const captureManifest = {
  schemaVersion: 1,
  nowISO: '2026-08-18T08:00:00.000Z',
  settleMs: 900,
  generatedFrom: OUTPUT_RELATIVE_PATH,
  scope: {
    mode: 'direct-screen-route-bulk-capture',
    includedScreenSurfaces: captureableAssignments.length,
    excludedNonScreenSurfaces: assignments.length - captureableAssignments.length,
    note: 'Sheets, dialogs, global overlays and platform chrome require dedicated state/opening drivers and are deliberately excluded from this direct-screen batch feed.',
  },
  batches: [...captureFixtureGroups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([fixture, surfaces]) => ({
      id: `non-business-${fixture}`,
      fixture,
      surfaces: surfaces.sort((left, right) => left.screen.localeCompare(right.screen)),
    })),
};

const prettierConfig = (await resolveConfig(OUTPUT_PATH)) ?? {};
const rendered = await format(`${JSON.stringify(manifest, null, 2)}\n`, {
  ...prettierConfig,
  parser: 'json',
});
const captureRendered = await format(`${JSON.stringify(captureManifest, null, 2)}\n`, {
  ...prettierConfig,
  parser: 'json',
});
if (process.argv.includes('--check')) {
  const [current, currentCapture] = await Promise.all([
    readFile(OUTPUT_PATH, 'utf8').catch(() => ''),
    readFile(CAPTURE_OUTPUT_PATH, 'utf8').catch(() => ''),
  ]);
  if (current !== rendered || currentCapture !== captureRendered) {
    const stale = [
      current !== rendered ? OUTPUT_RELATIVE_PATH : null,
      currentCapture !== captureRendered ? CAPTURE_OUTPUT_RELATIVE_PATH : null,
    ].filter(Boolean);
    console.error(`${stale.join(', ')} is stale; run build-parity-archetypes.mjs`);
    process.exitCode = 1;
  } else {
    console.log(
      `Validated ${assignments.length} non-Business surfaces across ${archetypes.length} archetypes and ${implementationWaves.length} waves; ${captureableAssignments.length} direct-screen batch routes.`,
    );
  }
} else {
  await Promise.all([
    writeFile(OUTPUT_PATH, rendered),
    writeFile(CAPTURE_OUTPUT_PATH, captureRendered),
  ]);
  console.log(
    `Wrote family manifest and capture batches: ${assignments.length} surfaces, ${archetypes.length} archetypes, ${implementationWaves.length} waves, ${captureableAssignments.length} direct-screen routes.`,
  );
}
