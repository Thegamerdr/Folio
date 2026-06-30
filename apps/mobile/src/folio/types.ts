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

// Every screen the shell can show. Mirrors the web ScreenId union, name-for-name.
export type ScreenId =
  | 'start'
  | 'guided'
  | 'intake'
  | 'pdf-success'
  | 'pdf-fallback'
  | 'image-success'
  | 'image-fallback'
  | 'paste-success'
  | 'visualizer'
  | 'review'
  | 'today'
  | 'today-after'
  | 'privacy'
  | 'melo'
  | 'more'
  | 'timeline'
  | 'calendar'
  | 'plans'
  | 'whatif'
  | 'recovery'
  | 'add-bill'
  | 'add-debt'
  | 'subs'
  | 'pots'
  | 'ritual'
  | 'insights'
  | 'shortfall';

// The single sheet the shell hosts at a time. `null` = no sheet. Mirrors the web SheetId union.
export type SheetId =
  | null
  | 'route-detail'
  | 'edit-txn'
  | 'edit-item'
  | 'melo-chat'
  | 'share'
  | 'onboarding'
  | 'log-spend'
  | 'sub-caught'
  | 'add-event'
  | 'calendar-export'
  | 'calendar-connect';

// Carried when a flow opens Melo so the companion can start with a prefilled draft / seed.
export type MeloIntent = { prefill?: string; seed?: string };

// The payload a flow may carry when opening a sheet that needs a real subject. Today only the
// edit-txn sheet uses it: `id` is the posted transaction the user chose to correct, so the sheet
// edits THAT row (via the store's editTransaction) instead of a hardcoded demo subject. Mirrors the
// MeloIntent pattern — an optional slot the shell threads into the sheet that needs it. Absent /
// `undefined` = no target (cold open) → the sheet keeps its safe inert fallback.
export type SheetPayload = { id?: string };

// The route pressure mood — the emotional weather of the money. Mirrors the web Pressure union.
export type Pressure = 'safe' | 'calm' | 'soft' | 'pressured' | 'overspent';

// The nav contract the shell exposes to screens (the RN mirror of the web Nav). The shell is an
// in-memory state machine; screens call these instead of touching state directly.
export type Nav = {
  go: (screen: ScreenId) => void;
  back: () => void;
  // openSheet takes an optional payload for sheets that need a real subject. Only 'edit-txn' reads
  // it today (`{ id }` = the posted transaction to correct); every other caller passes the SheetId
  // alone, exactly as before. The slot is optional so existing callers are unchanged.
  openSheet: (sheet: SheetId, payload?: SheetPayload) => void;
  openMelo: (opts?: MeloIntent) => void;
};
