import type { Sub } from '../store';

/** Names that describe protected household obligations, not optional subscriptions. */
const PROTECTED_SUBSCRIPTION_TERMS = [
  'rent',
  'mortgage',
  'housing',
  'utility',
  'utilities',
  'council tax',
  'childcare',
  'child care',
  'energy',
  'electric',
  'gas',
  'water',
  'insurance',
  'essential',
  'priority',
  'bill',
  'transport',
  'travel',
  'phone',
  'mobile',
  'child maintenance',
  'maintenance',
  'tax',
  'loan',
];

const OPTIONAL_SUBSCRIPTION_TERMS = [
  'entertainment',
  'streaming',
  'netflix',
  'spotify',
  'disney',
  'prime video',
  'youtube',
  'audible',
  'music',
  'gaming',
  'game',
  'playstation',
  'xbox',
  'nintendo',
  'cinema',
  'gym',
];

/** Automatic cut-waste/recovery suggestions require an explicit optional-service signal. */
export function isDiscretionarySubscription(subscription: Pick<Sub, 'name'>): boolean {
  const name = subscription.name.trim().toLocaleLowerCase();
  if (name.length === 0 || PROTECTED_SUBSCRIPTION_TERMS.some((term) => name.includes(term)))
    return false;
  return OPTIONAL_SUBSCRIPTION_TERMS.some((term) => name.includes(term));
}
