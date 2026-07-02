// The six dogfood scenarios behind the ⚙ state chip (MELO_BLUEPRINT.md §14 MVP item 3).
// Each scenario is a full engine input set — the screen calls resolveState() on these for real,
// so what the chip shows IS the engine's opinion, not a hand-painted mock. Deterministic on
// purpose: fixed demo "today", no device clock (the real store layer owns real dates later).

import type { CopyContext, MeloStateRecord, StateInputs } from '@folio/melo-engine';

import type { RunwayBill } from '../components/RunwayStrip';

export const DEMO_TODAY = '2026-07-01';

export type DemoKey = 'calm' | 'payday' | 'tight' | 'warning' | 'storm' | 'recovery' | 'fog';

export const DEMO_ORDER: readonly DemoKey[] = [
  'calm',
  'payday',
  'tight',
  'warning',
  'storm',
  'recovery',
  'fog',
];

export interface DemoScenario {
  readonly key: DemoKey;
  readonly label: string;
  readonly chipWord: string;
  readonly szPence: number;
  /** The line under the hero number. */
  readonly sub: string;
  /** The mascot's second line (flavour under the engine copy line). */
  readonly l2: string;
  readonly ctx: CopyContext;
  readonly inputs: StateInputs;
  readonly prev: MeloStateRecord | null;
  readonly daysToPayday: number;
  readonly bills: readonly RunwayBill[];
  readonly dangerDay: number | null;
  readonly action: { readonly title: string; readonly body: string; readonly cta: string };
}

function mkInputs(over: Partial<StateInputs> = {}): StateInputs {
  return {
    safeZonePence: 18_400,
    perDayPence: 1_533,
    comfortablePerDayPence: 800,
    daysToPayday: 12,
    runwayDays: null,
    dangerDaysAway: null,
    overdraft: false,
    dataAgeHours: 1,
    paydayToday: false,
    paydayTomorrow: false,
    billsDueNext7: 1,
    billsTotalCycle: 4,
    allBillsShielded: false,
    bufferIntact: false,
    cyclesEndedPositive: 0,
    savingsGrowing: false,
    daysSinceRecoveryEnd: null,
    greenDaysStreak: 0,
    daysSinceOverdraftEvent: null,
    milestoneReached: false,
    returnedAfterAbsence: false,
    ...over,
  };
}

function mkCtx(over: Partial<CopyContext> = {}): CopyContext {
  return {
    safeZone: '£184',
    perDay: '£15',
    keepDryPerDay: '£9',
    dangerDay: 'Thursday',
    paydayLabel: 'Fri the 12th',
    daysToPayday: 12,
    dayOnPath: 2,
    todaysMove: 'shift £8',
    staleLabel: 'Tuesday',
    ...over,
  };
}

const STANDARD_BILLS: readonly RunwayBill[] = [
  { day: 2, label: 'energy' },
  { day: 5, label: 'phone' },
  { day: 8, label: 'subs' },
];

export const DEMOS: Record<DemoKey, DemoScenario> = {
  calm: {
    key: 'calm',
    label: 'Calm',
    chipWord: 'Sunny to Friday',
    szPence: 18_400,
    sub: 'safe until Fri the 12th',
    l2: 'I’ll speak up if that changes.',
    ctx: mkCtx(),
    inputs: mkInputs(),
    prev: null,
    daysToPayday: 12,
    bills: STANDARD_BILLS,
    dangerDay: null,
    action: {
      title: 'One thing, if you want',
      body: 'Energy came in £14 above usual. Worth a look — it’s a 3-minute fix.',
      cta: 'Have a look',
    },
  },
  payday: {
    key: 'payday',
    label: 'Payday',
    chipWord: 'Payday — new cycle',
    szPence: 41_200,
    sub: 'the new cycle, protected',
    l2: 'Two minutes makes it safe.',
    ctx: mkCtx({ safeZone: '£412', perDay: '£14' }),
    inputs: mkInputs({ safeZonePence: 41_200, perDayPence: 1_471, paydayToday: true }),
    prev: null,
    daysToPayday: 28,
    bills: STANDARD_BILLS,
    dangerDay: null,
    action: {
      title: 'Payday',
      body: 'Two minutes with Melo makes the month safe.',
      cta: 'Start the ritual',
    },
  },
  tight: {
    key: 'tight',
    label: 'Tight',
    chipWord: 'Cloudy — steady it',
    szPence: 4_100,
    sub: '£3/day to Fri the 12th',
    l2: 'Doable, needs a little steering.',
    ctx: mkCtx({ safeZone: '£41', perDay: '£3' }),
    inputs: mkInputs({ safeZonePence: 4_100, perDayPence: 341 }),
    prev: null,
    daysToPayday: 12,
    bills: STANDARD_BILLS,
    dangerDay: null,
    action: {
      title: 'This week, steered',
      body: '£3/day keeps Friday calm. Thursday’s cinema — want it on the Shelf?',
      cta: 'See the week',
    },
  },
  warning: {
    key: 'warning',
    label: 'Warning',
    chipWord: 'Rain likely Thursday',
    szPence: 3_800,
    sub: '£9/day keeps Thursday dry',
    l2: 'Caught early — that’s the whole trick.',
    ctx: mkCtx({ safeZone: '£38' }),
    inputs: mkInputs({ safeZonePence: 3_800, dangerDaysAway: 5, runwayDays: 5 }),
    prev: null,
    daysToPayday: 12,
    bills: STANDARD_BILLS,
    dangerDay: 5,
    action: {
      title: 'Keep Thursday dry',
      body: '£9/day until Friday keeps the storm off. Want the day-by-day plan?',
      cta: 'Replan my week',
    },
  },
  storm: {
    key: 'storm',
    label: 'Storm',
    chipWord: 'Storm — bills are safe',
    szPence: 1_200,
    sub: 'bills protected · Wednesday is the day to plan for',
    l2: 'Breathe. The plan is small and daily.',
    ctx: mkCtx({ safeZone: '£12', dangerDay: 'Wednesday' }),
    inputs: mkInputs({ safeZonePence: 1_200, dangerDaysAway: 2, runwayDays: 2 }),
    prev: null,
    daysToPayday: 12,
    bills: STANDARD_BILLS,
    dangerDay: 2,
    action: {
      title: 'The way back',
      body: 'Three steps. The first one takes a minute. No lecture in any of them.',
      cta: 'Start the way back',
    },
  },
  recovery: {
    key: 'recovery',
    label: 'Recovery',
    chipWord: 'Clearing — day 2 on the path',
    szPence: 1_200,
    sub: 'rebuilding · £4/day to Friday',
    l2: 'Bills stay protected while we rebuild.',
    ctx: mkCtx({ safeZone: '£12', dayOnPath: 2 }),
    inputs: mkInputs({ safeZonePence: 1_200, greenDaysStreak: 1 }),
    prev: {
      ladder: 'overspent',
      ladderEnteredAt: '2026-06-30',
      journey: 'recovery',
      journeyEnteredAt: '2026-06-30',
    },
    daysToPayday: 12,
    bills: STANDARD_BILLS,
    dangerDay: null,
    action: {
      title: 'Today’s move',
      body: 'Shift £8 to bills. Then we’re done for today — no second ask.',
      cta: 'Do today’s move',
    },
  },
  fog: {
    key: 'fog',
    label: 'Fog',
    chipWord: 'Fog — numbers from Tue',
    szPence: 18_400,
    sub: 'safe until Fri the 12th',
    l2: 'Last good numbers are from Tuesday. 30 seconds fixes it.',
    ctx: mkCtx(),
    inputs: mkInputs({ dataAgeHours: 100 }),
    prev: null,
    daysToPayday: 12,
    bills: STANDARD_BILLS,
    dangerDay: null,
    action: {
      title: 'Refresh my picture',
      body: 'Tell me today’s balance and everything sharpens back up.',
      cta: 'Update balance (30s)',
    },
  },
};

/** Demo math-sheet rows: fixed balance, essentials, savings, buffer — bills absorb the rest so
 *  the rows always sum EXACTLY to the displayed Safe Zone (the show-the-math invariant). */
export function demoBreakdown(szPence: number): {
  readonly balance: number;
  readonly bills: number;
  readonly essentials: number;
  readonly savings: number;
  readonly buffer: number;
} {
  const balance = 124_000;
  const essentials = 16_800;
  const savings = 4_000;
  const buffer = 2_000;
  const bills = balance - essentials - savings - buffer - szPence;
  return { balance, bills, essentials, savings, buffer };
}
