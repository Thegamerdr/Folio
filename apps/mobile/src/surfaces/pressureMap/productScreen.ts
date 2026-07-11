// Re-homed from mobileShell.tsx (dead Gen-1 surface, deleted in plan 112 stage 1).
// ProductScreen is a type-only edge consumed by kit.tsx and FolioShell.tsx.
export type ProductScreen =
  | 'start'
  | 'today'
  | 'timeline'
  | 'calendar'
  | 'plans'
  | 'melo'
  | 'money'
  | 'import'
  | 'recovery'
  | 'more'
  | 'dogfood'
  | 'data'
  // New pressure-map surfaces (Stage 4) — reached from More / the cycle flows, not core tabs.
  | 'pots'
  | 'subscriptions'
  | 'insights'
  | 'ritual'
  // WIRE-phase transient/modal states — reached from Today (shortfall / after) or More (what if),
  // never as core tabs. They keep the bottom nav (it lights the nearest tab) and carry their own
  // header, so they are chromeless like the other map surfaces.
  | 'shortfall'
  | 'whatif'
  | 'todayAfter';
