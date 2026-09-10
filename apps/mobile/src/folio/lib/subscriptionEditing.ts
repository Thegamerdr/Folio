import { createLocalDate } from '@folio/domain';
import { expandObligationOccurrences } from '@folio/finance-engine';
import type { AppState, Sub } from '../store';
import { reanchorRenewals } from './renewalMath';
import { localDayKey } from './dayClock';

const shift = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const renameKey = <T>(map: Record<string, T>, before: string, after: string): Record<string, T> => {
  if (before === after) return map;
  const { [before]: value, ...rest } = map;
  return value === undefined ? rest : { ...rest, [after]: value };
};

/** The already tracked next occurrence and all accrued obligations keep their dates and amounts. */
export function subscriptionEditBoundary(state: AppState, name: string, now: Date) {
  const today = localDayKey(now);
  const sub = reanchorRenewals(state.subs, today).items.find((item) => item.name === name);
  if (!sub) throw new Error('This bill is no longer in Melo.');
  const offset = state.subOverrides[name] ?? 0;
  const anchor = sub.obligationAnchorISO ?? sub.nextRenewalISO ?? today;
  const occurrences = expandObligationOccurrences({
    anchor,
    through: shift(today, 370 - offset),
    amountMinor: Math.round(sub.cost * 100),
    ...(sub.renewalPeriodDays ? { periodDays: sub.renewalPeriodDays } : {}),
    ...(sub.obligationOccurrences ? { resolutions: sub.obligationOccurrences } : {}),
  });
  const next = occurrences.find((item) => shift(item.date, offset) >= today);
  const through = next?.date ?? shift(today, -offset);
  const protectedOccurrences = occurrences.filter((item) => item.date <= through);
  const future = occurrences.find((item) => item.date > through);
  const defaultDate = future ? shift(future.date, offset) : shift(today, 31);
  return {
    sub,
    offset,
    through,
    protectedOccurrences,
    defaultDate,
    protectedDate: shift(through, offset),
  };
}

export type SubscriptionEdit = {
  name: string;
  cost: number;
  periodDays: number | null;
  futureDate: string;
};

/** One atomic patch moves every name-keyed setting along with a renamed bill. No cash is booked. */
export function buildSubscriptionEditPatch(
  state: AppState,
  oldName: string,
  edit: SubscriptionEdit,
  now: Date,
): Partial<AppState> {
  const name = edit.name.trim();
  if (!name) throw new Error('Enter a bill name.');
  if (
    state.subs.some(
      (item) => item.name !== oldName && item.name.toLowerCase() === name.toLowerCase(),
    )
  )
    throw new Error('Another bill already has this name.');
  if (!Number.isFinite(edit.cost) || edit.cost <= 0)
    throw new Error('Enter an amount greater than zero.');
  if (edit.periodDays !== null && ![7, 14, 365].includes(edit.periodDays))
    throw new Error('Choose a supported repeat schedule.');
  const boundary = subscriptionEditBoundary(state, oldName, now);
  const scheduleChanged =
    Math.round(edit.cost * 100) !== Math.round(boundary.sub.cost * 100) ||
    edit.periodDays !== (boundary.sub.renewalPeriodDays ?? null) ||
    edit.futureDate !== boundary.defaultDate;
  let updated: Sub = { ...boundary.sub, name };
  if (scheduleChanged) {
    createLocalDate(edit.futureDate);
    if (edit.futureDate <= boundary.protectedDate)
      throw new Error(
        'Choose a future date after the current occurrence. Its amount and date stay unchanged.',
      );
    const resolutions = { ...boundary.sub.obligationOccurrences };
    for (const item of boundary.protectedOccurrences) {
      const old = resolutions[item.date];
      resolutions[item.date] = {
        ...old,
        status: old?.status ?? 'unpaid',
        amountMinor: old?.amountMinor ?? Math.round(boundary.sub.cost * 100),
      };
    }
    const anchor = shift(edit.futureDate, -boundary.offset);
    const { renewalPeriodDays: _period, ...rest } = updated;
    updated = {
      ...rest,
      cost: Math.round(edit.cost * 100) / 100,
      nextRenewalISO: anchor,
      obligationAnchorISO: anchor,
      nextRenewalDaysAway: Math.round(
        (Date.parse(`${anchor}T00:00:00Z`) - Date.parse(`${localDayKey(now)}T00:00:00Z`)) /
          86400000,
      ),
      obligationOccurrences: resolutions,
      ...(edit.periodDays === null ? {} : { renewalPeriodDays: edit.periodDays }),
    };
  }
  return {
    subs: state.subs.map((item) => (item.name === oldName ? updated : item)),
    subPaused: renameKey(state.subPaused, oldName, name),
    subOverrides: renameKey(state.subOverrides, oldName, name),
    ...(state.household
      ? {
          household: {
            ...state.household,
            subShareOverrides: renameKey(state.household.subShareOverrides, oldName, name),
          },
        }
      : {}),
  };
}
