/**
 * The local Melo write proposal vocabulary.
 *
 * These are proposal names only. The companion never applies them; the chat approval
 * surface hands a confirmed proposal to the store, which owns validation and mutation.
 */
export const PERSONAL_MELO_TOOL_NAMES = [
  'log_spend',
  'log_income',
  'log_refund',
  'log_transfer',
  'log_debt_payment',
  'set_commitment',
  'set_living_cost',
  'set_buffer_amount',
  'correct_income',
  'set_income_schedule',
  'set_debt_balance',
  'set_debt_arrears',
] as const;

export type PersonalMeloToolName = (typeof PERSONAL_MELO_TOOL_NAMES)[number];
export type MeloToolName = PersonalMeloToolName;

export function isPersonalMeloTool(name: MeloToolName): name is PersonalMeloToolName {
  return (PERSONAL_MELO_TOOL_NAMES as readonly string[]).includes(name);
}

export function isMeloToolName(value: string): value is MeloToolName {
  return (PERSONAL_MELO_TOOL_NAMES as readonly string[]).includes(value);
}
