// Money Mode selector (MELO_BLUEPRINT.md — mode-aware surfaces): a chip grid letting the user
// override the engine's auto-read of their situation. Auto stays the honest default — the chip
// shows what Melo currently reads without the user having to know the taxonomy. household + debt
// are flagged 'early' inline: the mode exists so the right words show up, but the deeper tracking
// for those two isn't built yet — an honest placeholder, not a locked feature. MODE_ORDER is a
// deliberate display order over MODE_LABELS (all ten modes) — keep it in sync whenever a mode is
// added to the engine; MoneyMode is the single source of truth for which modes exist.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type MoneyMode, MODE_LABELS } from '@folio/melo-engine';
import { Muted, useTheme } from '@/surfaces/pressureMap/kit';

type Props = {
  value: MoneyMode | null;
  onChange: (m: MoneyMode | null) => void;
  autoResolved: MoneyMode;
};

const EARLY_MODES: readonly MoneyMode[] = ['household', 'debt'];

const MODE_ORDER: readonly MoneyMode[] = [
  'survival',
  'stability',
  'growth',
  'debt',
  'irregular',
  'household',
  'planning',
  'optimizer',
  'reset',
  'lowVisibility',
];

export function MoneyModeSelector({ value, onChange, autoResolved }: Props) {
  const t = useTheme();
  const activeMode = value ?? autoResolved;
  const activeLine = MODE_LABELS[activeMode]?.line ?? '';

  return (
    <View>
      <View style={s.chipsWrap}>
        <Pressable
          onPress={() => onChange(null)}
          accessibilityRole="button"
          accessibilityState={{ selected: value === null }}
          style={[
            s.chip,
            {
              borderColor: value === null ? t.calm : t.hairline,
              backgroundColor: value === null ? t.calmSoft : t.inset,
            },
          ]}
        >
          <Text style={[s.chipLabel, { color: t.ink }]}>
            auto — Melo reads the numbers ({MODE_LABELS[autoResolved]?.name ?? autoResolved})
          </Text>
        </Pressable>

        {MODE_ORDER.map((mode) => {
          const selected = value === mode;
          const label = MODE_LABELS[mode];
          if (!label) return null;
          return (
            <Pressable
              key={mode}
              onPress={() => onChange(mode)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                s.chip,
                {
                  borderColor: selected ? t.calm : t.hairline,
                  backgroundColor: selected ? t.calmSoft : t.inset,
                },
              ]}
            >
              <Text style={[s.chipLabel, { color: t.ink }]}>{label.name}</Text>
              {EARLY_MODES.includes(mode) ? (
                <View style={[s.earlyTag, { borderColor: t.hairline, backgroundColor: t.canvas }]}>
                  <Text style={[s.earlyTagLabel, { color: t.muted }]}>early</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {activeLine ? <Muted style={s.activeLine}>{activeLine}</Muted> : null}
    </View>
  );
}

const s = StyleSheet.create({
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipLabel: { fontSize: 13.5, fontWeight: '500' },
  earlyTag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  earlyTagLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  activeLine: { marginTop: 10, lineHeight: 18 },
});
