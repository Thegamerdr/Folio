/**
 * The emotional money state machine (MELO_BLUEPRINT.md §4).
 * Four layers, strictly ordered for display: data (fog) > journey (recovery/rebuilding,
 * sticky) > health ladder (exactly one) > overlays (transient).
 * Anti-flap rules (§4.1): 24h minimum dwell per ladder state — but WORSENING bypasses the
 * dwell (safety beats stability); leaving Warning needs a runway margin, not just a good day.
 * The `monetizationAllowed` flag is part of the state contract (§4.3): no component may
 * upsell a user in a suppressed state, and that rule is enforced here, not in the UI.
 */

import { daysBetween, type ISODate, type Pence } from './core.js';

export type LadderState =
  | 'winning'
  | 'protected'
  | 'calm'
  | 'tight'
  | 'warning'
  | 'danger'
  | 'overspent';

export type JourneyState = 'none' | 'recovery' | 'rebuilding';
export type DataState = 'ok' | 'fog';
export type Overlay = 'payday' | 'paydayEve' | 'billWeek' | 'milestone' | 'neglectedReturn';
export type Weather = 'sunny' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'rainbow';

export type MascotFamily = 'calm' | 'joy' | 'concern' | 'stress' | 'sadness' | 'hope' | 'squint';
export interface MascotEmotion {
  readonly family: MascotFamily;
  readonly intensity: 1 | 2 | 3;
}

export const LADDER_SEVERITY: Record<LadderState, number> = {
  winning: 0,
  protected: 1,
  calm: 2,
  tight: 3,
  warning: 4,
  danger: 5,
  overspent: 6,
};

const FOG_AFTER_HOURS = 72; // §4 Fog: never fake certainty on stale data
const DANGER_WITHIN_DAYS = 3;
const DANGER_FLOOR_PENCE = 10_00; // £10 with bills still pending
const WARNING_EXIT_MARGIN_DAYS = 2; // leave Warning only when runway clears payday by this margin
const MIN_DWELL_DAYS = 1; // 24h dwell before an IMPROVEMENT is shown (worsening is instant)
const RECOVERY_GREEN_DAYS = 3; // green days to graduate recovery → rebuilding
const REBUILDING_DAYS = 7; // rebuilding consolidates for a week unless the buffer refills sooner
const WINNING_QUIET_DAYS = 60; // no recovery in this window before Winning can show
const OVERDRAFT_EMBARGO_DAYS = 7; // §8.4: no upsell for a week after an overdraft event

export interface StateInputs {
  readonly safeZonePence: Pence;
  readonly perDayPence: Pence;
  readonly comfortablePerDayPence: Pence; // learned threshold; below it life is Tight
  readonly daysToPayday: number;
  readonly runwayDays: number | null; // from runwayDays(); null = not spending
  readonly dangerDaysAway: number | null; // from projectDangerDate()?.daysAway
  readonly overdraft: boolean;
  readonly dataAgeHours: number;
  readonly paydayToday: boolean;
  readonly paydayTomorrow: boolean;
  readonly billsDueNext7: number;
  readonly billsTotalCycle: number;
  readonly allBillsShielded: boolean;
  readonly bufferIntact: boolean;
  readonly cyclesEndedPositive: number;
  readonly savingsGrowing: boolean;
  readonly daysSinceRecoveryEnd: number | null; // null = never recovered
  readonly greenDaysStreak: number;
  readonly daysSinceOverdraftEvent: number | null; // null = never
  readonly milestoneReached: boolean;
  readonly returnedAfterAbsence: boolean;
}

export interface MeloStateRecord {
  readonly ladder: LadderState;
  readonly ladderEnteredAt: ISODate;
  readonly journey: JourneyState;
  readonly journeyEnteredAt: ISODate;
}

export interface StateView {
  readonly ladder: LadderState;
  readonly journey: JourneyState;
  readonly data: DataState;
  readonly overlays: readonly Overlay[];
  readonly weather: Weather;
  readonly mascot: MascotEmotion;
  readonly copyKey: string;
  readonly monetizationAllowed: boolean;
}

export interface ResolveOptions {
  /** User accepted the Recovery offer (Recovery is entered by choice, never forced — §5.2 screen 12). */
  readonly acceptRecovery?: boolean;
}

export function computeRawLadder(i: StateInputs): LadderState {
  if (i.overdraft || i.safeZonePence < 0) return 'overspent';
  if (
    (i.dangerDaysAway !== null && i.dangerDaysAway <= DANGER_WITHIN_DAYS) ||
    (i.safeZonePence <= DANGER_FLOOR_PENCE && i.billsDueNext7 > 0)
  ) {
    return 'danger';
  }
  if (i.dangerDaysAway !== null) return 'warning';
  if (i.perDayPence < i.comfortablePerDayPence) return 'tight';
  if (
    i.cyclesEndedPositive >= 2 &&
    i.savingsGrowing &&
    (i.daysSinceRecoveryEnd === null || i.daysSinceRecoveryEnd >= WINNING_QUIET_DAYS)
  ) {
    return 'winning';
  }
  if (i.allBillsShielded && i.bufferIntact) return 'protected';
  return 'calm';
}

function applyHysteresis(
  prev: MeloStateRecord | null,
  raw: LadderState,
  i: StateInputs,
  today: ISODate,
): { ladder: LadderState; ladderEnteredAt: ISODate } {
  if (!prev) return { ladder: raw, ladderEnteredAt: today };
  if (raw === prev.ladder) return { ladder: prev.ladder, ladderEnteredAt: prev.ladderEnteredAt };

  const worsening = LADDER_SEVERITY[raw] > LADDER_SEVERITY[prev.ladder];
  if (worsening) return { ladder: raw, ladderEnteredAt: today }; // safety is never delayed

  // Improving: hold for the minimum dwell so the sky doesn't flap day to day.
  const dwellDays = daysBetween(prev.ladderEnteredAt, today);
  if (dwellDays < MIN_DWELL_DAYS) {
    return { ladder: prev.ladder, ladderEnteredAt: prev.ladderEnteredAt };
  }

  // Leaving Warning additionally needs the runway to clear payday by a margin (§4.1 bands).
  if (prev.ladder === 'warning') {
    const clearedWithMargin =
      i.runwayDays === null || i.runwayDays >= i.daysToPayday + WARNING_EXIT_MARGIN_DAYS;
    if (!clearedWithMargin) {
      return { ladder: prev.ladder, ladderEnteredAt: prev.ladderEnteredAt };
    }
  }

  return { ladder: raw, ladderEnteredAt: today };
}

function resolveJourney(
  prev: MeloStateRecord | null,
  ladder: LadderState,
  i: StateInputs,
  today: ISODate,
  opts: ResolveOptions,
): { journey: JourneyState; journeyEnteredAt: ISODate } {
  const prevJourney = prev?.journey ?? 'none';
  const prevEnteredAt = prev?.journeyEnteredAt ?? today;

  if (prevJourney === 'none') {
    const eligible = ladder === 'overspent' || ladder === 'danger';
    if (opts.acceptRecovery && eligible) return { journey: 'recovery', journeyEnteredAt: today };
    return { journey: 'none', journeyEnteredAt: prevEnteredAt };
  }

  if (prevJourney === 'recovery') {
    if (i.greenDaysStreak >= RECOVERY_GREEN_DAYS) {
      return { journey: 'rebuilding', journeyEnteredAt: today };
    }
    return { journey: 'recovery', journeyEnteredAt: prevEnteredAt };
  }

  // rebuilding
  if (i.bufferIntact || daysBetween(prevEnteredAt, today) >= REBUILDING_DAYS) {
    return { journey: 'none', journeyEnteredAt: today };
  }
  return { journey: 'rebuilding', journeyEnteredAt: prevEnteredAt };
}

function computeOverlays(i: StateInputs): readonly Overlay[] {
  const overlays: Overlay[] = [];
  if (i.paydayToday) overlays.push('payday');
  if (i.paydayTomorrow && !i.paydayToday) overlays.push('paydayEve');
  const billWeek =
    i.billsDueNext7 >= 3 || (i.billsTotalCycle > 0 && i.billsDueNext7 / i.billsTotalCycle >= 0.4);
  if (billWeek) overlays.push('billWeek');
  if (i.milestoneReached) overlays.push('milestone');
  if (i.returnedAfterAbsence) overlays.push('neglectedReturn');
  return overlays;
}

const LADDER_WEATHER: Record<LadderState, Weather> = {
  winning: 'sunny',
  protected: 'sunny',
  calm: 'sunny',
  tight: 'cloudy',
  warning: 'rain',
  danger: 'storm',
  overspent: 'storm',
};

function computeWeather(
  data: DataState,
  journey: JourneyState,
  journeyEnteredAt: ISODate,
  ladder: LadderState,
  today: ISODate,
): Weather {
  if (data === 'fog') return 'fog';
  if (journey === 'rebuilding' && daysBetween(journeyEnteredAt, today) === 0) return 'rainbow';
  if (journey === 'recovery') return 'cloudy'; // clearing — the storm is being worked, not raging
  return LADDER_WEATHER[ladder];
}

const LADDER_MASCOT: Record<LadderState, MascotEmotion> = {
  winning: { family: 'joy', intensity: 2 },
  protected: { family: 'calm', intensity: 2 },
  calm: { family: 'calm', intensity: 1 },
  tight: { family: 'concern', intensity: 1 },
  warning: { family: 'concern', intensity: 2 },
  danger: { family: 'stress', intensity: 3 }, // storm vigil: umbrella + co-breathing (§3.2)
  overspent: { family: 'sadness', intensity: 2 }, // one honest beat; the UI follows with hope (§4)
};

function computeMascot(
  data: DataState,
  overlays: readonly Overlay[],
  journey: JourneyState,
  journeyEnteredAt: ISODate,
  ladder: LadderState,
  today: ISODate,
): MascotEmotion {
  if (data === 'fog') return { family: 'squint', intensity: 2 };
  if (overlays.includes('payday')) return { family: 'joy', intensity: 3 };
  if (journey === 'rebuilding') {
    return daysBetween(journeyEnteredAt, today) === 0
      ? { family: 'hope', intensity: 3 } // the rainbow moment, once
      : { family: 'hope', intensity: 2 };
  }
  if (journey === 'recovery') return { family: 'hope', intensity: 2 };
  return LADDER_MASCOT[ladder];
}

function computeCopyKey(
  data: DataState,
  overlays: readonly Overlay[],
  journey: JourneyState,
  ladder: LadderState,
): string {
  if (data === 'fog') return 'fog';
  if (overlays.includes('payday')) return 'payday';
  if (ladder === 'overspent' && journey === 'none') return 'overspent';
  if (journey === 'recovery') return 'recovery';
  if (journey === 'rebuilding') return 'rebuilding';
  if (ladder === 'danger') return 'danger';
  if (ladder === 'warning') return 'warning';
  if (overlays.includes('billWeek')) return 'billWeek';
  if (ladder === 'tight') return 'tight';
  if (overlays.includes('paydayEve')) return 'paydayEve';
  return ladder; // protected | winning | calm
}

function computeMonetizationAllowed(
  data: DataState,
  journey: JourneyState,
  ladder: LadderState,
  i: StateInputs,
): boolean {
  if (data === 'fog') return false;
  if (journey === 'recovery') return false;
  if (ladder === 'warning' || ladder === 'danger' || ladder === 'overspent') return false;
  if (i.daysSinceOverdraftEvent !== null && i.daysSinceOverdraftEvent < OVERDRAFT_EMBARGO_DAYS) {
    return false; // §8.4: nobody gets sold to the week after they drowned
  }
  return true;
}

export function resolveState(
  prev: MeloStateRecord | null,
  inputs: StateInputs,
  today: ISODate,
  opts: ResolveOptions = {},
): { record: MeloStateRecord; view: StateView } {
  const raw = computeRawLadder(inputs);
  const { ladder, ladderEnteredAt } = applyHysteresis(prev, raw, inputs, today);
  const { journey, journeyEnteredAt } = resolveJourney(prev, ladder, inputs, today, opts);
  const data: DataState = inputs.dataAgeHours > FOG_AFTER_HOURS ? 'fog' : 'ok';
  const overlays = computeOverlays(inputs);

  const view: StateView = {
    ladder,
    journey,
    data,
    overlays,
    weather: computeWeather(data, journey, journeyEnteredAt, ladder, today),
    mascot: computeMascot(data, overlays, journey, journeyEnteredAt, ladder, today),
    copyKey: computeCopyKey(data, overlays, journey, ladder),
    monetizationAllowed: computeMonetizationAllowed(data, journey, ladder, inputs),
  };

  return { record: { ladder, ladderEnteredAt, journey, journeyEnteredAt }, view };
}
