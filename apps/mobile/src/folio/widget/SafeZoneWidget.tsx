/**
 * SafeZoneWidget — the Android home-screen widget. The point of the whole app in one
 * glance: "how much can I safely spend, per day, until payday". Renders with
 * `react-native-android-widget`'s `FlexWidget`/`TextWidget` (RemoteViews under the
 * hood, not a real RN view tree — see the package README for the constraint that only
 * this library's widget primitives are usable here, no arbitrary RN components).
 *
 * Paper palette hex values, inlined (RemoteViews has no access to the app's
 * ThemeProvider/CSS-variable machinery — see kit.tsx's own note that the LIGHT palette
 * literal is the byte-stable source of truth):
 *   canvas #F6F4EE · ink (near-black warm) #211D17 · calm (terracotta accent) #DC5E33
 *
 * The Safe Zone figure must stand alone without Melo — home-screen real estate is
 * tiny and glanceable-first, so no mascot, no illustration, just the number, the
 * per-day pace, and a one-word weather read.
 *
 * Honesty: a fresh install (or a store that has never had a real balance set) shows
 * "Open Folio to set up" rather than a fabricated £0 — the same rule the in-app
 * empty states follow (never claim something works when it's stubbed / unset).
 */
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import type { SafeZoneWidgetSnapshot } from '@/folio/lib/widgetSnapshot';
import type { MeloWeather } from '@/folio/lib/modes';

const CANVAS = '#F6F4EE';
const INK = '#211D17';
const MUTED = '#78716A';
const CALM = '#DC5E33';

/** Same weather vocabulary MeloWeatherGlyph draws as a horizon-strip icon — the
 *  widget has no room for the SVG glyph, so it renders the honest word instead. */
const WEATHER_WORD: Record<MeloWeather, string> = {
  sunny: 'Sunny',
  cloudy: 'Cloudy',
  rainy: 'Rainy',
  storm: 'Stormy',
  rainbow: 'Clearing up',
  night: 'Quiet tonight',
  alarm: 'Needs attention',
  fog: 'Hard to tell',
};

function formatGBP(pence: number): string {
  const sign = pence < 0 ? '−' : '';
  const pounds = Math.round(Math.abs(pence) / 100);
  return `${sign}£${pounds.toLocaleString('en-GB')}`;
}

function formatDayShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-GB', { weekday: 'short' });
}

export type SafeZoneWidgetProps = {
  snapshot: SafeZoneWidgetSnapshot | null;
};

export function SafeZoneWidget({ snapshot }: SafeZoneWidgetProps) {
  if (snapshot === null || snapshot.isSample) {
    return (
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          backgroundColor: CANVAS,
          borderRadius: 20,
          padding: 16,
          justifyContent: 'center',
          alignItems: 'center',
        }}
        clickAction="OPEN_APP"
      >
        <TextWidget
          text="Open Folio to set up"
          style={{ fontSize: 14, color: INK, textAlign: 'center', fontWeight: '600' }}
        />
      </FlexWidget>
    );
  }

  const safeZoneLabel = `${formatGBP(snapshot.safeZonePence)} safe`;
  const perDayLabel =
    snapshot.paydayISO !== null
      ? `${formatGBP(snapshot.perDayPence)}/day until ${formatDayShort(snapshot.paydayISO)}`
      : `${formatGBP(snapshot.perDayPence)}/day`;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: CANVAS,
        borderRadius: 20,
        padding: 16,
        flexDirection: 'column',
        justifyContent: 'center',
      }}
      clickAction="OPEN_APP"
    >
      <TextWidget
        text={safeZoneLabel}
        style={{
          fontSize: 26,
          fontWeight: '700',
          color: INK,
          textAlign: 'left',
        }}
        truncate="END"
        maxLines={1}
      />
      <FlexWidget style={{ height: 4, width: 'match_parent' }} />
      <TextWidget
        text={perDayLabel}
        style={{ fontSize: 13, color: MUTED, textAlign: 'left' }}
        truncate="END"
        maxLines={1}
      />
      <FlexWidget style={{ height: 6, width: 'match_parent' }} />
      <TextWidget
        text={WEATHER_WORD[snapshot.weather]}
        style={{ fontSize: 11, color: CALM, textAlign: 'left', fontWeight: '600' }}
        truncate="END"
        maxLines={1}
      />
    </FlexWidget>
  );
}
