// AccountScreen — the faithful 1:1 React Native port of the web account surface
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenAccount.tsx).
//
// @rn-screen    AccountScreen
// @rn-stack     MainTabs > More > Account
// @purpose      A calm read of who you are to Folio — current lens tier (Free / Plus / trial),
//               connected money sources, your footprint, and the quiet levers (sign in, restore
//               purchase, manage plan, export, wipe).
// @reads        subs.length, pots.length, cycles.length, onboarding.monthlyIncome/payday
// @writes       — none directly. "Wipe this device" routes to the gated Privacy reset (see
//               FIDELITY DECISIONS); export routes through the real export engine (via Privacy).
// @copy         FROZEN — ported verbatim from the web literals (no COPY_DECK entry exists yet for
//               this screen, so the web JSX strings are the frozen source, same convention
//               MeloScreen/MoreScreen use for their own inline literals).
// @tokens       canvas · surface · hairline · muted · calm (accent) · calmSoft · inset · ink ·
//               positive · repairInk — all from the kit, no new token.
// @motion       slide-in-r on mount · press 0.97 on every row/button.
//
// FIDELITY DECISIONS (each grounded in the SPEC + confirmed kit/store source):
//   • Lens tier: the web reads `lens.plusUnlocked` / `lens.proUnlocked` / `lens.trialCycleId` from a
//     lens/billing engine (`@/lib/lens`) that does NOT exist in the RN store yet (confirmed: no
//     `lens`, `moneyMode`, or `melo.quietMode` field anywhere in apps/mobile/src/folio/store.ts —
//     GAP_MAP.md batch 5 flags PaywallScreen itself as "a real build not just a port" for the same
//     reason). Per RN_PORT.md's loop discipline ("no new engine slipped in silently... must be added
//     to ENGINES.md first"), this port does NOT invent a shadow lens/billing store slice. Tier is
//     rendered honestly as always "Free" (nothing can be unlocked without the real engine), and the
//     CTA routes to the Paywall screen, which carries the same honest scoping. See the paired
//     @rn-engine tag below and PaywallScreen.tsx's own note.
//   // @rn-engine lens-tier (needs @/folio/lib/lens: plusUnlocked/proUnlocked/trialCycleId + a real
//   // billing/purchase flow — not wired here; tracked, not faked)
//   • Quiet mode: the web reads `melo?.quietMode`. RN's store has no such field (MeloScreen's own
//     quiet-mode row does not exist in this port either), so the "Melo & quiet mode" row hint is
//     rendered without a live quiet-mode read — it states the row's purpose, not a live state, and
//     routes to the Melo screen (nav.go('melo')) exactly like the web.
//   • Bank connection / sign-in: the web's `toast(...)` calls (sonner) are replaced with
//     `Alert.alert`, the established RN convention across this codebase (SubscriptionsScreen /
//     MeloChatSheet / PrivacyScreen) — RN has no sonner equivalent.
//   • Export: the web built a client-side Blob + `<a download>` (browser-only API, does not exist in
//     RN). This port routes "Export your data" through the REAL export engine already wired on
//     Privacy (`runExport()` from '@/folio/lib/exportNative') via `nav.go('privacy')`, so tapping it
//     lands the user on the surface that performs the actual, working export rather than reimplementing
//     a second export entry point or faking a browser download that cannot exist on-device.
//   • Wipe this device: the web wipes directly behind a two-step sonner toast (arm -> confirm), which
//     is a BYPASS of this app's D3 tier-3 wipe policy (exportedAck -> typedConfirm -> finalConfirm,
//     the same "no fake undo after a confirmed wipe" rule PrivacyScreen enforces, and the same reason
//     MoreScreen's own "Start fresh" row was changed to ROUTE to Privacy rather than wipe from the
//     hub). This port does not add a second, weaker wipe path — "Wipe this device" routes to the
//     Privacy screen's gated reset instead of calling resetAll()/resetToEmpty() directly.
//   • Trial days-left chip: the web's trial math depends on `lens.trialCycleId`, which does not exist
//     here (see lens-tier note above) — the chip is dropped rather than rendered against fabricated
//     trial state.
//   • Three-tier-at-a-glance grid + "Sources" tappable rows + "Your footprint" stats are ported
//     1:1 — they read only real store data (subs/pots/cycles/onboarding) and navigate honestly
//     (intake for statements, the onboarding sheet for payday/income, a plain "coming with the mobile
//     app" note for bank connection since there is no bank-link engine anywhere in this codebase).
//   • Accent word "plan": web `<em class="not-italic text-accent">plan</em>`. RN has no inline `<em>`,
//     so the headline is three Text runs and the accent run is a nested UPRIGHT terracotta span (the
//     StartScreen / MeloScreen / MoreScreen pattern — same Fraunces face, colour-only override).
//   • slide-in-r: translateX 28->0 + fade over 360ms ease-out-expo, gated to final state under
//     reduce-motion (MoreScreen / MeloScreen precedent).
//   • STATES: the SPEC-equivalent for this screen is populated-only (offline = populated; no async
//     dependency). All five branches are rendered for completeness, mirroring MoreScreen/MeloScreen.
//
// HONEST CLAIMS: this screen asserts no privacy/security property beyond what Privacy/export actually
// do. No banned product vocabulary appears in any visible string. Every row is a >=44px tap target.

import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccessibilityInfo } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Surface, Hairline, gap, radius, serif, useTheme } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { copy } from '@/folio/copy/copy';
import { useAppStore } from '@/folio/store';
import type { Nav } from '@/folio/types';

// The render states this screen can occupy. Populated-only per the SPEC convention (offline is
// identical to populated — local-first, no network dependency); loading/empty/error are n/a but are
// rendered for completeness so every branch is exercised (mirrors MoreScreen / MeloScreen).
export type AccountScreenState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type AccountScreenProps = {
  nav: Nav;
  state?: AccountScreenState;
};

// Shared ease-out-expo — the web's cubic-bezier(.16, 1, .3, 1).
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// slide-in-r geometry (from the SPEC @motion convention): the whole screen enters from +28px on X.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;

// Local reduce-motion read, mirroring MoreScreen / MeloScreen exactly.
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

// The three tiers at a glance — copy sourced from the web's inline literals (no billing engine
// backs "current" beyond Free; see FIDELITY DECISIONS lens-tier note).
const TIERS: readonly {
  key: 'free' | 'plus' | 'pro';
  name: string;
  price: string;
  hint: string;
}[] = [
  { key: 'free', name: 'Free', price: '£0', hint: 'Survival + Stability' },
  { key: 'plus', name: 'Melo Plus', price: '£4.99', hint: 'Daily clarity · 4 lenses' },
  { key: 'pro', name: 'Melo Pro', price: '£8.99', hint: 'Advanced · shared money' },
];

export function AccountScreen({ nav, state = 'populated' }: AccountScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  const subsCount = useAppStore((s) => s.subs.length);
  const potsCount = useAppStore((s) => s.pots.length);
  const cyclesCount = useAppStore((s) => s.cycles.length);
  const onboarding = useAppStore((s) => s.onboarding);

  // Tier — honestly always 'free'. No lens/billing engine exists in this store yet (see
  // FIDELITY DECISIONS lens-tier note); rendering anything else would fabricate a purchase state.
  const tier: 'free' = 'free';
  const tierLabel = 'Free';
  const tierHint = 'Survival and Stability, always yours.';

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

  // Sources — honest rows. Statements are reachable (real intake flow); bank connection is a plain
  // "coming with the mobile app" note (no bank-link engine anywhere in this codebase); payday/income
  // opens the real onboarding sheet.
  const sources = useMemo(
    () => [
      {
        label: 'Statements & receipts',
        hint: 'PDF · image · paste · CSV',
        state: subsCount + potsCount > 0 ? ('manual' as const) : ('empty' as const),
        action: () => nav.go('intake'),
      },
      {
        label: 'Bank connection',
        hint: 'coming with the mobile app',
        state: 'empty' as const,
        action: () =>
          Alert.alert(
            'Bank link ships with a future update',
            'Nothing to connect here yet.',
            [{ text: 'OK', style: 'cancel' }],
            { cancelable: true },
          ),
      },
      {
        label: 'Payday & income',
        hint:
          onboarding.monthlyIncome > 0
            ? `£${onboarding.monthlyIncome.toLocaleString()} / mo · payday ${onboarding.payday}`
            : 'not set yet — tap to add',
        state: onboarding.monthlyIncome > 0 ? ('manual' as const) : ('empty' as const),
        action: () => nav.openSheet('onboarding'),
      },
    ],
    [subsCount, potsCount, onboarding, nav],
  );

  // Export — routes to Privacy, which owns the real export engine (runExport). Avoids a second,
  // weaker export entry point (see FIDELITY DECISIONS).
  const handleExport = () => nav.go('privacy');

  // Wipe — routes to Privacy's gated D3 reset instead of wiping directly from here (see FIDELITY
  // DECISIONS; mirrors MoreScreen's own "Start fresh" -> Privacy routing).
  const handleWipe = () => nav.go('privacy');

  // empty / error — the calm EmptyState doorway (n/a in practice; rendered for completeness).
  if (state === 'empty' || state === 'error') {
    const headline = state === 'error' ? copy.err.generic : 'Your plan, plainly.';
    const body = state === 'error' ? undefined : 'Who you are to Folio — back in a moment.';
    return (
      <EmptyState
        mood="calm"
        headline={headline}
        body={body}
        cta={{ label: 'Back', onPress: () => nav.back() }}
      />
    );
  }

  // loading — Melo curious + a line, never a spinner (STATES.md convention).
  if (state === 'loading') {
    return (
      <View
        style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.huge }]}
      >
        <MeloLine mood="curious" text="One moment — pulling up your account." />
      </View>
    );
  }

  // populated / offline — the real account read. offline = populated (local-first).
  return (
    <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.xxl },
        ]}
      >
        {/* Header — back glyph · "Account" eyebrow · spacer. */}
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
          <Text style={[styles.eyebrow, { color: t.muted }]}>Account</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Title block. */}
        <View style={styles.titleBlock}>
          <Text style={[styles.kicker, { color: t.muted }]}>You + Folio</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {'Your '}
            <Text style={[styles.headlineAccent, { color: t.calm }]}>plan</Text>
            {', plainly.'}
          </Text>
        </View>

        {/* Tier card. */}
        <Surface style={[styles.tierCard, { borderColor: t.hairline }]}>
          <View style={styles.tierTopRow}>
            <Text style={[styles.tierEyebrow, { color: t.muted }]}>Tier</Text>
            <View style={[styles.tierPill, { backgroundColor: t.inset }]}>
              <Text style={[styles.tierPillLabel, { color: t.muted }]}>{tierLabel}</Text>
            </View>
          </View>
          <Text style={[styles.tierHint, { color: t.ink }]}>{tierHint}</Text>
          <View style={styles.tierActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => nav.go('paywall')}
              style={({ pressed: isPressed }) => [
                styles.tierCta,
                { backgroundColor: t.calm },
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.tierCtaLabel, { color: t.inverse }]}>See plans</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => nav.go('paywall')}
              style={({ pressed: isPressed }) => [
                styles.tierRestore,
                { borderColor: t.hairline },
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.tierRestoreLabel, { color: t.muted }]}>Restore</Text>
            </Pressable>
          </View>
        </Surface>

        {/* Three-tier at a glance. */}
        <View style={styles.tiersGrid}>
          {TIERS.map((p) => {
            const isCurrent = p.key === tier;
            return (
              <Pressable
                accessibilityLabel={`${p.name} — ${p.price} per month. Tap for details.`}
                accessibilityRole="button"
                key={p.key}
                onPress={() => nav.go('paywall')}
                style={({ pressed: isPressed }) => [
                  styles.tierGridCard,
                  { backgroundColor: isCurrent ? t.calmSoft : t.surface, borderColor: t.hairline },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.tierGridName, { color: t.ink }]}>{p.name}</Text>
                <Text style={[styles.tierGridPrice, { color: t.ink }]}>{p.price}</Text>
                <Text style={[styles.tierGridHint, { color: t.muted }]}>{p.hint}</Text>
                {isCurrent ? (
                  <Text style={[styles.tierGridCurrent, { color: t.calm }]}>Current</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* Sources. */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: t.ink }]}>Where your money comes from</Text>
            <Text style={[styles.sectionHint, { color: t.muted }]}>local · this device</Text>
          </View>
          <Surface style={[styles.card, { borderColor: t.hairline }]}>
            {sources.map((s, index) => (
              <View key={s.label}>
                {index > 0 ? <Hairline /> : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={s.action}
                  style={({ pressed: isPressed }) => [
                    styles.row,
                    isPressed ? styles.rowPressed : undefined,
                  ]}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, { color: t.ink }]}>{s.label}</Text>
                    <Text style={[styles.rowHint, { color: t.muted }]}>{s.hint}</Text>
                  </View>
                  <View style={[styles.rowStateChip, { backgroundColor: t.inset }]}>
                    <Text style={[styles.rowStateLabel, { color: t.muted }]}>
                      {s.state === 'manual' ? 'added by you' : 'not yet'}
                    </Text>
                  </View>
                  <Text style={[styles.chevron, { color: t.muted }]}>→</Text>
                </Pressable>
              </View>
            ))}
          </Surface>
        </View>

        {/* Your footprint. */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.ink }]}>Your footprint</Text>
          <View style={styles.statsGrid}>
            <Stat n={subsCount} label="subs" />
            <Stat n={potsCount} label="pots" />
            <Stat n={cyclesCount} label="cycles" />
          </View>
        </View>

        {/* Levers. */}
        <Surface style={[styles.card, styles.leversCard, { borderColor: t.hairline }]}>
          <AccountRow
            label="Melo"
            hint="how Melo speaks, and when"
            onPress={() => nav.go('melo')}
          />
          <Hairline />
          <AccountRow
            label="Payday & income"
            hint={
              onboarding.monthlyIncome > 0
                ? `£${onboarding.monthlyIncome.toLocaleString()} / mo · payday ${onboarding.payday}`
                : 'not set yet'
            }
            onPress={() => nav.openSheet('onboarding')}
          />
          <Hairline />
          <AccountRow
            label="Data & privacy"
            hint="what's saved, what stays local"
            onPress={() => nav.go('privacy')}
          />
          <Hairline />
          <AccountRow
            label="Export your data"
            hint="a complete copy of everything on this device"
            onPress={handleExport}
          />
          <Hairline />
          <AccountRow label="Sign in" hint="save across devices — coming soon" muted />
        </Surface>

        <Surface style={[styles.card, styles.wipeCard, { borderColor: t.hairline }]}>
          <AccountRow
            label="Wipe this device"
            hint="subs, pots, cycles, prefs — gone. can't undo"
            onPress={handleWipe}
            tone="negative"
          />
        </Surface>

        <View style={styles.closing}>
          <MeloLine text="Nothing here is guessed. You'll only see what you added or what Folio read from a statement." />
        </View>

        <Text style={[styles.footer, { color: t.muted }]}>
          Folio · designed on web, shipping on mobile
        </Text>
      </ScrollView>
    </Animated.View>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  const t = useTheme();
  return (
    <Surface style={[styles.statCard, { borderColor: t.hairline }]}>
      <Text style={[styles.statNumber, { color: t.ink }]}>{n}</Text>
      <Text style={[styles.statLabel, { color: t.muted }]}>{label}</Text>
    </Surface>
  );
}

function AccountRow({
  label,
  hint,
  onPress,
  muted,
  tone,
}: {
  label: string;
  hint: string;
  onPress?: () => void;
  muted?: boolean;
  tone?: 'negative';
}) {
  const t = useTheme();
  const labelColor = tone === 'negative' ? t.repairInk : t.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!muted }}
      disabled={!!muted}
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        styles.row,
        muted ? styles.rowMuted : undefined,
        isPressed && !muted ? styles.rowPressed : undefined,
      ]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: labelColor }]}>{label}</Text>
        <Text style={[styles.rowHint, { color: t.muted }]}>{hint}</Text>
      </View>
      {!muted ? <Text style={[styles.chevron, { color: t.muted }]}>→</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  content: {
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
  tierCard: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.xl,
    padding: gap.lg,
  },
  tierTopRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tierEyebrow: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  tierPill: {
    borderRadius: radius.sm,
    paddingHorizontal: gap.sm,
    paddingVertical: 2,
  },
  tierPillLabel: {
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  tierHint: {
    fontFamily: serif.display,
    fontSize: 20,
    lineHeight: 24,
    marginTop: gap.sm,
  },
  tierActions: {
    columnGap: gap.sm,
    flexDirection: 'row',
    marginTop: gap.md,
  },
  tierCta: {
    alignItems: 'center',
    borderRadius: radius.lg,
    flex: 1,
    paddingVertical: gap.md,
  },
  tierCtaLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  tierRestore: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    paddingHorizontal: gap.lg,
  },
  tierRestoreLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  tiersGrid: {
    columnGap: gap.sm,
    flexDirection: 'row',
    marginTop: gap.md,
  },
  tierGridCard: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    padding: gap.sm + gap.xxs,
  },
  tierGridName: {
    fontFamily: serif.display,
    fontSize: 14,
    lineHeight: 17,
  },
  tierGridPrice: {
    fontFamily: serif.display,
    fontSize: 18,
    lineHeight: 20,
    marginTop: gap.xs,
  },
  tierGridHint: {
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: gap.xs + gap.xxs,
  },
  tierGridCurrent: {
    fontSize: 9,
    letterSpacing: 1.4,
    marginTop: gap.xs + gap.xxs,
    textTransform: 'uppercase',
  },
  section: {
    marginTop: gap.xl,
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
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.md,
    overflow: 'hidden',
  },
  leversCard: {
    marginTop: gap.xl,
  },
  wipeCard: {
    marginTop: gap.md,
  },
  row: {
    alignItems: 'center',
    columnGap: gap.md,
    flexDirection: 'row',
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md + gap.xxs,
  },
  rowMuted: {
    opacity: 0.55,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  rowHint: {
    fontFamily: serif.displayItalic,
    fontSize: 11,
    marginTop: 2,
  },
  rowStateChip: {
    borderRadius: radius.sm,
    paddingHorizontal: gap.xs + gap.xxs,
    paddingVertical: 2,
  },
  rowStateLabel: {
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  chevron: {
    fontSize: 15,
  },
  statsGrid: {
    columnGap: gap.sm,
    flexDirection: 'row',
    marginTop: gap.md,
  },
  statCard: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    paddingVertical: gap.md,
  },
  statNumber: {
    fontFamily: serif.display,
    fontSize: 22,
    lineHeight: 24,
  },
  statLabel: {
    fontSize: 10.5,
    letterSpacing: 1.4,
    marginTop: gap.xs + gap.xxs,
    textTransform: 'uppercase',
  },
  closing: {
    marginTop: gap.xl,
  },
  footer: {
    fontFamily: serif.displayItalic,
    fontSize: 10.5,
    marginBottom: gap.xxl,
    marginTop: gap.xl,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
});
