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
import {
  AccessibilityInfo,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { gap, radius, serif, useTheme, type Palette } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { MeloLine } from '@/folio/melo/MeloLine';
import { copy } from '@/folio/copy/copy';
import { EmptyState } from '@/folio/ui/EmptyState';
import { useAppStore, setMelo, setMeloPrimerSeen } from '@/folio/store';
import { useLens } from '@/folio/lib/lens';
import { canShowUpsell } from '@/folio/lib/lensPaywall';
import { deriveModeState, MODE_LABEL, type MoneyMode } from '@/folio/lib/modes';
import { deriveMeloMemory } from '@/folio/lib/melo/memory';
import { useRoute } from '@/folio/lib/storeRoute';
import { MeloWeatherGlyph } from '@/folio/ui/MeloWeatherGlyph';
import { MeloCompanionHost } from '@/folio/ui/MeloCompanionHost';
import {
  deriveMeloPresence,
  derivePersonalContextAction,
  type MeloPosition,
} from '@/folio/lib/melo/companion';
import { MeloContextSheet } from '@/folio/sheets/MeloContextSheet';
import { MeloIntroSheet } from '@/folio/sheets/MeloIntroSheet';
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
  const tinyWins = useAppStore((s) => s.tinyWins ?? []);
  const preferredPosition = useAppStore((s) => s.melo?.preferredPosition ?? 'auto') as MeloPosition;
  const meloPrimerSeen = useAppStore((s) => s.meloPrimerSeen === true);
  const [contextOpen, setContextOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(!meloPrimerSeen);

  // Melo's context and first-run sheets are screen-owned. On Android the shared Sheet uses the
  // in-tree portal (rather than a native Modal), so the shell's global back listener cannot see
  // these local open states. Register the local dismissal ahead of shell navigation: context
  // closes first, then intro, and only an already-closed screen falls through to shell/OS back.
  useEffect(() => {
    if (Platform.OS !== 'android' || (!contextOpen && !introOpen)) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (contextOpen) {
        setContextOpen(false);
        return true;
      }
      if (introOpen) {
        setMeloPrimerSeen(true);
        setIntroOpen(false);
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [contextOpen, introOpen]);

  const { canAccess, fullUnlocked } = useLens();

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
  const memory = useMemo(() => deriveMeloMemory(tinyWins, cycles, 10), [tinyWins, cycles]);
  const activeSubs = subs.filter((subscription) => !subPaused[subscription.name]).length;
  const fundedPots = pots.filter((pot) => pot.saved > 0).length;
  const lensLabel =
    moneyMode === 'survival' ? 'Make it to payday' : MODE_LABEL[moneyMode].toLowerCase();
  const contextAction = useMemo(
    () => derivePersonalContextAction(modeState.mood),
    [modeState.mood],
  );
  const presence = deriveMeloPresence({ quietMode: melo.quietMode, action: contextAction });

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
    if (locked) {
      if (upsellsOn) nav.go('paywall');
      return;
    }
    const next = equipped
      ? melo.wardrobe.filter((x) => x !== id)
      : [...melo.wardrobe, id].slice(0, 3);
    setMelo({ wardrobe: next });
  };

  const toggleQuietMode = () => setMelo({ quietMode: !melo.quietMode });
  const toggleMilestoneSounds = () => setMelo({ soundEnabled: melo.soundEnabled !== true });

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
            <MeloCompanionHost
              size={140}
              mood={modeState.mood}
              pose={modeState.pose}
              position={preferredPosition}
              presence={presence}
              accessibilityLabel={`Melo, ${modeState.mood}`}
              onPress={() => setContextOpen(true)}
            />
          )}

          {/* Live state line — weather + lens, no chip container. Locked Full lens shows a small
              lock so the paywall state is legible without opening the picker. */}
          <View style={styles.lensLine}>
            <MeloWeatherGlyph weather={modeState.weather} size={12} />
            <Text style={[styles.lensLineText, { color: t.muted }]}>{lensLabel} lens</Text>
            {modeLocked ? (
              <Pressable
                accessibilityLabel="This lens is Full — tap to see access options"
                accessibilityRole="button"
                onPress={() => nav.go('paywall')}
                style={({ pressed: isPressed }) => [
                  styles.lockChip,
                  { backgroundColor: t.inset, borderColor: t.hairline },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.lockChipLabel, { color: t.calm }]}>full</Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Talk to Melo"
            accessibilityHint="Opens the companion conversation"
            onPress={() => nav.openMelo()}
            style={({ pressed: isPressed }) => [
              styles.talkButton,
              { backgroundColor: t.ink },
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={[styles.talkButtonLabel, { color: t.canvas }]}>Talk to Melo</Text>
            <Text style={[styles.talkButtonArrow, { color: t.canvas }]}>→</Text>
          </Pressable>
        </View>

        {/* A current reflection, explicitly not progress, a score, or a hidden tier. */}
        {!melo.quietMode ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: t.ink }]}>Right now</Text>
              <Text style={[styles.sectionHint, { color: t.muted }]}>
                current money · not a score
              </Text>
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

        {!melo.quietMode ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: t.ink }]}>What he's reading</Text>
            <View style={styles.readingGrid}>
              <ReadingCell
                label="balance"
                value={formatWholePounds(currentBalance.amount)}
                palette={t}
              />
              <ReadingCell label="live bills" value={String(activeSubs)} palette={t} />
              <ReadingCell label="funded pots" value={String(fundedPots)} palette={t} />
            </View>
          </View>
        ) : null}

        {!melo.quietMode ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: t.ink }]}>Memory</Text>
              <Text style={[styles.sectionHint, { color: t.muted }]}>
                {memory.length > 0 ? `last ${memory.length}` : 'quiet so far'}
              </Text>
            </View>
            {memory.length === 0 ? (
              <View
                style={[
                  styles.memoryEmpty,
                  { backgroundColor: t.surface, borderColor: t.hairline },
                ]}
              >
                <Melo size={28} mood="calm" />
                <Text style={[styles.memoryEmptyCopy, { color: t.ink }]}>
                  Hasn't needed to speak yet — that's not nothing.
                </Text>
              </View>
            ) : (
              <View
                style={[styles.memoryList, { backgroundColor: t.surface, borderColor: t.hairline }]}
              >
                {memory.map((event, index) => (
                  <View
                    key={event.id}
                    style={[
                      styles.memoryRow,
                      index > 0
                        ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.hairline }
                        : undefined,
                    ]}
                  >
                    <View
                      style={[
                        styles.memoryDot,
                        {
                          backgroundColor:
                            event.kind === 'cycle-green'
                              ? t.positive
                              : event.kind === 'cycle-red'
                                ? t.repair
                                : t.calm,
                        },
                      ]}
                    />
                    <Text style={[styles.memoryLine, { color: t.ink }]}>{event.line}</Text>
                    <Text style={[styles.memoryWhen, { color: t.muted }]}>
                      {relativeTime(event.at)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
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
              const locked = w.plus && !fullUnlocked && !equipped;
              const suppress = locked && !upsellsOn;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: equipped, disabled: suppress }}
                  accessibilityLabel={`${w.label}. ${equipped ? 'Equipped' : locked ? 'Melo Full' : 'Available'}`}
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
                    <Text style={[styles.wardrobePlus, { color: t.muted }]}>
                      {fullUnlocked ? 'available' : 'Full'}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Quiet Mode */}
        <View style={styles.section}>
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel={`Quiet Mode, ${melo.quietMode ? 'on' : 'off'}`}
            accessibilityHint="Hides the character but keeps your money information available"
            accessibilityState={{ checked: melo.quietMode }}
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
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel={`Milestone sounds, ${melo.soundEnabled === true ? 'on' : 'off'}`}
            accessibilityHint="Optional sounds play only for earned or completed milestone moments"
            accessibilityState={{ checked: melo.soundEnabled === true }}
            onPress={toggleMilestoneSounds}
            style={({ pressed: isPressed }) => [
              styles.quietRow,
              styles.soundRow,
              { backgroundColor: t.surface, borderColor: t.hairline },
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <View style={styles.quietText}>
              <Text style={[styles.quietLabel, { color: t.ink }]}>Milestone sounds</Text>
              <Text style={[styles.quietHint, { color: t.muted }]}>
                {melo.quietMode
                  ? 'Quiet Mode keeps them silent.'
                  : melo.soundEnabled === true
                    ? 'Only rituals and earned moments.'
                    : 'Off by default.'}
              </Text>
            </View>
            <View
              style={[
                styles.quietPill,
                { backgroundColor: melo.soundEnabled === true ? t.calmSoft : 'transparent' },
              ]}
            >
              <Text
                style={[
                  styles.quietPillLabel,
                  { color: melo.soundEnabled === true ? t.calm : t.muted },
                ]}
              >
                {melo.soundEnabled === true ? 'on' : 'off'}
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
      <MeloContextSheet
        visible={contextOpen}
        onClose={() => setContextOpen(false)}
        mood={modeState.mood}
        presence={presence}
        action={contextAction}
        quietMode={melo.quietMode}
        position={preferredPosition}
        onAction={() => {
          if (contextAction.id === 'personal-tight-point') nav.go('today');
          else if (contextAction.id === 'personal-ritual') nav.go('insights');
          else nav.go('today');
        }}
        onQuietModeChange={toggleQuietMode}
        onPositionChange={(next) => setMelo({ preferredPosition: next })}
        onTalk={() => nav.openMelo()}
      />
      <MeloIntroSheet
        visible={introOpen}
        onClose={() => {
          setMeloPrimerSeen(true);
          setIntroOpen(false);
        }}
        onContinue={() => {
          setMeloPrimerSeen(true);
          setIntroOpen(false);
          nav.openSheet('onboarding');
        }}
      />
    </Animated.View>
  );
}

function formatWholePounds(value: number): string {
  const sign = value < 0 ? '−' : '';
  return `${sign}£${Math.abs(Math.round(value)).toLocaleString('en-GB')}`;
}

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

function ReadingCell({
  label,
  value,
  palette,
}: {
  label: string;
  value: string;
  palette: Palette;
}) {
  return (
    <View
      style={[
        styles.readingCell,
        { backgroundColor: palette.surface, borderColor: palette.hairline },
      ]}
    >
      <Text style={[styles.readingValue, { color: palette.ink }]}>{value}</Text>
      <Text style={[styles.readingLabel, { color: palette.muted }]}>{label}</Text>
    </View>
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
  talkButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: gap.lg,
    minHeight: 48,
    paddingHorizontal: gap.xl,
  },
  talkButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  talkButtonArrow: {
    fontSize: 18,
    marginLeft: gap.sm,
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
  readingGrid: {
    flexDirection: 'row',
    gap: gap.sm,
    marginTop: gap.md,
  },
  readingCell: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    minWidth: 0,
    paddingHorizontal: gap.sm,
    paddingVertical: gap.md,
  },
  readingValue: {
    fontFamily: serif.display,
    fontSize: 17,
    fontVariant: ['tabular-nums'],
    lineHeight: 19,
  },
  readingLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  memoryEmpty: {
    alignItems: 'flex-start',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: gap.md,
    marginTop: gap.md,
    padding: gap.md,
  },
  memoryEmptyCopy: {
    flex: 1,
    fontFamily: serif.displayItalic,
    fontSize: 13,
    lineHeight: 18,
  },
  memoryList: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.md,
    overflow: 'hidden',
  },
  memoryRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: gap.sm,
    paddingHorizontal: gap.md,
    paddingVertical: gap.sm + 2,
  },
  memoryDot: {
    borderRadius: 3,
    height: 6,
    marginTop: 6,
    width: 6,
  },
  memoryLine: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
  memoryWhen: {
    fontSize: 10,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.6,
    marginTop: 2,
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
  soundRow: {
    marginTop: gap.sm,
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
