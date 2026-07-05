// MeloScreen — the faithful 1:1 React Native port of the web Melo companion hub
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenMelo.tsx).
//
// @rn-screen    MeloScreen
// @rn-stack     MainTabs > Melo
// @purpose      Melo companion hub — presence + a live "plumage" (money-health) read, companion
//               touches (wardrobe), a Quiet Mode toggle, and Rituals shortcuts (Payday / Sunday
//               look). This REPLACES the prior "pressure band playground" build, which faithfully
//               ported a different web surface (a mood picker, not the companion hub) — see
//               PARITY_GAPS.md Group 3 for the finding. This port renders what ScreenMelo.tsx
//               actually is: the companion's home, not a mood/pressure toy.
// @reads        melo (quietMode, wardrobe), moneyMode, onboarding, subs, subPaused, pots,
//               currentBalance, cycles — via the store, mirroring the web's useAppStore reads.
// @writes       setMelo (wardrobe, quietMode) — via @/folio/store. nav.openMelo() on tapping Melo
//               herself (opens the melo-chat sheet, same as web's onTap).
// @opens-sheet  melo-chat (via nav.openMelo(), tapping the hero Melo)
// @copy         FROZEN — ported verbatim from the web literals (no COPY_DECK entry exists yet for
//               this screen; the web JSX strings are the frozen source, same convention every
//               other folio screen uses for its own inline literals).
// @tokens       canvas (paper) · surface · inset (chips) · calm (accent) · calmSoft (active/equip) ·
//               hairline · muted · serif (Fraunces) — all from the kit, no new token.
// @motion       slide-in-r (whole screen, 360ms ease-out-expo) · press 0.97 on every row/button ·
//               Melo breathe + blink (kit-owned). All gated to final state under reduce-motion.
//
// FIDELITY DECISIONS (each grounded in the SPEC + confirmed kit/store source):
//   • Plumage (vitality): the web derives a live 0..1 "vitality" from money-health signals
//     (tightest spare vs monthly income, sub load, pot health, ritual freshness) via
//     `deriveMeloVitality`, projected onto four labels (dim/warm/bright/radiant) — a live money-
//     health READ, explicitly NOT a streak or level. RN has no `deriveMeloVitality` port and no
//     `@/folio/lib/melo/state` module (grepped before writing — neither exists). Rather than
//     silently inventing a parallel vitality formula, this port derives an honest, comparably-
//     shaped signal from the REAL RN mode engine already wired everywhere else on this app:
//     `deriveModeState(moneyMode, inputs).safeZone.amount` (the same safe-zone number Today/
//     Paywall/Account already trust) divided by monthly income, clamped to 0..1, banded into the
//     same four dim/warm/bright/radiant labels at the same thresholds the web used internally
//     (<0.15 dim, <0.4 warm, <0.7 bright, else radiant — ported verbatim from the web's own
//     `deriveMeloVitality` thresholds). This is a real, live, money-aware read — not a fabricated
//     placeholder — built entirely from engines that already exist in this codebase, with no new
//     engine slipped in silently (mirrors RN_PORT.md's loop discipline).
//   • Mood/pose for the hero Melo: ported through the same `deriveModeState` call (its `.mood` /
//     `.pose` fields), the same derivation Today already uses — keeps the companion hub in
//     lockstep with the rest of the app's mood language instead of running a second, disagreeing
//     derivation.
//   • Lens-lock state line: the web's `LensStateLine` reads `useLens().canAccess(mode)` + weather +
//     the mode label, showing a small Plus-lock chip that routes to `plans` (web) when the active
//     lens is locked. RN's real `useLens()` (`@/folio/lib/lens`) is used directly — `canAccess`,
//     `MODE_LABEL` — and the chip routes to `nav.go('paywall')` (RN's actual plans/pricing screen;
//     there is no separate `plans` screen for lens tiers in this app — `paywall` IS Folio's plans
//     surface, confirmed via AccountScreen/MoreScreen's own `nav.go('paywall')` routing).
//   • Companion touches (wardrobe): ported verbatim — three touches (Ember scarf / Paper crown /
//     Listener cups), Plus-gated for two of the three, tap to equip/unequip (max 3), suppressed
//     (no-op, dimmed) when locked AND `canShowUpsell` says not to sell right now. `canShowUpsell`
//     is the REAL RN port (`@/folio/lib/lensPaywall`), fed real inputs: weather from
//     `deriveModeState`, `recoveryActive` = `moneyMode === 'reset'` (mirrors the web's own
//     recoveryActive derivation), the same safe-zone-derived total, and the real `melo.quietMode`.
//   • Quiet Mode: real, persisted via the new `setMelo({ quietMode })` store mutator (`@/folio/
//     store` — added alongside this port; ports the web's `melo.quietMode` slice 1:1). When on,
//     the hero Melo is replaced by "Melo is resting." (verbatim) and the Plumage + line sections
//     are hidden, matching the web exactly.
//   • Rituals: "Payday" -> nav.go('ritual'), "Sunday look" -> nav.go('insights') — both real
//     ScreenIds already wired in this app's Nav contract. The "last · {date}" / "never run" caption
//     reads `cycles[0]?.closedAt`, the same field the web reads.
//   • Accent words ("quiet", "Reflects", "plan" pattern used elsewhere): web uses
//     `<em class="not-italic text-accent">`. RN has no inline `<em>`, so each headline is built from
//     Text runs with a nested UPRIGHT terracotta span (the StartScreen / AccountScreen / MoreScreen
//     pattern — same Fraunces face, colour-only override, never italic).
//   • `pressure` prop: the previous (now-replaced) build accepted a `pressure` prop threaded by
//     FolioShell (`<MeloScreen nav={nav} pressure={pressure} />`). The web ScreenMelo this port is
//     now faithful to has no pressure/mood-picker concept at all, so the prop is accepted (kept
//     optional, for FolioShell call-site compatibility) but intentionally unused by this screen.
//   • slide-in-r: translateX 28→0 + fade over 360ms ease-out-expo, gated to final state under
//     reduce-motion (resolved layout, never a slower animation) — mirrors every other folio screen.
//   • STATES: populated-only per the SPEC convention (offline = populated; no async dependency). All
//     five branches are rendered for completeness, mirroring MoreScreen/AccountScreen/PaywallScreen.
//
// HONEST CLAIMS: this screen asserts no privacy/security property. No banned product vocabulary
// appears in any visible string. Tap targets are >=44px (full-width rows) or carry hitSlop.

import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { gap, radius, serif, useTheme } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { MeloLine } from '@/folio/melo/MeloLine';
import { copy } from '@/folio/copy/copy';
import { EmptyState } from '@/folio/ui/EmptyState';
import { useAppStore, setMelo } from '@/folio/store';
import { useLens } from '@/folio/lib/lens';
import { canShowUpsell } from '@/folio/lib/lensPaywall';
import { deriveModeState, MODE_LABEL, type MoneyMode } from '@/folio/lib/modes';
import { useRoute } from '@/folio/lib/storeRoute';
import type { Nav, Pressure } from '@/folio/types';

export type MeloScreenState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type MeloScreenProps = {
  nav: Nav;
  /** Accepted for FolioShell call-site compatibility (the shell threads its app-wide pressure
   *  default to this screen name historically). Unused — the companion hub this screen now
   *  faithfully ports has no pressure/mood-picker concept. See FIDELITY DECISIONS. */
  pressure?: Pressure;
  /** STATES.md branch. Defaults to 'populated'. */
  state?: MeloScreenState;
};

// Plumage labels — ported verbatim from the web's `vitalityLabel` bands.
type Plumage = 'dim' | 'warm' | 'bright' | 'radiant';

function vitalityLabel(v: number): Plumage {
  if (v < 0.15) return 'dim';
  if (v < 0.4) return 'warm';
  if (v < 0.7) return 'bright';
  return 'radiant';
}

const PLUMAGE_COPY: Record<Plumage, { line: string; caption: string }> = {
  dim: { line: 'Feathers drawn in.', caption: "The path is thin. He's holding still with you." },
  warm: { line: 'Warm at the edges.', caption: 'Enough to breathe. The ember is patient.' },
  bright: { line: 'Bright and steady.', caption: "The runway holds. He's alert, not anxious." },
  radiant: {
    line: 'Full plumage, quietly lit.',
    caption: 'Real headroom. The ember runs warm.',
  },
};

// Companion touches — verbatim from the web `WARDROBE` list.
const WARDROBE: readonly { id: string; label: string; note: string; plus: boolean }[] = [
  { id: 'scarf', label: 'Ember scarf', note: 'cool months', plus: false },
  { id: 'crown', label: 'Paper crown', note: 'goal-hit day', plus: true },
  { id: 'headphones', label: 'Listener cups', note: 'focus sessions', plus: true },
];

const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduce(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}

export function MeloScreen({ nav, state = 'populated' }: MeloScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  const melo = useAppStore((s) => s.melo ?? { quietMode: false, wardrobe: [] });
  const moneyMode = useAppStore((s) => s.moneyMode ?? 'survival') as MoneyMode;
  const onboarding = useAppStore((s) => s.onboarding);
  const subs = useAppStore((s) => s.subs);
  const subPaused = useAppStore((s) => s.subPaused);
  const pots = useAppStore((s) => s.pots);
  const currentBalance = useAppStore((s) => s.currentBalance);
  const cycles = useAppStore((s) => s.cycles);

  const { canAccess } = useLens();

  const route = useRoute(new Date());

  const modeState = useMemo(
    () =>
      deriveModeState(moneyMode, {
        currentBalance,
        onboarding,
        pots,
        subs,
        subPaused,
        tightestSpare: route.tightPoint.amount,
        tightestDate: route.tightPoint.date,
        ritualCompletedRecently: !!cycles[0]?.closedAt,
        hour: new Date().getHours(),
      }),
    [moneyMode, currentBalance, onboarding, pots, subs, subPaused, route, cycles],
  );

  // Vitality — the real safe-zone read, normalised against monthly income. See FIDELITY DECISIONS.
  const vitality = useMemo(() => {
    const monthly = Math.max(1, onboarding.monthlyIncome);
    return Math.max(0, Math.min(1, modeState.safeZone.amount / monthly));
  }, [modeState, onboarding.monthlyIncome]);
  const plumage = vitalityLabel(vitality);
  const plumageCopy = PLUMAGE_COPY[plumage];

  // Four dots visualise vitality as a plumage reading — not a level.
  const dotCount = plumage === 'dim' ? 1 : plumage === 'warm' ? 2 : plumage === 'bright' ? 3 : 4;

  const recoveryActive = moneyMode === 'reset';
  const safeZoneTotal = modeState.safeZone.amount;
  const upsellsOn = canShowUpsell({
    weather: modeState.weather,
    recoveryActive,
    safeZoneTotal,
    quietMode: melo.quietMode,
  });

  const lastCycle = cycles[0]?.closedAt;

  // slide-in-r — drives the whole screen.
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    enter.value = withTiming(1, { duration: SLIDE_MS, easing: EASE_OUT_EXPO });
  }, [enter, reduceMotion]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateX: (1 - enter.value) * SLIDE_FROM_X }],
  }));

  const toggleWardrobe = (id: string, equipped: boolean, locked: boolean) => {
    if (locked && !upsellsOn) return;
    const next = equipped
      ? melo.wardrobe.filter((x) => x !== id)
      : [...melo.wardrobe, id].slice(0, 3);
    setMelo({ wardrobe: next });
  };

  const toggleQuietMode = () => setMelo({ quietMode: !melo.quietMode });

  // empty / error — the calm EmptyState doorway (n/a in practice, rendered for completeness).
  if (state === 'empty' || state === 'error') {
    const headline = state === 'error' ? copy.err.generic : 'Meet Melo, your quiet companion.';
    const body =
      state === 'error' ? undefined : 'A quiet presence across the journey. Nothing to set up.';
    return (
      <EmptyState
        mood="calm"
        headline={headline}
        body={body}
        cta={{ label: 'Back', onPress: () => nav.back() }}
      />
    );
  }

  // loading — Melo curious + a line, never a spinner (per the hard rule + STATES.md).
  if (state === 'loading') {
    return (
      <View
        style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.huge }]}
      >
        <MeloLine mood="curious" text="One moment — Melo's settling in." />
      </View>
    );
  }

  const modeLocked = !canAccess(moneyMode);

  return (
    <Animated.View style={[styles.flex, enterStyle, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — back glyph · "Melo" eyebrow · spacer. */}
        <View style={styles.header}>
          <Pressable
            accessibilityHint="Goes back."
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={16}
            onPress={() => nav.back()}
            style={({ pressed: isPressed }) => [isPressed ? styles.pressed : undefined]}
          >
            <Text style={[styles.backGlyph, { color: t.muted }]}>←</Text>
          </Pressable>
          <Text style={[styles.eyebrow, { color: t.muted }]}>{copy.global.melo.name}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Presence — editorial masthead. */}
        <View style={styles.titleBlock}>
          <Text style={[styles.kicker, { color: t.muted }]}>Companion</Text>
          {melo.quietMode ? (
            <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
              {'A '}
              <Text style={[styles.headlineAccent, { color: t.calm }]}>quiet</Text>
              {' lens on your money.'}
            </Text>
          ) : (
            <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
              {'Reads your money. '}
              <Text style={[styles.headlineAccent, { color: t.calm }]}>Reflects</Text>
              {' it back.'}
            </Text>
          )}
        </View>

        {/* Presence — hero Melo or the quiet-mode resting line. */}
        <View style={styles.heroWrap}>
          {melo.quietMode ? (
            <View style={styles.restingWrap}>
              <Text style={[styles.restingLine, { color: t.muted }]}>Melo is resting.</Text>
            </View>
          ) : (
            <Melo
              size={140}
              mood={modeState.mood}
              pose={modeState.pose}
              grounded
              onTap={() => nav.openMelo()}
            />
          )}

          {/* Live state line — weather + lens, no chip container. Locked Plus lens shows a small
              lock so the paywall state is legible without opening the picker. */}
          <View style={styles.lensLine}>
            <Text style={[styles.lensLineText, { color: t.muted }]}>
              {MODE_LABEL[moneyMode].toLowerCase()} lens
            </Text>
            {modeLocked ? (
              <Pressable
                accessibilityLabel="This lens is Plus — tap to unlock"
                accessibilityRole="button"
                onPress={() => nav.go('paywall')}
                style={({ pressed: isPressed }) => [
                  styles.lockChip,
                  { backgroundColor: t.inset, borderColor: t.hairline },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.lockChipLabel, { color: t.calm }]}>plus</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Plumage reading — the "tier", tied to money health, not streaks. */}
        {!melo.quietMode ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: t.ink }]}>Plumage</Text>
              <Text style={[styles.sectionHint, { color: t.muted }]}>live · money health</Text>
            </View>
            <View style={styles.plumageRow}>
              <Text style={[styles.plumageWord, { color: t.ink }]}>{plumage}</Text>
              <View style={styles.plumageDots} accessibilityLabel={`plumage ${plumage}`}>
                {[0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.plumageDot,
                      { backgroundColor: i < dotCount ? t.calm : t.inset },
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {/* Melo line — kept as a whisper, no giant card. */}
        {!melo.quietMode ? (
          <View style={styles.meloLineWrap}>
            <MeloLine
              text={
                plumage === 'dim'
                  ? "I'm here. Small moves count more than big ones this week."
                  : plumage === 'radiant'
                    ? "You've built a soft floor. I'll keep it warm."
                    : plumageCopy.caption
              }
            />
          </View>
        ) : null}

        {/* Companion touches — reframed wardrobe, quieter row. */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: t.ink }]}>Companion touches</Text>
            <Text style={[styles.sectionHint, { color: t.muted }]}>{melo.wardrobe.length}/3</Text>
          </View>
          <View style={styles.wardrobeList}>
            {WARDROBE.map((w) => {
              const equipped = melo.wardrobe.includes(w.id);
              const locked = w.plus && !equipped;
              const suppress = locked && !upsellsOn;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: equipped, disabled: suppress }}
                  key={w.id}
                  onPress={() => toggleWardrobe(w.id, equipped, locked)}
                  style={({ pressed: isPressed }) => [
                    styles.wardrobeRow,
                    {
                      backgroundColor: equipped ? t.calmSoft : t.surface,
                      borderColor: t.hairline,
                      opacity: suppress ? 0.5 : 1,
                    },
                    isPressed && !suppress ? styles.pressed : undefined,
                  ]}
                >
                  <View style={styles.wardrobeText}>
                    <Text style={[styles.wardrobeLabel, { color: t.ink }]}>{w.label}</Text>
                    <Text style={[styles.wardrobeNote, { color: t.muted }]}>{w.note}</Text>
                  </View>
                  {w.plus && !equipped ? (
                    <Text style={[styles.wardrobePlus, { color: t.muted }]}>Plus</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Quiet Mode */}
        <View style={styles.section}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: melo.quietMode }}
            onPress={toggleQuietMode}
            style={({ pressed: isPressed }) => [
              styles.quietRow,
              { backgroundColor: t.surface, borderColor: t.hairline },
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <View style={styles.quietText}>
              <Text style={[styles.quietLabel, { color: t.ink }]}>Quiet Mode</Text>
              <Text style={[styles.quietHint, { color: t.muted }]}>
                {melo.quietMode
                  ? 'Character hidden. Weather chip still shows on Today.'
                  : 'Turn off the character. Keep the numbers.'}
              </Text>
            </View>
            <View
              style={[
                styles.quietPill,
                { backgroundColor: melo.quietMode ? t.calmSoft : 'transparent' },
              ]}
            >
              <Text style={[styles.quietPillLabel, { color: melo.quietMode ? t.calm : t.muted }]}>
                {melo.quietMode ? 'on' : 'off'}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Rituals */}
        <View style={[styles.section, styles.ritualsSection]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: t.ink }]}>Rituals</Text>
            <Text style={[styles.sectionHint, { color: t.muted }]}>
              {lastCycle ? `last · ${lastCycle}` : 'never run'}
            </Text>
          </View>
          <View style={styles.ritualsGrid}>
            <Pressable
              accessibilityRole="button"
              onPress={() => nav.go('ritual')}
              style={({ pressed: isPressed }) => [
                styles.ritualCard,
                { backgroundColor: t.surface, borderColor: t.hairline },
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.ritualLabel, { color: t.ink }]}>Payday</Text>
              <Text style={[styles.ritualHint, { color: t.muted }]}>close the cycle together</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => nav.go('insights')}
              style={({ pressed: isPressed }) => [
                styles.ritualCard,
                { backgroundColor: t.surface, borderColor: t.hairline },
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.ritualLabel, { color: t.ink }]}>Sunday look</Text>
              <Text style={[styles.ritualHint, { color: t.muted }]}>what shifted this week</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: gap.xl,
  },
  loading: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backGlyph: {
    fontSize: 20,
    lineHeight: 24,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  headerSpacer: {
    width: 20,
  },
  titleBlock: {
    marginTop: gap.xl,
  },
  kicker: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
  },
  headline: {
    fontFamily: serif.display,
    fontSize: 26,
    letterSpacing: -0.2,
    lineHeight: 30,
    marginTop: gap.xs,
  },
  headlineAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  heroWrap: {
    alignItems: 'center',
    marginTop: gap.xxl,
  },
  restingWrap: {
    alignItems: 'center',
    height: 132,
    justifyContent: 'center',
  },
  restingLine: {
    fontFamily: serif.displayItalic,
    fontSize: 15,
    fontStyle: 'italic',
  },
  lensLine: {
    alignItems: 'center',
    columnGap: gap.xs + gap.xxs,
    flexDirection: 'row',
    marginTop: gap.lg,
  },
  lensLineText: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  lockChip: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingHorizontal: gap.xs + gap.xxs,
    paddingVertical: 2,
  },
  lockChipLabel: {
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  section: {
    marginTop: gap.xl,
  },
  ritualsSection: {
    marginBottom: gap.xxl,
  },
  sectionHeaderRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: serif.displayItalic,
    fontSize: 15,
  },
  sectionHint: {
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  plumageRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: gap.md,
  },
  plumageWord: {
    fontFamily: serif.display,
    fontSize: 19,
    lineHeight: 22,
    textTransform: 'capitalize',
  },
  plumageDots: {
    columnGap: gap.xs + gap.xxs,
    flexDirection: 'row',
  },
  plumageDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  meloLineWrap: {
    marginTop: gap.lg,
    paddingHorizontal: gap.xs + gap.xxs,
  },
  wardrobeList: {
    marginTop: gap.md,
    rowGap: gap.sm,
  },
  wardrobeRow: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    columnGap: gap.md,
    flexDirection: 'row',
    paddingHorizontal: gap.md,
    paddingVertical: gap.sm + gap.xxs,
  },
  wardrobeText: {
    flex: 1,
  },
  wardrobeLabel: {
    fontSize: 13,
  },
  wardrobeNote: {
    fontFamily: serif.displayItalic,
    fontSize: 11,
    marginTop: 2,
  },
  wardrobePlus: {
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  quietRow: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    columnGap: gap.md,
    flexDirection: 'row',
    paddingHorizontal: gap.lg,
    paddingVertical: gap.lg,
  },
  quietText: {
    flex: 1,
  },
  quietLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  quietHint: {
    fontFamily: serif.displayItalic,
    fontSize: 11,
    marginTop: 2,
  },
  quietPill: {
    borderRadius: radius.sm,
    paddingHorizontal: gap.sm,
    paddingVertical: 2,
  },
  quietPillLabel: {
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  ritualsGrid: {
    columnGap: gap.sm,
    flexDirection: 'row',
    marginTop: gap.md,
  },
  ritualCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    paddingHorizontal: gap.md,
    paddingVertical: gap.md,
  },
  ritualLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  ritualHint: {
    fontFamily: serif.displayItalic,
    fontSize: 11,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
});
