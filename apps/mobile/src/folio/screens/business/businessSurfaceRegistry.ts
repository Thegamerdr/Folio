import type { ScreenId } from '@/folio/types';

/**
 * The Business routes which are currently shipping from the native shell.
 *
 * Keep this list deliberately presentation-only: the business-workspace package remains the
 * authority for entity, cash, invoice and tax truth. This registry gives the shell a narrow,
 * testable coverage seam so a new route cannot accidentally disappear into a generic fallback.
 */
export type BusinessOperationScreenId = Extract<ScreenId, `business-${string}`>;

export type BusinessSurfaceFamily =
  | 'workspace'
  | 'cash'
  | 'money-in'
  | 'money-out'
  | 'tax'
  | 'limited-company'
  | 'filing'
  | 'review';

export type BusinessSurfaceDefinition = Readonly<{
  id: BusinessOperationScreenId;
  family: BusinessSurfaceFamily;
  label: string;
}>;

export const BUSINESS_SURFACE_REGISTRY: readonly BusinessSurfaceDefinition[] = [
  { id: 'business-entity-setup', family: 'workspace', label: 'Business type' },
  { id: 'business-runway', family: 'cash', label: 'Cash runway' },
  { id: 'business-clients', family: 'money-in', label: 'Clients' },
  { id: 'business-invoices', family: 'money-in', label: 'Invoices' },
  { id: 'business-obligations', family: 'money-out', label: 'Recurring money out' },
  { id: 'business-deductions', family: 'money-out', label: 'Deductions' },
  { id: 'business-vat', family: 'tax', label: 'VAT' },
  { id: 'business-corp-tax', family: 'tax', label: 'Corporation Tax' },
  { id: 'business-payroll', family: 'limited-company', label: 'Payroll' },
  { id: 'business-dividends', family: 'limited-company', label: 'Dividends' },
  { id: 'business-dla', family: 'limited-company', label: "Director's loan" },
  { id: 'business-companies-house', family: 'limited-company', label: 'Companies House' },
  { id: 'business-filings', family: 'filing', label: 'Filings' },
  { id: 'business-filing-vat', family: 'filing', label: 'VAT working copy' },
  { id: 'business-filing-sa', family: 'filing', label: 'Self-Assessment working copy' },
  { id: 'business-filing-ct', family: 'filing', label: 'CT600 working copy' },
  { id: 'business-filing-cs', family: 'filing', label: 'CS01 working copy' },
  { id: 'business-filing-accounts', family: 'filing', label: 'Accounts working copy' },
  { id: 'business-filing-payroll', family: 'filing', label: 'Payroll working copy' },
  { id: 'business-insights', family: 'review', label: 'Business insights' },
] as const;

/** Business-native routes that are selected as primary shell surfaces when a Business workspace
 * is active. They are intentionally kept next to the operation registry for coverage accounting,
 * while their components remain owned by the shell. */
export const BUSINESS_SHELL_SURFACE_IDS = [
  'today',
  'more',
  'melo',
  'timeline',
  'calendar',
  'plans',
] as const satisfies readonly ScreenId[];

/** Shared native surfaces with an explicit Business presentation/data partition when reached
 * from Business More. They are not duplicated as Business screens. */
export const BUSINESS_SHARED_SURFACE_IDS = [
  'account',
  'intake',
  'privacy',
] as const satisfies readonly ScreenId[];

export function businessSurface(id: ScreenId): BusinessSurfaceDefinition | undefined {
  return BUSINESS_SURFACE_REGISTRY.find((surface) => surface.id === id);
}
