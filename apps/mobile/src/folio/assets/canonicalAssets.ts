/**
 * Static Metro registry for every binary in the frozen 42-entry asset manifest.
 * Keep literal require calls: dynamic asset paths are not bundled by Metro.
 */
export const CANONICAL_ASSETS = {
  'favicon-dark.png': require('../../../assets/canonical/favicon-dark.png'),
  'favicon-maskable.png': require('../../../assets/canonical/favicon-maskable.png'),
  'favicon.png': require('../../../assets/canonical/favicon.png'),
  'frames/postcard-frame.png': require('../../../assets/canonical/frames/postcard-frame.png'),
  'melo-hero.png': require('../../../assets/canonical/melo-hero.png'),
  'melo/phoenix-asleep.png': require('../../../assets/canonical/melo/phoenix-asleep.png'),
  'melo/phoenix-celebrate.png': require('../../../assets/canonical/melo/phoenix-celebrate.png'),
  'melo/phoenix-cheer-alt.png': require('../../../assets/canonical/melo/phoenix-cheer-alt.png'),
  'melo/phoenix-cheer.png': require('../../../assets/canonical/melo/phoenix-cheer.png'),
  'melo/phoenix-concern.png': require('../../../assets/canonical/melo/phoenix-concern.png'),
  'melo/phoenix-curious-alt.png': require('../../../assets/canonical/melo/phoenix-curious-alt.png'),
  'melo/phoenix-curious.png': require('../../../assets/canonical/melo/phoenix-curious.png'),
  'melo/phoenix-empty-state.png': require('../../../assets/canonical/melo/phoenix-empty-state.png'),
  'melo/phoenix-hero-beanie.png': require('../../../assets/canonical/melo/phoenix-hero-beanie.png'),
  'melo/phoenix-hero-crown.png': require('../../../assets/canonical/melo/phoenix-hero-crown.png'),
  'melo/phoenix-hero-headphones.png': require('../../../assets/canonical/melo/phoenix-hero-headphones.png'),
  'melo/phoenix-hero-scarf.png': require('../../../assets/canonical/melo/phoenix-hero-scarf.png'),
  'melo/phoenix-hero-spectacles.png': require('../../../assets/canonical/melo/phoenix-hero-spectacles.png'),
  'melo/phoenix-hero.png': require('../../../assets/canonical/melo/phoenix-hero.png'),
  'melo/phoenix-icon.png': require('../../../assets/canonical/melo/phoenix-icon.png'),
  'melo/phoenix-protect.png': require('../../../assets/canonical/melo/phoenix-protect.png'),
  'melo/phoenix-think.png': require('../../../assets/canonical/melo/phoenix-think.png'),
  'og-brand.png': require('../../../assets/canonical/og-brand.png'),
  'og-image.png': require('../../../assets/canonical/og-image.png'),
  'splash.png': require('../../../assets/canonical/splash.png'),
  'stamps/stamp-ablaze-crown.png': require('../../../assets/canonical/stamps/stamp-ablaze-crown.png'),
  'stamps/stamp-ash-carry.png': require('../../../assets/canonical/stamps/stamp-ash-carry.png'),
  'stamps/stamp-ct-filed.png': require('../../../assets/canonical/stamps/stamp-ct-filed.png'),
  'stamps/stamp-date-moved.png': require('../../../assets/canonical/stamps/stamp-date-moved.png'),
  'stamps/stamp-entity-setup.png': require('../../../assets/canonical/stamps/stamp-entity-setup.png'),
  'stamps/stamp-first-green.png': require('../../../assets/canonical/stamps/stamp-first-green.png'),
  'stamps/stamp-first-pot.png': require('../../../assets/canonical/stamps/stamp-first-pot.png'),
  'stamps/stamp-invoice-paid.png': require('../../../assets/canonical/stamps/stamp-invoice-paid.png'),
  'stamps/stamp-invoice-sent.png': require('../../../assets/canonical/stamps/stamp-invoice-sent.png'),
  'stamps/stamp-postcard-sent.png': require('../../../assets/canonical/stamps/stamp-postcard-sent.png'),
  'stamps/stamp-rebirth-ember.png': require('../../../assets/canonical/stamps/stamp-rebirth-ember.png'),
  'stamps/stamp-runway-30.png': require('../../../assets/canonical/stamps/stamp-runway-30.png'),
  'stamps/stamp-streak.png': require('../../../assets/canonical/stamps/stamp-streak.png'),
  'stamps/stamp-sub-cancelled.png': require('../../../assets/canonical/stamps/stamp-sub-cancelled.png'),
  'stamps/stamp-tax-filing.png': require('../../../assets/canonical/stamps/stamp-tax-filing.png'),
  'stamps/stamp-vat-filed.png': require('../../../assets/canonical/stamps/stamp-vat-filed.png'),
  'wax-seal.png': require('../../../assets/canonical/wax-seal.png'),
} as const;

export type CanonicalAssetKey = keyof typeof CANONICAL_ASSETS;

export const CANONICAL_ASSET_COUNT = Object.keys(CANONICAL_ASSETS).length;
