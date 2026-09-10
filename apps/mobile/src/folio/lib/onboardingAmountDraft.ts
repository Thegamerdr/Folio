import { parseManualMoney } from './manualMoney';
import type { MoneyMode } from './modes/types';

type AmountDraft = Readonly<{ amount: number; input: string }>;
type AmountTarget = 'buffer' | MoneyMode;
export type OnboardingAmountDraft = Readonly<{
  buffer: AmountDraft;
  extras: Readonly<Partial<Record<MoneyMode, AmountDraft>>>;
}>;

const EMPTY_AMOUNT: AmountDraft = { amount: 0, input: '0' };

function isBuffer(target: AmountTarget): boolean {
  return target === 'buffer' || target === 'survival' || target === 'stability';
}

/** The early Survival/Stability question and later protected-buffer field are one answer. */
export function createOnboardingAmountDraft(
  savedBuffer: number,
  savedExtras: Readonly<Partial<Record<MoneyMode, number>>> = {},
): OnboardingAmountDraft {
  return {
    buffer: { amount: savedBuffer, input: String(savedBuffer) },
    extras: Object.fromEntries(
      Object.entries(savedExtras).map(([mode, amount]) => [
        mode,
        { amount, input: String(amount) },
      ]),
    ),
  };
}

export function selectOnboardingAmount(
  draft: OnboardingAmountDraft,
  target: AmountTarget,
): AmountDraft {
  if (isBuffer(target)) return draft.buffer;
  return draft.extras[target as MoneyMode] ?? EMPTY_AMOUNT;
}

/** Preserve exact in-progress input and the last valid number, as the other money fields do. */
export function updateOnboardingAmount(
  draft: OnboardingAmountDraft,
  target: AmountTarget,
  input: string,
): OnboardingAmountDraft {
  const previous = selectOnboardingAmount(draft, target);
  const amount = parseManualMoney(input, { allowZero: true }) ?? previous.amount;
  const next = { amount, input };
  return isBuffer(target)
    ? { ...draft, buffer: next }
    : { ...draft, extras: { ...draft.extras, [target]: next } };
}
