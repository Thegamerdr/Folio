// Chart style preference — the faithful 1:1 RN port of the web's lib/settings/chartStyle.ts.
//
// One user choice that reshapes the money-path visual across every Today lens: three honest
// options (curve / bars / minimal), read by LensProgress and LensRhythm so every chart primitive
// shares the same visual grammar as the money-path chart on Today.
//
// FIDELITY DECISION: the web's `useChartStyle()` reads `useAppStore((s) => s.chartStyle)` and
// writes via `setChartStyle`. Confirmed: apps/mobile/src/folio/store.ts has no `chartStyle` field
// and no `setChartStyle` export (grepped before writing this file). Per RN_PORT.md's loop
// discipline ("no new engines slipped in silently"), this port does NOT add a field to the real
// store. `useChartStyle()` here is a LOCAL-ONLY React state hook (defaults to 'curve', the
// Survival-default look) — it satisfies every caller's shape (`{ style, set }`) but does not
// persist across app restarts and is not shared across component trees. Reported as a
// wiringNeeds dependency: promote this to a real `chartStyle` store field (+ persistence) once
// the store is ready to own it.

import { useState } from 'react';

export type ChartStyle = 'curve' | 'bars' | 'minimal';

export const CHART_STYLES: ChartStyle[] = ['curve', 'bars', 'minimal'];

export const CHART_STYLE_LABEL: Record<ChartStyle, string> = {
  curve: 'Curve',
  bars: 'Bars',
  minimal: 'Minimal',
};

export const CHART_STYLE_HINT: Record<ChartStyle, string> = {
  curve: 'smooth path — the shape of the month',
  bars: 'weekly rhythm — one bar per week',
  minimal: 'quiet dots — just the moments that matter',
};

const DEFAULT_CHART_STYLE: ChartStyle = 'curve';

export function useChartStyle(): { style: ChartStyle; set: (next: ChartStyle) => void } {
  const [style, setStyle] = useState<ChartStyle>(DEFAULT_CHART_STYLE);
  return { style, set: setStyle };
}
