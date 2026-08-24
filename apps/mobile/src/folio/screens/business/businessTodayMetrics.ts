import type { BusinessInvoice } from '@folio/business-workspace';

/** Revenue signal for Business Today, derived only from saved invoices in this workspace. */
export function invoicedInYearMinor(invoices: readonly BusinessInvoice[], year: number): number {
  const prefix = `${Math.trunc(year)}-`;
  return invoices
    .filter((invoice) => invoice.issuedOn.startsWith(prefix))
    .reduce((total, invoice) => total + invoice.totalMinor, 0);
}
