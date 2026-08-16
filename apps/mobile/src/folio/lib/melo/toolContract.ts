/**
 * Canonical Melo write-tool contract.
 *
 * These names are shared by the local parser, the retired compatibility
 * parser, and the approval-gated store bridge. Keeping the list here prevents
 * one surface from quietly accepting fewer tools than another.
 */
export const PERSONAL_MELO_TOOL_NAMES = [
  'log_spend',
  'log_income',
  'log_refund',
  'log_transfer',
  'addToPot',
  'borrowFromPot',
] as const;

export const BUSINESS_MELO_TOOL_NAMES = [
  'log_business_expense',
  'log_business_income',
  'log_invoice_sent',
  'log_invoice_paid',
  'log_owner_draw',
  'log_dividend',
] as const;

export const MELO_TOOL_NAMES = [...PERSONAL_MELO_TOOL_NAMES, ...BUSINESS_MELO_TOOL_NAMES] as const;

export type PersonalMeloToolName = (typeof PERSONAL_MELO_TOOL_NAMES)[number];
export type BusinessMeloToolName = (typeof BUSINESS_MELO_TOOL_NAMES)[number];
export type MeloToolName = (typeof MELO_TOOL_NAMES)[number];

export function isPersonalMeloTool(name: MeloToolName): name is PersonalMeloToolName {
  return (PERSONAL_MELO_TOOL_NAMES as readonly string[]).includes(name);
}

export function isBusinessMeloTool(name: MeloToolName): name is BusinessMeloToolName {
  return (BUSINESS_MELO_TOOL_NAMES as readonly string[]).includes(name);
}
