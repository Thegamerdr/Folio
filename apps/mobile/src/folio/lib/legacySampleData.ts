/** Recognition-only fingerprints for cleaning older persisted prototype data.
 * No production initializer or reset may populate a profile from these values.
 * Fixture construction lives under test/ and is never imported by the app. */
import type { CurrentBalance, CycleRecord, Debt, Plan, Pot, Sub } from '../store';

export const LEGACY_SAMPLE_SUBS: Sub[] = [
  { name: 'Spotify', cost: 11.0, nextRenewalDaysAway: 2, lastUsedDaysAgo: 0, usesPerMonth: 28 },
  { name: 'Netflix', cost: 12.99, nextRenewalDaysAway: 9, lastUsedDaysAgo: 21, usesPerMonth: 2 },
  { name: 'Notion', cost: 8.0, nextRenewalDaysAway: 11, lastUsedDaysAgo: 0, usesPerMonth: 30 },
  {
    name: 'Disney+',
    cost: 8.99,
    nextRenewalDaysAway: 6,
    lastUsedDaysAgo: 42,
    usesPerMonth: 0,
    trialEndsInDays: 6,
  },
  { name: 'iCloud', cost: 2.99, nextRenewalDaysAway: 13, lastUsedDaysAgo: 0, usesPerMonth: 30 },
  { name: 'Strava', cost: 9.99, nextRenewalDaysAway: 17, lastUsedDaysAgo: 18, usesPerMonth: 1 },
];

export const LEGACY_SAMPLE_BALANCE: CurrentBalance = {
  amount: 720,
  source: 'sample',
  confidence: 'sample',
  setAt: '2026-06-27T00:00:00.000Z',
};

export const LEGACY_SAMPLE_POTS: Pot[] = [
  {
    id: 'holiday',
    name: 'Holiday · September',
    saved: 420,
    goal: 1200,
    perWeek: 35,
    accent: true,
  },
  { id: 'buffer', name: 'Buffer', saved: 140, goal: 500, perWeek: 20, accent: false },
  { id: 'christmas', name: 'Christmas', saved: 60, goal: 300, perWeek: 15, accent: false },
];

export const LEGACY_SAMPLE_CYCLES: CycleRecord[] = [
  // Seed two prior cycles so Insights has something to show on first run.
  {
    closedAt: '2026-05-25',
    label: 'May',
    spare: 142,
    tightPoint: 38,
    setAside: 60,
    note: 'Held the line on takeaway.',
  },
  {
    closedAt: '2026-04-25',
    label: 'April',
    spare: 88,
    tightPoint: 24,
    setAside: 50,
    note: 'Tight one — buffer saved it.',
  },
];

export const LEGACY_SAMPLE_DEBTS: Debt[] = [
  {
    id: 'seed-loan',
    name: 'Personal loan',
    kind: 'loan',
    balance: 2400,
    apr: 12.9,
    minPayment: 120,
    dueDom: 5,
    addedAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'seed-klarna',
    name: 'Klarna sofa',
    kind: 'bnpl',
    balance: 320,
    apr: 0,
    minPayment: 80,
    dueDom: 15,
    addedAt: '2026-05-01T00:00:00.000Z',
  },
];

export const LEGACY_SAMPLE_PLANS: Plan[] = [
  {
    id: 'seed-macbook',
    name: 'New MacBook',
    target: 1600,
    saved: 240,
    byDate: '2026-12-15',
    perWeek: 40,
    addedAt: '2026-06-01T00:00:00.000Z',
  },
];
