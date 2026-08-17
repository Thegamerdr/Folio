// Folio shell types — the RN mirror of the web folio nav vocabulary.
//
// These names are a faithful 1:1 port of the web design source
// (folio-melo/src/components/folio/types.ts). The shell navigates by ScreenId, hosts one
// SheetId at a time, and threads a MeloIntent when a flow wants to open Melo with a prefill.
// Nothing here talks to the engine — it is pure nav vocabulary the shell composes.
//
// Why this lives here and not in the kit: the kit's BottomNav is typed against the
// pressure-map ProductScreen union (its tab ids are today / import / melo / more, where the
// "Review" tab carries the id `import`). The web design speaks ScreenId (where the same
// screen is `review`). The shell owns the small, explicit map between the two so the kit stays
// untouched and the web nav semantics are preserved exactly.
//
// Batch-1 union parity note (GAP_MAP.md NAV section): `today-mode`, `today-stability`,
// `paywall`, `account` and the sheet ids below were missing from these unions — added here
// (+ FolioShell's SCREEN_TITLE/SHEET_TITLE placeholder maps + MORE_SUBTREE) so batches 2/4/5/7
// have a union to build their real screens/sheets against instead of being blocked on a shared
// file. The screens/sheets themselves still render only the shell's placeholder body until the
// batch that owns them lands the real port.

// Every screen the current native shell can show. Keeping the runtime list beside the type lets
// navigation/coverage tests prove that every native route has an explicit home; a TypeScript union
// alone disappears at runtime and previously let newly added routes silently fall into More.
export const SCREEN_IDS = [
  'start',
  'first-answer',
  'guided',
  'intake',
  'pdf-success',
  'pdf-fallback',
  'image-success',
  'image-fallback',
  'paste-success',
  'visualizer',
  'review',
  'today',
  'today-mode',
  'today-stability',
  'today-after',
  'privacy',
  'decision-history',
  'melo',
  'melo-memory',
  'melo-moves',
  'more',
  'timeline',
  'calendar',
  'plans',
  'paywall',
  'whatif',
  'recovery',
  'add-bill',
  // NOTE: this is the recurring bill/debt-PAYMENT quick-add (AddEntryScreen kind="debt") — an
  // unrelated feature from the SheetId 'declare-debt' below (the real Debt-lens record with
  // APR/min-payment/due-day, ported from the web's SheetAddDebt). Do not conflate the two.
  'add-debt',
  'subs',
  'pots',
  'ritual',
  'insights',
  'shortfall',
  'account',
  'money-sources',
  'intake-history',
  'business-entity-setup',
  'business-money',
  'business-runway',
  'business-clients',
  'business-invoices',
  'business-obligations',
  'business-vat',
  'business-corp-tax',
  'business-payroll',
  'business-dividends',
  'business-dla',
  'business-companies-house',
  'business-filings',
  'business-filing-vat',
  'business-filing-sa',
  'business-filing-ct',
  'business-filing-cs',
  'business-filing-accounts',
  'business-filing-payroll',
  'business-insights',
  'business-deductions',
] as const;

export type ScreenId = (typeof SCREEN_IDS)[number];

// The single sheet the current native shell hosts at a time. `null` = no sheet.
export const SHEET_IDS = [
  'route-detail',
  'edit-txn',
  'edit-item',
  'melo-chat',
  'companion-touches',
  'share',
  'onboarding',
  'log-spend',
  'log-invoice',
  'log-payment',
  'add-plan',
  'declare-debt',
  'debt-schedule',
  'household-setup',
  'sub-caught',
  'income-caught',
  'bill-caught',
  'drift-caught',
  'annual-caught',
  'add-event',
  'calendar-export',
  'calendar-connect',
  'safe-zone',
  'worked-out-number',
  'shelf',
  'afford-check',
  'lens-picker',
  'chart-style',
  'hidden-review',
  'day-detail',
] as const;

export type SheetId = null | (typeof SHEET_IDS)[number];

// Carried when a flow opens Melo so the companion can start with a prefilled draft / seed.
export type MeloIntent = { prefill?: string; seed?: string };

// The payload a flow may carry when opening a sheet that needs a real subject. Today only the
// edit-txn sheet uses it: `id` is the posted transaction the user chose to correct, so the sheet
// edits THAT row (via the store's editTransaction) instead of a hardcoded demo subject. Mirrors the
// MeloIntent pattern — an optional slot the shell threads into the sheet that needs it. Absent /
// `undefined` = no target (cold open) → the sheet keeps its safe inert fallback.
// `date` is the day-detail sheet's subject — the ISO day (YYYY-MM-DD) a Month cell / "+N" chip /
// Week day header tap resolved, so day-detail opens showing THAT day instead of a hardcoded one.
// `addEventKind` / `addEventTitle` are the add-event sheet's deep-link prefill (mirrors the web
// SheetIntent) — a CTA like a low-visibility lens's "Add a bill" can open AddEventSheet pre-filled
// with kind="out"/title="Rent" instead of always starting cold.
export type SheetPayload = {
  id?: string;
  date?: string;
  /** Optional spend amount prefilled by an explicit preview-to-log action. */
  amount?: number;
  addEventKind?: 'in' | 'out' | 'review' | 'deadline';
  addEventTitle?: string;
  /** The consequential figure whose live inputs and arithmetic the explanation sheet shows. */
  workedNumber?: 'safe-range' | 'business-runway';
};

// The route pressure mood — the emotional weather of the money. Mirrors the web Pressure union.
export type Pressure = 'safe' | 'calm' | 'soft' | 'pressured' | 'overspent';

// The nav contract the shell exposes to screens (the RN mirror of the web Nav). The shell is an
// in-memory state machine; screens call these instead of touching state directly.
export type Nav = {
  go: (screen: ScreenId) => void;
  back: () => void;
  /** Opens the native workspace switcher. Personal exposes this from More; Business also
   *  keeps the persistent workspace rail defined by the frozen Business chrome. */
  openWorkspace?: () => void;
  // openSheet takes an optional payload for sheets that need a real subject. Only 'edit-txn' reads
  // it today (`{ id }` = the posted transaction to correct); every other caller passes the SheetId
  // alone, exactly as before. The slot is optional so existing callers are unchanged.
  openSheet: (sheet: SheetId, payload?: SheetPayload) => void;
  openMelo: (opts?: MeloIntent) => void;
  /** Override the app-wide money-pressure band — the mood that reshapes Today / What-if / Melo's tone.
   *  Pass a band to set it (the Melo mood picker calls this), or null to fall back to the band DERIVED
   *  from the real route. Held in the shell so a pick on the Melo tab actually propagates everywhere. */
  setPressure: (p: Pressure | null) => void;
};
