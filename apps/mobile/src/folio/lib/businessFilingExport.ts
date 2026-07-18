import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  annualAccountsDueDate,
  calculateVatBoxes,
  calculateSelfAssessmentSummary,
  corporationTaxDueDate,
  corporationTaxMinor,
  effectiveCorporationTaxBasisPoints,
  payrollTotals,
  type BusinessFilingKind,
  type BusinessOperationsState,
  type LtdEntity,
  type SoleTraderEntity,
} from '@folio/business-workspace';

export type BusinessFilingWorkingCopy = Readonly<{
  kind: BusinessFilingKind;
  title: string;
  period: string;
  authority: 'HMRC' | 'Companies House';
  entityName: string;
  amountMinor?: number;
  rows: readonly Readonly<{ label: string; value: string }>[];
  policyPackVersion: string;
  policyVerifiedOn: string;
  generatedAt: string;
}>;

export function buildBusinessFilingWorkingCopy(
  kind: BusinessFilingKind,
  state: BusinessOperationsState,
  generatedAt = new Date().toISOString(),
): BusinessFilingWorkingCopy | null {
  const entity = state.entity;
  if (!entity) return null;
  if (kind === 'vat') {
    const current = state.vatReturns
      .filter((item) => !item.filedExternallyOn)
      .sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0];
    if (!current || !entity.vat.registered) return null;
    const boxes = calculateVatBoxes(current);
    return {
      kind,
      title: 'VAT return working copy',
      period: `${current.periodStart} to ${current.periodEnd}`,
      authority: 'HMRC',
      entityName: entityName(entity),
      amountMinor: boxes.box5Minor,
      rows: [
        { label: 'Box 1 · Output VAT', value: money(boxes.box1Minor) },
        { label: 'Box 2 · NI acquisitions VAT', value: money(boxes.box2Minor) },
        { label: 'Box 3 · Total VAT due', value: money(boxes.box3Minor) },
        { label: 'Box 4 · Input VAT', value: money(boxes.box4Minor) },
        { label: 'Box 5 · Net VAT', value: money(boxes.box5Minor) },
        { label: 'Box 6 · Sales excluding VAT', value: money(boxes.box6Minor) },
        { label: 'Box 7 · Purchases excluding VAT', value: money(boxes.box7Minor) },
        { label: 'Box 8 · NI EU goods sales', value: money(boxes.box8Minor) },
        { label: 'Box 9 · NI EU goods purchases', value: money(boxes.box9Minor) },
      ],
      policyPackVersion: state.policyPackVersion,
      policyVerifiedOn: state.policyVerifiedOn,
      generatedAt,
    };
  }
  if (kind === 'self-assessment') {
    if (entity.kind !== 'sole-trader') return null;
    const summary = calculateSelfAssessmentSummary(state, entity);
    const pensionMinor = state.taxAdjustments
      .filter((adjustment) => adjustment.kind === 'pension')
      .reduce((sum, adjustment) => sum + adjustment.amountMinor, 0);
    const homeOfficeMinor = state.taxAdjustments
      .filter((adjustment) => adjustment.kind === 'home-office')
      .reduce((sum, adjustment) => sum + adjustment.amountMinor, 0);
    return {
      kind,
      title: 'Self-Assessment working copy',
      period: currentTaxYear(),
      authority: 'HMRC',
      entityName: entityName(entity),
      amountMinor: summary.amountDueMinor,
      rows: [
        { label: 'Recorded trading profit', value: money(summary.recordedProfitMinor) },
        { label: 'Basis-period transition slice', value: money(summary.transitionProfitMinor) },
        { label: 'Assessed profit', value: money(summary.assessedProfitMinor) },
        { label: 'Home-office record', value: money(homeOfficeMinor) },
        { label: 'Pension contributions recorded', value: money(pensionMinor) },
        { label: 'Income Tax', value: money(summary.incomeTaxMinor) },
        { label: 'Class 4 National Insurance', value: money(summary.class4NiMinor) },
        { label: 'Student loan', value: money(summary.studentLoanMinor) },
        { label: 'CIS already deducted', value: money(summary.cisDeductedMinor) },
        {
          label: 'Each payment on account',
          value: money(summary.paymentOnAccountEachMinor),
        },
        { label: 'UTR', value: entity.utr ?? 'Not recorded' },
      ],
      policyPackVersion: state.policyPackVersion,
      policyVerifiedOn: state.policyVerifiedOn,
      generatedAt,
    };
  }
  if (kind === 'corporation-tax') {
    if (entity.kind !== 'ltd') return null;
    const tax = corporationTaxMinor(state.ytdProfitMinor);
    return {
      kind,
      title: 'CT600 working copy',
      period: `Year ending ${entity.yearEnd}`,
      authority: 'HMRC',
      entityName: entityName(entity),
      amountMinor: tax,
      rows: [
        { label: 'Trading profit', value: money(state.ytdProfitMinor) },
        {
          label: 'Effective Corporation Tax rate',
          value: `${(effectiveCorporationTaxBasisPoints(state.ytdProfitMinor) / 100).toFixed(1)}%`,
        },
        { label: 'Corporation Tax', value: money(tax) },
        { label: 'Payment due', value: corporationTaxDueDate(entity) },
        { label: 'Company number', value: entity.companyNumber ?? 'Not recorded' },
      ],
      policyPackVersion: state.policyPackVersion,
      policyVerifiedOn: state.policyVerifiedOn,
      generatedAt,
    };
  }
  if (kind === 'confirmation-statement') {
    if (entity.kind !== 'ltd') return null;
    return {
      kind,
      title: 'CS01 working copy',
      period: String(new Date(generatedAt).getUTCFullYear()),
      authority: 'Companies House',
      entityName: entityName(entity),
      rows: [
        { label: 'Company', value: entity.companyName },
        { label: 'Company number', value: entity.companyNumber ?? 'Not recorded' },
        { label: 'Directors', value: String(entity.directors.length) },
        { label: 'Shareholders', value: String(entity.shareholders.length) },
      ],
      policyPackVersion: state.policyPackVersion,
      policyVerifiedOn: state.policyVerifiedOn,
      generatedAt,
    };
  }
  if (kind === 'annual-accounts') {
    if (entity.kind !== 'ltd') return null;
    return {
      kind,
      title: 'Annual accounts working copy',
      period: `Year ending ${entity.yearEnd}`,
      authority: 'Companies House',
      entityName: entityName(entity),
      rows: [
        { label: 'Company', value: entity.companyName },
        { label: 'Company number', value: entity.companyNumber ?? 'Not recorded' },
        { label: 'Year end', value: entity.yearEnd },
        { label: 'Trading profit', value: money(state.ytdProfitMinor) },
        { label: 'Accounts due', value: annualAccountsDueDate(entity) },
      ],
      policyPackVersion: state.policyPackVersion,
      policyVerifiedOn: state.policyVerifiedOn,
      generatedAt,
    };
  }
  const run = state.payrollRuns[0];
  if (!run || entity.kind !== 'ltd') return null;
  const totals = payrollTotals(run);
  return {
    kind,
    title: 'Payroll working copy',
    period: `Period ending ${run.periodEnd}`,
    authority: 'HMRC',
    entityName: entityName(entity),
    amountMinor: totals.payeMinor,
    rows: [
      { label: 'Gross pay', value: money(totals.grossMinor) },
      { label: 'Net paid', value: money(totals.netMinor) },
      { label: 'PAYE, NI and student loans', value: money(totals.payeMinor) },
      { label: 'Employees', value: String(run.employees.length) },
    ],
    policyPackVersion: state.policyPackVersion,
    policyVerifiedOn: state.policyVerifiedOn,
    generatedAt,
  };
}

export async function shareBusinessFilingPdf(
  copy: BusinessFilingWorkingCopy,
): Promise<'shared' | 'unavailable'> {
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  const { uri } = await Print.printToFileAsync({ html: filingHtml(copy) });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: copy.title,
    UTI: 'com.adobe.pdf',
  });
  return 'shared';
}

export function filingHtml(copy: BusinessFilingWorkingCopy): string {
  const rows = copy.rows
    .map(
      (row) =>
        `<tr><th>${escapeHtml(row.label)}</th><td>${escapeHtml(row.value)}</td></tr>`,
    )
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    @page { margin: 36pt; }
    body { color: #29241f; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 11pt; line-height: 1.45; }
    .flag { color: #a64c3f; font-size: 9pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    h1 { font-family: Georgia, serif; font-size: 25pt; font-weight: 500; margin: 10pt 0 3pt; }
    .meta { color: #756b62; margin: 0 0 22pt; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-bottom: 1px solid #ddd4ca; padding: 9pt 0; vertical-align: top; }
    th { color: #756b62; font-weight: 500; text-align: left; width: 62%; }
    td { font-variant-numeric: tabular-nums; font-weight: 650; text-align: right; }
    .amount { background: #f4eee7; border-radius: 10pt; margin-top: 18pt; padding: 14pt; }
    .amount strong { display: block; font-family: Georgia, serif; font-size: 22pt; font-weight: 500; margin-top: 3pt; }
    footer { color: #756b62; font-size: 8.5pt; margin-top: 28pt; }
  </style>
</head>
<body>
  <div class="flag">Working copy · not lodged with ${escapeHtml(copy.authority)}</div>
  <h1>${escapeHtml(copy.title)}</h1>
  <p class="meta">${escapeHtml(copy.entityName)} · ${escapeHtml(copy.period)}</p>
  <table>${rows}</table>
  ${
    copy.amountMinor === undefined
      ? ''
      : `<div class="amount">Calculated amount<strong>${escapeHtml(money(copy.amountMinor))}</strong></div>`
  }
  <footer>
    Prepared ${escapeHtml(new Date(copy.generatedAt).toLocaleString('en-GB'))}<br>
    Policy ${escapeHtml(copy.policyPackVersion)} · verified ${escapeHtml(copy.policyVerifiedOn)}
  </footer>
</body>
</html>`;
}

function entityName(entity: SoleTraderEntity | LtdEntity): string {
  return entity.kind === 'ltd'
    ? entity.companyName
    : entity.tradingName ?? 'Sole Trader business';
}

function currentTaxYear(now = new Date()): string {
  const year = now.getUTCFullYear();
  const startsThisYear = now >= new Date(Date.UTC(year, 3, 6));
  const first = startsThisYear ? year : year - 1;
  return `${first}/${String(first + 1).slice(2)}`;
}

function money(valueMinor: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valueMinor / 100);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
