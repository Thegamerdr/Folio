// Subscriptions — what still earns its place (Quiet Paper Luxury).
//
// Faithful RN port of the Folio WEB screen (ScreenSubscriptions.tsx). It answers one
// question: of everything that recurs, what still earns its place? The recurring drain is
// the hero (a count-up monthly total, with what pauses have already saved beneath it); a
// single quiet "pause the quiet ones" move appears only when there are quiet, still-active
// subscriptions; three sort chips reorder the list (worst value first by default); and each
// row carries a usage pulse dot + a value-score subtitle + per-row actions.
//
// Presentation only — it never touches the engine. It takes the LocalSubscriptionsModel the
// container builds from the canonical engine, plus the engine's handlers as on* callbacks.
// Money is formatted through formatMinorAmount so there is no formatting drift. Built from RN
// primitives composing the pressure-map kit; the design is a faithful reproduction of the web
// (verbatim copy + the same paper tokens), not a reinterpretation.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Body,
  ChipToggle,
  elevation,
  Headline,
  paper,
  PressureScreen,
  pressed,
  radius,
  serif,
} from './kit';
import { MeloLine, ScreenHeader } from './secondaryKit';
import { formatMinorAmount } from '../../local/localLedger';
import type {
  LocalSubscriptionPulse,
  LocalSubscriptionRow,
  LocalSubscriptionsModel,
} from '../../local/localSubscriptionsAdapter';

// The three orderings the web offers. "value" (worst value first) is the default, because the
// whole screen is built to surface what no longer earns its keep.
type SortKey = 'value' | 'cost' | 'next';

const SORTS: readonly { key: SortKey; label: string }[] = [
  { key: 'value', label: 'Worst value' },
  { key: 'cost', label: 'Cost' },
  { key: 'next', label: 'Next charge' },
];

// ---------------------------------------------------------------------------
// Count-up — the monthly total animates up to its target on mount / when it changes,
// matching the web's useCountUp(monthly, 600). Pure rAF; respects reduced motion (jumps
// straight to the value). Two decimals, to read as money.
// ---------------------------------------------------------------------------

const COUNT_UP_MS = 600;

function useCountUp(target: number, reduceMotion: boolean): number {
  const [value, setValue] = useState(reduceMotion ? target : 0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduceMotion) {
      setValue(target);
      return;
    }
    const from = fromRef.current;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / COUNT_UP_MS);
      // easeOutCubic — a calm settle, never a linear crawl.
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      setValue(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, reduceMotion]);

  return value;
}

// ---------------------------------------------------------------------------
// Row helpers — pulse colour + label, value-score subtitle, next-charge label.
// All derived purely from the model row; no engine calls, no new data.
// ---------------------------------------------------------------------------

// Pulse dot. yes = the calm green (regular use), maybe = caution gold DATA mark (the kit's
// paper.caution, never the text gold), no = a muted ink (gone quiet). Mirrors the web's
// positive / caution / negative-at-70%-opacity dots.
function pulseColor(pulse: LocalSubscriptionPulse): string {
  if (pulse === 'yes') return paper.positive;
  if (pulse === 'maybe') return paper.caution;
  return paper.muted;
}

function pulseLabel(pulse: LocalSubscriptionPulse): string {
  if (pulse === 'yes') return 'Used recently';
  if (pulse === 'maybe') return 'Not sure';
  return 'Quiet a while';
}

// The web's "{p}p per use · {uses}/mo", or "no uses this month" when there are none.
function scoreLine(row: LocalSubscriptionRow): string {
  if (row.usesPerMonth <= 0 || !Number.isFinite(row.valueScore)) return 'no uses this month';
  return `${row.valueScoreLabel} · ${row.usesPerMonth}/mo`;
}

function nextChargeLabel(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 14) return `in ${days}d`;
  const date = new Date(Date.now() + days * 86_400_000);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ---------------------------------------------------------------------------
// Sorting — same comparators the web uses. Worst-value first sorts by valueScore
// descending (Infinity = no uses floats to the top); cost descending; next-charge ascending.
// ---------------------------------------------------------------------------

function sortRows(
  rows: readonly LocalSubscriptionRow[],
  sort: SortKey,
): readonly LocalSubscriptionRow[] {
  const next = [...rows];
  if (sort === 'value') next.sort((a, b) => b.valueScore - a.valueScore);
  if (sort === 'cost') next.sort((a, b) => b.costMinor - a.costMinor);
  if (sort === 'next') next.sort((a, b) => a.nextRenewalDaysAway - b.nextRenewalDaysAway);
  return next;
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function SubscriptionRow({
  row,
  first,
  onResume,
  onPause,
  onRecordUse,
  onAskMelo,
  onCancel,
}: {
  row: LocalSubscriptionRow;
  first: boolean;
  onResume: (id: string) => void;
  onPause: (id: string) => void;
  onRecordUse: (id: string) => void;
  onAskMelo: (name: string) => void;
  onCancel: (id: string) => void;
}) {
  const confirmCancel = () => {
    Alert.alert(
      `Cancel ${row.name} for good?`,
      'You can re-add it any time.',
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Cancel it', style: 'destructive', onPress: () => onCancel(row.id) },
      ],
      { cancelable: true },
    );
  };

  return (
    <View
      style={[styles.row, first ? styles.rowFirst : undefined, row.paused ? styles.rowPaused : undefined]}
    >
      <View style={styles.rowHead}>
        <View style={[styles.pulseDot, { backgroundColor: pulseColor(row.pulse) }]} />
        <View style={styles.rowText}>
          <Text style={styles.rowName} numberOfLines={1}>
            {row.name}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {pulseLabel(row.pulse)} · {scoreLine(row)}
          </Text>
        </View>
        <View style={styles.rowAmountCol}>
          <Text style={styles.rowCost}>{row.cost}</Text>
          <Text style={styles.rowNext}>next {nextChargeLabel(row.nextRenewalDaysAway)}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <PausePill
          label={row.paused ? 'Resume' : 'Pause one cycle'}
          onPress={() => (row.paused ? onResume(row.id) : onPause(row.id))}
        />
        {row.paused ? null : (
          <ActionLink
            label="Used today"
            tone="positive"
            onPress={() => onRecordUse(row.id)}
            accessibilityHint="Marks this subscription as used today."
          />
        )}
        <ActionLink
          label="Ask Melo"
          tone="muted"
          onPress={() => onAskMelo(row.name)}
          accessibilityHint={`Asks Melo about ${row.name}.`}
        />
        <View style={styles.actionsSpacer} />
        <ActionLink
          label="Cancel"
          tone="repair"
          onPress={confirmCancel}
          accessibilityHint={`Cancels ${row.name}.`}
        />
      </View>
    </View>
  );
}

// A compact inset pill (Pause / Resume) — the web's h-8 px-3 rounded-full bg-[var(--inset)]
// control. Not the full-width kit GhostButton; a small chip that sits inline with the actions.
function PausePill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed: isPressed }) => [styles.pausePill, isPressed ? pressed : undefined]}
    >
      <Text style={styles.pausePillLabel}>{label}</Text>
    </Pressable>
  );
}

// A flat, text-only action (Used today / Ask Melo / Cancel) — no fill, only coloured text,
// matching the web's borderless h-8 pills.
function ActionLink({
  label,
  tone,
  onPress,
  accessibilityHint,
}: {
  label: string;
  tone: 'positive' | 'muted' | 'repair';
  onPress: () => void;
  accessibilityHint?: string | undefined;
}) {
  const color =
    tone === 'positive' ? paper.positiveInk : tone === 'repair' ? paper.repairInk : paper.muted;
  return (
    <Text
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={[styles.actionLink, { color }]}
      suppressHighlighting
    >
      {label}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function SubscriptionsScreen({
  subscriptions,
  onBack,
  onPause,
  onResume,
  onRecordUse,
  onCancel,
  onBulkPauseQuiet,
  onAskMelo,
  reduceMotion,
}: {
  subscriptions: LocalSubscriptionsModel;
  onBack: () => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRecordUse: (id: string) => void;
  onCancel: (id: string) => void;
  onBulkPauseQuiet: () => void;
  onAskMelo: (name: string) => void;
  reduceMotion?: boolean | undefined;
}) {
  const [sort, setSort] = useState<SortKey>('value');

  const rows = useMemo(() => sortRows(subscriptions.rows, sort), [subscriptions.rows, sort]);

  // The hero number counts up to the live monthly total (active subscriptions only). Animate
  // from the minor-unit pounds so the formatting (commas, two decimals) matches the rest.
  const monthlyPounds = subscriptions.monthlyTotalMinor / 100;
  const animatedPounds = useCountUp(monthlyPounds, reduceMotion === true);
  const monthlyDisplay = formatMinorAmount(Math.round(animatedPounds * 100));
  const yearlyDisplay = formatMinorAmount(subscriptions.monthlyTotalMinor * 12);
  const hasSavings = subscriptions.savedFromPausesMinor > 0;

  // The quiet-move banner only appears when there are quiet subscriptions that are still
  // active — i.e. there is something to pause. This is the model's quietActiveCount.
  const showQuietMove = subscriptions.quietActiveCount > 0;
  const quietSavedMinor = useMemo(
    () =>
      subscriptions.rows
        .filter((row) => !row.paused && row.quiet)
        .reduce((total, row) => total + row.costMinor, 0),
    [subscriptions.rows],
  );

  return (
    <PressureScreen>
      <ScreenHeader label="Subscriptions" onBack={onBack} />

      <View style={styles.head}>
        <Text style={styles.kicker}>Recurring spend</Text>
        <Headline lead="What still " accent="earns" tail=" its place?" />
      </View>

      {/* Totals card — the monthly drain is the hero. "−£X from pauses" sits beneath it in
          the calm green; the yearly figure is the quiet right-hand counterweight. */}
      <View style={styles.totals}>
        <View style={styles.totalsLeft}>
          <Text style={styles.totalsLabel}>Every month</Text>
          <Text style={styles.totalsValue}>{monthlyDisplay}</Text>
          {hasSavings ? (
            <Text style={styles.totalsSaved}>−{subscriptions.savedFromPauses} from pauses</Text>
          ) : null}
        </View>
        <View style={styles.totalsRight}>
          <Text style={styles.totalsLabel}>Per year</Text>
          <Text style={styles.totalsYear}>{yearlyDisplay}</Text>
        </View>
      </View>

      {/* The single quiet move — pause everything that has gone quiet. One accent-soft banner
          with a forward arrow, never a row of equal buttons. */}
      {showQuietMove ? (
        <Text
          accessibilityRole="button"
          accessibilityHint="Pauses every subscription that has gone quiet."
          onPress={onBulkPauseQuiet}
          suppressHighlighting
          style={styles.quietBanner}
        >
          <Text style={styles.quietEyebrow}>A QUIET MOVE{'\n'}</Text>
          <Text style={styles.quietBody}>
            Pause the {subscriptions.quietActiveCount} quiet{' '}
            {subscriptions.quietActiveCount === 1 ? 'one' : 'ones'} → save{' '}
            {formatMinorAmount(quietSavedMinor)}/mo, {formatMinorAmount(quietSavedMinor * 12)}/yr
          </Text>
        </Text>
      ) : null}

      {/* Sort chips — Worst value (default) · Cost · Next charge. */}
      <View style={styles.sortRow}>
        {SORTS.map((option) => (
          <ChipToggle
            key={option.key}
            label={option.label}
            selected={sort === option.key}
            onPress={() => setSort(option.key)}
          />
        ))}
      </View>

      {/* The list — one surface card, hairline-divided rows. */}
      {rows.length > 0 ? (
        <View style={styles.list}>
          {rows.map((row, index) => (
            <SubscriptionRow
              key={row.id}
              row={row}
              first={index === 0}
              onResume={onResume}
              onPause={onPause}
              onRecordUse={onRecordUse}
              onAskMelo={onAskMelo}
              onCancel={onCancel}
            />
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <Body>
            No subscriptions yet. When recurring payments show up, you can see what still earns
            its place here.
          </Body>
        </View>
      )}

      <MeloLine
        tone="soft"
        text="Pause is a small experiment. Nothing leaves your money picture."
      />
    </PressureScreen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 4 },
  // Italic serif kicker — web font-display italic, 13px, muted ink.
  kicker: {
    color: paper.muted,
    fontFamily: serif.displayItalic,
    fontSize: 13,
    lineHeight: 18,
  },

  // Totals card — a raised paper surface, baseline-aligned left vs right (web items-baseline).
  totals: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    backgroundColor: paper.surface,
    borderRadius: 20,
    padding: 20,
    ...elevation.card,
  },
  totalsLeft: { flex: 1 },
  totalsRight: { alignItems: 'flex-end' },
  totalsLabel: {
    color: paper.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  totalsValue: {
    color: paper.ink,
    fontFamily: serif.display,
    fontSize: 34,
    lineHeight: 36,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  totalsSaved: {
    color: paper.positiveInk,
    fontSize: 11.5,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  totalsYear: {
    color: paper.ink,
    fontFamily: serif.display,
    fontSize: 15,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },

  // Quiet-move banner — accent-soft fill, terracotta ring + eyebrow, with a trailing arrow.
  quietBanner: {
    backgroundColor: paper.calmSoft,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(224, 99, 58, 0.3)',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  quietEyebrow: {
    color: paper.calmStrong,
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  quietBody: {
    color: paper.ink,
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },

  sortRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },

  list: {
    backgroundColor: paper.surface,
    borderRadius: 20,
    ...elevation.card,
  },
  row: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.hairline,
  },
  rowFirst: { borderTopWidth: 0 },
  rowPaused: { opacity: 0.55 },

  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pulseDot: { width: 8, height: 8, borderRadius: 4 },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { color: paper.ink, fontSize: 14.5, fontWeight: '600' },
  rowMeta: {
    color: paper.muted,
    fontSize: 11.5,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  rowAmountCol: { alignItems: 'flex-end' },
  rowCost: {
    color: paper.ink,
    fontFamily: serif.display,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  rowNext: {
    color: paper.muted,
    fontSize: 10.5,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  actionsSpacer: { flex: 1 },
  // The Pause/Resume control — a compact inset pill matching the web h-8 px-3 rounded-full
  // bg-[var(--inset)]; never the full-width kit GhostButton.
  pausePill: {
    backgroundColor: paper.inset,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  pausePillLabel: { color: paper.ink, fontSize: 12, fontWeight: '600' },
  actionLink: { fontSize: 12, fontWeight: '600' },

  empty: {
    backgroundColor: paper.surface,
    borderRadius: 20,
    padding: 20,
    ...elevation.card,
  },
});
