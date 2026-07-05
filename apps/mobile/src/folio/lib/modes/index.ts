/**
 * Mode strategy registry.
 *
 * RN port of folio-melo (design-main) `src/lib/modes/index.ts`, verbatim.
 * Every mode has a real strategy in this port (see `MODE_SHIP_STATUS` in
 * `./types`); falling through to Survival stays as documented dead-code
 * safety for any mode that doesn't resolve, matching the source's pattern.
 */
import {
  MODE_SHIP_STATUS,
  type MoneyMode,
  type ModeInputs,
  type ModeState,
  type ModeStrategy,
} from './types';
import { survivalStrategy } from './strategies/survival';
import { stabilityStrategy } from './strategies/stability';
import { growthStrategy } from './strategies/growth';
import { debtStrategy } from './strategies/debt';
import { irregularStrategy } from './strategies/irregular';
import { householdStrategy } from './strategies/household';
import { planningStrategy } from './strategies/planning';
import { optimizerStrategy } from './strategies/optimizer';
import { resetStrategy } from './strategies/reset';
import { lowVisStrategy } from './strategies/lowVis';

const STRATEGIES: Partial<Record<MoneyMode, ModeStrategy>> = {
  survival: survivalStrategy,
  stability: stabilityStrategy,
  growth: growthStrategy,
  debt: debtStrategy,
  irregular: irregularStrategy,
  household: householdStrategy,
  planning: planningStrategy,
  optimizer: optimizerStrategy,
  reset: resetStrategy,
  lowVis: lowVisStrategy,
};

export function getStrategy(mode: MoneyMode): ModeStrategy {
  return STRATEGIES[mode] ?? survivalStrategy;
}

export function deriveModeState(mode: MoneyMode, inputs: ModeInputs): ModeState {
  return getStrategy(mode).derive(inputs);
}

export { MODE_SHIP_STATUS };
export type {
  MoneyMode,
  ModeInputs,
  ModeState,
  ModeStrategy,
  MeloWeather,
  SafeZone,
  MeloVoiceTint,
} from './types';
export { MODE_LABEL } from './types';

// Re-export the rest of the mode-engine fleet so callers (e.g. useMeloOpener,
// Today/Pots/Subs/Calendar/Cycle-Close surfaces) have one import surface —
// `@/folio/lib/modes` — matching how PORT_BIBLE.md describes this module.
export { pickOpener, type OpenerCtx } from './openers';
export { getFraming, type Framing, type FramingSurface } from './framing';
export { getShortfallCopy, getWhatIfCopy, getRecoveryCopy } from './action';
export type { ShortfallCopy, WhatIfCopy, RecoveryCopy } from './action';
export { getRetrospect, formatDelta, type Retrospect, type Kpi } from './retrospect';
export { getStarters } from './starters';
export { suggestMode, type ModeSuggestion } from './suggest';
export {
  subsDefaultSort,
  potsDefaultSort,
  sortPots,
  calendarDefaultAnchor,
  calendarAnchorLabel,
  type SubsSort,
  type PotsSort,
  type PotLite,
  type CalendarAnchor,
} from './surfacePrefs';
export { MODE_TOOL_PRIORITY, toolPriorityDirective, type MeloTool } from './toolPrefs';
export { getEmptyVoice, type EmptyVoiceCopy } from './emptyVoice';
export { safeZoneMath, type SafeZoneLine, type SafeZoneMath } from './safeZone';
export * as debtEngine from './debtEngine';
export * as planEngine from './planEngine';
