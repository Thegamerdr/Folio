import { isLaunchCurrency } from './launchCurrency';

/**
 * Structural account shape used by the launch money-boundary helpers. The legacy store's
 * `balanceMinor` is, despite its name, a major-unit pound amount; the optional facility limits use
 * the same unit until the remaining legacy store is migrated to integer minor units.
 */
export type LaunchAccountPolicyInput = Readonly<{
  kind: 'bank' | 'credit-card' | 'savings' | 'cash';
  isLiability: boolean;
  balanceMinor: number;
  currency?: string;
  closed?: boolean;
  hidden?: boolean;
  excludedFromTotals?: boolean;
  creditLimit?: number;
  arrangedOverdraftLimit?: number;
}>;

export type CreditPosition = Readonly<{
  owed: number;
  creditBalance: number;
  limit: number | null;
  availableCredit: number | null;
  overLimitBy: number;
}>;

export type OverdraftPosition = Readonly<{
  state: 'not-overdrawn' | 'arranged' | 'unarranged';
  balance: number;
  arrangedLimit: number;
  arrangedUsed: number;
  arrangedRemaining: number;
  unarrangedBy: number;
}>;

export type CreditAvailabilitySummary = Readonly<{
  knownAvailableCredit: number;
  unknownLimitAccountCount: number;
  overLimitBy: number;
}>;

export type OverdraftSummary = Readonly<{
  arrangedUsed: number;
  arrangedRemaining: number;
  unarrangedBy: number;
  overdrawnAccountCount: number;
}>;

export function isAccountCurrent(account: LaunchAccountPolicyInput): boolean {
  return account.closed !== true;
}

/** Included in current launch totals. Hidden accounts remain included; hiding is presentation only. */
export function isAccountInLaunchMoneyPicture(account: LaunchAccountPolicyInput): boolean {
  return (
    isAccountCurrent(account) &&
    account.excludedFromTotals !== true &&
    isLaunchCurrency(account.currency)
  );
}

export function isCashAccountInLaunchPosition(account: LaunchAccountPolicyInput): boolean {
  return isAccountInLaunchMoneyPicture(account) && !account.isLiability;
}

/** Accounts offered for new writes. Hidden/excluded accounts remain visible in account management. */
export function isAccountSelectable(account: LaunchAccountPolicyInput): boolean {
  return (
    isAccountCurrent(account) &&
    account.hidden !== true &&
    account.excludedFromTotals !== true &&
    isLaunchCurrency(account.currency)
  );
}

export function creditPosition(account: LaunchAccountPolicyInput): CreditPosition | null {
  if (account.kind !== 'credit-card' || !account.isLiability) return null;
  const balance = finiteNonZeroOrZero(account.balanceMinor);
  const owed = Math.max(0, balance);
  const creditBalance = Math.max(0, -balance);
  const limit = validFacilityLimit(account.creditLimit);
  return {
    owed,
    creditBalance,
    limit,
    availableCredit: limit === null ? null : Math.max(0, limit - balance),
    overLimitBy: limit === null ? 0 : Math.max(0, balance - limit),
  };
}

/**
 * Classifies a current-account balance without ever adding overdraft headroom to cash. A missing or
 * malformed arranged limit is treated as zero, so a negative balance fails closed as unarranged.
 */
export function overdraftPosition(account: LaunchAccountPolicyInput): OverdraftPosition | null {
  if (account.kind !== 'bank' || account.isLiability) return null;
  const balance = finiteNonZeroOrZero(account.balanceMinor);
  const arrangedLimit = validFacilityLimit(account.arrangedOverdraftLimit) ?? 0;
  const used = Math.max(0, -balance);
  const arrangedUsed = Math.min(used, arrangedLimit);
  const unarrangedBy = Math.max(0, used - arrangedLimit);
  return {
    state: used === 0 ? 'not-overdrawn' : unarrangedBy > 0 ? 'unarranged' : 'arranged',
    balance,
    arrangedLimit,
    arrangedUsed,
    arrangedRemaining: Math.max(0, arrangedLimit - used),
    unarrangedBy,
  };
}

export function summarizeCreditAvailability(
  accounts: readonly LaunchAccountPolicyInput[],
): CreditAvailabilitySummary {
  let knownAvailableCredit = 0;
  let unknownLimitAccountCount = 0;
  let overLimitBy = 0;
  for (const account of accounts) {
    if (!isAccountInLaunchMoneyPicture(account)) continue;
    const position = creditPosition(account);
    if (position === null) continue;
    if (position.availableCredit === null) unknownLimitAccountCount += 1;
    else knownAvailableCredit += position.availableCredit;
    overLimitBy += position.overLimitBy;
  }
  return { knownAvailableCredit, unknownLimitAccountCount, overLimitBy };
}

export function summarizeOverdrafts(
  accounts: readonly LaunchAccountPolicyInput[],
): OverdraftSummary {
  let arrangedUsed = 0;
  let arrangedRemaining = 0;
  let unarrangedBy = 0;
  let overdrawnAccountCount = 0;
  for (const account of accounts) {
    if (!isAccountInLaunchMoneyPicture(account)) continue;
    const position = overdraftPosition(account);
    if (position === null) continue;
    arrangedUsed += position.arrangedUsed;
    arrangedRemaining += position.arrangedRemaining;
    unarrangedBy += position.unarrangedBy;
    if (position.state !== 'not-overdrawn') overdrawnAccountCount += 1;
  }
  return { arrangedUsed, arrangedRemaining, unarrangedBy, overdrawnAccountCount };
}

function validFacilityLimit(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function finiteNonZeroOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
