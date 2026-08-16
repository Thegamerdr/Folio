import { setChartStyle, useAppStore, type ChartStyle } from '../store';

export type { ChartStyle } from '../store';

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

export function useChartStyle(): { style: ChartStyle; set: (next: ChartStyle) => void } {
  const style = useAppStore((state) => state.chartStyle ?? 'curve');
  return { style, set: setChartStyle };
}
