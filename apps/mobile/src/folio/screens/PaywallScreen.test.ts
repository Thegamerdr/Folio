import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'PaywallScreen.tsx'),
  'utf8',
);

describe('PaywallScreen live Lovable tier contract', () => {
  it('renders only Free, Plus and Pro through the typed copy deck', () => {
    expect(source).toContain("(['free', 'plus', 'pro'] as const)");
    expect(source).toContain('copy.plans.tier.free.price');
    expect(source).toContain('copy.plans.tier.plus.price');
    expect(source).toContain('copy.plans.tier.pro.price');
    expect(source).not.toMatch(/\bMelo (?:Full|Live)\b/);
  });

  it('uses the central suppression guard and never-paywall promise', () => {
    expect(source).toContain('canShowUpsell(guardInputs)');
    expect(source).toContain('upsellSuppressionReason(guardInputs)');
    expect(source).toContain('copy.plans.promise.ownership');
    expect(source).toContain('copy.plans.promise.safety');
  });

  it('wires monthly/yearly purchases and signed entitlement restore', () => {
    expect(source).toContain("(['monthly', 'yearly'] as const)");
    expect(source).toContain('verifyGooglePurchase');
    expect(source).toContain('saveVerifiedEntitlement');
    expect(source).toContain('restorePurchases');
    expect(source).toContain("ctaMode === 'purchase'");
  });

  it('keeps the live Lovable tier detail, comparison and affordability surfaces', () => {
    expect(source).toContain('tierBullets(tier)');
    expect(source).toContain('LIVE_BULLETS[tier]');
    expect(source).toContain('copy.plans.compare.rows[index]');
    expect(source).toContain('copy.plans.affordability.spare');
    expect(source).toContain('copy.plans.affordability.tight');
  });
});
