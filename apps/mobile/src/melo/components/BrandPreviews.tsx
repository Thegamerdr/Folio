// Brand previews (§9 native trio — parked): the widget and app icon can't ship as real native
// artifacts yet (LongPathsEnabled still 0 on this box), so these are quiet, honest JS mocks —
// labeled plainly as previews, not the real thing. Nothing here pretends to be more finished
// than it is.

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Muted, useTheme } from '@/surfaces/pressureMap/kit';

const ICON_VARIANTS = [
  { id: 'cream', bg: '#F6EFE4', glyph: '#C8724A' },
  { id: 'ember', bg: '#C8724A', glyph: '#F6EFE4' },
  { id: 'charcoal', bg: '#2A2622', glyph: '#E8A47A' },
] as const;

function EmberHeartGlyph({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20.5c-.3 0-.6-.1-.8-.3C7 16.7 3.5 13.4 3.5 9.6 3.5 6.9 5.6 4.8 8.2 4.8c1.5 0 2.9.7 3.8 1.9.9-1.2 2.3-1.9 3.8-1.9 2.6 0 4.7 2.1 4.7 4.8 0 3.8-3.5 7.1-7.7 10.6-.2.2-.5.3-.8.3Z"
        fill={color}
      />
    </Svg>
  );
}

export function WidgetPreviewCard() {
  const t = useTheme();
  return (
    <View>
      <View style={[s.widgetCard, { backgroundColor: t.canvas, borderColor: t.hairline }]}>
        <View style={s.widgetTop}>
          <View style={[s.emberDot, { backgroundColor: t.calmStrong }]} />
          <Text style={[s.widgetWeather, { color: t.muted }]}>calm skies</Text>
        </View>
        <Text style={[s.widgetAmount, { color: t.ink }]}>£24.50</Text>
        <Text style={[s.widgetSub, { color: t.muted }]}>today, comfortably</Text>
      </View>
      <Muted style={s.caption}>Widget — arrives with the native build</Muted>
    </View>
  );
}

export function AppIconPreview() {
  const t = useTheme();
  return (
    <View>
      <View style={s.iconRow}>
        {ICON_VARIANTS.map((variant) => (
          <View
            key={variant.id}
            style={[s.iconTile, { backgroundColor: variant.bg, borderColor: t.hairline }]}
          >
            <EmberHeartGlyph color={variant.glyph} size={28} />
          </View>
        ))}
      </View>
      <Muted style={s.caption}>App icon directions</Muted>
    </View>
  );
}

const s = StyleSheet.create({
  widgetCard: {
    width: 168,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  widgetTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  emberDot: { width: 8, height: 8, borderRadius: 999 },
  widgetWeather: { fontSize: 11.5 },
  widgetAmount: { fontSize: 26, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: 4 },
  widgetSub: { fontSize: 12 },
  iconRow: { flexDirection: 'row', gap: 14 },
  iconTile: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: { marginTop: 10, fontSize: 12 },
});
