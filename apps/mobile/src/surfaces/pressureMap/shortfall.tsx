// The honest "you won't make it" moment.
//
// Ported faithfully from the Lovable ScreenShortfall. Shortfall names the gap to payday
// without alarm and without blame, then offers three concrete moves — pause a sub, borrow
// from a pot, hold a daily cap — and an explicit way to do none of them. Knowing the gap is
// the work; the moves are optional.
//
// Presentational ONLY. Every real number arrives as a prop (the container derives them from
// the live route): gapMinor, daysLeft, the pausable subscription, the lending pot, the daily
// cap. The screen mutates nothing on its own — each move calls a handler the container wires.
//
// @rn-screen   ShortfallScreen
// @rn-stack    Today > Shortfall (modal-style)
// @copy        FROZEN — never alarmist, never blaming. Strings below match the Lovable source
//              verbatim; do not soften, embellish, or re-order.
// @motion      gap-pulse on the coral gap word (subtle opacity breathe), respects reduceMotion.

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Body,
  Eyebrow,
  Headline,
  PressureScreen,
  gap,
  magnitude,
  serif,
  useTheme,
  type Palette,
} from './kit';
import { MeloPresence } from './melo';

export type ShortfallScreenProps = Readonly<{
  /** The gap to payday, in minor units (pence). Always a positive magnitude — the route's
   *  shortfall = abs(tightestBalanceMinor) when it goes negative. */
  gapMinor: number;
  /** Whole days until payday. */
  daysLeft: number;
  /** Name of a subscription that can be paused this cycle, in minor units for its cost. Null
   *  when there is nothing pausable — the "Pause one sub" move is then hidden. */
  pausableSubName: string | null;
  /** Cost of that subscription, in minor units. Ignored when pausableSubName is null. */
  pausableSubCostMinor: number;
  /** Name of the largest pot to lend from. Null when no pot can cover the gap — the "Borrow
   *  from a pot" move is then hidden. (The container only supplies a name when saved >= gap.) */
  lendingPotName: string | null;
  /** The daily-spend cap that would close the gap, in minor units. */
  dailyCapMinor: number;
  onPauseSub: () => void;
  onBorrowFromPot: () => void;
  onClose: () => void;
  onMelo: () => void;
  reduceMotion?: boolean | undefined;
}>;

export function ShortfallScreen({
  gapMinor,
  daysLeft,
  pausableSubName,
  pausableSubCostMinor,
  lendingPotName,
  dailyCapMinor,
  onPauseSub,
  onBorrowFromPot,
  onClose,
  onMelo,
  reduceMotion,
}: ShortfallScreenProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  // The gap word "breathes" — a subtle opacity loop, never a jarring flash. Matches the web
  // gap-pulse (1.6s ease-in-out). Held steady when the user prefers reduced motion.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.62,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <PressureScreen style={layout.screen}>
      {/* Header — a quiet way back and a calm eyebrow. "A quiet moment", never an alarm. */}
      <View style={layout.header}>
        <Pressable
          accessibilityHint="Goes back without making any change."
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onClose}
          style={({ pressed }) => [layout.back, pressed ? { opacity: 0.6 } : undefined]}
        >
          <Text style={[layout.backGlyph, s.backGlyph]}>←</Text>
        </Pressable>
        <Eyebrow tone="muted">A quiet moment</Eyebrow>
        <View style={layout.headerSpacer} />
      </View>

      {/* Melo sits with you — a soft-concern presence, no copy here (the headline speaks). */}
      <MeloPresence
        reduceMotion={reduceMotion}
        size="md"
        state="melo_uncertainty"
        style={layout.meloTop}
        withCopy={false}
      />

      {/* The honest answer. The gap is the coral accent word, given the editorial serif. */}
      <View style={layout.lead}>
        <Text style={[layout.leadEyebrow, s.leadEyebrow]}>Honest answer</Text>
        <Animated.View style={{ opacity: pulse }}>
          <Headline accent={`Short by ${magnitude(gapMinor)}.`} accentTone="repair" />
        </Animated.View>
        <Body style={[layout.leadBody, s.leadBody]}>
          {daysLeft} days until payday. Here's what would close the gap — pick one, or none.
        </Body>
      </View>

      {/* Three concrete moves — or none. Quiet inset tiles, the amount given air on the right. */}
      <View style={layout.moves}>
        {pausableSubName ? (
          <MoveTile
            amount={`+${magnitude(pausableSubCostMinor)}`}
            eyebrow="Pause one sub"
            onPress={onPauseSub}
            s={s}
          >
            <Text style={[layout.moveLine, s.moveLine]}>
              Pause <Text style={layout.moveStrong}>{pausableSubName}</Text> this cycle
            </Text>
          </MoveTile>
        ) : null}

        {lendingPotName ? (
          <MoveTile
            amount={`+${magnitude(gapMinor)}`}
            eyebrow="Borrow from a pot"
            onPress={onBorrowFromPot}
            s={s}
          >
            <Text style={[layout.moveLine, s.moveLine]}>
              Move {magnitude(gapMinor)} from{' '}
              <Text style={layout.moveStrong}>{lendingPotName}</Text>
            </Text>
            <Text style={[layout.moveSub, s.moveSub]}>Pay it back next cycle if you can.</Text>
          </MoveTile>
        ) : null}

        <MoveTile
          amount={`${magnitude(dailyCapMinor)}/day`}
          eyebrow="Spend a little less"
          onPress={onMelo}
          s={s}
        >
          <Text style={[layout.moveLine, s.moveLine]}>
            Keep daily spend at {magnitude(dailyCapMinor)} for {daysLeft} days
          </Text>
        </MoveTile>
      </View>

      {/* Melo's reassurance — frozen line, never blaming. Carried as the one-line override. */}
      <MeloPresence
        line="No move is fine too. Knowing the gap is half the work."
        reduceMotion={reduceMotion}
        size="sm"
        state="melo_uncertainty"
        style={layout.meloBottom}
      />

      {/* The explicit refusal. Quiet, hairline — never competes with the moves. */}
      <Pressable
        accessibilityHint="Closes this without changing anything."
        accessibilityRole="button"
        onPress={onClose}
        style={({ pressed }) => [layout.leave, s.leave, pressed ? { opacity: 0.6 } : undefined]}
      >
        <Text style={[layout.leaveLabel, s.leaveLabel]}>Leave it for now</Text>
      </Pressable>
    </PressureScreen>
  );
}

// One concrete move — a quiet inset tile. The eyebrow names the move, the amount is given air
// on the right, the human line sits below. Tappable as a whole.
function MoveTile({
  amount,
  eyebrow,
  onPress,
  children,
  s,
}: {
  amount: string;
  eyebrow: string;
  onPress: () => void;
  children: ReactNode;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [layout.move, s.move, pressed ? { opacity: 0.7 } : undefined]}
    >
      <View style={layout.moveHead}>
        <Text style={[layout.moveEyebrow, s.moveEyebrow]}>{eyebrow}</Text>
        <Text style={[layout.moveAmount, s.moveAmount]}>{amount}</Text>
      </View>
      <View style={layout.moveBody}>{children}</View>
    </Pressable>
  );
}

// Layout-only styles (spacing, type, flex) — theme-independent, kept module-level static.
const layout = StyleSheet.create({
  // Editorial rhythm — generous, uneven air. The lead owns the top; the moves sit below with
  // a clear gap; the refusal is pinned quiet at the foot.
  screen: { gap: gap.xl },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: gap.xs,
  },
  back: { paddingVertical: 4, paddingRight: gap.sm },
  backGlyph: { fontSize: 22, lineHeight: 24 },
  headerSpacer: { width: 16 },

  meloTop: { marginTop: gap.xs },

  lead: { gap: gap.xs },
  leadEyebrow: {
    fontFamily: serif.displayItalic,
    fontSize: 14,
    lineHeight: 20,
  },
  leadBody: { marginTop: gap.xs, maxWidth: 320 },

  moves: { gap: gap.sm },
  move: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: gap.lg,
    paddingHorizontal: gap.xl,
  },
  moveHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  moveEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  moveAmount: {
    fontFamily: serif.display,
    fontSize: 18,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  moveBody: { marginTop: gap.xs },
  moveLine: { fontSize: 15, lineHeight: 21 },
  moveStrong: { fontWeight: '600' },
  moveSub: { fontSize: 12.5, lineHeight: 18, marginTop: 4 },

  meloBottom: { marginTop: gap.xs },

  leave: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: gap.xs,
  },
  leaveLabel: { fontSize: 13, fontWeight: '600' },
});

// Colour-bearing styles — rebuilt from the active palette so the screen follows light/dark.
function makeStyles(t: Palette) {
  return StyleSheet.create({
    backGlyph: { color: t.muted },

    leadEyebrow: { color: t.muted },
    leadBody: { color: t.secondary },

    move: { backgroundColor: t.inset, borderColor: t.hairline },
    moveEyebrow: { color: t.muted },
    moveAmount: { color: t.ink },
    moveLine: { color: t.ink },
    moveSub: { color: t.muted },

    leave: { borderColor: t.hairline },
    leaveLabel: { color: t.muted },
  });
}
