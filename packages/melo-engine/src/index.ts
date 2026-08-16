export {
  meloEngineBoundary,
  assertPence,
  toEpochDay,
  daysBetween,
  addDays,
  floorToPounds,
  formatPounds,
  type Pence,
  type ISODate,
} from './core.js';

export {
  billsInCycle,
  computeSafeZone,
  checkAfford,
  type Bill,
  type BillKind,
  type SafeZoneInputs,
  type SafeZoneResult,
  type BreakdownRow,
  type AffordVerdict,
  type AffordResult,
} from './safeZone.js';

export {
  projectDangerDate,
  runwayDays,
  type DangerInputs,
  type DangerProjection,
} from './dangerDate.js';

export {
  resolveState,
  computeRawLadder,
  LADDER_SEVERITY,
  type LadderState,
  type JourneyState,
  type DataState,
  type Overlay,
  type Weather,
  type MascotFamily,
  type MascotEmotion,
  type StateInputs,
  type MeloStateRecord,
  type StateView,
  type ResolveOptions,
} from './states.js';

export {
  COPY,
  SAMPLE_CONTEXT,
  BANNED_PATTERNS,
  lintCopy,
  type CopyContext,
  type CopyKey,
  type BannedPattern,
} from './copy.js';

export {
  planNotification,
  inQuietHours,
  type NotificationKey,
  type PlannedNotification,
  type NotifyContext,
  type NotifyInputs,
} from './notify.js';

export {
  observedRunRatePence,
  shiftWeekendToFriday,
  dayOfWeek,
  recoveryMovePence,
  type SpendEntry,
} from './spend.js';

export { detectWins, WIN_LINES, type WinId, type WinEvent, type WinSnapshot } from './wins.js';

export {
  parseStatementCSV,
  type StatementRow,
  type DetectedBill,
  type RecentSpend,
  type StatementParse,
} from './statement.js';

export {
  buildWeekReview,
  type ReviewBill,
  type WeekWin,
  type WeekReviewInputs,
  type WeekReview,
} from './review.js';

export { pickSmartMove, type SmartMove, type SmartMoveInputs } from './smartMoves.js';

export {
  deriveCycleState,
  closeCycle,
  type CycleRecord,
  type CycleInputs,
  type CycleDerived,
} from './cycles.js';

export { assessUnsafe, type UnsafeInputs, type UnsafeOption, type UnsafeState } from './unsafe.js';

export { buildChatContext, type ChatContextInputs } from './chatContext.js';

export { assessAffordImpact, type AffordImpact, type AffordImpactInputs } from './affordImpact.js';

export {
  diffChanges,
  type WhatChangedItem,
  type WhatChangedSnapshot,
  type WhatChangedContext,
} from './whatChanged.js';

export {
  pickNextBestAction,
  type NextBestAction,
  type NextBestActionId,
  type NextBestActionInputs,
} from './nextBestAction.js';

export {
  buildCalendarRows,
  type CalendarRow,
  type CalendarRowKind,
  type CalendarBill,
  type CalendarRowsInputs,
} from './calendarRows.js';

export {
  resolveMoneyMode,
  MODE_LABELS,
  type MoneyMode,
  type MoneyModeInputs,
} from './moneyMode.js';
