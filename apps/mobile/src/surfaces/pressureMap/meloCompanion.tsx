// Melo — the companion page (Quiet Paper Luxury).
//
// Faithful RN port of the accepted web design (ScreenMelo): a quiet header, an editorial
// "Companion" title, a calm hero panel with Melo large in her current mood + the one reassuring
// line she is reading right now, and the five-mood spectrum she moves through as the money picture
// changes. Each spectrum row carries a small Melo in that mood; the current row reads accent-soft
// with a trailing accent dot. Melo interprets and reassures; she never moves anything — that is
// always the user. Same prop contract, route + snapshot, and mood-state wiring as before; only the
// presentation matches the web source.

import { StyleSheet, Text, View } from 'react-native';
import type { MeloLocalFinancialSnapshot } from '@folio/ai-contracts';

import { Display, gap, paper, PressureScreen, radius, serif } from './kit';
import { ScreenHeader } from './secondaryKit';
import { MeloFigure } from './melo/MeloFigure';
import type { MeloMood } from './melo/meloStates';
import { routeHasMeaningfulPath } from './MoneyPath';
import type { LocalLedgerState, LocalRouteSummary } from '../../local/localLedger';

type PressureKey = 'safe' | 'calm' | 'soft' | 'pressured' | 'overspent';

// Melo's emotional range — the spectrum she moves through as the route tightens. Lines are her
// voice (verbatim from the accepted design); the mood drives the figure's pose.
const SPECTRUM: readonly {
  key: PressureKey;
  label: string;
  mood: MeloMood;
  line: string;
}[] = [
  {
    key: 'safe',
    label: 'Safe',
    mood: 'calm',
    line: 'Plenty of room. Breathe.',
  },
  {
    key: 'calm',
    label: 'Calm',
    mood: 'calm',
    line: 'You make it to payday.',
  },
  {
    key: 'soft',
    label: 'Soft',
    mood: 'soft-concern',
    line: 'Tight - but the path holds.',
  },
  {
    key: 'pressured',
    label: 'Pressured',
    mood: 'attentive',
    line: 'The middle of next week is the squeeze.',
  },
  {
    key: 'overspent',
    label: 'Overspent',
    mood: 'soft-concern',
    line: 'Something has to move. Let us look together.',
  },
];

// Where Melo is right now, read from the route. A ledger with no meaningful path sits at calm
// (neutral) rather than guessing a pressure from an empty £0.
function currentPressure(route: LocalRouteSummary): PressureKey {
  if (!routeHasMeaningfulPath(route)) return 'calm';
  const tight = route.tightestBalanceMinor;
  if (tight < 0) return 'overspent';
  if (tight < 5000) return 'pressured'; // < £50
  if (tight < 18400) return 'soft'; // < £184
  if (tight < 32500) return 'calm'; // < £325
  return 'safe';
}

export function MeloScreen({
  onBack,
  route,
}: {
  // Accepted for prop-contract parity with the container.
  ledger: LocalLedgerState;
  onBack: () => void;
  onOpenImports: () => void;
  onOpenRecovery: () => void;
  onOpenWhatIf: () => void;
  onOpenSources: () => void;
  privateExampleMode: boolean;
  route: LocalRouteSummary;
  snapshot: MeloLocalFinancialSnapshot;
}) {
  const currentKey = currentPressure(route);
  const current = SPECTRUM.find((s) => s.key === currentKey) ?? SPECTRUM[1]!;

  return (
    <PressureScreen>
      <ScreenHeader label="Melo" onBack={onBack} />

      <View style={styles.title}>
        <Text style={styles.kicker}>Companion</Text>
        <Display style={styles.titleHeadline}>A quiet presence across the journey.</Display>
      </View>

      <View style={styles.hero}>
        <MeloFigure mood={current.mood} size={120} />
        <Text style={styles.heroLine}>{`“${current.line}”`}</Text>
      </View>

      <View style={styles.spectrum}>
        {SPECTRUM.map((mood) => {
          const isNow = mood.key === currentKey;
          return (
            <View
              key={mood.key}
              accessibilityRole="text"
              style={[styles.moodRow, isNow ? styles.moodRowNow : undefined]}
            >
              <MeloFigure mood={mood.mood} size={28} />
              <View style={styles.moodText}>
                <Text style={styles.moodLabel}>{mood.label}</Text>
                <Text style={styles.moodLine}>{`“${mood.line}”`}</Text>
              </View>
              {isNow ? <View style={styles.nowDot} /> : null}
            </View>
          );
        })}
      </View>

      <Text style={styles.footer}>
        Try each state - Melo shifts mood and the path follows.
      </Text>
    </PressureScreen>
  );
}

const styles = StyleSheet.create({
  title: { gap: 4 },
  kicker: {
    color: paper.muted,
    fontFamily: serif.displayItalic,
    fontSize: 14,
    lineHeight: 19,
  },
  titleHeadline: {
    fontSize: 28,
    lineHeight: 34,
  },

  hero: {
    alignItems: 'center',
    backgroundColor: paper.surface,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.hairlineStrong,
    paddingVertical: 40,
    paddingHorizontal: gap.lg,
    gap: gap.md,
  },
  heroLine: {
    color: paper.muted,
    fontFamily: serif.displayItalic,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 240,
  },

  spectrum: { gap: gap.xs },
  moodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gap.sm,
    paddingVertical: 12,
    paddingHorizontal: gap.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.hairlineStrong,
    backgroundColor: paper.inset,
  },
  moodRowNow: {
    backgroundColor: paper.calmSoft,
  },
  moodText: { flex: 1 },
  moodLabel: { color: paper.ink, fontSize: 13, fontWeight: '500' },
  moodLine: {
    color: paper.muted,
    fontFamily: serif.displayItalic,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1,
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: paper.calm,
  },

  footer: {
    color: paper.muted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
});
