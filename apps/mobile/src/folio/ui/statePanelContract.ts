import type { ProductIconName } from './ProductIcon';

export const PRODUCT_STATE_KINDS = [
  'first-time-empty',
  'genuine-empty',
  'loading',
  'error',
  'offline',
  'locked',
  'unconfirmed',
  'conflict',
  'permission-denied',
  'consent-expired',
  'queued',
  'success',
  'archived',
] as const;

export type ProductStateKind = (typeof PRODUCT_STATE_KINDS)[number];

export function stateVisual(kind: ProductStateKind): Readonly<{
  icon: ProductIconName;
  tone: 'neutral' | 'warm' | 'repair' | 'positive';
}> {
  if (kind === 'error' || kind === 'conflict') return { icon: 'warning', tone: 'repair' };
  if (kind === 'offline') return { icon: 'offline', tone: 'warm' };
  if (kind === 'locked' || kind === 'permission-denied' || kind === 'consent-expired') {
    return { icon: 'locked', tone: 'warm' };
  }
  if (kind === 'queued' || kind === 'loading') return { icon: 'queued', tone: 'neutral' };
  if (kind === 'success') return { icon: 'success', tone: 'positive' };
  if (kind === 'archived') return { icon: 'restore', tone: 'neutral' };
  if (kind === 'unconfirmed') return { icon: 'info', tone: 'warm' };
  return { icon: 'info', tone: 'neutral' };
}
