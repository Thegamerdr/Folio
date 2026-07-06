// PasteSuccessScreen — the faithful 1:1 React Native port of the web pasted-text confirmation gate
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPasteSuccess.tsx).
//
// @rn-screen    PasteSuccessScreen
// @rn-stack     Intake > Things to check
// @purpose      Show what Folio found in pasted text (or an uploaded CSV/TXT) before the user
//               accepts. A calm preview gate: a hairline-divided list of money-in / money-out items
//               + one Melo line, then a primary path to check them and a quiet "leave for later".
//               Nothing is committed here — the user only chooses to proceed.
// @reads        — (the found list derives from the `pasteText` prop via the pure parseSheet engine).
// @writes       enqueueReviewItems (primary CTA only — what the card showed moves into the PERSISTED
//               review queue with source "csv", then routes to Review; web ScreenPasteSuccess `send`
//               parity. Still no money-path mutation: an Accept in the downstream Review step is
//               what calls store.addTransaction — never here.)
// @opens-sheet  edit-item (INTENDED downstream from Review; NOT fired here. Kept documented but not
//               opened.)
// @copy         FROZEN
// @tokens       surface · hairline · positive · calm (accent) · muted · ink · inverse — all from the
//               kit via '@/folio/theme'. No new token.
// @motion       slide-in-r (whole screen) · press 0.97 (kit `pressed`) · Melo breathe + blink
//               (from MeloLine, calm mood — the only continuous motion on this quiet screen).
//
// @rn-engine text-reader — WIRED. The found list is now the real pure `parseSheet` engine
//   (apps/mobile/src/folio/lib/importSheet.ts, ENGINES.md §6) output, not a hand-built array.
//   The demo has no live clipboard text threaded in (FolioShell renders this screen with `nav`
//   only), so — per the build task — `parseSheet` is driven from the screen's existing sample
//   rows, restated faithfully as pasted spreadsheet text (the web source's exact three items: no
//   fabricated merchants / numbers). The engine returns CandidateMoneyItem[] + honest ColumnIssue[];
//   the clean sample parses with zero issues. Nothing is counted here — review-before-truth: an
//   Accept happens only downstream in the Visualizer (which calls store.addTransaction), never here.
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit/source):
//   • Accent word "check." is rendered UPRIGHT terracotta inside the Fraunces headline (web
//     <em class="not-italic text-[accent]">). Sourced from the keyed copy.add.success.paste
//     ('Things to **check.**') and split on the **accent** marker so exactly one accent word renders.
//   • Money tone IS sign-derived here (faithful to the web): money-in reads green/positive, money-out
//     reads INK. The dot beside an "in" row is green, an "out" row is terracotta. The sign is carried
//     by the +/− glyph; the amounts are rendered as the web's exact preformatted strings (+£1,200 /
//     −£42 / −£750) with the U+2212 minus, byte-for-byte.
//   • Tailwind divide-y has no RN analog — a manual per-row top hairline; the first row carries none
//     so it never doubles with the card's outer hairline (matches VisualizerScreen).
//   • The web's literal '←' glyph is drawn as a small inline react-native-svg icon (the codebase ships
//     no icon font), matching PdfSuccessScreen's BackArrow.
//   • slide-in-r: translateX 28→0 + fade over 360ms ease-out-expo, gated to FINAL STATE under
//     reduce-motion (resolved layout, never a slower animation), mirroring Melo + StartScreen.
//   • Press feedback is the kit `pressed` feel (scale 0.97 / lowered opacity) via Pressable.
//   • Push-to-bottom: a ScrollView whose contentContainer is flexGrow:1 with a flex:1 spacer pins
//     the CTAs to the bottom; bottom safe-area replaces the web's trailing margin.
//
// STATES (per STATES.md): this file IS the populated/success branch for the text/file reader. All
// five branches render for completeness: populated/offline = the preview (offline ≡ populated, local-
// first); loading = Melo curious + a line, NEVER a spinner; empty/error = the calm EmptyState doorway.
//
// Tokens only — no new colour, font, spacing, radius, or shadow. Tap targets are >=44px or carry
// hitSlop. Copy is VERBATIM: the headline uses the keyed add.success.paste; the eyebrow / subhead /
// row meta / Melo line / CTAs are @copy FROZEN inline literals (the web keeps them inline).

import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { gap, radius, serif, useTheme } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { copy } from '@/folio/copy/copy';
import { EmptyState } from '@/folio/ui/EmptyState';
import { showToast } from '@/folio/ui/Toast';
import { parseSheet, type CandidateMoneyItem, type ColumnIssue } from '@/folio/lib/importSheet';
import { applyMemoryToCandidates } from '@/folio/lib/merchantMemory';
import { isBulkStatement } from '@/folio/lib/bulkLanding';
import { enqueueReviewItems, getState, queueInputFromCandidates } from '@/folio/store';
import { BulkStatementLanding } from '@/folio/ui/BulkStatementLanding';
import type { Nav } from '@/folio/types';

// One thing Folio found in the pasted text — `id` is the candidate's own identity (the list keys on
// THIS, never `merchant`, so two rows for the same merchant never collapse into one — phase ⑦
// "preview key collapse" fix). `flow` distinguishes money-in from money-out, `amount` is the bare
// preformatted magnitude (the screen prepends the +/− glyph), `date` is the short date.
export type PastedItem = {
  id: string;
  merchant: string;
  flow: 'in' | 'out';
  amount: string;
  date: string;
};

// The render states this screen can occupy (per STATES.md PasteSuccess row).
export type PasteSuccessState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type PasteSuccessScreenProps = {
  nav: Nav;
  /** Live pasted/CSV text. When present it is read by the real `parseSheet` engine into the found
   *  list (+ honest issues). Omitted on a cold open — the screen then shows the empty doorway. */
  pasteText?: string;
  /** Pre-derived found list. Overrides the engine derivation when supplied (e.g. for a fixture). */
  items?: readonly PastedItem[];
  state?: PasteSuccessState;
};

// The short date label each row shows, keyed by merchant — restated labels layered on top of a live
// parse's money facts (the same metadata-map role SAMPLE_ROW_META plays in the Visualizer). Kept
// because `toPastedItems` reads it for known merchants; a real paste falls back to the parsed date.
const SAMPLE_DATE_LABELS: Readonly<Record<string, string>> = {
  Tesco: '26 Jun',
  Salary: '25 Jun',
  Rent: '1 Jul',
};

// Format a bare GBP magnitude the way the web preformatted it: whole pounds, thousands grouped, no
// pence (42 → "£42", 1200 → "£1,200", 750 → "£750"). Pence are shown only when the magnitude isn't
// whole, so a real pasted "12.50" never silently loses its decimals.
function formatMagnitude(amount: number): string {
  const magnitude = Math.abs(amount);
  const grouped = magnitude.toLocaleString('en-GB', {
    minimumFractionDigits: Number.isInteger(magnitude) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `£${grouped}`;
}

// Map the engine's CandidateMoneyItem[] (the real `parseSheet` output) into this screen's render
// shape. The sign carries money-in vs money-out; the magnitude is reformatted to the web's exact
// preformatted string; the short date label is restated from the same day. Faithful, no new data.
// Carrying the candidate's own `id` through is what lets the list key on a stable per-row identity
// instead of collapsing same-merchant rows (phase ⑦ "preview key collapse" fix).
function toPastedItems(candidates: readonly CandidateMoneyItem[]): PastedItem[] {
  return candidates.map((candidate) => ({
    id: candidate.id,
    merchant: candidate.merchant,
    flow: candidate.amount >= 0 ? 'in' : 'out',
    amount: formatMagnitude(candidate.amount),
    date: SAMPLE_DATE_LABELS[candidate.merchant] ?? candidate.date ?? '',
  }));
}

// Shared ease-out-expo — the web's cubic-bezier(.16, 1, .3, 1).
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// slide-in-r geometry (spec @motion): the whole screen enters from +28px on X with a fade over 360ms.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;

// Local reduce-motion read, mirroring Melo.tsx + StartScreen.tsx exactly: read once, then subscribe.
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

// Split a frozen copy string on its single **accent** marker into lead / accent / tail.
function splitAccent(source: string): { lead: string; accent: string; tail: string } {
  const open = source.indexOf('**');
  const close = source.indexOf('**', open + 2);
  if (open === -1 || close === -1) {
    return { lead: source, accent: '', tail: '' };
  }
  return {
    lead: source.slice(0, open),
    accent: source.slice(open + 2, close),
    tail: source.slice(close + 2),
  };
}

export function PasteSuccessScreen({
  nav,
  pasteText,
  items: itemsOverride,
  state = 'populated',
}: PasteSuccessScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  // The real engine derivation. Live pasted text (when threaded in) is read by `parseSheet`;
  // otherwise we fall back to the faithful sample (the same module-level parse, no re-run). An
  // explicit `items` prop still wins for fixtures. `issues` are the engine's honest fix prompts.
  // `candidates` keeps the raw parse output so the primary CTA can enqueue exactly what the card
  // showed (an `items` fixture carries no raw candidates, so it enqueues nothing — tests only).
  const { items, issues, candidates } = useMemo(() => {
    if (itemsOverride) {
      return {
        items: itemsOverride,
        issues: [] as readonly ColumnIssue[],
        candidates: [] as readonly CandidateMoneyItem[],
      };
    }
    if (pasteText !== undefined) {
      const parsed = parseSheet(pasteText, { source: 'paste' });
      // RECALL (lib/merchantMemory.ts, DATA_INTELLIGENCE.md phase ③): this is the
      // one paste path that never touches setReaderCandidates (the file/photo
      // reader's choke point), so a remembered merchant category is applied here
      // directly before the candidates reach the card / the queue. Category only.
      const withMemory = applyMemoryToCandidates(parsed.candidates, getState().merchantCategories);
      return {
        items: toPastedItems(withMemory),
        issues: parsed.issues,
        candidates: withMemory,
      };
    }
    // Nothing pasted (a cold open from the nav): show the empty doorway below, never a fabricated
    // sample list. The SAMPLE_* consts are gone — a real paste is the only source of rows here.
    return {
      items: [] as readonly PastedItem[],
      issues: [] as readonly ColumnIssue[],
      candidates: [] as readonly CandidateMoneyItem[],
    };
  }, [itemsOverride, pasteText]);

  // slide-in-r — drives the whole screen. Under reduce-motion we resolve straight to final state.
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

  const { lead, accent, tail } = useMemo(() => splitAccent(copy.add.success.paste), []);

  // BULK ADD-AS-HISTORY (task): a multi-candidate paste/CSV read (a real statement pasted or
  // uploaded) swaps the ordinary single-item CTA pair for the bulk landing surface. A
  // single-candidate read, or a fixture-driven `items` prop, is unchanged — same
  // enqueue-then-Review path (`candidates` is already [] for an `items` fixture, so
  // `isBulkStatement` reads false there too).
  const isBulk = isBulkStatement(candidates.length);

  // A hard column issue means the engine could not understand the paste at all (no amount/name
  // column, or empty input) — that IS the "read failed" case, so it resolves to the same calm error
  // doorway below rather than a hollow card. Row-level issues (a single bad amount) are not hard;
  // the good rows still render.
  const hasHardIssue = issues.some(
    (issue) =>
      issue.code === 'missing-amount' ||
      issue.code === 'missing-merchant' ||
      issue.code === 'empty-input',
  );

  // error — the read failed; the calm EmptyState doorway, routing back to intake to paste again.
  if (state === 'error' || (hasHardIssue && items.length === 0)) {
    return (
      <EmptyState
        mood="calm"
        headline={copy.err.statement.unreadable}
        cta={{ label: 'Paste again', onPress: () => nav.go('intake') }}
      />
    );
  }

  // empty — n/a in practice (you only land here when something was found). Rendered as the calm
  // EmptyState so the screen never shows a hollow "0 things" card.
  if (state === 'empty' || items.length === 0) {
    return (
      <EmptyState
        mood="calm"
        headline="Nothing to check."
        body="Folio didn't find money in this one. Paste a bit more, or add one thing yourself."
        cta={{ label: 'Paste again', onPress: () => nav.go('intake') }}
      />
    );
  }

  // loading — Melo curious + a line, NEVER a spinner (hard rule + STATES.md).
  if (state === 'loading') {
    return (
      <View
        style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxl }]}
      >
        <MeloLine mood="curious" text="Folio is reading…" />
      </View>
    );
  }

  // populated / offline — the real preview. offline ≡ populated (the read already happened upstream).
  const count = items.length;
  const eyebrow = `${count} thing${count === 1 ? '' : 's'} to check`;

  return (
    <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — back glyph · Pasted label · balancing spacer. */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={nav.back}
            style={({ pressed: isPressed }) => [
              styles.pressIcon,
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <BackArrow color={t.muted} />
          </Pressable>
          <Text style={[styles.headerLabel, { color: t.muted }]}>Pasted</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Intro — italic count eyebrow, the headline with the single accent word "check.", subhead. */}
        <View style={styles.intro}>
          <Text style={[styles.eyebrow, { color: t.muted }]}>{eyebrow}</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {lead}
            <Text style={[styles.headlineAccent, { color: t.calm }]}>{accent}</Text>
            {tail}
          </Text>
          <Text style={[styles.body, { color: t.muted }]}>
            Folio found possible money in and money out. Nothing has been added yet.
          </Text>
        </View>

        {/* Items card — one calm row per pasted item on a single surface card, hairline-divided. */}
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          {items.map((item, index) => {
            const isIn = item.flow === 'in';
            return (
              <View
                key={item.id}
                style={[
                  styles.row,
                  index > 0 ? { borderTopColor: t.hairline, ...styles.rowDivider } : undefined,
                ]}
              >
                <View style={[styles.dot, { backgroundColor: isIn ? t.positive : t.calm }]} />
                <View style={styles.rowMeta}>
                  <Text numberOfLines={1} style={[styles.merchant, { color: t.ink }]}>
                    {item.merchant}
                  </Text>
                  <Text style={[styles.rowSub, { color: t.muted }]}>
                    {`${item.date} · money ${item.flow}`}
                  </Text>
                </View>
                {/* Money — money-in green/positive, money-out INK; sign carried by the +/− glyph. */}
                <Text style={[styles.amount, { color: isIn ? t.positive : t.ink }]}>
                  {`${isIn ? '+' : '−'}${item.amount}`}
                </Text>
              </View>
            );
          })}
        </View>

        {/* BULK ADD-AS-HISTORY (task): a multi-candidate paste/CSV read (a real statement) swaps
            the ordinary single-item CTA pair for the bulk landing surface — summary + "Add all as
            history" / "Review one by one" + the post-import offer sequencer. A single-candidate
            read is unchanged — same enqueue-then-Review path as before. */}
        {isBulk ? (
          <BulkStatementLanding
            nav={nav}
            candidates={candidates}
            onAdded={() => {}}
            onReviewOneByOne={() => {
              const { dropped } = enqueueReviewItems(queueInputFromCandidates(candidates, 'csv'));
              if (dropped > 0) {
                showToast(
                  'Showing the newest 60 to check first',
                  `${dropped} more will follow as you clear them.`,
                );
              }
              nav.go('review');
            }}
          />
        ) : (
          <>
            {/* Melo line — the quiet companion, calm mood. MeloLine adds the straight quotes. */}
            <View style={styles.meloBlock}>
              <MeloLine mood="calm" text="Use what you have. You choose what counts." />
            </View>

            {/* Spacer pins the CTAs to the bottom, mirroring the web flex-1 spacer. */}
            <View style={styles.spacer} />

            {/* Primary CTA — terracotta fill; enqueues what the card showed into the persisted review
                queue and routes to Review, faithful to the web source (ScreenPasteSuccess.tsx `send`:
                enqueueReviewItems with source "csv", then nav.go("review")). Review-before-truth holds —
                queued items are candidates, never posted facts. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Check these"
              accessibilityHint="Opens the review of what was found"
              onPress={() => {
                const { dropped } = enqueueReviewItems(queueInputFromCandidates(candidates, 'csv'));
                if (dropped > 0) {
                  showToast(
                    'Showing the newest 60 to check first',
                    `${dropped} more will follow as you clear them.`,
                  );
                }
                nav.go('review');
              }}
              style={({ pressed: isPressed }) => [
                styles.primary,
                { backgroundColor: t.calm },
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.primaryLabel, { color: t.inverse }]}>Check these</Text>
            </Pressable>

            {/* Secondary CTA — quiet "leave for later" (backs out, nothing added). */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Leave for later"
              onPress={nav.back}
              style={({ pressed: isPressed }) => [
                styles.secondary,
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.secondaryLabel, { color: t.muted }]}>Leave for later</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
}

// Back arrow — the web '←' glyph, drawn inline (matches PdfSuccessScreen). 20×20 user space.
function BackArrow({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path
        d="M12 4 L6 10 L12 16"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M6 10 H16" stroke={color} strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // px-7 ≈ screen inset → gap.xl (24). flexGrow:1 + a flex:1 spacer pins the CTAs to the bottom.
  content: {
    flexGrow: 1,
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
  pressIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 20,
  },
  // Pasted — uppercase, tracked, 12px, muted.
  headerLabel: {
    fontSize: 12,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  headerSpacer: {
    width: 20,
  },
  // mt-6 (24) → gap.xl.
  intro: {
    marginTop: gap.xl,
  },
  // Fraunces italic eyebrow, 13px, muted.
  eyebrow: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
  },
  // Fraunces hero, 30px, tight line-height, mt-1.
  headline: {
    fontFamily: serif.display,
    fontSize: 30,
    lineHeight: 34,
    marginTop: gap.xs,
  },
  // The accent word stays UPRIGHT (web em.not-italic) — same display face, normal style.
  headlineAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  // 13.5px relaxed body, mt-3, muted.
  body: {
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: gap.md,
  },
  // Items card — surface bg, 1px hairline border, 2xl radius, mt-6, rows divided.
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.xl,
  },
  // Row — px-4 py-3.5, row, gap-3. The first row carries no top hairline.
  row: {
    alignItems: 'center',
    columnGap: gap.md,
    flexDirection: 'row',
    paddingHorizontal: gap.lg,
    paddingVertical: 14,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // w-1.5 h-1.5 (6) rounded-full dot — green on "in", terracotta on "out".
  dot: {
    borderRadius: radius.pill,
    height: 6,
    width: 6,
  },
  rowMeta: {
    flex: 1,
    minWidth: 0,
  },
  // 14px medium, truncating.
  merchant: {
    fontSize: 14,
    fontWeight: '500',
  },
  // 11.5px muted, mt-0.5.
  rowSub: {
    fontSize: 11.5,
    marginTop: gap.xxs,
  },
  // Money — the web <Money size="sm"> is Fraunces display, tabular, medium, 15px.
  amount: {
    fontFamily: serif.display,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },
  // mt-5.
  meloBlock: {
    marginTop: gap.lg + gap.xs,
  },
  spacer: {
    flex: 1,
  },
  // Primary CTA — h-[58px], 2xl radius, terracotta fill.
  primary: {
    alignItems: 'center',
    borderRadius: radius.xl,
    height: 58,
    justifyContent: 'center',
  },
  primaryLabel: {
    fontSize: 15.5,
    fontWeight: '500',
  },
  // Secondary CTA — h-[46px], 2xl radius, mt-2, no fill.
  secondary: {
    alignItems: 'center',
    borderRadius: radius.xl,
    height: 46,
    justifyContent: 'center',
    marginTop: gap.sm,
  },
  secondaryLabel: {
    fontSize: 13,
  },
  // The kit press feel (web `press` util — scale 0.97 / lowered opacity).
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
});
