import type { MeloWeather } from '../../ui/MeloWeatherGlyph';

type Tint = Readonly<{ red: number; green: number; blue: number; alpha: number }>;

const TINTS: Readonly<Record<MeloWeather, Tint>> = {
  sunny: { red: 224, green: 176, blue: 85, alpha: 0.06 },
  cloudy: { red: 139, green: 143, blue: 166, alpha: 0.05 },
  rainy: { red: 120, green: 138, blue: 176, alpha: 0.07 },
  storm: { red: 176, green: 96, blue: 84, alpha: 0.08 },
  rainbow: { red: 146, green: 176, blue: 168, alpha: 0.05 },
  night: { red: 45, green: 42, blue: 58, alpha: 0.06 },
  alarm: { red: 176, green: 96, blue: 84, alpha: 0.09 },
  fog: { red: 180, green: 180, blue: 190, alpha: 0.07 },
  windy: { red: 158, green: 189, blue: 176, alpha: 0.05 },
  heatwave: { red: 224, green: 148, blue: 85, alpha: 0.06 },
  freeze: { red: 170, green: 190, blue: 200, alpha: 0.05 },
};

/** Composite the live weather tint into the canvas itself, never into text, numbers, or Melo art. */
export function weatherTintCanvas(
  canvas: string,
  weather: MeloWeather,
  options: Readonly<{ quiet?: boolean; intensity?: number }> = {},
): string {
  if (options.quiet) return canvas;
  const base = parseHex(canvas);
  if (base === null) return canvas;
  const tint = TINTS[weather] ?? TINTS.cloudy;
  const alpha = tint.alpha * clamp(options.intensity ?? 1);
  const channel = (background: number, foreground: number) =>
    Math.round(background * (1 - alpha) + foreground * alpha);
  return `rgb(${channel(base.red, tint.red)}, ${channel(base.green, tint.green)}, ${channel(
    base.blue,
    tint.blue,
  )})`;
}

function parseHex(value: string): { red: number; green: number; blue: number } | null {
  const hex = value.trim().replace(/^#/, '');
  const expanded =
    hex.length === 3
      ? hex
          .split('')
          .map((part) => `${part}${part}`)
          .join('')
      : hex;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return null;
  return {
    red: Number.parseInt(expanded.slice(0, 2), 16),
    green: Number.parseInt(expanded.slice(2, 4), 16),
    blue: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
