import { resolveContractVisualState } from './contract-aliases.mjs';

export const VISUAL_STATES = Object.freeze([
  'idle-calm',
  'idle-curious',
  'gaze-left',
  'gaze-right',
  'gaze-up',
  'gaze-down',
  'notice-user',
  'peek',
  'move-short-left',
  'move-short-right',
  'settle',
  'thinking-loop',
  'waiting-for-user',
  'concern-small',
  'concern-major',
  'reassurance',
  'positive-small',
  'positive-major',
  'result-acknowledgement',
  'sleeping',
  'blocked',
]);

const FALLBACKS = Object.freeze({
  peek: 'notice-user',
  'result-acknowledgement': 'notice-user',
  'move-short-left': 'flight-loop-left',
  'move-short-right': 'flight-loop-right',
  settle: 'idle-calm',
  'thinking-loop': 'thinking',
  'concern-small': 'concern-major',
  reassurance: 'recovery',
  'positive-small': 'positive-medium',
  'positive-major': 'positive-major',
});

function entryFor(state, manifest) {
  if (manifest[state]) return { state, entry: manifest[state], isFallback: false };
  const fallbackState = FALLBACKS[state] ?? 'idle-calm';
  if (manifest[fallbackState])
    return { state: fallbackState, entry: manifest[fallbackState], isFallback: true };
  return {
    state: 'idle-calm',
    entry: manifest['idle-calm'] ?? null,
    isFallback: state !== 'idle-calm',
  };
}

function chooseAsset(entry, { reducedMotion = false, wardrobe = null } = {}) {
  if (entry === null || entry === undefined) return { asset: null, mode: 'missing', frameCount: 0 };
  if (typeof entry === 'string')
    return { asset: entry, mode: 'single', frameCount: 1, loop: 'hold' };

  const wardrobeAssets = entry.wardrobe ?? {};
  const wardrobeAsset = wardrobe && wardrobeAssets[wardrobe];
  if (wardrobeAsset)
    return {
      asset: wardrobeAsset,
      mode: 'wardrobe',
      frameCount: 1,
      loop: 'hold',
      artStatus: 'static-wardrobe',
    };

  if (reducedMotion && entry.reducedMotion) {
    return {
      asset: entry.reducedMotion,
      mode: 'reduced-motion',
      frameCount: 1,
      loop: 'hold',
      artStatus: entry.artStatus ?? null,
    };
  }
  if (entry.animated) {
    return {
      asset: entry.animated,
      mode: 'animated',
      frameCount: entry.frameCount ?? null,
      durationsMs: entry.durationsMs ?? null,
      loop: entry.loop ?? 'once',
      interruptible: entry.interruptible ?? true,
      preview: entry.preview ?? null,
      lottie: entry.lottie ?? null,
      artStatus: entry.artStatus ?? null,
    };
  }
  if (entry.static)
    return {
      asset: entry.static,
      mode: 'static',
      frameCount: 1,
      loop: 'hold',
      artStatus: entry.artStatus ?? null,
    };
  if (entry.asset)
    return {
      asset: entry.asset,
      mode: 'single',
      frameCount: 1,
      loop: 'hold',
      artStatus: entry.artStatus ?? null,
    };
  return { asset: null, mode: 'missing', frameCount: 0 };
}

export function resolveVisualAsset(state, manifest = {}, options = {}) {
  const entries =
    manifest?.states && typeof manifest.states === 'object' ? manifest.states : manifest;
  const contract = resolveContractVisualState(state, entries);
  const selected = entryFor(contract.rendererState, entries);
  const choice = chooseAsset(selected.entry, options);
  const wardrobeRequested = options.wardrobe ?? null;
  const wardrobeApplied = choice.mode === 'wardrobe' ? wardrobeRequested : null;
  const semanticFallback =
    contract.isDistinctPerformanceMissing || String(choice.artStatus ?? '').includes('fallback');
  return {
    requestedState: state,
    resolvedState: selected.state,
    contractState: contract.requestedState,
    contractStatus: contract.status,
    provenance: contract.provenance,
    isDistinctPerformanceMissing: contract.isDistinctPerformanceMissing,
    ...choice,
    animationPaused: Boolean(options.animationPaused),
    wardrobeRequested,
    wardrobeApplied,
    wardrobeSupported: !wardrobeRequested || wardrobeApplied === wardrobeRequested,
    isFallback: semanticFallback || !contract.exact || selected.isFallback || choice.asset === null,
    fallbackReason: contract.isDistinctPerformanceMissing
      ? `distinct-performance-missing:${state}`
      : !contract.exact
        ? `contract-alias:${state}->${contract.rendererState}`
        : selected.isFallback
          ? `missing:${state}`
          : choice.asset === null
            ? 'missing-asset'
            : semanticFallback
              ? `semantic-fallback:${state}`
              : null,
  };
}

export function createRendererAdapter({ manifest = {}, render = () => {}, options = {} } = {}) {
  let current = resolveVisualAsset('idle-calm', manifest, options);
  return {
    setState(state, nextOptions = options) {
      current = resolveVisualAsset(state, manifest, nextOptions);
      render(current);
      return current;
    },
    getState() {
      return current;
    },
  };
}
