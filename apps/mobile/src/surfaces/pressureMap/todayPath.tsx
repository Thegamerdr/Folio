// Today — Folio's rich home, built around the signature money path.
//
// Faithful RN rebuild of the web ScreenToday (folio-melo/src/components/folio/screens/ScreenToday):
//   • a top bar — italic Fraunces date + "N days to payday →" link, with a round Melo button
//     top-right that opens Melo;
//   • the hero — a one-line verdict, a count-up "spare" figure, and "at the tightest point";
//   • TodayNudges (<=2 pills), TodaySpendStrip (this-week-by-category), TodayRecentTxns (<=5 rows
//     + "+ log a spend" → a LogSpend bottom sheet);
//   • the money path (interactive: scrub thumb, band toggle, tight-point callout, 3-col summary);
//   • a Melo prompt card; and TodayWeekTiles.
//
// PRESENTATION ONLY. Everything it shows comes from props (the model + on* callbacks). It never
// touches the engine: the container maps canonical/local data into the small surface shapes below
// and owns every mutation (onLogSpend writes through the canonical add-transaction path). When the
// route has no meaningful movement yet, it honestly states position instead of faking a verdict.

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LocalRouteSummary } from '../../local/localLedger';
import type { TodayPathBand, TodayPathSummary, TodayTransaction } from './todayTypes';
import type { TodayNudge } from './todayNudges';
import type { TodayNextCharge, TodayTightPoint } from './todayWeekTiles';
import { MoneyPath, PointExplanation, routeHasMeaningfulPath } from './MoneyPath';
import { Sheet } from './Sheet';
import { TodayNudges } from './todayNudges';
import { TodayRecentTxns } from './todayRecentTxns';
import { TodaySpendStrip } from './todaySpendStrip';
import { TodayWeekTiles } from './todayWeekTiles';
import { MeloPresence } from './melo';
import { useCountUp } from './useCountUp';
import {
  Display,
  Eyebrow,
  Headline,
  MoneyPad,
  PrimaryAction,
  QuietLink,
  elevation,
  gap,
  magnitude,
  money,
  poundsLabel,
  pressed,
  radius,
  serif,
  useTheme,
  type Palette,
} from './kit';

// An active pot (a weekly top-up the user has set). The path names the dip these create so a Friday
// dip caused by saving reads as a named choice. perWeekMinor is integer minor units.
export type TodayActivePot = Readonly<{
  name: string;
  perWeekMinor: number;
}>;

// The scrub preview maps the 0..1 drag fraction onto a small "spend more today" amount, exactly as
// the web does (drag → preview up to ~£120). It only re-reads the lowest point; it never mutates.
const MAX_SCRUB_PREVIEW_MINOR = 12_000; // £120

// The hero "spare" figure counts up to its target via the shared useCountUp (./useCountUp):
// easeOutCubic over 500ms, honouring reduced motion (snaps straight to the value).
const HERO_COUNT_UP_MS = 500;

function verdict(route: LocalRouteSummary): {
  lead: string;
  accent: string;
  tail: string;
  tone: 'positive' | 'warm' | 'repair';
} {
  const low = route.tightestBalanceMinor;
  if (low < 0)
    return { lead: 'It runs ', accent: 'short', tail: ' before payday.', tone: 'repair' };
  if (low < 10000)
    return { lead: 'It holds — but stays ', accent: 'tight', tail: '.', tone: 'warm' };
  return { lead: 'Your money ', accent: 'lasts', tail: ' to payday.', tone: 'positive' };
}

export function TodayScreen({
  dateLabel,
  daysToPayday,
  route,
  spareMinor,
  nudges,
  weekSpends,
  recentSpends,
  asOfDate,
  rangeLabel,
  band,
  pathSummary,
  thisWeekMinor,
  lastWeekMinor,
  nextCharge,
  tightPoint,
  activePots,
  reduceMotion,
  routeFocusDateIso,
  onOpenMelo,
  onOpenPayday,
  onChangeBand,
  onAskWeekSpend,
  onLogSpend,
  onRemoveSpend,
  onCompareWeeks,
  onOpenNextCharge,
  onAskTightPoint,
}: TodayScreenProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const real = routeHasMeaningfulPath(route);
  const v = verdict(route);

  // Scrub state — the previewed spend (drag 0..1 → £0..£120), and the lowest figure it previews.
  const [scrubFraction, setScrubFraction] = useState(0);
  const scrubPreviewMinor = Math.round(scrubFraction * MAX_SCRUB_PREVIEW_MINOR);
  const previewedSpareMinor = Math.max(0, spareMinor - scrubPreviewMinor);
  const heroDisplay = useCountUp(previewedSpareMinor, HERO_COUNT_UP_MS, reduceMotion);

  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [logSpendOpen, setLogSpendOpen] = useState(false);

  // Pot top-ups become a labelled dip so the path reads honestly — a Friday dip caused by saving
  // isn't a mystery, it's a named choice. Mirrors the web's pot-dip annotation.
  const pots = activePots ?? [];
  const potDipText = useMemo(() => {
    if (pots.length === 0) return null;
    const parts = pots
      .map((p) => `${(p.name.split(' ')[0] ?? p.name)} ${potPounds(p.perWeekMinor)}`)
      .join(' + ');
    const weeklyTotalMinor = pots.reduce((sum, p) => sum + p.perWeekMinor, 0);
    const tail =
      pots.length > 1
        ? ` · ${potPounds(weeklyTotalMinor)}/wk to your pots`
        : '/wk to your pot';
    return `Friday dip · ${parts}${tail}`;
  }, [pots]);

  return (
    <View style={layout.screen}>
      {/* Top bar — date + days-to-payday link, round Melo button top-right. */}
      <View style={layout.topBar}>
        <View style={layout.topBarText}>
          <Text style={s.date}>{dateLabel}</Text>
          <Pressable
            accessibilityHint="See your payday ritual."
            accessibilityRole="button"
            hitSlop={6}
            onPress={onOpenPayday}
            style={({ pressed: isPressed }) => (isPressed ? pressed : undefined)}
          >
            <Text style={s.paydayLink}>{daysToPayday} days to payday →</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityHint="Opens Melo."
          accessibilityLabel="Melo"
          accessibilityRole="button"
          onPress={onOpenMelo}
          style={({ pressed: isPressed }) => [s.meloButton, isPressed ? pressed : undefined]}
        >
          <MeloPresence reduceMotion={reduceMotion} size="sm" state="melo_idle" withCopy={false} />
        </Pressable>
      </View>

      {/* Hero — verdict + count-up spare + "at the tightest point" (or honest position when empty). */}
      <View style={layout.hero}>
        {real ? (
          <>
            <Text style={[layout.verdictLine, verdictLineColor(t, v.tone)]}>
              {v.lead}
              <Text style={layout.verdictAccent}>{v.accent}</Text>
              {v.tail}
            </Text>
            <View style={layout.heroFigureRow}>
              <Text style={s.heroFigure}>
                £
                {Math.round(previewedSpareMinor === 0 ? 0 : heroDisplay / 100).toLocaleString(
                  'en-GB',
                )}
              </Text>
              <Text style={s.heroSuffix}>spare</Text>
            </View>
            <Text style={s.heroCaption}>at its lowest point</Text>
          </>
        ) : (
          <>
            <Eyebrow tone="muted">Will your money last to payday?</Eyebrow>
            <Headline lead="Here's where you " accent="stand" tail="." />
            <Text style={s.heroFigure}>{money(route.availableNowMinor)}</Text>
            <Text style={s.heroCaption}>money you can see now</Text>
            <Display style={s.startBody}>
              Add when money comes in and what has to leave, and your path to payday draws itself.
            </Display>
          </>
        )}
      </View>

      {nudges.length > 0 ? <TodayNudges nudges={nudges} /> : null}

      <TodaySpendStrip onAskMelo={onAskWeekSpend} transactions={weekSpends} />

      <TodayRecentTxns
        asOfDate={asOfDate}
        onLogSpend={() => setLogSpendOpen(true)}
        onRemove={onRemoveSpend}
        transactions={recentSpends}
      />

      {/* The money path — the screen's hero object, here in its interactive form. */}
      <MoneyPath
        band={band}
        focusDateIso={routeFocusDateIso}
        onChangeBand={onChangeBand}
        onScrub={setScrubFraction}
        onSelectPoint={setSelectedPoint}
        rangeLabel={rangeLabel}
        route={route}
        scrubPreviewMinor={scrubPreviewMinor}
        selectedIndex={selectedPoint}
        summary={pathSummary}
      />

      {/* Pot-dip annotation — names the weekly dip the user's pot top-ups create, so a Friday dip
          caused by saving reads as a named choice rather than a mystery. */}
      {potDipText ? (
        <View style={s.potDip}>
          <Text style={s.potDipArrow}>↘</Text>
          <Text style={s.potDipText}>{potDipText}</Text>
        </View>
      ) : null}

      {/* Melo prompt card — a quiet doorway into Melo with the low-point context. */}
      {real ? (
        <Pressable
          accessibilityHint="Asks Melo about your low point."
          accessibilityRole="button"
          onPress={onAskTightPoint}
          style={({ pressed: isPressed }) => [s.meloCard, isPressed ? pressed : undefined]}
        >
          <MeloPresence
            reduceMotion={reduceMotion}
            size="sm"
            state="melo_path_explaining"
            withCopy={false}
          />
          <View style={layout.meloCardText}>
            <Text style={s.meloCardLine}>
              “{v.lead.trim()} {v.accent}
              {v.tail}”
            </Text>
            <View style={layout.meloCardFooter}>
              <Text style={s.meloCardFooterText}>
                {route.pendingReviewCount > 0
                  ? `${route.pendingReviewCount} still waiting to be checked.`
                  : 'Nothing left waiting to be checked.'}
              </Text>
              <Text style={s.meloCardAsk}>Ask Melo →</Text>
            </View>
          </View>
        </Pressable>
      ) : null}

      <TodayWeekTiles
        lastWeekMinor={lastWeekMinor}
        nextCharge={nextCharge}
        onAskTightPoint={onAskTightPoint}
        onCompareWeeks={onCompareWeeks}
        onOpenNextCharge={onOpenNextCharge}
        thisWeekMinor={thisWeekMinor}
        tightPoint={tightPoint}
      />

      <PointExplanation
        onClose={() => setSelectedPoint(null)}
        point={selectedPoint === null ? null : (route.points[selectedPoint] ?? null)}
      />

      <LogSpendSheet
        onClose={() => setLogSpendOpen(false)}
        onLogSpend={(merchant, amountMinor, category) => {
          onLogSpend(merchant, amountMinor, category);
          setLogSpendOpen(false);
        }}
        reduceMotion={reduceMotion}
        visible={logSpendOpen}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Log a spend — a small bottom sheet composing the shared Sheet primitive.
// ---------------------------------------------------------------------------

const SPEND_CATEGORIES: readonly { key: string; label: string }[] = [
  { key: 'food', label: 'Food' },
  { key: 'transport', label: 'Transport' },
  { key: 'fun', label: 'Fun' },
  { key: 'bills', label: 'Bills' },
  { key: 'shopping', label: 'Shopping' },
  { key: 'other', label: 'Other' },
];

function digitsToMinor(value: string): number {
  const clean = value.replace(/[^0-9]/g, '');
  return clean.length === 0 ? 0 : Number(clean) * 100;
}

function LogSpendSheet({
  visible,
  onClose,
  onLogSpend,
  reduceMotion,
}: {
  visible: boolean;
  onClose: () => void;
  onLogSpend: (merchant: string, amountMinor: number, category: string) => void;
  reduceMotion?: boolean | undefined;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('food');
  const amountMinor = digitsToMinor(amount);
  const ready = amountMinor > 0;

  // Reset the form whenever the sheet is dismissed so the next open starts clean.
  useEffect(() => {
    if (!visible) {
      setMerchant('');
      setAmount('');
      setCategory('food');
    }
  }, [visible]);

  return (
    <Sheet onClose={onClose} reduceMotion={reduceMotion} visible={visible}>
      <Eyebrow>Log a spend</Eyebrow>
      <Display style={layout.sheetTitle}>What did you spend?</Display>

      <Text style={s.sheetFieldLabel}>Where</Text>
      <View style={s.merchantField}>
        <Text style={merchant.length === 0 ? s.merchantPlaceholder : s.merchantValue}>
          {merchant.length === 0 ? 'Tap a quick pick below' : merchant}
        </Text>
      </View>
      <View style={layout.quickPicks}>
        {QUICK_MERCHANTS.map((name) => (
          <Pressable
            accessibilityRole="button"
            key={name}
            onPress={() => setMerchant(name)}
            style={({ pressed: isPressed }) => [
              s.quickPick,
              merchant === name ? s.quickPickOn : undefined,
              isPressed ? pressed : undefined,
            ]}
          >
            <Text style={[s.quickPickText, merchant === name ? s.quickPickTextOn : undefined]}>
              {name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.sheetFieldLabel}>How much</Text>
      <Text style={s.amountReadout}>{poundsLabel(amount)}</Text>
      <MoneyPad onChange={setAmount} value={amount} />

      <Text style={s.sheetFieldLabel}>What kind</Text>
      <View style={layout.categories}>
        {SPEND_CATEGORIES.map((c) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: category === c.key }}
            key={c.key}
            onPress={() => setCategory(c.key)}
            style={({ pressed: isPressed }) => [
              s.category,
              category === c.key ? s.categoryOn : undefined,
              isPressed ? pressed : undefined,
            ]}
          >
            <Text style={[s.categoryText, category === c.key ? s.categoryTextOn : undefined]}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={layout.sheetFooter}>
        <QuietLink accessibilityHint="Closes without logging." label="Not now" onPress={onClose} />
        <PrimaryAction
          caption={ready ? `${magnitude(amountMinor)} out` : undefined}
          disabled={!ready}
          label="Log it"
          onPress={() => onLogSpend(merchant.trim() || 'Spend', amountMinor, category)}
        />
      </View>
    </Sheet>
  );
}

const QUICK_MERCHANTS: readonly string[] = ['Tesco', 'Coffee', 'Bus', 'Lunch', 'Shop'];

// ---------------------------------------------------------------------------

// Whole-pound label for a pot's weekly top-up (minor units in), matching the web's "£12" form.
function potPounds(minor: number): string {
  return `£${Math.round(Math.abs(minor) / 100).toLocaleString('en-GB')}`;
}

function verdictLineColor(t: Palette, tone: 'positive' | 'warm' | 'repair') {
  if (tone === 'repair') return { color: t.repairInk };
  if (tone === 'warm') return { color: t.warmInk };
  return { color: t.positiveInk };
}

export type TodayScreenProps = {
  /** Italic serif date, e.g. "Saturday, 27 June". */
  dateLabel: string;
  /** Whole days until the next payday. */
  daysToPayday: number;
  route: LocalRouteSummary;
  /** Spare (minor units) at the tightest point — drives the hero count-up. */
  spareMinor: number;
  nudges: readonly TodayNudge[];
  /** This week's spends (windowed + mapped) for the spend strip. */
  weekSpends: readonly TodayTransaction[];
  /** Recent spends (newest-first, mapped) for the recent list. */
  recentSpends: readonly TodayTransaction[];
  /** Today's ISO date, so recent rows read relative days. */
  asOfDate: string;
  /** Range caption for the path, e.g. "27 Jun → 25 Jul". */
  rangeLabel: string;
  band: TodayPathBand;
  pathSummary: TodayPathSummary;
  thisWeekMinor: number;
  lastWeekMinor: number;
  nextCharge?: TodayNextCharge | undefined;
  tightPoint: TodayTightPoint;
  /** Active pots (perWeek > 0), so the path can name the weekly dip its top-ups create — a Friday dip
   *  caused by saving reads as a named choice, not a mystery. Empty/omitted → the callout is hidden. */
  activePots?: readonly TodayActivePot[] | undefined;
  reduceMotion?: boolean | undefined;
  /** Calendar -> Route bridge: an ISO day to pulse on the money path (transient; container clears it
   *  after ~6s). Forwarded to MoneyPath; undefined when nothing is focused. */
  routeFocusDateIso?: string | undefined;
  onOpenMelo: () => void;
  onOpenPayday: () => void;
  onChangeBand: (band: TodayPathBand) => void;
  onAskWeekSpend: () => void;
  /** Writes a logged spend through the container's canonical add path. */
  onLogSpend: (merchant: string, amountMinor: number, category: string) => void;
  onRemoveSpend?: ((id: string) => void) | undefined;
  onCompareWeeks: () => void;
  onOpenNextCharge: () => void;
  onAskTightPoint: () => void;
};

// Colour-free styles — shared across light and dark.
const layout = StyleSheet.create({
  screen: { gap: gap.lg, paddingTop: gap.sm, paddingBottom: gap.xxxl },

  topBar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  topBarText: { gap: 2 },

  hero: { gap: gap.xs },
  verdictLine: { fontFamily: serif.displayItalic, fontSize: 15, lineHeight: 21 },
  verdictAccent: { fontFamily: serif.displayItalic },
  heroFigureRow: { flexDirection: 'row', alignItems: 'flex-end', gap: gap.sm, marginTop: gap.xs },

  meloCardText: { flex: 1, gap: gap.xs },
  meloCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  // Log-spend sheet
  sheetTitle: { fontSize: 26, lineHeight: 31, marginTop: gap.xs },
  quickPicks: { flexDirection: 'row', flexWrap: 'wrap', gap: gap.sm, marginTop: gap.sm },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: gap.sm, marginTop: gap.sm },
  sheetFooter: { gap: gap.xs, marginTop: gap.xl },
});

// Colour-bearing styles, resolved against the active palette.
function makeStyles(t: Palette) {
  return StyleSheet.create({
    date: { color: t.muted, fontFamily: serif.displayItalic, fontSize: 13 },
    paydayLink: { color: t.muted, fontSize: 12, textDecorationLine: 'underline' },
    meloButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: t.surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...elevation.card,
    },

    heroFigure: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 60,
      lineHeight: 62,
      letterSpacing: -1.5,
      fontVariant: ['tabular-nums'],
    },
    heroSuffix: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 18,
      marginBottom: 6,
    },
    heroCaption: { color: t.muted, fontSize: 12.5, marginTop: 2 },
    startBody: { color: t.secondary, fontSize: 18, lineHeight: 25, marginTop: gap.xs },

    meloCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: gap.md,
      backgroundColor: t.inset,
      borderRadius: radius.lg,
      padding: gap.lg,
    },
    potDip: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: gap.sm,
      backgroundColor: t.inset,
      borderRadius: radius.md,
      paddingVertical: 6,
      paddingHorizontal: gap.sm,
    },
    potDipArrow: { color: t.calmStrong, fontSize: 10.5, lineHeight: 15 },
    potDipText: { flex: 1, color: t.muted, fontSize: 10.5, lineHeight: 15 },

    meloCardLine: { color: t.ink, fontFamily: serif.displayItalic, fontSize: 13, lineHeight: 19 },
    meloCardFooterText: { flex: 1, color: t.muted, fontSize: 11.5 },
    meloCardAsk: { color: t.calmStrong, fontSize: 11.5, marginLeft: gap.sm },

    // Log-spend sheet
    sheetFieldLabel: {
      color: t.muted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      marginTop: gap.lg,
    },
    merchantField: {
      backgroundColor: t.sunken,
      borderRadius: radius.md,
      paddingVertical: 12,
      paddingHorizontal: gap.md,
      marginTop: gap.sm,
    },
    merchantPlaceholder: { color: t.muted, fontSize: 15 },
    merchantValue: { color: t.ink, fontSize: 15, fontWeight: '600' },
    quickPick: {
      borderRadius: radius.pill,
      paddingVertical: 8,
      paddingHorizontal: gap.md,
      borderWidth: 1.5,
      borderColor: t.hairline,
      backgroundColor: t.surface,
    },
    quickPickOn: { borderColor: t.calm, backgroundColor: t.calmSoft },
    quickPickText: { color: t.secondary, fontSize: 14, fontWeight: '600' },
    quickPickTextOn: { color: t.calmStrong },
    amountReadout: {
      color: t.ink,
      fontSize: 40,
      fontWeight: '800',
      letterSpacing: -1.2,
      fontVariant: ['tabular-nums'],
      textAlign: 'center',
      paddingVertical: gap.xs,
      marginTop: gap.sm,
    },
    category: {
      borderRadius: radius.pill,
      paddingVertical: 8,
      paddingHorizontal: gap.md,
      borderWidth: 1.5,
      borderColor: t.hairline,
      backgroundColor: t.surface,
    },
    categoryOn: { borderColor: t.calm, backgroundColor: t.calmSoft },
    categoryText: { color: t.secondary, fontSize: 14, fontWeight: '600' },
    categoryTextOn: { color: t.calmStrong },
  });
}
