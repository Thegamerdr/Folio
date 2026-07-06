// PdfSuccessScreen — the faithful 1:1 React Native port of the web statement-read confirmation
// gate (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPdfSuccess.tsx).
//
// @rn-screen    PdfSuccessScreen
// @rn-stack     Intake > Statement found
// @purpose      Show what Folio found in a statement before the user accepts. A calm preview gate:
//               file summary + a short list of found money items + one Melo line, then a primary
//               path to review what was found and a secondary path to use a different file. Nothing
//               is committed here — the user only chooses to proceed (review-before-truth).
// @reads        readerCandidates (the staged reader output this screen previews).
// @writes       enqueueReviewItems + clearReaderCandidates (primary CTA only — what the card showed
//               moves into the PERSISTED review queue, then routes to Review; web ScreenPdfSuccess
//               parity. Still no money-path mutation: an Accept in the downstream Review step is
//               what calls store.addTransaction — never here.)
// @opens-sheet  edit-item (INTENDED downstream from Review, NOT fired on this screen. We keep
//               edit-item documented but do not open it.)
// @copy         FROZEN
// @tokens       surface · hairline · positive · calm (accent) · calmSoft (accent-soft) · muted ·
//               ink · inverse — all from the kit via '@/folio/theme'. No new token.
// @motion       slide-in-r (whole screen) · press 0.97 (kit `pressed`) · Melo breathe + blink
//               (from MeloLine, soft mood — the only continuous motion on this quiet screen).
//               The doc-block's "stamp on accept" belongs to the DOWNSTREAM accept moment
//               (ritual/visualizer), NOT this screen — it is not fired here.
//
// @rn-engine statement-reader — WIRED to the real reader. When the Intake screen has STAGED
//   candidates in the store (`readerCandidates`) — the LLM reader's output for a picked PDF, or the
//   pure `parseSheet` output for a picked CSV / TSV / TXT — this screen renders THOSE real candidates
//   (review-before-truth — candidates only, never auto-counted). When the slot is empty (a cold /
//   dev open of this screen, e.g. FolioShell rendering it with `nav` only), it falls back to the
//   faithful SAMPLE below: the web source's exact three items, restated as statement text and run
//   through the real `parseSheet` engine (no hand-built array, no fabricated merchants / numbers).
//   The file name + page count are the reader's metadata; the sample keeps the web source's values,
//   and a live read shows an honest "read from your statement" label since the reader stages only the
//   money movements, not the file's page count.
// @rn-engine ocr-extraction — the extractor for a real PDF is the LLM reader (gateway vision model,
//   src/local/statementReaderClient.ts), reached from the Intake screen. The native PdfRenderer +
//   ML Kit module is NOT the blocker anymore; this success preview is reached when the reader staged
//   real candidates, and a read that found nothing routes to the honest pdf-fallback instead.
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit/source):
//   • Accent word "read" is rendered UPRIGHT terracotta inside the Fraunces headline — the web uses
//     <em class="not-italic text-[accent]">. Exactly one accent word (voice rule). Built as nested
//     Text runs in the same display face, the accent run coloured t.calm with normal style.
//   • Money tone is NOT sign-derived. The income (+£2,180) is INK, the bills (−£118 / −£42) are INK —
//     the web <Money> defaults to tone='ink'. Sign is carried by the +/− glyph only. The amounts are
//     now formatted FROM the engine's signed candidate amount (formatSignedAmount), which emits the
//     same byte-exact strings the web hand-wrote: a '+' for income, the U+2212 minus '−' for spend /
//     bills, whole pounds grouped (2180 → "+£2,180", 118 → "−£118", 42 → "−£42"). The salary name
//     keeps its em-dash (U+2014). The hint ('looks like income' / 'looks like a bill' / 'likely
//     spending') is mapped from the candidate `kind` — a voice-approved confidence line, never a raw
//     category code — so the rendered list stays byte-identical while the money facts flow through
//     the real engine.
//   • Glyphs: the web's literal '←' and '▤' are drawn as small inline react-native-svg icons (the
//     codebase draws its own glyphs — ChevronRight/CheckGlyph/Melo — and ships no icon font), not as
//     unicode text that renders inconsistently across OSes.
//   • Primary CTA carries a TERRACOTTA-tinted lift (the kit `elevation.cta`, shadowColor terracotta),
//     the in-system realisation of the web's box-shadow rgba(224,99,58,0.55) — never a gray Android
//     elevation.
//   • slide-in-r: translateX 28→0 + fade over 360ms ease-out-expo, gated to FINAL STATE under
//     reduce-motion (resolved layout, never a slower animation), mirroring Melo + StartScreen.
//   • Press feedback is the kit `pressed` feel (scale 0.97 / lowered opacity) via Pressable — the
//     token equivalent of the web `press` util, matching StartScreen (the codebase ships no
//     expo-haptics; the spec's Haptics.selectionAsync() is the ideal, gated on that dep landing).
//   • Push-to-bottom: a ScrollView whose contentContainer is flexGrow:1 with a flex:1 spacer pins the
//     two CTAs to the bottom; a naive ScrollView collapses the spacer. Bottom safe-area replaces the
//     web's trailing h-4.
//   • Truncation: file title + item merchant are numberOfLines={1} in a flex:1 / minWidth:0
//     (flexShrink:1) row so a long name never pushes the amount off-screen.
//
// STATES (per STATES.md PdfSuccess row): this file is the POPULATED/success branch. All five branches
// are rendered for completeness:
//   • populated / offline — the real preview (offline ≡ populated; local-first, nothing here needs
//     the network — the read already happened upstream).
//   • loading — Melo curious + a line, NEVER a spinner (max 4s upstream, then this success screen).
//   • error — routed to the fallback ('File saved.', add.fallback.pdf) UPSTREAM; this screen renders
//     no inline error. The error branch here is a calm EmptyState doorway so the screen never
//     dead-ends if it is ever mounted in that state directly.
//   • empty — n/a in practice (you only land here when something was read); a zero-candidate read is a
//     fallback/empty-found case the flow defines upstream. Rendered as the calm EmptyState for safety.
//
// Tokens only — no new colour, font, spacing, radius, or shadow. Tap targets are >=44px or carry
// hitSlop. Copy is VERBATIM: the headline uses the keyed add.success.pdf ('Folio **read** your
// statement.'); the eyebrow / body / Melo line / section label / CTAs are @copy FROZEN inline
// literals (the web keeps them inline; they are not yet keyed in COPY_DECK — only add.success.pdf is).

import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { elevation, gap, radius, serif, useTheme } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { copy } from '@/folio/copy/copy';
import { EmptyState } from '@/folio/ui/EmptyState';
import { showToast } from '@/folio/ui/Toast';
import { parseSheet, type CandidateKind, type CandidateMoneyItem } from '@/folio/lib/importSheet';
import { isBulkStatement } from '@/folio/lib/bulkLanding';
import {
  clearReaderCandidates,
  enqueueReviewItems,
  queueInputFromCandidates,
  useReaderCandidates,
  useReaderClosingBalance,
} from '@/folio/store';
import { BulkStatementLanding } from '@/folio/ui/BulkStatementLanding';
import type { Nav } from '@/folio/types';

// A single thing Folio found in the statement — the eventual shape of one CandidateMoneyItem from the
// @rn-engine statement-reader. `id` is the candidate's own identity (falls back to a stable per-index
// synthetic id for fixture rows that carry none) — the found list keys on THIS, never `merchant`, so
// two rows for the same merchant (e.g. two Tesco spends in one statement) never collapse into one
// (phase ⑦ "preview key collapse" fix). `hint` is the voice-approved confidence line ('looks like
// income' / 'looks like a bill' / 'likely spending') — never a raw category code, and `amount` is the
// preformatted signed money string (the reader formats it; the screen renders it).
export type FoundItem = {
  id: string;
  merchant: string;
  hint: string;
  amount: string;
};

// What a completed read hands this screen. Until the reader lands, the shell passes the SAMPLE_FOUND
// below (the web source's exact three items), so the screen renders honestly off real-shaped data.
export type FoundStatement = {
  fileName: string;
  pageCount: number;
  items: readonly FoundItem[];
};

// The render states this screen can occupy (per STATES.md PdfSuccess row).
export type PdfSuccessState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type PdfSuccessScreenProps = {
  nav: Nav;
  statement?: FoundStatement;
  state?: PdfSuccessState;
};

// The web prototype's three items, restated VERBATIM as statement text so the real `parseSheet`
// engine — not a hand-built array — produces the rendered candidates. Tab-separated with a header the
// engine auto-detects; the `type` column lets the engine sign + classify each amount. Merchants and
// magnitudes are the web source's exact three items (no fabricated merchants/numbers); the salary name
// keeps its em-dash (U+2014). The whole-pound magnitudes (2180 / 118 / 42) are restated as the same
// integers the web hand-wrote, so the formatter below re-emits the byte-exact strings.
const SAMPLE_STATEMENT_TEXT: string = [
  'merchant\tamount\ttype',
  'Salary — Whitstone Ltd\t2180\tincome',
  'Octopus Energy\t118\tbill',
  'Tesco\t42\tspend',
].join('\n');

// Map the engine's candidate `kind` → the voice-approved confidence hint the web hand-wrote. Never a
// raw category code (banned). Income/bill/spend cover the sample; anything else degrades to the calm
// generic 'a money item' rather than inventing a confident label.
function hintForKind(kind: CandidateKind): string {
  switch (kind) {
    case 'income':
      return 'looks like income';
    case 'bill':
      return 'looks like a bill';
    case 'subscription':
      return 'looks like a subscription';
    case 'spend':
      return 'likely spending';
    default:
      return 'a money item';
  }
}

// Format a signed candidate amount the way the web preformatted it: a leading '+' for money in, the
// U+2212 minus '−' for money out, whole pounds grouped, pence only when present (2180 → "+£2,180",
// −118 → "−£118"). Pence are shown when the magnitude isn't whole so a real read never loses decimals.
function formatSignedAmount(amount: number): string {
  const magnitude = Math.abs(amount);
  const grouped = magnitude.toLocaleString('en-GB', {
    minimumFractionDigits: Number.isInteger(magnitude) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const sign = amount >= 0 ? '+' : '−';
  return `${sign}£${grouped}`;
}

// Map the engine's CandidateMoneyItem[] (real `parseSheet` output) into this screen's render shape —
// id + merchant verbatim, the hint from the candidate kind, the amount from the signed magnitude.
// Faithful, no new data, candidates only (never auto-counted). Carrying the candidate's own `id`
// through (rather than re-deriving a key from `merchant`) is what lets the found list key on a stable
// per-row identity instead of collapsing same-merchant rows (phase ⑦ "preview key collapse" fix).
function toFoundItems(candidates: readonly CandidateMoneyItem[]): FoundItem[] {
  return candidates.map((candidate) => ({
    id: candidate.id,
    merchant: candidate.merchant,
    hint: hintForKind(candidate.kind),
    amount: formatSignedAmount(candidate.amount),
  }));
}

// The found list, derived once from the real engine over the sample statement text. The file name +
// page count are the eventual reader's metadata (kept as the web source's sample until a live read
// threads them in). The clean sample parses with zero issues. The raw candidates are kept so the
// primary CTA can enqueue exactly what the card showed (web parity — ScreenPdfSuccess enqueues its
// sample rows too), never a re-derived list.
const SAMPLE_CANDIDATES = parseSheet(SAMPLE_STATEMENT_TEXT, { source: 'csv' }).candidates;
const SAMPLE_FOUND: FoundStatement = {
  fileName: 'Statement_June_2025.pdf',
  pageCount: 8,
  items: toFoundItems(SAMPLE_CANDIDATES),
};

// The honest file label for a LIVE read: the reader stages the money movements, not the file's name
// or page count, so we never invent a filename or a page total. A single calm line tells the truth
// about where the items came from.
const LIVE_READ_FILE_LABEL = 'Your statement';
const LIVE_READ_PAGE_COUNT = 1;

// Build the FoundStatement for a live read from the store's staged candidates. Honest metadata (no
// fabricated filename / page count); the money movements are the reader's real output.
function liveStatementFrom(candidates: readonly CandidateMoneyItem[]): FoundStatement {
  return {
    fileName: LIVE_READ_FILE_LABEL,
    pageCount: LIVE_READ_PAGE_COUNT,
    items: toFoundItems(candidates),
  };
}

// Shared ease-out-expo — the web's cubic-bezier(.16, 1, .3, 1).
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// slide-in-r geometry (spec @motion): the whole screen enters from +28px on X with a fade over 360ms.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;

// Tap-target floor — the file icon chip is the web's w-11 (44px), already a comfortable target.
const ICON_CHIP = 44;

// Primary / secondary CTA heights, faithful to the web h-[58px] / h-[46px].
const PRIMARY_H = 58;
const SECONDARY_H = 46;

// Local reduce-motion read, mirroring Melo.tsx + StartScreen.tsx exactly: read once, then subscribe.
// Kept self-contained so this screen pulls no heavy module graph.
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

export function PdfSuccessScreen({
  nav,
  statement: statementProp,
  state = 'populated',
}: PdfSuccessScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  // The REAL staged candidates the Intake reader produced for this statement (review-before-truth).
  // When the slot is non-empty we render those; when it is empty (a cold / dev open of this screen)
  // we fall back to the faithful sample. An explicit `statement` prop still wins (fixtures / tests).
  const staged = useReaderCandidates();
  // The closing balance the reader staged alongside `staged` (null when the read didn't carry
  // one, or came from a path that never does — see setReaderClosingBalance's doc). Only
  // meaningful for the REAL staged read, never for the fixture sample below.
  const stagedClosingBalance = useReaderClosingBalance();
  const statement: FoundStatement =
    statementProp ?? (staged.length > 0 ? liveStatementFrom(staged) : SAMPLE_FOUND);

  // The raw candidates this screen would enqueue/land — a fixture-driven `statement` prop carries
  // none (tests only); otherwise the real staged read, falling back to the sample so the bulk
  // landing still renders honestly off real-shaped data on a cold/dev open.
  const rawCandidates: readonly CandidateMoneyItem[] = statementProp
    ? []
    : staged.length > 0
      ? staged
      : SAMPLE_CANDIDATES;

  // Mirrors `rawCandidates`' fixture guard: a fixture-driven `statement` prop (tests only) never
  // carries a real reader-staged balance through to the landing.
  const closingBalance = statementProp ? undefined : (stagedClosingBalance ?? undefined);

  // BULK ADD-AS-HISTORY (task): a multi-candidate read is a statement — swap the ordinary per-item
  // preview for the bulk summary + "Add all as history" landing (BulkStatementLanding owns the
  // actual `addStatementAsHistory` write, fired only on that CTA tap). A single-candidate read
  // keeps going straight to the existing per-row enqueue -> Review path below, unchanged.
  const isBulk = !statementProp && isBulkStatement(rawCandidates.length);

  // slide-in-r — drives the whole screen. 0 = entering, 1 = resting (translateX 0, opacity 1). Under
  // reduce-motion we resolve straight to the final state instead of animating.
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

  // error — the read failed; upstream routes to PdfFallback ('File saved.'). This screen renders no
  // inline error, but if it is ever mounted in the error state directly we show the calm fallback
  // doorway rather than dead-ending. The single CTA routes back to intake to pick another file.
  if (state === 'error') {
    return (
      <EmptyState
        mood="calm"
        headline="File saved."
        body="Folio couldn't read this one. It's saved as a note — try a different file."
        cta={{ label: 'Use a different file', onPress: () => nav.go('intake') }}
      />
    );
  }

  // empty — n/a in practice (you only land here when a statement was read). A zero-candidate read is a
  // fallback/empty-found case the upstream flow defines; rendered here as the calm EmptyState so the
  // screen never shows a hollow "0 things found" card.
  if (state === 'empty' || statement.items.length === 0) {
    return (
      <EmptyState
        mood="calm"
        headline="Nothing to add."
        body="Folio didn't find money items in this one. Try a different file."
        cta={{ label: 'Use a different file', onPress: () => nav.go('intake') }}
      />
    );
  }

  // loading — Melo curious + a line, NEVER a spinner (hard rule + STATES.md). A calm holding moment
  // while the read settles; in practice the read happens upstream and this success screen mounts after.
  if (state === 'loading') {
    return (
      <View
        style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxl }]}
      >
        <MeloLine mood="curious" text="Folio is reading…" />
      </View>
    );
  }

  // populated / offline — the real preview. offline ≡ populated (the read already happened; nothing
  // here needs the network).
  const foundLabel = `${statement.items.length} thing${statement.items.length === 1 ? '' : 's'} found`;

  return (
    <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — back glyph · PDF label · balancing spacer. */}
        <View style={styles.header}>
          <PressIcon onPress={nav.back} accessibilityLabel="Go back">
            <BackArrow color={t.muted} />
          </PressIcon>
          <Text style={[styles.headerLabel, { color: t.muted }]}>PDF</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Intro — green eyebrow, the headline with the single accent word "read", a calm body. */}
        <View style={styles.intro}>
          <Text style={[styles.eyebrow, { color: t.positive }]}>Statement read</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            <FolioReadHeadline accentColor={t.calm} />
          </Text>
          <Text style={[styles.body, { color: t.muted }]}>
            Check what you want to add. Nothing counts until you choose.
          </Text>
        </View>

        {/* File + found card. */}
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          {/* File row — icon chip + truncating filename + page count. */}
          <View style={styles.fileRow}>
            <View style={[styles.iconChip, { backgroundColor: t.calmSoft }]}>
              <FileGlyph color={t.calm} />
            </View>
            <View style={styles.fileMeta}>
              <Text numberOfLines={1} style={[styles.fileName, { color: t.ink }]}>
                {statement.fileName}
              </Text>
              <Text style={[styles.fileSub, { color: t.muted }]}>
                {`${statement.pageCount} page${statement.pageCount === 1 ? '' : 's'}`}
              </Text>
            </View>
          </View>

          {/* Hairline divider. */}
          <View style={[styles.divider, { backgroundColor: t.hairline }]} />

          {/* Found section — pluralised count + the candidate list. */}
          <View style={styles.foundSection}>
            <Text style={[styles.foundLabel, { color: t.muted }]}>{foundLabel}</Text>
            <View style={styles.foundList}>
              {statement.items.map((item) => (
                <View key={item.id} style={styles.foundRow}>
                  <View style={[styles.dot, { backgroundColor: t.calm }]} />
                  <View style={styles.foundMeta}>
                    <Text numberOfLines={1} style={[styles.merchant, { color: t.ink }]}>
                      {item.merchant}
                    </Text>
                    <Text style={[styles.hint, { color: t.muted }]}>{item.hint}</Text>
                  </View>
                  {/* Money — tone INK (no sign colouring); sign carried by the +/− glyph only. */}
                  <Text style={[styles.amount, { color: t.ink }]}>{item.amount}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* BULK ADD-AS-HISTORY (task): a multi-candidate read (a real statement) swaps the ordinary
            single-item CTA pair below for the bulk landing surface — summary + "Add all as
            history" / "Review one by one" + the post-import offer sequencer. A single-candidate
            read (or a fixture-driven `statement` prop) is UNCHANGED — same enqueue-then-Review
            path as before. */}
        {isBulk ? (
          <BulkStatementLanding
            nav={nav}
            candidates={rawCandidates}
            {...(closingBalance !== undefined ? { closingBalance } : {})}
            onAdded={() => clearReaderCandidates()}
            onReviewOneByOne={() => {
              const { dropped } = enqueueReviewItems(
                queueInputFromCandidates(rawCandidates, 'pdf'),
              );
              if (dropped > 0) {
                showToast(
                  'Showing the newest 60 to check first',
                  `${dropped} more will follow as you clear them.`,
                );
              }
              clearReaderCandidates();
              nav.go('review');
            }}
          />
        ) : (
          <>
            {/* Melo line — the quiet companion. The web passes mood='soft'; in the web kit 'soft' is a
                MeloMoodInput ALIAS that normalizeMood resolves to 'calm' (kit.tsx: `if (m === "soft")
                return "calm"`). The RN MeloLine takes the canonical MeloMood directly, so the byte-
                faithful equivalent of the prototype's mood='soft' is mood='calm' — same resolved
                character, the quiet "nothing counts yet" tone. Its breathe + blink are the only
                continuous motion on this screen. MeloLine adds the straight quotes; we pass raw text. */}
            <View style={styles.meloBlock}>
              <MeloLine mood="calm" text="This is waiting. Add it only if it belongs." />
            </View>

            {/* Spacer pins the CTAs to the bottom, mirroring the web flex-1 spacer. */}
            <View style={styles.spacer} />

            {/* Primary CTA — terracotta fill + terracotta-tinted lift; enqueues what the card showed
                into the persisted review queue and routes to Review, faithful to the web source
                (ScreenPdfSuccess.tsx: enqueueReviewItems(...) then nav.go("review")). Review-before-truth
                holds — queued items are candidates, never posted facts; addTransaction fires only on the
                Review screen's Add. The transient staging slot is cleared once its items move into the
                queue so the same rows can't be double-surfaced from the Check tab. A fixture-driven
                `statement` prop carries no raw candidates, so it enqueues nothing (tests only). */}
            <PressButton
              onPress={() => {
                const showing = statementProp ? [] : staged.length > 0 ? staged : SAMPLE_CANDIDATES;
                const { dropped } = enqueueReviewItems(queueInputFromCandidates(showing, 'pdf'));
                if (dropped > 0) {
                  showToast(
                    'Showing the newest 60 to check first',
                    `${dropped} more will follow as you clear them.`,
                  );
                }
                if (staged.length > 0) clearReaderCandidates();
                nav.go('review');
              }}
              accessibilityLabel="Check what Folio found"
              accessibilityHint="Opens the review of what was found"
              style={[styles.primary, elevation.cta, { backgroundColor: t.calm }]}
            >
              <Text style={[styles.primaryLabel, { color: t.inverse }]}>
                Check what Folio found
              </Text>
            </PressButton>

            {/* Secondary CTA — quiet path back to intake to pick a different file. */}
            <PressButton
              onPress={() => nav.go('intake')}
              accessibilityLabel="Use a different file"
              style={styles.secondary}
            >
              <Text style={[styles.secondaryLabel, { color: t.muted }]}>Use a different file</Text>
            </PressButton>
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
}

// The headline "Folio read your statement." with "read" as the single upright terracotta accent word.
// Built as nested Text runs in the same Fraunces display face; the accent run is normal-style and
// coloured. Sourced from the keyed copy.add.success.pdf ('Folio **read** your statement.') so the
// frozen string stays the single source of truth — we split on the **accent** marker rather than
// hardcoding the words, keeping exactly one accent word per the voice rule.
function FolioReadHeadline({ accentColor }: { accentColor: string }) {
  const { lead, accent, tail } = useMemo(() => splitAccent(copy.add.success.pdf), []);
  return (
    <>
      {lead}
      <Text style={[styles.headlineAccent, { color: accentColor }]}>{accent}</Text>
      {tail}
    </>
  );
}

// Split a frozen copy string on its single **accent** marker into lead / accent / tail. The deck
// guarantees exactly one **…** span per headline (voice rule), so this is total for these strings.
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

// A small inline pressable that carries the kit `pressed` feel — used for icon-only tappables (the
// back arrow). hitSlop guarantees the tap area clears 44px around the 20px glyph.
function PressIcon({
  onPress,
  accessibilityLabel,
  children,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={12}
      onPress={onPress}
      style={({ pressed: isPressed }) => [styles.pressIcon, isPressed ? styles.pressed : undefined]}
    >
      {children}
    </Pressable>
  );
}

// A full-width pressable carrying the kit `pressed` feel (scale 0.97 / lowered opacity) — the token
// equivalent of the web `press` util, matching StartScreen's CTA treatment.
function PressButton({
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
  children,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  style: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        styles.pressBtnBase,
        style,
        isPressed ? styles.pressed : undefined,
      ]}
    >
      {children}
    </Pressable>
  );
}

// Back arrow — the web '←' glyph, drawn inline (the codebase ships no icon font). 20×20 user space.
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

// File glyph — the web '▤' (a document with lines), drawn inline. 18×18 user space, accent-coloured.
function FileGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      {/* Page outline. */}
      <Path
        d="M4 2 H11 L14 5 V16 H4 Z"
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
        fill="none"
      />
      {/* Folded corner crease. */}
      <Path d="M11 2 V5 H14" stroke={color} strokeWidth={1.4} strokeLinejoin="round" fill="none" />
      {/* Content lines. */}
      <Path d="M6 9 H12" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      <Path d="M6 12 H10" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  // root: the animated screen frame (slide-in-r lives here); ScrollView fills it.
  root: {
    flex: 1,
  },
  // px-7 ≈ screen inset → gap.xl (24, matching StartScreen's px-7 mapping). flexGrow:1 + a flex:1
  // spacer pins the CTAs to the bottom of the scroll column (web h-full flex-col + flex-1).
  content: {
    flexGrow: 1,
    paddingHorizontal: gap.xl,
  },
  // loading branch column.
  loading: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  // Header row — back glyph · centred label · balancing spacer.
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pressIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: ICON_CHIP,
    minWidth: 20,
  },
  // PDF — uppercase, tracked, 12px, muted (web text-[12px] uppercase tracking-[0.14em]).
  headerLabel: {
    fontSize: 12,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  // Balances the 20px back glyph so the label stays centred (web w-5).
  headerSpacer: {
    width: 20,
  },
  // mt-6 (24) → gap.xl.
  intro: {
    marginTop: gap.xl,
  },
  // Fraunces italic eyebrow, 13px, green/positive (web font-display italic text-[13px] --positive).
  eyebrow: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
  },
  // Fraunces hero, 30px, tight line-height, mt-1 (4 → gap.xs) below the eyebrow.
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
  // 13.5px relaxed body, mt-3 (12 → gap.md), muted (web text-[13.5px] leading-relaxed --muted-ink).
  body: {
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: gap.md,
  },
  // Card — surface bg, 1px hairline border, 2xl radius, p-5 (20 → gap.lg + gap.xs), mt-6 (24 → gap.xl).
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.xl,
    padding: gap.lg + gap.xs,
  },
  // File row — icon chip + meta, gap-3 (12 → gap.md).
  fileRow: {
    alignItems: 'center',
    columnGap: gap.md,
    flexDirection: 'row',
  },
  // w-11 h-11 (44) rounded-lg accent-soft chip, centred glyph.
  iconChip: {
    alignItems: 'center',
    borderRadius: radius.sm,
    height: ICON_CHIP,
    justifyContent: 'center',
    width: ICON_CHIP,
  },
  // flex-1 min-w-0 → flex:1 + minWidth:0 so the filename truncates instead of pushing the row.
  fileMeta: {
    flex: 1,
    minWidth: 0,
  },
  // 14px medium, truncating (web text-[14px] font-medium truncate).
  fileName: {
    fontSize: 14,
    fontWeight: '500',
  },
  // 11.5px muted, mt-0.5 (2 → gap.xxs) (web text-[11.5px] --muted-ink mt-0.5).
  fileSub: {
    fontSize: 11.5,
    marginTop: gap.xxs,
  },
  // 1px divider, mt-5 (20 → gap.lg + gap.xs) (web mt-5 h-px --hairline).
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: gap.lg + gap.xs,
  },
  // Found section, mt-5 (20 → gap.lg + gap.xs).
  foundSection: {
    marginTop: gap.lg + gap.xs,
  },
  // 11px uppercase tracked muted (web text-[11px] uppercase tracking-[0.14em] --muted-ink).
  foundLabel: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  // mt-3 (12 → gap.md) + space-y-3 (12 → gap.md) between rows.
  foundList: {
    marginTop: gap.md,
    rowGap: gap.md,
  },
  // Found row — dot + meta + amount, gap-3 (12 → gap.md).
  foundRow: {
    alignItems: 'center',
    columnGap: gap.md,
    flexDirection: 'row',
  },
  // w-1.5 h-1.5 (6) rounded-full accent dot.
  dot: {
    borderRadius: radius.pill,
    height: 6,
    width: 6,
  },
  // flex-1 min-w-0 so the merchant truncates and the amount stays pinned right.
  foundMeta: {
    flex: 1,
    minWidth: 0,
  },
  // 13.5px medium, truncating (web text-[13.5px] font-medium truncate).
  merchant: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  // 11.5px italic muted (web text-[11.5px] --muted-ink italic).
  hint: {
    fontSize: 11.5,
    fontStyle: 'italic',
  },
  // Money — the web <Money size="sm"> is `font-display tabular font-medium text-[15px]`: Fraunces
  // display face, tabular figures, medium weight, 15px. Tone is INK (no sign colouring) — the income
  // (+) and bills (−) all render in --ink; the sign is carried by the +/− glyph only.
  amount: {
    fontFamily: serif.display,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },
  // mt-5 (20 → gap.lg + gap.xs).
  meloBlock: {
    marginTop: gap.lg + gap.xs,
  },
  spacer: {
    flex: 1,
  },
  // Shared base for the full-width CTAs — centred content, full-width.
  pressBtnBase: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Primary CTA — h-[58px], 2xl radius. Fill + terracotta lift applied inline (token bg + elevation.cta).
  primary: {
    borderRadius: radius.xl,
    height: PRIMARY_H,
  },
  primaryLabel: {
    fontSize: 15.5,
    fontWeight: '500',
  },
  // Secondary CTA — h-[46px], 2xl radius, mt-2 (8 → gap.sm), no fill.
  secondary: {
    borderRadius: radius.xl,
    height: SECONDARY_H,
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
