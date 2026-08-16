// The host art contract is intentionally larger than the currently authored
// clip set. Keep the mapping explicit so a renderer always resolves a non-blank
// asset without pretending that a static or semantic alias is distinct art.

const RUNTIME_CANDIDATES = new Set(['notice-user', 'settle', 'positive-small']);

const REFERENCE_ONLY = new Set([
  'peek',
  'result-acknowledgement',
  'move-short-left',
  'move-short-right',
  'thinking-loop',
  'concern-small',
  'reassurance',
  'positive-major',
]);

const MISSING_DISTINCT = new Set([
  'tap-response',
  'waiting',
  'waiting-for-user',
  'concern-major',
  'blocked',
  ...REFERENCE_ONLY,
]);
const LEGACY_AVAILABLE = new Set([
  'gaze-left',
  'gaze-right',
  'gaze-up',
  'gaze-down',
  'offline',
  'sleeping',
]);

const CONTRACT_STATUSES = Object.freeze({
  'idle-calm': 'needs-A+-reauthor',
  'idle-curious': 'needs-A+-reauthor',
  'idle-restless': 'needs-A+-reauthor',
  'notice-user': 'authored-semantic-performance',
  peek: 'authored-semantic-performance',
  'result-acknowledgement': 'authored-semantic-performance',
  'gaze-left': 'legacy-available',
  'gaze-right': 'legacy-available',
  'gaze-up': 'legacy-available',
  'gaze-down': 'legacy-available',
  sleeping: 'legacy-available',
  offline: 'legacy-available',
});

function statusFor(contractId) {
  if (RUNTIME_CANDIDATES.has(contractId)) return 'runtime-candidate-unapproved';
  if (REFERENCE_ONLY.has(contractId)) return 'reference-only-rework';
  return CONTRACT_STATUSES[contractId] ?? 'needs-A+-reauthor';
}

function aliasByMeaning(contractId) {
  const id = String(contractId).toLowerCase();

  if (id === 'idle-curious' || id === 'idle-restless') return 'idle-calm';
  if (id === 'gaze-left' || id === 'gaze-right' || id === 'gaze-up' || id === 'gaze-down') {
    return 'notice-user';
  }
  if (id === 'peek') return 'peek';
  if (
    id.includes('hop-left') ||
    id.includes('takeoff-left') ||
    id.includes('flight-loop-left') ||
    id.includes('landing-left')
  ) {
    return 'move-short-left';
  }
  if (
    id.includes('hop-right') ||
    id.includes('takeoff-right') ||
    id.includes('flight-loop-right') ||
    id.includes('landing-right')
  ) {
    return 'move-short-right';
  }
  if (id === 'settle-to-sleep') return 'settle';
  if (id === 'wake-up') return 'notice-user';
  if (id === 'thinking' || id === 'import-started' || id === 'filing-started')
    return 'thinking-loop';
  if (id === 'waiting') return 'waiting-for-user';
  if (
    id === 'guide-left' ||
    id === 'guide-right' ||
    id === 'tap-response' ||
    id === 'before-spend-asked' ||
    id === 'what-changed'
  ) {
    return 'notice-user';
  }
  if (
    id.includes('concern') ||
    id.includes('worsened') ||
    id.includes('overdue') ||
    id.includes('shortfall-opened') ||
    id.includes('tight-point') ||
    id.includes('failed') ||
    id === 'vat-due' ||
    id === 'filing-due'
  ) {
    return id === 'concern-major' ? 'concern-major' : 'concern-small';
  }
  if (
    id.includes('reassurance') ||
    id.includes('recovery') ||
    id.includes('shield-armed') ||
    id.includes('resolved')
  ) {
    return 'reassurance';
  }
  if (
    id.includes('major') ||
    id.includes('goal-hit') ||
    id.includes('goal') ||
    id.includes('cleared') ||
    id.includes('completed') ||
    id === 'payday'
  ) {
    return 'positive-major';
  }
  if (
    id.includes('positive') ||
    id.includes('improved') ||
    id.includes('paid') ||
    id.includes('halfway') ||
    id.includes('milestone') ||
    id.includes('ack') ||
    id.includes('created') ||
    id.includes('sent') ||
    id.includes('resumed') ||
    id.includes('paused') ||
    id.includes('step') ||
    id.includes('closed') ||
    id === 'before-spend-result' ||
    id === 'statement-imported'
  ) {
    return 'positive-small';
  }
  // The current portable manifest has no distinct offline frame. Sleeping is
  // the closest quiet, low-energy static that is actually present.
  if (id === 'offline') return 'sleeping';
  if (id === 'sleeping') return 'sleeping';
  if (id === 'blocked' || id === 'import-failed') return 'blocked';
  if (id === 'result-acknowledgement') return 'result-acknowledgement';
  return 'idle-calm';
}

/**
 * Resolve an art-contract id to the closest available renderer state.
 * `status` describes the contract's art maturity; it never claims that an
 * authored semantic alias is a distinct performance.
 */
export function resolveContractVisualState(contractId, manifest = {}) {
  const entries =
    manifest?.states && typeof manifest.states === 'object' ? manifest.states : manifest;
  const requestedState = String(contractId);
  const candidate = entries?.[requestedState] ? requestedState : aliasByMeaning(requestedState);
  const rendererState = entries?.[candidate]
    ? candidate
    : entries?.['idle-calm']
      ? 'idle-calm'
      : candidate;
  const exact = rendererState === requestedState;
  return {
    requestedState,
    rendererState,
    exact,
    status: statusFor(requestedState),
    provenance:
      exact && RUNTIME_CANDIDATES.has(rendererState)
        ? 'audited-key-pose-runtime-candidate'
        : exact && LEGACY_AVAILABLE.has(rendererState)
          ? 'legacy-runtime-art'
          : RUNTIME_CANDIDATES.has(rendererState)
            ? 'audited-key-pose-fallback'
            : 'static-fallback',
    isPrototype: false,
    isAuthored: RUNTIME_CANDIDATES.has(rendererState),
    isDistinctPerformanceMissing: MISSING_DISTINCT.has(requestedState),
  };
}

export const ART_CONTRACT_STATUS = CONTRACT_STATUSES;
