/**
 * @rn-lib       headerFraming
 * @purpose      Maps each money mode to the short "Today" header line shown next to the
 *               date. Several mode VOICE contracts explicitly ban payday-days framing
 *               (irregular.ts: "Speak in runway (weeks covered), not days-to-payday";
 *               growth.ts: "Speak in months and cadence, not days"; lowVis.ts: "Never
 *               state numbers as fact"), yet the shared TodayModeScreen chrome used to
 *               render "{daysToPayday} days to payday →" unconditionally for all 10
 *               modes. This is the one place that reframes the header per mode so the
 *               chrome stops contradicting the mode's own voice (Plan 108, D2 reframe).
 * @copy         COPY_LINT clean. Every line ends in "→" — the header Pressable still
 *               routes to 'ritual' regardless of mode (the ritual itself is
 *               payday-anchored, that's correct; only the LABEL was the violation).
 * @notes        Payday-days framing survives only where payday genuinely is the mode's
 *               anchor: debt and reset. survival and stability are included here for
 *               totality/exhaustiveness — TodayModeScreen never routes those two modes
 *               through this map (they render their own headers in TodayScreen.tsx /
 *               TodayStabilityScreen.tsx, both intentionally out of scope for this map).
 */
import type { MoneyMode } from './types';

const HEADER_LINE: Record<MoneyMode, (daysToPayday: number) => string> = {
  survival: (days) => `${days} days to payday →`,
  stability: (days) => `${days} days to payday →`,
  debt: (days) => `${days} days to payday →`,
  reset: (days) => `${days} days to payday →`,
  growth: () => 'This month →',
  optimizer: () => 'This month →',
  planning: () => 'This month →',
  household: () => 'This month →',
  irregular: () => 'Your runway →',
  lowVis: () => 'Getting a picture →',
};

export function headerLineFor(mode: MoneyMode, daysToPayday: number): string {
  return HEADER_LINE[mode](daysToPayday);
}
