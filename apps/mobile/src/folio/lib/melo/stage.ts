/**
 * Workspace-local phoenix progression.
 *
 * The stage derivation is the frozen web engine. Persistence helpers in this
 * file remain pure: callers provide one workspace's route/runway/cycle inputs
 * and receive the next bounded stage/streak slices.
 */

export type PhoenixStage = 'ash' | 'ember' | 'rising' | 'fledgling' | 'full' | 'ablaze';

export type StageMode = 'standard' | 'survival' | 'reset' | 'lowvis' | 'irregular' | 'quiet';

export type StageInput = {
  daysToPayday?: number;
  cycleLength?: number;
  pathBendPct?: number;
  cleanStreakDays?: number;
  runwayDays?: number | null;
  mode?: StageMode;
  lastCycleRed?: boolean;
  hoursSincePayday?: number;
};

export type StageOutput = {
  stage: PhoenixStage;
  isRebirthBeat: boolean;
  reason: string;
};

export type PhoenixStageState = {
  current: PhoenixStage;
  enteredAt: string;
  lastRebirthAt: string | null;
  history: Array<{ stage: PhoenixStage; at: string }>;
};

export type MeloStreakState = {
  count: number;
  lastQualifiedCycleId: string | null;
  bestCount: number;
  updatedAt: string;
};

export type CycleCloseProgressInput = {
  cycleId: string;
  spare: number;
  tightPoint: number;
  closedAt: string;
};

export type BusinessWeeklyProgressInput = {
  runwayDays: number | null;
  overdueInvoiceCount: number;
  now: string;
};

export type BusinessStageInput = {
  quietMode: boolean;
  runwayDays: number | null;
  overdueInvoiceCount: number;
  overdueInvoice30DayCount: number;
  nextDeadlineDaysAway: number | null;
  setAsideCoverage: number;
  cleanStreakWeeks: number;
  hoursSinceFilingOrPaid: number | null;
};

export type BusinessSetAsideInput = {
  vatPotBalance: number;
  corpTaxPotBalance: number;
  saPotBalance: number;
  vatDueNext: number;
  corpTaxDueNext: number;
  saDueNext: number;
};

export const STAGE_HISTORY_LIMIT = 12;
export const STAGE_FOREGROUND_STALE_MS = 24 * 60 * 60 * 1000;

const PHOENIX_STAGES: readonly PhoenixStage[] = [
  'ash',
  'ember',
  'rising',
  'fledgling',
  'full',
  'ablaze',
];
const DEFAULT_OUTPUT: StageOutput = {
  stage: 'ember',
  isRebirthBeat: false,
  reason: 'default',
};
const EPOCH_ISO = '1970-01-01T00:00:00.000Z';

export function deriveStage(input: StageInput = {}): StageOutput {
  const mode = input.mode ?? 'standard';

  if (mode === 'quiet') return { stage: 'ash', isRebirthBeat: false, reason: 'quiet-mode' };
  if (mode === 'reset') return { stage: 'ember', isRebirthBeat: false, reason: 'reset-mode' };

  if (mode === 'lowvis' || mode === 'irregular') {
    const runway = input.runwayDays ?? null;
    if (runway === null) return { stage: 'ember', isRebirthBeat: false, reason: 'no-runway' };
    if (runway < 14) return { stage: 'ash', isRebirthBeat: false, reason: 'runway<14' };
    if (runway < 45) return { stage: 'rising', isRebirthBeat: false, reason: 'runway<45' };
    if (runway < 90) {
      return { stage: 'fledgling', isRebirthBeat: false, reason: 'runway<90' };
    }
    if (runway < 180) return { stage: 'full', isRebirthBeat: false, reason: 'runway<180' };
    return { stage: 'ablaze', isRebirthBeat: false, reason: 'runway>=180' };
  }

  const cycleLength = Math.max(7, input.cycleLength ?? 30);
  const daysToPayday = input.daysToPayday;
  const bend = input.pathBendPct ?? 0;
  const streak = input.cleanStreakDays ?? 0;
  const lastRed = input.lastCycleRed === true;
  const hoursSincePayday = input.hoursSincePayday ?? Number.POSITIVE_INFINITY;
  const isRebirthBeat = hoursSincePayday <= 6 && (daysToPayday ?? cycleLength) >= cycleLength - 1;

  if (lastRed && hoursSincePayday > 6) {
    return { stage: 'ash', isRebirthBeat: false, reason: 'prev-cycle-red' };
  }
  if (isRebirthBeat) {
    return { stage: 'ember', isRebirthBeat: true, reason: 'post-payday<=6h' };
  }
  if (daysToPayday === undefined) return DEFAULT_OUTPUT;

  if (mode === 'survival') {
    if (bend > 0.25) {
      return { stage: 'ash', isRebirthBeat: false, reason: 'survival+bend>0.25' };
    }
    if (bend > 0.1) {
      return { stage: 'ember', isRebirthBeat: false, reason: 'survival+bend>0.1' };
    }
    const capped =
      daysToPayday < cycleLength * 0.25
        ? 'rising'
        : daysToPayday < cycleLength * 0.5
          ? 'fledgling'
          : 'full';
    return { stage: capped, isRebirthBeat: false, reason: `survival-cap:${capped}` };
  }

  const fraction = 1 - Math.max(0, Math.min(1, daysToPayday / cycleLength));
  if (bend > 0.35) return { stage: 'ash', isRebirthBeat: false, reason: 'bend>0.35' };

  let stage: PhoenixStage;
  if (fraction < 0.1) stage = 'ember';
  else if (fraction < 0.35) stage = 'rising';
  else if (fraction < 0.65) stage = 'fledgling';
  else if (fraction < 0.9) stage = 'full';
  else stage = 'ash';

  if (stage === 'full' && streak >= 3 && bend < 0.1) {
    return { stage: 'ablaze', isRebirthBeat: false, reason: 'streak>=3+full' };
  }
  return { stage, isRebirthBeat: false, reason: `arc:${stage}` };
}

/**
 * Frozen Business precedence. The stronger ablaze test lives inside the
 * otherwise-full healthy band so it remains reachable without weakening any
 * earlier risk signal.
 */
export function deriveBusinessStage(input: BusinessStageInput): StageOutput {
  const runway = input.runwayDays ?? Number.POSITIVE_INFINITY;
  const overdueInvoices = nonNegativeInteger(input.overdueInvoiceCount);
  const overdueThirtyDays = nonNegativeInteger(input.overdueInvoice30DayCount);
  const coverage = finiteNonNegative(input.setAsideCoverage, 1);
  const cleanStreakWeeks = nonNegativeInteger(input.cleanStreakWeeks);
  const deadlineDays = finiteOrNull(input.nextDeadlineDaysAway);
  const recentHours = finiteOrNull(input.hoursSinceFilingOrPaid);

  if (input.quietMode) {
    return { stage: 'ash', isRebirthBeat: false, reason: 'business:quiet-mode' };
  }
  if (deadlineDays !== null && deadlineDays < 0) {
    return { stage: 'ash', isRebirthBeat: false, reason: 'business:filing-overdue' };
  }
  if (runway < 14 || overdueThirtyDays >= 1) {
    return { stage: 'ash', isRebirthBeat: false, reason: 'business:runway-or-30d-overdue' };
  }
  if (recentHours !== null && recentHours >= 0 && recentHours <= 6) {
    return { stage: 'ember', isRebirthBeat: true, reason: 'business:just-filed-or-paid' };
  }
  if (runway < 45 || coverage < 0.5) {
    return { stage: 'rising', isRebirthBeat: false, reason: 'business:runway-or-cover<0.5' };
  }
  if (runway < 90 && coverage < 0.85) {
    return { stage: 'fledgling', isRebirthBeat: false, reason: 'business:runway-and-cover<0.85' };
  }
  if (runway >= 90 && coverage >= 0.85 && overdueInvoices === 0) {
    if (runway >= 180 && coverage >= 1 && cleanStreakWeeks >= 4) {
      return { stage: 'ablaze', isRebirthBeat: false, reason: 'business:healthy+streak>=4' };
    }
    return { stage: 'full', isRebirthBeat: false, reason: 'business:healthy' };
  }

  // The approved bands leave mixed runway/coverage states between fledgling
  // and full uncovered. Keep those below full without fabricating a risk beat.
  return { stage: 'fledgling', isRebirthBeat: false, reason: 'business:mixed-middle-band' };
}

export function calculateBusinessSetAsideCoverage(input: BusinessSetAsideInput): number {
  const balance =
    finiteNonNegative(input.vatPotBalance) +
    finiteNonNegative(input.corpTaxPotBalance) +
    finiteNonNegative(input.saPotBalance);
  const liability =
    finiteNonNegative(input.vatDueNext) +
    finiteNonNegative(input.corpTaxDueNext) +
    finiteNonNegative(input.saDueNext);
  return liability === 0 ? 1 : balance / liability;
}

export function createPhoenixStageState(
  at: string,
  current: PhoenixStage = 'ember',
): PhoenixStageState {
  const enteredAt = validIsoOr(at, EPOCH_ISO);
  return {
    current,
    enteredAt,
    lastRebirthAt: null,
    history: [{ stage: current, at: enteredAt }],
  };
}

export function createMeloStreakState(at: string): MeloStreakState {
  return {
    count: 0,
    lastQualifiedCycleId: null,
    bestCount: 0,
    updatedAt: validIsoOr(at, EPOCH_ISO),
  };
}

export function normalisePhoenixStageState(
  value: Partial<PhoenixStageState> | null | undefined,
  fallbackAt: string,
): PhoenixStageState {
  const enteredAt = validIsoOr(value?.enteredAt, validIsoOr(fallbackAt, EPOCH_ISO));
  const current = isPhoenixStage(value?.current) ? value.current : 'ember';
  const history = Array.isArray(value?.history)
    ? value.history
        .filter(
          (entry): entry is { stage: PhoenixStage; at: string } =>
            isPhoenixStage(entry?.stage) && isIso(entry?.at),
        )
        .slice(-STAGE_HISTORY_LIMIT)
    : [];
  return {
    current,
    enteredAt,
    lastRebirthAt:
      value?.lastRebirthAt === null || isIso(value?.lastRebirthAt)
        ? (value.lastRebirthAt ?? null)
        : null,
    history: history.length > 0 ? history : [{ stage: current, at: enteredAt }],
  };
}

export function normaliseMeloStreakState(
  value: Partial<MeloStreakState> | null | undefined,
  fallbackAt: string,
): MeloStreakState {
  const count = nonNegativeInteger(value?.count);
  const bestCount = Math.max(count, nonNegativeInteger(value?.bestCount));
  return {
    count,
    lastQualifiedCycleId:
      typeof value?.lastQualifiedCycleId === 'string' && value.lastQualifiedCycleId.length > 0
        ? value.lastQualifiedCycleId
        : null,
    bestCount,
    updatedAt: validIsoOr(value?.updatedAt, validIsoOr(fallbackAt, EPOCH_ISO)),
  };
}

export function transitionPhoenixStage(
  previous: PhoenixStageState,
  next: PhoenixStage,
  at: string,
): PhoenixStageState {
  const enteredAt = validIsoOr(at, previous.enteredAt);
  if (previous.current === next) return previous;
  return {
    current: next,
    enteredAt,
    lastRebirthAt:
      previous.current === 'ash' && next === 'ember' ? enteredAt : previous.lastRebirthAt,
    history: [...previous.history, { stage: next, at: enteredAt }].slice(-STAGE_HISTORY_LIMIT),
  };
}

export function deriveForegroundStage(
  previous: PhoenixStageState,
  input: StageInput,
  now: string,
): PhoenixStageState {
  const nowIso = validIsoOr(now, previous.enteredAt);
  if (Date.parse(nowIso) - Date.parse(previous.enteredAt) <= STAGE_FOREGROUND_STALE_MS) {
    return previous;
  }
  return transitionPhoenixStage(previous, deriveStage(input).stage, nowIso);
}

export function deriveBusinessForegroundStage(
  previous: PhoenixStageState,
  input: BusinessStageInput,
  now: string,
): PhoenixStageState {
  const nowIso = validIsoOr(now, previous.enteredAt);
  if (Date.parse(nowIso) - Date.parse(previous.enteredAt) <= STAGE_FOREGROUND_STALE_MS) {
    return previous;
  }
  return transitionPhoenixStage(previous, deriveBusinessStage(input).stage, nowIso);
}

export function applyCycleCloseProgress(
  previousStage: PhoenixStageState,
  previousStreak: MeloStreakState,
  input: CycleCloseProgressInput,
): { stage: PhoenixStageState; streak: MeloStreakState } {
  if (input.cycleId === previousStreak.lastQualifiedCycleId) {
    return { stage: previousStage, streak: previousStreak };
  }
  const closedAt = validIsoOr(input.closedAt, previousStreak.updatedAt);
  const qualified = input.spare >= 0 && input.tightPoint >= 0;
  const count = qualified ? previousStreak.count + 1 : 0;
  return {
    stage: transitionPhoenixStage(previousStage, 'ash', closedAt),
    streak: {
      count,
      lastQualifiedCycleId: qualified ? input.cycleId : null,
      bestCount: Math.max(previousStreak.bestCount, count),
      updatedAt: closedAt,
    },
  };
}

export function applyRitualCompletion(previous: PhoenixStageState, at: string): PhoenixStageState {
  return transitionPhoenixStage(previous, 'ember', at);
}

/**
 * Evaluate the just-finished Business week once, on the first foreground of
 * the new local ISO week. Weeks missed while the app is closed are not
 * backfilled: Melo only records a week it can evaluate from saved facts.
 */
export function applyBusinessWeeklyProgress(
  previous: MeloStreakState,
  input: BusinessWeeklyProgressInput,
): MeloStreakState {
  const updatedAt = validIsoOr(input.now, previous.updatedAt);
  const now = new Date(updatedAt);
  const previousUpdate = new Date(previous.updatedAt);
  if (localIsoWeekId(now) === localIsoWeekId(previousUpdate)) return previous;

  const qualified =
    input.runwayDays !== null &&
    input.runwayDays >= 30 &&
    nonNegativeInteger(input.overdueInvoiceCount) === 0;
  const count = qualified ? previous.count + 1 : 0;
  return {
    count,
    lastQualifiedCycleId: qualified ? `business-week:${previousLocalIsoWeekId(now)}` : null,
    bestCount: Math.max(previous.bestCount, count),
    updatedAt,
  };
}

export function stageLabel(stage: PhoenixStage): string {
  if (stage === 'ash') return 'ASH';
  if (stage === 'ember') return 'EMBER';
  if (stage === 'rising') return 'RISING';
  if (stage === 'fledgling') return 'IN FLIGHT';
  if (stage === 'full') return 'FULL';
  return 'ABLAZE';
}

function isPhoenixStage(value: unknown): value is PhoenixStage {
  return typeof value === 'string' && (PHOENIX_STAGES as readonly string[]).includes(value);
}

function isIso(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function validIsoOr(value: unknown, fallback: string): string {
  return isIso(value) ? value : fallback;
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function finiteNonNegative(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function previousLocalIsoWeekId(value: Date): string {
  const previousWeek = new Date(value);
  previousWeek.setDate(previousWeek.getDate() - 7);
  return localIsoWeekId(previousWeek);
}

/** ISO week identity using the device's local calendar day, not UTC midnight. */
function localIsoWeekId(value: Date): string {
  const day = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const weekYear = day.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil(((day.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${weekYear}-W${String(week).padStart(2, '0')}`;
}
