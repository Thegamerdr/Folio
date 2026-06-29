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

// The route pressure mood — the emotional weather of the money. Mirrors the web Pressure union.
export type Pressure = 'safe' | 'calm' | 'soft' | 'pressured' | 'overspent';

// The nav contract the shell exposes to screens (the RN mirror of the web Nav). The shell is an
// in-memory state machine; screens call these instead of touching state directly.
export type Nav = {
  go: (screen: ScreenId) => void;
  back: () => void;
  openSheet: (sheet: SheetId) => void;
  openMelo: (opts?: MeloIntent) => void;
};
