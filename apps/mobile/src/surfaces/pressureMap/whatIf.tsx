// What if — a spend-preview slider.
//
// A quiet experiment: drag a hypothetical spend and watch the tight point shift. It writes
// NOTHING — it only previews. Faithful port of the Lovable ScreenWhatIf (More > What if).
//
// Two honest signals layered onto the preview:
//   • breach — would this spend drop the route's lowest point below the tight-point floor the
//     user set (the engine's tightPointGoalMinor)?
//   • pots — if it would run the lowest point negative, is there enough across pots to absorb it?
//
// Money is INTEGER MINOR units (pence) end to end. The hypothetical spend is held in whole pounds
// (the stepper moves in £5 steps, mirroring the web), and converted to minor for every comparison
// and every formatted figure so there is no formatting drift with the rest of the app.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import {
  Eyebrow,
  Headline,
  HeroMoney,
  PressureScreen,
  PrimaryAction,
  QuietLink,
  Surface,
  gap,
  magnitude,
  money,
  paper,
  pressed,
  radius,
  serif,
} from './kit';
import { MeloPresence } from './melo';
import type { MeloState } from './melo/meloStates';
import { useCountUp } from './useCountUp';

// Stepper bounds + step, in whole pounds — mirrors the web (max 500, ±5).
const MIN_POUNDS = 0;
const MAX_POUNDS = 500;
const STEP_POUNDS = 5;
const START_POUNDS = 40;

// Pence in a pound — money math is in minor units, the stepper reasons in pounds.
const PENCE = 100;

// Count-up timing for the new-lowest figure (web uses 380ms).
const COUNT_UP_MS = 380;

// Days-of-cover assumes a calm ~£28/day burn (web divides newLow by 28).
const DAILY_BURN_MINOR = 28 * PENCE;

// Honest thresholds on the new lowest point (minor units), matching the web copy ladder.
const PRESSED_FLOOR_MINOR = 50 * PENCE; // below this it "presses you"
const COMFORT_FLOOR_MINOR = 150 * PENCE; // below this you "feel it" but make it
const LOW_COVER_DAYS = 5; // below this many days, cover reads as pressure

export type WhatIfScreenProps = Readonly<{
  /** The route's current lowest point to payday, in minor units (pence). */
  baseLowMinor: number;
  /** The tight-point floor the user set, in minor units, or null when no floor is set. */
  tightPointGoalMinor: number | null;
  /** Total saved across all pots, in minor units — the cushion a shortfall could be absorbed from. */
  potsTotalMinor: number;
  /** Ask Melo about this preview (opens the Melo chat sheet). */
  onOpenMelo: () => void;
  /** Leave the preview — nothing was added. */
  onBack: () => void;
  /** Reduced-motion preference; when true the figure snaps instead of counting up. */
  reduceMotion?: boolean | undefined;
}>;

export function WhatIfScreen({
  baseLowMinor,
  tightPointGoalMinor,
  potsTotalMinor,
  onOpenMelo,
  onBack,
  reduceMotion,
}: WhatIfScreenProps) {
  // The hypothetical spend the user is dragging, in whole pounds.
  const [pounds, setPounds] = useState(START_POUNDS);
  const spendMinor = pounds * PENCE;

  // The previewed lowest point if this spend happened today.
  const newLowMinor = baseLowMinor - spendMinor;
  const lowDisplayMinor = useCountUp(newLowMinor, COUNT_UP_MS, reduceMotion === true);

  // Days of cover — how long the previewed lowest point lasts at a calm daily burn.
  const daysCover = Math.max(0, Math.round((newLowMinor / DAILY_BURN_MINOR) * 10) / 10);
  const coverDisplay = useCountUp(daysCover, COUNT_UP_MS, reduceMotion === true);

  // Honest signal: would this drop the lowest point below the user's set floor?
  const breachesGoal = tightPointGoalMinor !== null && newLowMinor < tightPointGoalMinor;
  // Honest signal: if it runs short, is there enough across pots to absorb it?
  const shortfallMinor = newLowMinor < 0 ? Math.abs(newLowMinor) : 0;
  const wouldEatPots = shortfallMinor > 0 && potsTotalMinor >= shortfallMinor;

  const lowTone = breachesGoal || newLowMinor < PRESSED_FLOOR_MINOR ? 'repair' : undefined;
  const coverTone = daysCover < LOW_COVER_DAYS ? 'repair' : undefined;

  const meloState = meloStateFor(breachesGoal, newLowMinor);
  const meloLine = meloLineFor({
    breachesGoal,
    tightPointGoalMinor,
    newLowMinor,
    wouldEatPots,
    shortfallMinor,
  });

  const decrement = () => setPounds((v) => Math.max(MIN_POUNDS, v - STEP_POUNDS));
  const increment = () => setPounds((v) => Math.min(MAX_POUNDS, v + STEP_POUNDS));

  return (
    <PressureScreen style={styles.screen}>
      <View style={styles.head}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onBack}
          style={({ pressed: isPressed }) => (isPressed ? pressed : undefined)}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Eyebrow tone="muted">Preview</Eyebrow>
        <View style={styles.headSpacer} />
      </View>

      <View style={styles.intro}>
        <Text style={styles.kicker}>A quiet experiment</Text>
        <Headline lead="What if I spend " accent={`£${pounds}`} tail=" today?" />
      </View>

      <Surface style={styles.holdCard}>
        <View style={styles.stepperRow}>
          <Pressable
            accessibilityHint="Lowers the hypothetical spend by five pounds."
            accessibilityLabel="Less"
            accessibilityRole="button"
            disabled={pounds <= MIN_POUNDS}
            onPress={decrement}
            style={({ pressed: isPressed }) => [
              styles.stepKey,
              pounds <= MIN_POUNDS ? styles.stepKeyDisabled : undefined,
              isPressed ? pressed : undefined,
            ]}
          >
            <Text style={styles.stepKeyGlyph}>−</Text>
          </Pressable>

          <View style={styles.holdValue}>
            <HeroMoney accessibilityLabel={`${money(spendMinor)} today's hold`} tone={undefined}>
              <Text style={styles.holdAccent}>{money(spendMinor)}</Text>
            </HeroMoney>
            <Text style={styles.holdCaption}>today's hold</Text>
          </View>

          <Pressable
            accessibilityHint="Raises the hypothetical spend by five pounds."
            accessibilityLabel="More"
            accessibilityRole="button"
            disabled={pounds >= MAX_POUNDS}
            onPress={increment}
            style={({ pressed: isPressed }) => [
              styles.stepKey,
              pounds >= MAX_POUNDS ? styles.stepKeyDisabled : undefined,
              isPressed ? pressed : undefined,
            ]}
          >
            <Text style={styles.stepKeyGlyph}>+</Text>
          </Pressable>
        </View>

        <MiniPath pounds={pounds} />
      </Surface>

      <View style={styles.statsRow}>
        <StatCell
          label="New lowest"
          value={money(Math.round(lowDisplayMinor))}
          tone={lowTone}
          footnote={
            tightPointGoalMinor !== null
              ? `floor ${magnitude(tightPointGoalMinor)}`
              : undefined
          }
          footnoteTone={breachesGoal ? 'repair' : undefined}
        />
        <StatCell
          label="Days of cover"
          value={`${coverDisplay.toFixed(1)}d`}
          tone={coverTone}
          footnote={`${magnitude(potsTotalMinor)} in pots`}
        />
      </View>

      <MeloPresence line={meloLine} size="sm" state={meloState} style={styles.melo} />

      <View style={styles.footer}>
        <PrimaryAction
          accessibilityHint="Opens Melo to talk through this preview."
          label="Talk it through with Melo"
          onPress={onOpenMelo}
        />
        <QuietLink
          accessibilityHint="Leaves the preview. Nothing was added."
          label="Close — nothing was added"
          onPress={onBack}
        />
      </View>
    </PressureScreen>
  );
}

// ---------------------------------------------------------------------------
// Mini money path — a small, calm dip that deepens as the hypothetical spend grows.
// Decorative (not the canonical route), faithful to the web's preview sketch.
// ---------------------------------------------------------------------------

function MiniPath({ pounds }: { pounds: number }) {
  // The dip lands lower as the spend grows (web: 130 + amount*0.55, clamped to 190).
  const dipY = Math.min(190, 130 + pounds * 0.55);
  const d = `M 18 80 C 70 90, 110 70, 160 110 S 240 ${dipY}, 300 150 S 350 60, 372 50`;
  return (
    <Svg
      accessibilityLabel="A small money path dipping to its lowest point before payday."
      height={140}
      style={styles.path}
      viewBox="0 0 390 200"
      width="100%"
    >
      <Path d={d} stroke={paper.hairlineStrong} strokeWidth={1} strokeDasharray="2 4" fill="none" />
      <Path
        d={d}
        stroke={paper.calm}
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={372} cy={50} r={5} fill={paper.payday} />
      <SvgText x={350} y={40} fontFamily={serif.displayItalic} fontSize={10} fill={paper.ink} textAnchor="end">
        payday
      </SvgText>
      <Circle cx={300} cy={dipY} r={3.5} fill={paper.ink} />
      <SvgText x={300} y={dipY + 18} fontFamily={serif.displayItalic} fontSize={10} fill={paper.muted} textAnchor="middle">
        lowest point
      </SvgText>
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Stat cell — a small quiet figure with a label and an optional footnote.
// ---------------------------------------------------------------------------

function StatCell({
  label,
  value,
  tone,
  footnote,
  footnoteTone,
}: {
  label: string;
  value: string;
  tone?: 'repair' | undefined;
  footnote?: string | undefined;
  footnoteTone?: 'repair' | undefined;
}) {
  return (
    <Surface style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, tone === 'repair' ? styles.statValueRepair : undefined]}>
        {value}
      </Text>
      {footnote ? (
        <Text
          style={[
            styles.statFootnote,
            footnoteTone === 'repair' ? styles.statFootnoteRepair : undefined,
          ]}
        >
          {footnote}
        </Text>
      ) : null}
    </Surface>
  );
}

// ---------------------------------------------------------------------------
// Melo — the honest read on the previewed spend. Copy is FROZEN from the Lovable source.
// ---------------------------------------------------------------------------

function meloStateFor(breachesGoal: boolean, newLowMinor: number): MeloState {
  if (breachesGoal || newLowMinor < PRESSED_FLOOR_MINOR) return 'melo_uncertainty';
  if (newLowMinor < COMFORT_FLOOR_MINOR) return 'melo_path_explaining';
  return 'melo_idle';
}

function meloLineFor({
  breachesGoal,
  tightPointGoalMinor,
  newLowMinor,
  wouldEatPots,
  shortfallMinor,
}: {
  breachesGoal: boolean;
  tightPointGoalMinor: number | null;
  newLowMinor: number;
  wouldEatPots: boolean;
  shortfallMinor: number;
}): string {
  // FROZEN copy ladder — verbatim from ScreenWhatIf, with money rendered through the canonical
  // formatter (the web inlines "£{tightPointGoal}" / "£{Math.abs(newLow)}").
  if (breachesGoal && tightPointGoalMinor !== null) {
    return `That drops you below your ${magnitude(tightPointGoalMinor)} floor.`;
  }
  if (newLowMinor < 0) {
    return wouldEatPots
      ? `You'd have to dip into pots — about ${magnitude(shortfallMinor)} from somewhere.`
      : "This one wouldn't fit. Try a smaller hold.";
  }
  if (newLowMinor < PRESSED_FLOOR_MINOR) {
    return 'This one would press you. Try a smaller hold.';
  }
  if (newLowMinor < COMFORT_FLOOR_MINOR) {
    return "You'd feel it, but you'd make it.";
  }
  return 'Plenty of room. Spend if it serves you.';
}

const styles = StyleSheet.create({
  screen: { gap: gap.lg },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 24,
  },
  backText: { color: paper.secondary, fontSize: 15, fontWeight: '600' },
  headSpacer: { width: 40 },

  intro: { gap: gap.xs },
  // Melo's voice / a quiet aside: serif italic, warm-muted — the web's font-display italic kicker.
  kicker: {
    color: paper.muted,
    fontFamily: serif.displayItalic,
    fontSize: 13,
    lineHeight: 18,
  },

  holdCard: { gap: gap.lg },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepKey: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.inset,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.hairlineStrong,
  },
  stepKeyDisabled: { opacity: 0.45 },
  stepKeyGlyph: { color: paper.ink, fontSize: 24, fontWeight: '500', lineHeight: 26 },
  holdValue: { alignItems: 'center', gap: 4 },
  holdAccent: { color: paper.calm },
  holdCaption: {
    color: paper.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  path: { marginTop: gap.xs },

  statsRow: { flexDirection: 'row', gap: gap.sm },
  statCell: { flex: 1, gap: 4, padding: gap.lg },
  statLabel: {
    color: paper.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  statValue: {
    color: paper.ink,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  statValueRepair: { color: paper.repairInk },
  statFootnote: {
    color: paper.muted,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  statFootnoteRepair: { color: paper.repairInk },

  melo: { marginTop: gap.xs },

  footer: { gap: gap.sm, marginTop: gap.xs },
});
