export type ProductLensId =
  | 'make_it_to_payday'
  | 'organise_debts'
  | 'check_bills'
  | 'add_bank_activity'
  | 'see_where_i_stand'
  | 'guide_me';

export type ProductLens = Readonly<{
  defaultAction: 'manual' | 'import' | 'sample';
  firstQuestion: string;
  hiddenUntilNeeded: readonly string[];
  homeEmphasis: string;
  id: ProductLensId;
  label: string;
  meloTone: string;
  reviewEmphasis: string;
  routeEmphasis: string;
}>;

export type GuidedManualQuestion = Readonly<{
  context: string;
  estimateLabel: string;
  id: 'money_now' | 'exactness' | 'next_income' | 'must_pay' | 'worry_payment';
  inputLabel: string;
  question: string;
  skipLabel: string;
  why: string;
}>;

export const productExperiencePrinciples = [
  'One obvious next step.',
  'Useful in under 60 seconds.',
  "Start with the user's mental model.",
  'Review before anything counts.',
  'Gentle reveal for stressful information.',
  'Manual entry must feel like building a picture, not filling a form.',
  'Import must be honest, never magical.',
  'Debt, bills, income, and survival pressure are first-class.',
  'Every number can explain itself.',
  'The route must answer a real question.',
  'Melo guides the next action, not the whole product.',
  'Advanced control exists but is not the default.',
  'No screen should feel like an architecture diagram.',
  'No screen should make the user feel stupid.',
  'If the user hesitates, the screen failed.',
] as const;

export const productLenses: readonly ProductLens[] = [
  {
    defaultAction: 'manual',
    firstQuestion: 'How much money is available today?',
    hiddenUntilNeeded: ['Timeline', 'Plans', 'Data and privacy', 'Internal test mode'],
    homeEmphasis: 'Show the next pressure before payday.',
    id: 'make_it_to_payday',
    label: 'Make it to payday',
    meloTone: 'Calm, direct, pressure-aware.',
    reviewEmphasis: 'Bills and income rows are checked first.',
    routeEmphasis: 'Today, next income, must-pay items, lowest point.',
  },
  {
    defaultAction: 'manual',
    firstQuestion: 'Which debt or minimum payment is worrying you first?',
    hiddenUntilNeeded: ['Timeline', 'Calendar', 'Data and privacy', 'Internal test mode'],
    homeEmphasis: 'Put debt payments beside income and bills.',
    id: 'organise_debts',
    label: 'Organise debts',
    meloTone: 'No shame, no advice, just what is due and what changed.',
    reviewEmphasis: 'Debt payment labels stay reviewable.',
    routeEmphasis: 'Minimum payments, dates, breathing room after commitments.',
  },
  {
    defaultAction: 'manual',
    firstQuestion: 'What bill must be paid before the next income?',
    hiddenUntilNeeded: ['Timeline', 'Melo help', 'Internal test mode'],
    homeEmphasis: 'Keep upcoming bills visible before flexible spending.',
    id: 'check_bills',
    label: 'Check bills',
    meloTone: 'Practical and plain.',
    reviewEmphasis: 'Recurring bill-looking rows are easy to mark.',
    routeEmphasis: 'Bill cluster, due dates, protected buffer.',
  },
  {
    defaultAction: 'import',
    firstQuestion: 'Do you have CSV, text, PDF, screenshot, or something else?',
    hiddenUntilNeeded: ['Plans', 'Calendar', 'Melo help', 'Internal test mode'],
    homeEmphasis: 'Find what to check without adding it.',
    id: 'add_bank_activity',
    label: 'Add bank activity',
    meloTone: 'Honest about what is supported.',
    reviewEmphasis: 'Every row explains what happens if added.',
    routeEmphasis: 'Waiting rows stay out of the money picture.',
  },
  {
    defaultAction: 'manual',
    firstQuestion: 'What number do you know right now?',
    hiddenUntilNeeded: ['Timeline', 'Plans', 'Calendar', 'Internal test mode'],
    homeEmphasis: 'Build the smallest useful picture.',
    id: 'see_where_i_stand',
    label: 'See where I stand',
    meloTone: 'Quietly reassuring and specific.',
    reviewEmphasis: 'Anything uncertain waits for checking.',
    routeEmphasis: 'Available now, next pressure, what changed.',
  },
  {
    defaultAction: 'sample',
    firstQuestion: 'Would you like to try fake data before using your own?',
    hiddenUntilNeeded: ['Timeline', 'Plans', 'Data and privacy', 'Internal test mode'],
    homeEmphasis: 'Show how Folio works safely with a pretend example.',
    id: 'guide_me',
    label: 'Guide me',
    meloTone: 'Brief, bounded, next-step oriented.',
    reviewEmphasis: 'Fake review rows are clearly not yours.',
    routeEmphasis: 'Example pressure without saving anything.',
  },
] as const;

export const guidedManualQuestions: readonly GuidedManualQuestion[] = [
  {
    context: 'Start with what you can see today.',
    estimateLabel: 'Rough estimate',
    id: 'money_now',
    inputLabel: 'Money available today',
    question: 'What money do you have right now?',
    skipLabel: 'Skip for now',
    why: 'A rough number is fine. You can correct it later.',
  },
  {
    context: 'Exact is helpful, rough is allowed.',
    estimateLabel: 'Use rough number',
    id: 'exactness',
    inputLabel: 'Exact or rough',
    question: 'Is that exact or a rough estimate?',
    skipLabel: 'Decide later',
    why: 'Estimates stay visible so you know what the picture is based on.',
  },
  {
    context: 'This helps show whether your money lasts.',
    estimateLabel: 'Estimate income',
    id: 'next_income',
    inputLabel: 'Next income amount and date',
    question: 'When is money coming in next?',
    skipLabel: 'No income to add',
    why: 'The date and amount show what improves the picture before things run tight.',
  },
  {
    context: 'This marks the payment that cannot wait.',
    estimateLabel: 'Estimate payment',
    id: 'must_pay',
    inputLabel: 'Bill or payment amount and date',
    question: 'What must be paid before then?',
    skipLabel: 'No payment to add',
    why: 'This shows what causes the drop before your next income.',
  },
] as const;

export const firstValueMoments = {
  addBankActivity: 'Rows found to check. Nothing has been added yet.',
  bills: 'Bills before income are visible together.',
  debt: 'Debt payments sit beside bills and income.',
  payday: 'You can see what has to last until payday.',
  unsure: 'Start with one thing: money available today.',
} as const;

export function lensById(id: ProductLensId): ProductLens {
  return productLenses.find((lens) => lens.id === id) ?? productLenses[0]!;
}
