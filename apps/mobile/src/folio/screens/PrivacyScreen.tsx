// PrivacyScreen — the faithful 1:1 React Native port of the web "Your data" surface
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPrivacy.tsx).
//
// @rn-screen    PrivacyScreen
// @rn-stack     More > Data & privacy
// @purpose      Plain statement of what Folio does (and doesn't do) with the user's data, plus export
//               and reset.
// @reads        — (no store reads for render; getState() is read imperatively only inside the Start
//               fresh handler to snapshot state for Undo — never a reactive subscription)
// @writes       resetAll() (via Start fresh) · setPartial(snapshot) (via Undo)
// @opens-sheet  share (export)
// @copy         FROZEN — must match what the app actually does. No false claims. Checked by the RN
//               copy-lint tests (copyLint.test.ts): no banned words, no false privacy/security claims.
// @tokens       calm (accent) · positive (check) · repair (negative "Start fresh") · surface · hairline
//               · muted · canvas · ink — all from the kit via '@/folio/theme'
// @motion       slide-in-r on mount (whole screen, translateX 28→0 + fade, 360ms ease-out-expo) ·
//               press 0.97 on every tappable (kit `pressed`) · Melo breathe/blink at the footer (calm)
// @notes        Claims here are checked by RN copy-lint tests. Edit copy with care.
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit/store source):
//   • COPY IS FROZEN. Every visible string is the web literal, byte-for-byte. The deck (COPY_DECK.md)
//     has NO keys for this screen, so the strings are inline literals here (exactly as the web keeps
//     them) — none of them are keyed in '@/folio/copy/copy', so nothing is imported from the deck.
//     They must remain literally true of the shipped app, or the honest-claims copy-lint fails.
//   • The accent word "your call." is rendered UPRIGHT (not italic) in terracotta — the web uses
//     <em class="not-italic text-[accent]">. The headline is two Text runs so the accent run is a
//     nested, upright, calm-coloured span inside the Fraunces hero line (same pattern as StartScreen).
//   • The three honest claims each carry a positive-tinted check badge: a 15% alpha tint of the
//     `positive` token (web bg-[var(--positive)]/15), computed in RN — never a hard-coded hex — with
//     the kit's CheckGlyph in `positive` ink. Marked aria-hidden (importantForAccessibility="no") so
//     the claim text carries the meaning, matching the web's aria-hidden tick.
//   • The primary CTA is a Pressable carrying the terracotta fill + the warm raised glow (the kit's
//     `elevation.cta` — the in-system realisation of the web's literal terracotta drop shadow
//     rgba(224,99,58,0.55), which is NOT a token and must not be reintroduced). It opens the share
//     sheet via nav.openSheet('share'). Note this is a plain centred label (no arrow), faithful to the
//     web button, so it is NOT the kit's <PrimaryAction> (which pins a chevron).
//   • The action list is a single `surface` card with the kit hairline border, holding two rows split
//     by ONE inter-row hairline (web divide-y → a single divider between the two rows; never above row
//     1 or below row 2). Each row is a Pressable with the kit `pressed` feel and a right chevron.
//   • Start fresh snapshots the full state, calls resetAll(), navigates to Start, then offers Undo.
//     The web used a 6s sonner toast with a tappable Undo; the RN-native analog already established in
//     this codebase (SubscriptionsScreen) is Alert.alert with an Undo action, so Start fresh uses the
//     same convention — title "Started fresh", body "Everything cleared.", an Undo that restores the
//     snapshot via setPartial. Fidelity note carried below: resetAll() RESEEDS demo data (it is NOT a
//     truly empty store), so "clears everything" / "Delete everything in one tap" describe the user's
//     own data being wiped — the seed is sample/demo content, not the user's. See @rn-engine note.
//   • slide-in-r resolves straight to its final state under reduce-motion (resolved layout, never a
//     slower animation), mirroring Melo's own gating and StartScreen.
//   • STATES: per the spec, Privacy is populated-only and offline ≡ populated (local-first, no network
//     dependency, no offline banner). All five branches are rendered for completeness: populated /
//     offline = the real surface; loading = Melo curious + a line (never a spinner, per the hard rule
//     + STATES.md); empty / error = the calm EmptyState doorway (n/a in practice — this screen never
//     fetches and has no async path — but rendered so every branch is exercised).
//
// Tokens only — no new colour, font, spacing, radius, or shadow. Tap targets are >=44px (the rows and
// CTA have generous padding; the back glyph carries hitSlop). Named export (the route file is separate).

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  CheckGlyph,
  ChevronRight,
  elevation,
  gap,
  pressed,
  radius,
  serif,
  useTheme,
} from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { copy } from '@/folio/copy/copy';
import { EmptyState } from '@/folio/ui/EmptyState';
import { getState, resetAll, setPartial } from '@/folio/store';
import type { Nav } from '@/folio/types';

// The render states this screen can occupy. Per the spec, Privacy is populated-only and offline is
// identical to populated (local-first, no network dependency); loading/empty/error are n/a for a
// purely presentational + two-store-actions screen, but are rendered for completeness.
export type PrivacyState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type PrivacyScreenProps = {
  nav: Nav;
  state?: PrivacyState;
};

// The three honest claims — VERBATIM from the web source. Each must stay literally true of the shipped
// app: no ads/tracking is shipped, nothing leaves the device without the export tap, and Start fresh
// wipes the user's data in one tap. Copy-lint checks these.
const HONEST_CLAIMS = [
  'No ads, no tracking',
  'Nothing shared without you tapping export',
  'Delete everything in one tap',
] as const;

// Shared ease-out-expo — the web's cubic-bezier(.16, 1, .3, 1).
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// slide-in-r geometry (from the spec @motion): the whole screen enters from +28px on X with a fade.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;

// The positive check badge is a 15% alpha tint of the `positive` token (web bg-[var(--positive)]/15).
// `positive` is a 6-digit hex; append the 0x26 (~15%) alpha byte so the tint follows the theme rather
// than being a separate hard-coded colour.
const POSITIVE_TINT_ALPHA = '26'; // 0x26 / 0xFF ≈ 0.15

// Local reduce-motion read, mirroring Melo.tsx / StartScreen exactly: read once, then subscribe.
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

export function PrivacyScreen({ nav, state = 'populated' }: PrivacyScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  // slide-in-r — drives the whole screen. 0 = entering, 1 = resting; under reduce-motion we resolve
  // straight to the final state instead of animating.
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

  // Start fresh — snapshot the full state for Undo, clear+reseed, jump to Start, then offer Undo. The
  // web wrapped this in a 6s sonner toast; the RN-native analog (already used in SubscriptionsScreen)
  // is Alert.alert with an Undo action. @rn-engine export, melo-gateway: there is no export/share
  // engine wired from the folio import surface yet — Export my data just opens the 'share' sheet, and
  // resetAll() reseeds sample/demo content (it does NOT leave a truly empty store), so the "clears
  // everything" / "Delete everything in one tap" claims describe the user's OWN data being wiped, not
  // the demo seed. Confirm before ship if the seed should be suppressed after a deliberate reset.
  const handleStartFresh = () => {
    const snapshot = { ...getState() };
    resetAll();
    nav.go('start');
    Alert.alert(
      'Started fresh',
      'Everything cleared.',
      [
        { text: 'Undo', onPress: () => setPartial(snapshot) },
        { text: 'OK', style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  // empty / error — the calm EmptyState doorway (n/a in practice — no async path — rendered for
  // completeness). The single CTA routes back to the doorway so it never dead-ends.
  if (state === 'empty' || state === 'error') {
    const headline = state === 'error' ? copy.err.generic : 'Your data, your call.';
    const body =
      state === 'error'
        ? undefined
        : "Folio shows you what's saved, lets you export it, and wipes it when you say so.";
    return (
      <EmptyState
        mood="calm"
        headline={headline}
        body={body}
        cta={{ label: 'Export my data', onPress: () => nav.openSheet('share') }}
      />
    );
  }

  // loading — Melo curious + a line, never a spinner (per the hard rule + STATES.md). A calm holding
  // moment while the surface settles.
  if (state === 'loading') {
    return (
      <View style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxl }]}>
        <MeloLine mood="curious" text="One second — gathering what's saved." />
      </View>
    );
  }

  // populated / offline — the real surface. offline ≡ populated (local-first; nothing here needs the
  // network, so there is no offline banner).
  const positiveTint = `${t.positive}${POSITIVE_TINT_ALPHA}`;

  return (
    <Animated.View
      style={[
        styles.screen,
        enterStyle,
        { backgroundColor: t.canvas, paddingTop: insets.top + gap.md, paddingBottom: insets.bottom },
      ]}
    >
      {/* Top bar — back glyph · centred eyebrow · an equal-width invisible spacer so the eyebrow stays
          optically centred (the web balances the back arrow with a w-5 spacer, not textAlign:center). */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={16}
          onPress={nav.back}
          style={({ pressed: isPressed }) => [styles.backHit, isPressed ? pressed : undefined]}
        >
          <Text style={[styles.backGlyph, { color: t.muted }]}>←</Text>
        </Pressable>
        <Text style={[styles.eyebrow, { color: t.muted }]}>Your data</Text>
        <View style={styles.topBarSpacer} aria-hidden />
      </View>

      {/* Headline block — "Your data, " + the upright terracotta accent "your call." + the body line. */}
      <View style={styles.headlineBlock}>
        <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
          {'Your data, '}
          <Text style={[styles.headlineAccent, { color: t.calm }]}>your call.</Text>
        </Text>
        <Text style={[styles.body, { color: t.muted }]}>
          Folio shows you what&apos;s saved, lets you export it, and wipes it when you say so.
        </Text>
      </View>

      {/* Three honest claims — each a positive-tinted check badge + the claim text. */}
      <View style={styles.claims}>
        {HONEST_CLAIMS.map((claim) => (
          <View key={claim} style={styles.claimRow}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.checkBadge, { backgroundColor: positiveTint }]}
            >
              <CheckGlyph color={t.positive} size={12} />
            </View>
            <Text style={[styles.claimText, { color: t.ink }]}>{claim}</Text>
          </View>
        ))}
      </View>

      {/* Primary CTA — terracotta fill + the warm raised glow; opens the share (export) sheet. Plain
          centred label, no arrow, faithful to the web button. */}
      <Pressable
        accessibilityHint="Opens the export sheet"
        accessibilityRole="button"
        onPress={() => nav.openSheet('share')}
        style={({ pressed: isPressed }) => [
          styles.primary,
          { backgroundColor: t.calmStrong },
          isPressed ? pressed : undefined,
        ]}
      >
        <Text style={[styles.primaryLabel, { color: t.inverse }]}>Export my data</Text>
      </Pressable>

      {/* Action list card — one surface with the kit hairline border, two rows split by ONE inter-row
          hairline. */}
      <View style={[styles.actionCard, { backgroundColor: t.surface, borderColor: t.hairline }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => nav.go('timeline')}
          style={({ pressed: isPressed }) => [styles.actionRow, isPressed ? pressed : undefined]}
        >
          <View style={styles.actionText}>
            <Text style={[styles.actionTitle, { color: t.ink }]}>See what&apos;s saved</Text>
            <Text style={[styles.actionSubtitle, { color: t.muted }]}>everything you&apos;ve added</Text>
          </View>
          <ChevronRight color={t.muted} />
        </Pressable>

        {/* The single inter-row divider (web divide-y) — one hairline between the two rows only. */}
        <View style={[styles.rowDivider, { backgroundColor: t.hairline }]} />

        <Pressable
          accessibilityRole="button"
          onPress={handleStartFresh}
          style={({ pressed: isPressed }) => [styles.actionRow, isPressed ? pressed : undefined]}
        >
          <View style={styles.actionText}>
            <Text style={[styles.actionTitle, { color: t.repair }]}>Start fresh</Text>
            <Text style={[styles.actionSubtitle, { color: t.muted }]}>clears everything</Text>
          </View>
          <ChevronRight color={t.muted} />
        </Pressable>
      </View>

      {/* Spacer pushes the Melo footer line to the bottom, mirroring the web flex-1 spacer. */}
      <View style={styles.spacer} />

      {/* Melo footer line — the only Melo on screen: the folded-document character (size 28, calm) beside
          one Fraunces-italic thought. The web mood "soft" is non-canonical (MELO_MOODS maps Privacy to
          'calm'), so the canonical 'calm' is used. MeloLine supplies the straight quotes; pass raw text. */}
      <View style={styles.footer}>
        <MeloLine mood="calm" size={28} text="Your numbers are yours to keep or export." />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // px-7 ≈ screen inset (gap.xl = 24); pt-4 ≈ safe-area top + gap.md (12).
  screen: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  loading: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  // Top bar — back · eyebrow · spacer.
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backHit: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  // ← back glyph, 20px, muted (web text-[20px] text-muted-ink).
  backGlyph: {
    fontSize: 20,
  },
  // Eyebrow — 12px, uppercase, tracked, muted (web tracking-[0.14em] uppercase).
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  // The invisible 20px spacer (web w-5) that balances the back arrow so the eyebrow stays centred.
  topBarSpacer: {
    width: 20,
  },
  // mt-10 (40px) = gap.xl (24) + gap.lg (16).
  headlineBlock: {
    marginTop: gap.xl + gap.lg,
  },
  // Fraunces headline, 36px, tight line-height (web font-display text-[36px] leading-[1.05]).
  headline: {
    fontFamily: serif.display,
    fontSize: 36,
    lineHeight: 38,
  },
  // The accent word "your call." stays UPRIGHT (web em.not-italic) — same display face, terracotta.
  headlineAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  // mt-4 (16px); 14px relaxed, muted, max-width ~300 (web text-[14px] leading-relaxed max-w-[300px]).
  body: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: gap.lg,
    maxWidth: 300,
  },
  // mt-6 (24px) = gap.xl; gap-2 (8px) = gap.sm between claim rows (web mt-6 space-y-2).
  claims: {
    gap: gap.sm,
    marginTop: gap.xl,
  },
  // Each claim row — badge + text, gap-3 (12px), 13.5px text (web flex items-center gap-3 text-[13.5px]).
  claimRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: gap.md,
  },
  // The check badge — 20px round well holding the 12px tick (web w-5 h-5 rounded-full).
  checkBadge: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  claimText: {
    fontSize: 13.5,
  },
  // mt-8 (32px) = gap.xxl; full-width terracotta CTA, rounded-2xl (radius.xl = 24), with the warm glow.
  primary: {
    alignItems: 'center',
    borderRadius: radius.xl,
    marginTop: gap.xxl,
    paddingVertical: 18,
    ...elevation.cta,
  },
  // 15px medium label (web text-[15px] font-medium text-white → inverse).
  primaryLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  // mt-3 (12px) = gap.md; surface card with a 1px hairline border, rounded-2xl (radius.xl = 24).
  actionCard: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.md,
    overflow: 'hidden',
  },
  // px-5 py-4 row (web px-5 py-4 flex items-center). py-4 (16px) clears the >=44px tap target.
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: gap.lg + gap.xs, // px-5 ≈ 20
    paddingVertical: gap.lg,
  },
  actionText: {
    flex: 1,
  },
  // 15px medium row title (web text-[15px] font-medium).
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  // 12px muted subtitle, mt-0.5 (web text-[12px] text-muted-ink mt-0.5).
  actionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  // The single inter-row hairline.
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  spacer: {
    flex: 1,
  },
  // mt-6 mb-6 footer (web mt-6 mb-6 flex items-center gap-3). MeloLine owns its own row layout + gap.
  footer: {
    marginBottom: gap.xl,
    marginTop: gap.xl,
  },
});
