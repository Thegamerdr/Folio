import { createLocalDate } from '@folio/domain';
import {
  expandObligationOccurrences,
  remainingObligationMinor,
  type ObligationResolution,
} from '@folio/finance-engine';
import { getState, setPartial, type Debt } from '../store';
import { localDayKey } from './dayClock';

/** A schedule edit applies prospectively, preserving already accrued dates and amounts. */
export function preserveDebtMinimumSchedule(
  debt: Debt,
  patch: Pick<Partial<Debt>, 'dueDom' | 'minPayment'>,
  now = new Date(),
): Pick<Partial<Debt>, 'minimumDueDate' | 'minimumOccurrences'> {
  if (
    (patch.dueDom === undefined || patch.dueDom === debt.dueDom) &&
    (patch.minPayment === undefined || patch.minPayment === debt.minPayment)
  )
    return {};
  const today = localDayKey(now);
  const monthly = (offset: number, day: number) => {
    const date = new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset + 1, 0));
    date.setUTCDate(Math.min(day, date.getUTCDate()));
    return date.toISOString().slice(0, 10);
  };
  const anchor = debt.minimumDueDate ?? monthly(0, debt.dueDom);
  const occurrences = { ...debt.minimumOccurrences };
  for (const item of expandObligationOccurrences({
    anchor,
    through: today,
    amountMinor: Math.round(debt.minPayment * 100),
    dayOfMonth: debt.dueDom,
    resolutions: occurrences,
  })) {
    const previous = occurrences[item.date];
    occurrences[item.date] = {
      ...previous,
      status: previous?.status ?? 'unpaid',
      amountMinor: previous?.amountMinor ?? Math.round(debt.minPayment * 100),
    };
  }
  const dueDay = patch.dueDom ?? debt.dueDom;
  const currentCycleDue = monthly(0, debt.dueDom);
  const cycleAlreadyAccrued = anchor <= currentCycleDue && currentCycleDue <= today;
  const candidate = monthly(0, dueDay);
  const minimumDueDate = cycleAlreadyAccrued || candidate < today ? monthly(1, dueDay) : candidate;
  return { minimumDueDate, minimumOccurrences: occurrences };
}

function checked(date: string, resolution: ObligationResolution): ObligationResolution {
  createLocalDate(date);
  remainingObligationMinor(0, resolution);
  return { ...resolution };
}

/**
 * Confirm an existing payment/resolution already reflected in the current cash balance.
 * These transitions change outstanding protection only; they never book a second cash movement.
 * Repeating the same confirmation is idempotent. Passing {status:'unpaid'} supports undo.
 */
export function setSubscriptionOccurrenceResolution(
  name: string,
  date: string,
  resolution: ObligationResolution,
): void {
  const state = getState();
  const sub = state.subs.find((item) => item.name === name);
  const priorAmount =
    sub?.obligationOccurrences?.[date]?.amountMinor ??
    (sub === undefined ? undefined : Math.round(sub.cost * 100));
  const next = checked(date, {
    ...(priorAmount === undefined ? {} : { amountMinor: priorAmount }),
    ...resolution,
  });
  if (!sub || JSON.stringify(sub.obligationOccurrences?.[date]) === JSON.stringify(next)) return;
  setPartial({
    subs: state.subs.map((item) =>
      item === sub
        ? {
            ...item,
            obligationOccurrences: { ...item.obligationOccurrences, [date]: next },
          }
        : item,
    ),
  });
}

export function setDebtMinimumOccurrenceResolution(
  id: string,
  date: string,
  resolution: ObligationResolution,
): void {
  const state = getState();
  const debt = state.debts?.find((item) => item.id === id);
  const priorAmount =
    debt?.minimumOccurrences?.[date]?.amountMinor ??
    (debt === undefined ? undefined : Math.round(debt.minPayment * 100));
  const next = checked(date, {
    ...(priorAmount === undefined ? {} : { amountMinor: priorAmount }),
    ...resolution,
  });
  if (!debt || JSON.stringify(debt.minimumOccurrences?.[date]) === JSON.stringify(next)) return;
  setPartial({
    debts: state.debts!.map((item) =>
      item === debt
        ? {
            ...item,
            minimumOccurrences: { ...item.minimumOccurrences, [date]: next },
          }
        : item,
    ),
  });
}

export function setCalendarObligationResolution(
  id: string,
  resolution: ObligationResolution,
): void {
  const state = getState();
  const event = state.calendarEvents.find((item) => item.id === id && item.kind === 'out');
  if (!event) return;
  const next = checked(event.date, resolution);
  if (event.obligationStatus === next.status && event.obligationPaidMinor === next.paidMinor)
    return;
  setPartial({
    calendarEvents: state.calendarEvents.map((item) => {
      if (item !== event) return item;
      const { obligationStatus: _status, obligationPaidMinor: _paid, ...rest } = item;
      return {
        ...rest,
        ...(next.status === undefined ? {} : { obligationStatus: next.status }),
        ...(next.paidMinor === undefined ? {} : { obligationPaidMinor: next.paidMinor }),
      };
    }),
  });
}
