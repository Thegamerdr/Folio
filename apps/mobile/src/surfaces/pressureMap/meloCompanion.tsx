// Melo — the companion page (Quiet Paper Luxury).
//
// Faithful RN port of the accepted web design (ScreenMelo): a quiet header, an editorial
// "Companion" title, a calm hero panel with Melo large in her current mood + the one reassuring
// line she is reading right now, and the five-mood spectrum she moves through as the money picture
// changes. Each spectrum row carries a small Melo in that mood; the current row reads accent-soft
// with a trailing accent dot. Melo interprets and reassures; she never moves anything — that is
// always the user. Same prop contract, route + snapshot, and mood-state wiring as before; only the
// presentation matches the web source.
//
// Honesty: the spectrum is READ-ONLY by design. Melo's mood is derived from the money picture
// (currentPressure -> route.tightestBalanceMinor); it is never something the user toggles. The
// rows are display, not controls -- so the screen never implies a tap-to-change affordance. The
// real, honest navigation off this page lives in the "Where to go from here" rows below, which is
// where onOpenWhatIf / onOpenImports / onOpenRecovery / onOpenSources actually do their work.

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { MeloLocalFinancialSnapshot } from '@folio/ai-contracts';

import { gap, Headline, PressureScreen, radius, serif, useTheme, type Palette } from './kit';
import { HubRow, RowCard, ScreenHeader, SectionLabel } from './secondaryKit';
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
  onOpenImports,
  onOpenRecovery,
  onOpenWhatIf,
  onOpenSources,
  route,
}: {
  // Accepted for prop-contract parity with the container.
  ledger: LocalLedgerState;
  onBack: () => void;
  // Real, working navigation off this page — surfaced as the "Where to go from here" rows below.
  onOpenImports: () => void;
  onOpenRecovery: () => void;
  onOpenWhatIf: () => void;
  onOpenSources: () => void;
  privateExampleMode: boolean;
  route: LocalRouteSummary;
  snapshot: MeloLocalFinancialSnapshot;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const currentKey = currentPressure(route);
  const current = SPECTRUM.find((m) => m.key === currentKey) ?? SPECTRUM[1]!;

  return (
    <PressureScreen>
      <ScreenHeader label="Melo" onBack={onBack} />

      <View style={layout.title}>
        <Text style={[layout.kicker, s.kicker]}>Companion</Text>
        {/* Faithful to the web title: one terracotta accent word ("quiet"). */}
        <Headline lead="A " accent="quiet" tail=" presence across the journey." style={layout.titleHeadline} />
      </View>

      <View style={[layout.hero, s.hero]}>
        <MeloFigure mood={current.mood} size={120} />
        <Text style={[layout.heroLine, s.heroLine]}>{`“${current.line}”`}</Text>
      </View>

      <View style={layout.spectrum} accessibilityLabel="Melo's mood range, from safe to overspent">
        {SPECTRUM.map((mood) => {
          const isNow = mood.key === currentKey;
          return (
            <View
              key={mood.key}
              // Display, not a control. The mood is read from the money picture, never tapped to
              // change it — so these rows carry no onPress and read as plain text to assistive tech.
              accessibilityRole="text"
              accessibilityLabel={
                isNow
                  ? `${mood.label}. Where your money sits right now.`
                  : mood.label
              }
              style={[layout.moodRow, s.moodRow, isNow ? s.moodRowNow : undefined]}
            >
              <MeloFigure mood={mood.mood} size={28} />
              <View style={layout.moodText}>
                <Text style={[layout.moodLabel, s.moodLabel]}>{mood.label}</Text>
                <Text style={[layout.moodLine, s.moodLine]}>{`“${mood.line}”`}</Text>
              </View>
              {isNow ? <View style={s.nowDot} /> : null}
            </View>
          );
        })}
      </View>

      <Text style={[layout.footer, s.footer]}>
        Melo's mood reads where your money sits right now. It eases as things settle and steadies
        as they tighten — you move the money, Melo just reflects it back.
      </Text>

      <View style={layout.actions}>
        <SectionLabel>Where to go from here</SectionLabel>
        <RowCard>
          <HubRow
            first
            label="Review"
            hint="confirm what Folio has so far"
            accessibilityHint="Opens Review."
            onPress={onOpenImports}
          />
          <HubRow
            label="What if I spend"
            hint="preview a change before you decide"
            accessibilityHint="Opens a spend preview."
            onPress={onOpenWhatIf}
          />
          <HubRow
            label="Recovery"
            hint="when something has to move"
            accessibilityHint="Opens the repair flow."
            onPress={onOpenRecovery}
          />
          <HubRow
            label="Where these numbers come from"
            hint="what Melo is reading, and why"
            accessibilityHint="Opens where Melo's numbers come from."
            onPress={onOpenSources}
          />
        </RowCard>
      </View>
    </PressureScreen>
  );
}

// Layout-only — theme-invariant, so it stays module-level static (no per-render churn).
const layout = StyleSheet.create({
  title: { gap: 4 },
  kicker: {
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
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 40,
    paddingHorizontal: gap.lg,
    gap: gap.md,
  },
  heroLine: {
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
  },
  moodText: { flex: 1 },
  moodLabel: { fontSize: 13, fontWeight: '500' },
  moodLine: {
    fontFamily: serif.displayItalic,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1,
  },

  footer: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },

  actions: { gap: gap.xs },
});

// Colour-bearing styles — rebuilt only when the active palette changes.
function makeStyles(t: Palette) {
  return StyleSheet.create({
    kicker: { color: t.muted },

    hero: {
      backgroundColor: t.surface,
      borderColor: t.hairlineStrong,
    },
    heroLine: { color: t.muted },

    moodRow: {
      borderColor: t.hairlineStrong,
      backgroundColor: t.inset,
    },
    moodRowNow: {
      backgroundColor: t.calmSoft,
    },
    moodLabel: { color: t.ink },
    moodLine: { color: t.muted },
    nowDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.calm,
    },

    footer: { color: t.muted },
  });
}
