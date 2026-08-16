/**
 * Every-third-renewal subscription check-in from the live Lovable source.
 * Pure derivation; the explicit keep/pause answer is persisted by `logSubCheckIn`.
 */
import type { Sub } from '../../store';

const CHECK_IN_EVERY = 3;
const COOLDOWN_DAYS = 45;

export type CheckInPrompt = {
  name: string;
  cost: number;
  renewalCount: number;
  paidSoFar: number;
} | null;

export function subDueForCheckIn(
  subs: readonly Sub[],
  paused: Readonly<Record<string, boolean>>,
  checkIns: Readonly<Record<string, string>>,
  today = new Date().toISOString().slice(0, 10),
): CheckInPrompt {
  const todayMs = Date.parse(`${today}T00:00:00.000Z`);
  const cooldownCutoff = new Date(
    (Number.isFinite(todayMs) ? todayMs : Date.now()) - COOLDOWN_DAYS * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);

  const candidates = subs.filter((sub) => {
    if (paused[sub.name]) return false;
    const renewalCount = sub.renewalCount ?? 0;
    if (renewalCount < CHECK_IN_EVERY || renewalCount % CHECK_IN_EVERY !== 0) return false;
    const lastCheckIn = checkIns[sub.name];
    return !lastCheckIn || lastCheckIn <= cooldownCutoff;
  });

  if (candidates.length === 0) return null;
  const top = [...candidates].sort((left, right) => right.cost - left.cost)[0]!;
  const renewalCount = top.renewalCount ?? 0;
  return {
    name: top.name,
    cost: top.cost,
    renewalCount,
    paidSoFar: Math.round(top.cost * renewalCount),
  };
}
