import {
  buildFirstMinuteBriefing,
  buildSampleBriefing,
  validateMeloRenderableOutput,
} from '@folio/melo-policy';

export type FirstMinuteActionId = 'import_statement' | 'add_what_i_know' | 'sample_briefing';

export type FirstMinuteAction = Readonly<{
  id: FirstMinuteActionId;
  label: string;
  detail: string;
  hint: string;
}>;

export type SampleBriefingCard = Readonly<{
  title: string;
  value: string;
  tone: 'confirmed' | 'estimated' | 'attention';
}>;

export type ImportReviewActionId =
  | 'accept'
  | 'edit'
  | 'reject'
  | 'mark_duplicate'
  | 'income'
  | 'bill'
  | 'debt_payment'
  | 'refund'
  | 'later'
  | 'wrong_workspace'
  | 'not_mine'
  | 'parser_error'
  | 'transfer';

export type ImportReviewActionCopy = Readonly<{
  id: ImportReviewActionId;
  label: string;
  consequence: string;
}>;

export const firstMinutePrimaryMessage =
  'Folio helps you understand where you stand, what changed, and what happens next.';

export const firstMinuteActions: readonly FirstMinuteAction[] = [
  {
    id: 'import_statement',
    label: 'Use a bank statement',
    detail: 'Find what to check before anything is added',
    hint: 'Opens Review. Nothing changes your picture until you add it.',
  },
  {
    id: 'add_what_i_know',
    label: 'Add a few numbers',
    detail: 'Use money now, next income and one payment',
    hint: 'Creates a first picture from three values.',
  },
  {
    id: 'sample_briefing',
    label: 'Try fake data',
    detail: 'See the app with a pretend example',
    hint: 'Opens an example-only briefing. Nothing is saved.',
  },
];

export const firstMinuteMeloBriefing = buildFirstMinuteBriefing({
  primaryMessage: firstMinutePrimaryMessage,
  choices: firstMinuteActions.map((action) => action.label),
  dataControlAvailable: true,
});

export const sampleBriefingMelo = buildSampleBriefing({
  whatChanged: 'income arrived and one everyday spend changed the picture',
  comingUp: 'rent and one import review are visible',
  remainsProtected: 'rent stays separated from flexible spending',
  needsReview: 'one imported payment is held out until you decide',
});

export const sampleBriefingCards: readonly SampleBriefingCard[] = [
  {
    title: 'What changed',
    value: 'Income arrived and the visible picture changed.',
    tone: 'confirmed',
  },
  {
    title: 'Coming up',
    value: 'Rent is next and remains visible before spending decisions.',
    tone: 'estimated',
  },
  {
    title: 'Still protected',
    value: 'Rent stays separated from flexible spending.',
    tone: 'confirmed',
  },
  {
    title: 'Needs review',
    value: 'One imported payment waits for you to decide.',
    tone: 'attention',
  },
];

export const importEntryTrustCopy = [
  'Everything waits for review before it is added.',
  'Nothing changes your picture until you add it.',
] as const;

export const importReviewActionCopy: readonly ImportReviewActionCopy[] = [
  {
    id: 'accept',
    label: 'Add',
    consequence: 'Adds this payment to your money view with the original wording attached.',
  },
  {
    id: 'edit',
    label: 'Edit',
    consequence:
      'Preserves the original wording, stores your correction and still waits for acceptance.',
  },
  {
    id: 'reject',
    label: 'Ignore',
    consequence:
      'Keeps this one out of your money view and leaves Today, Timeline and Plans unchanged.',
  },
  {
    id: 'mark_duplicate',
    label: 'Duplicate',
    consequence: 'Remembers the duplicate evidence so a future import can flag it for review.',
  },
  {
    id: 'income',
    label: 'Income',
    consequence: 'Marks it as money coming in, still waiting for you to add it.',
  },
  {
    id: 'bill',
    label: 'Bill',
    consequence: 'Marks it as a must-pay item, still waiting for you to add it.',
  },
  {
    id: 'debt_payment',
    label: 'Debt payment',
    consequence: 'Marks it as a debt payment without blame or telling you what to do.',
  },
  {
    id: 'refund',
    label: 'Refund',
    consequence: 'Marks it as money returned, still waiting for you to add it.',
  },
  {
    id: 'later',
    label: 'Later',
    consequence: 'Leaves this one waiting and changes nothing in your picture.',
  },
  {
    id: 'wrong_workspace',
    label: 'Wrong workspace',
    consequence: 'Keeps it out of this personal workspace as non-financial evidence.',
  },
  {
    id: 'not_mine',
    label: 'Not mine',
    consequence: 'Retains the original wording without adding it to your money view.',
  },
  {
    id: 'parser_error',
    label: 'Read wrong',
    consequence: 'Keeps it waiting when the wording or amount needs fixing.',
  },
  {
    id: 'transfer',
    label: 'Transfer',
    consequence: 'Excludes the movement from spending while keeping the original wording visible.',
  },
] as const;

export const quickEstimateEnoughCopy =
  'This is enough for a first picture. You can add more later.';

export const dataControlTrustCopy = [
  'Your data can stay local to this device.',
  'Anything waiting for review is a question, not saved money.',
  'What you added, what you rejected and your history all stay easy to look through.',
  'You can export or clear local data here.',
  'Cloud, AI, Open Banking and Business mode are not required to use Folio.',
] as const;

export function productExperienceCopyIsPolicySafe(): boolean {
  return [
    firstMinuteMeloBriefing.summary,
    sampleBriefingMelo.summary,
    ...sampleBriefingCards.map((card) => `${card.title}: ${card.value}`),
    ...importEntryTrustCopy,
    ...importReviewActionCopy.map((action) => `${action.label}: ${action.consequence}`),
    quickEstimateEnoughCopy,
    ...dataControlTrustCopy,
  ].every((copy) => validateMeloRenderableOutput(copy).renderable);
}
