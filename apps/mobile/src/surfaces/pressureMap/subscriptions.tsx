// Subscriptions — everything that recurs (Quiet Paper Luxury).
//
// RN port of the Folio WEB screen (ScreenSubscriptions.tsx), DE-CLAIMED to payment facts only:
// Folio can prove a charge RECURS (banking/seed data), but not that a product was used or is good/bad
// VALUE — so this surface never renders a usage/value/per-use verdict (SUBSCRIPTION_SIGNAL_RESEARCH
// §5, matching apps/mobile/src/folio/screens/SubscriptionsScreen.tsx). The recurring drain is the hero
// (a count-up monthly total, with what pauses have already saved beneath it); a single quiet "pause
// the quiet ones" move appears only when there are quiet, still-active subscriptions; two sort chips
// reorder the list by PAYMENT FACTS (next charge by default, then cost — no "worst value"); and each
// row carries a calm neutral marker + a payment-fact subtitle (recurrence / Paused) + per-row actions.
//
// Presentation only — it never touches the engine. It takes the LocalSubscriptionsModel the
// container builds from the canonical engine, plus the engine's handlers as on* callbacks.
// Money is formatted through formatMinorAmount so there is no formatting drift. Built from RN
// primitives composing the pressure-map kit. The model still carries usage fields (used elsewhere),
// but this surface deliberately renders none of them as a verdict.

import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Body,
  ChipToggle,
  elevation,
  gap,
  GhostButton,
  Headline,
  MoneyPad,
  poundsLabel,
  PressureScreen,
  pressed,
  PrimaryAction,
  radius,
  serif,
  useTheme,
  type Palette,
} from './kit';
import { MeloLine, ScreenHeader } from './secondaryKit';
import { Sheet } from './Sheet';
import { useCountUp } from './useCountUp';
import {
  formatMinorAmount,
  type CreateSubscriptionInput,
  type SubscriptionCadence,
} from '../../local/localLedger';
import type {
  LocalSubscriptionRow,
  LocalSubscriptionsModel,
} from '../../local/localSubscriptionsAdapter';

// The orderings offered — PAYMENT FACTS only. No "worst value" sort: that ranks by a usage/value
// judgement banking or seed data cannot honestly make (SUBSCRIPTION_SIGNAL_RESEARCH §5). The honest
// orderings are by next charge (the default — what's coming first) and by cost.
type SortKey = 'next' | 'cost';

const SORTS: readonly { key: SortKey; label: string }[] = [
  { key: 'next', label: 'Next charge' },
  { key: 'cost', label: 'Cost' },
];

// The monthly total counts up to its target via the shared useCountUp (./useCountUp): the
// web's useCountUp(monthly, 600) — easeOutCubic over 600ms, respecting reduced motion (jumps
// straight to the value). Two decimals, to read as money.
const COUNT_UP_MS = 600;

// ---------------------------------------------------------------------------
// Row helpers — calm neutral marker, payment-fact subtitle, next-charge label.
// All derived purely from the model row; no engine calls, no new data. NONE of these encode a
// usage/value/per-use verdict (SUBSCRIPTION_SIGNAL_RESEARCH §5) — only payment facts.
// ---------------------------------------------------------------------------

// A calm, NON-usage marker dot. Banking/seed data can't prove a product was used, so the dot never
// encodes a "good/bad value" verdict — every row gets the same neutral calm mark. A paused row dims
// via row opacity, not the dot colour.
function markerColor(t: Palette): string {
  return t.muted;
}

// The row's subtitle — a PAYMENT FACT only. No usage / value / per-use claim: just that the charge
// recurs (the safe recurrence claim, SUBSCRIPTION_SIGNAL_RESEARCH §4), or that the user has paused it.
function metaLine(row: LocalSubscriptionRow): string {
  if (row.paused) return 'Paused';
  if (row.cadence === 'weekly') return 'Repeats weekly';
  if (row.cadence === 'yearly') return 'Repeats yearly';
  return 'Repeats monthly';
}

// Per-cadence suffix for the row's own cost ("£10.00 / week"), so a weekly or yearly charge reads
// honestly at its real frequency. The monthly total above still normalizes these to per-month.
function cadenceSuffix(cadence: SubscriptionCadence): string {
  if (cadence === 'weekly') return '/ week';
  if (cadence === 'yearly') return '/ year';
  return '/ month';
}

function nextChargeLabel(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 14) return `in ${days}d`;
  const date = new Date(Date.now() + days * 86_400_000);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ---------------------------------------------------------------------------
// Sorting — PAYMENT FACTS only. Next-charge ascending (what's coming first) and cost descending.
// There is no usage/value ordering: banking or seed data cannot make that judgement honestly
// (SUBSCRIPTION_SIGNAL_RESEARCH §5).
// ---------------------------------------------------------------------------

function sortRows(
  rows: readonly LocalSubscriptionRow[],
  sort: SortKey,
): readonly LocalSubscriptionRow[] {
  const next = [...rows];
  if (sort === 'cost') next.sort((a, b) => b.monthlyMinor - a.monthlyMinor);
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
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
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
      style={[
        s.row,
        first ? layout.rowFirst : undefined,
        row.paused ? layout.rowPaused : undefined,
      ]}
    >
      <View style={layout.rowHead}>
        <View style={[layout.pulseDot, { backgroundColor: markerColor(t) }]} />
        <View style={layout.rowText}>
          <Text style={s.rowName} numberOfLines={1}>
            {row.name}
          </Text>
          <Text style={s.rowMeta} numberOfLines={1}>
            {metaLine(row)}
          </Text>
        </View>
        <View style={layout.rowAmountCol}>
          <Text style={s.rowCost}>
            {row.cost} {cadenceSuffix(row.cadence)}
          </Text>
          <Text style={s.rowNext}>next {nextChargeLabel(row.nextRenewalDaysAway)}</Text>
        </View>
      </View>

      <View style={layout.actions}>
        <PausePill
          label={row.paused ? 'Resume' : 'Pause for a month'}
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
        <View style={layout.actionsSpacer} />
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
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed: isPressed }) => [s.pausePill, isPressed ? pressed : undefined]}
    >
      <Text style={s.pausePillLabel}>{label}</Text>
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
  const t = useTheme();
  const color = tone === 'positive' ? t.positiveInk : tone === 'repair' ? t.repairInk : t.muted;
  return (
    <Text
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={[layout.actionLink, { color }]}
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
  onCreateSubscription,
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
  onCreateSubscription: (input: CreateSubscriptionInput) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRecordUse: (id: string) => void;
  onCancel: (id: string) => void;
  onBulkPauseQuiet: () => void;
  onAskMelo: (name: string) => void;
  reduceMotion?: boolean | undefined;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const [sort, setSort] = useState<SortKey>('next');
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => sortRows(subscriptions.rows, sort), [subscriptions.rows, sort]);

  // The hero number counts up to the live monthly total (active subscriptions only). Animate
  // from the minor-unit pounds so the formatting (commas, two decimals) matches the rest.
  const monthlyPounds = subscriptions.monthlyTotalMinor / 100;
  const animatedPounds = useCountUp(monthlyPounds, COUNT_UP_MS, reduceMotion === true);
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
        // Saving is a MONTHLY figure, so sum the per-month-normalized cost, not the raw cadence cost.
        .reduce((total, row) => total + row.monthlyMinor, 0),
    [subscriptions.rows],
  );

  return (
    <PressureScreen>
      <ScreenHeader label="Subscriptions" onBack={onBack} />

      <View style={layout.head}>
        <Text style={s.kicker}>Recurring spend</Text>
        <Headline lead="What still " accent="earns" tail=" its place?" />
      </View>

      {/* Totals card — the monthly drain is the hero. "−£X from pauses" sits beneath it in
          the calm green; the yearly figure is the quiet right-hand counterweight. */}
      <View style={s.totals}>
        <View style={layout.totalsLeft}>
          <Text style={s.totalsLabel}>Every month</Text>
          <Text style={s.totalsValue}>{monthlyDisplay}</Text>
          {hasSavings ? (
            <Text style={s.totalsSaved}>−{subscriptions.savedFromPauses} from pauses</Text>
          ) : null}
        </View>
        <View style={layout.totalsRight}>
          <Text style={s.totalsLabel}>Per year</Text>
          <Text style={s.totalsYear}>{yearlyDisplay}</Text>
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
          style={s.quietBanner}
        >
          <Text style={s.quietEyebrow}>A QUIET MOVE{'\n'}</Text>
          <Text style={s.quietBody}>
            Pause the {subscriptions.quietActiveCount} quiet{' '}
            {subscriptions.quietActiveCount === 1 ? 'one' : 'ones'} → save{' '}
            {formatMinorAmount(quietSavedMinor)}/mo, {formatMinorAmount(quietSavedMinor * 12)}/yr
          </Text>
        </Text>
      ) : null}

      {/* Sort chips — Worst value (default) · Cost · Next charge. */}
      <View style={layout.sortRow}>
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
        <>
          <View style={s.list}>
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
          <PrimaryAction
            label="Add a subscription"
            accessibilityHint="Adds a recurring payment you carry."
            onPress={() => setCreating(true)}
          />
        </>
      ) : (
        <View style={s.empty}>
          <Body>
            No subscriptions yet. Add the recurring payments you carry, and you can see what still
            earns its place here.
          </Body>
          <View style={layout.emptyAction}>
            <PrimaryAction
              label="Add a subscription"
              accessibilityHint="Adds a recurring payment you carry."
              onPress={() => setCreating(true)}
            />
          </View>
        </View>
      )}

      <MeloLine
        tone="soft"
        text="Pausing for a month is a small experiment. You can always resume."
      />

      {/* Add a subscription. */}
      <CreateSubscriptionSheet
        visible={creating}
        reduceMotion={reduceMotion}
        onClose={() => setCreating(false)}
        onCreate={(input) => {
          onCreateSubscription(input);
          setCreating(false);
        }}
      />
    </PressureScreen>
  );
}

// ---------------------------------------------------------------------------
// Add a subscription — mirrors the Pots "Open a pot" sheet: quick name chips, a single tappable
// amount tile filled by the MoneyPad, and "how often" cadence chips. Plain, honest language only.
// ---------------------------------------------------------------------------

const QUICK_SUB_NAMES = ['Netflix', 'Spotify', 'Gym', 'Phone', 'Cloud storage'] as const;

const CADENCE_OPTIONS: readonly { key: SubscriptionCadence; label: string }[] = [
  { key: 'weekly', label: 'Every week' },
  { key: 'monthly', label: 'Every month' },
  { key: 'yearly', label: 'Every year' },
];

// Whole-pound digit string → pence. Strips any non-digits, defaults to 0.
function poundsToMinor(wholePounds: string): number {
  const digits = wholePounds.replace(/[^0-9]/g, '');
  const value = digits.length === 0 ? 0 : Number(digits);
  return value * 100;
}

function CreateSubscriptionSheet({
  visible,
  onClose,
  onCreate,
  reduceMotion,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (input: CreateSubscriptionInput) => void;
  reduceMotion?: boolean | undefined;
}) {
  const [name, setName] = useState('');
  // Held as a whole-pound digit string, converted to pence on save.
  const [cost, setCost] = useState('');
  const [cadence, setCadence] = useState<SubscriptionCadence>('monthly');
  const [primed, setPrimed] = useState(false);
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  // Reset the form each time the sheet opens (same priming pattern as CreatePotSheet).
  if (visible && !primed) {
    setPrimed(true);
    setName('');
    setCost('');
    setCadence('monthly');
  }
  if (!visible && primed) {
    setPrimed(false);
  }

  const costMinor = poundsToMinor(cost);
  const canCreate = name.trim().length > 0 && costMinor > 0;

  return (
    <Sheet visible={visible} reduceMotion={reduceMotion} onClose={onClose}>
      <Text style={s.sheetKicker}>Add a subscription</Text>
      <Text style={s.sheetTitle}>What do you pay for?</Text>

      <Text style={s.fieldLabel}>Name</Text>
      <View style={layout.nameRow}>
        {QUICK_SUB_NAMES.map((preset) => {
          const selected = name === preset;
          return (
            <Pressable
              key={preset}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setName(preset)}
              style={({ pressed: isPressed }) => [
                s.nameChip,
                selected ? s.nameChipOn : undefined,
                isPressed ? pressed : undefined,
              ]}
            >
              <Text style={[s.nameChipLabel, selected ? s.nameChipLabelOn : undefined]}>
                {preset}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Amount — a single tappable tile filled by the pad below. */}
      <View style={layout.amountTiles}>
        <View style={[s.amountTile, s.amountTileActive]}>
          <Text style={s.amountTileLabel}>Amount</Text>
          <Text style={[s.amountTileValue, s.amountTileValueActive]}>{poundsLabel(cost)}</Text>
        </View>
      </View>

      <MoneyPad value={cost} onChange={setCost} />

      <Text style={s.fieldLabel}>How often</Text>
      <View style={layout.cadenceRow}>
        {CADENCE_OPTIONS.map((option) => (
          <ChipToggle
            key={option.key}
            label={option.label}
            selected={cadence === option.key}
            onPress={() => setCadence(option.key)}
          />
        ))}
      </View>

      <View style={layout.sheetActions}>
        <GhostButton flex label="Cancel" onPress={onClose} />
        <View style={layout.sheetActionFlex}>
          <PrimaryAction
            label="Add it"
            disabled={!canCreate}
            accessibilityHint="Adds the subscription."
            onPress={() => onCreate({ name: name.trim(), costMinor, cadence })}
          />
        </View>
      </View>
    </Sheet>
  );
}

// Colour-free styles — shared across light and dark (per the DARK-MODE PATTERN in kit.tsx).
const layout = StyleSheet.create({
  head: { gap: 4 },

  totalsLeft: { flex: 1 },
  totalsRight: { alignItems: 'flex-end' },

  sortRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },

  rowFirst: { borderTopWidth: 0 },
  rowPaused: { opacity: 0.55 },

  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pulseDot: { width: 8, height: 8, borderRadius: 4 },
  rowText: { flex: 1, minWidth: 0 },
  rowAmountCol: { alignItems: 'flex-end' },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  actionsSpacer: { flex: 1 },
  actionLink: { fontSize: 12, fontWeight: '600' },

  emptyAction: { marginTop: gap.lg },

  sheetActions: { flexDirection: 'row', gap: gap.sm, marginTop: gap.lg },
  sheetActionFlex: { flex: 1 },

  nameRow: { flexDirection: 'row', flexWrap: 'wrap', gap: gap.xs, marginTop: gap.sm },
  amountTiles: { flexDirection: 'row', gap: gap.sm, marginTop: gap.lg },
  cadenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: gap.sm },
});

// Colour-bearing styles, resolved against the active palette `t`.
function makeStyles(t: Palette) {
  return StyleSheet.create({
    // Italic serif kicker — web font-display italic, 13px, muted ink.
    kicker: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 13,
      lineHeight: 18,
    },

    // Totals card — a raised paper surface, baseline-aligned left vs right (web items-baseline).
    totals: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      backgroundColor: t.surface,
      borderRadius: 20,
      padding: 20,
      ...elevation.card,
    },
    totalsLabel: {
      color: t.muted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    totalsValue: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 34,
      lineHeight: 36,
      marginTop: 4,
      fontVariant: ['tabular-nums'],
    },
    totalsSaved: {
      color: t.positiveInk,
      fontSize: 11.5,
      marginTop: 4,
      fontVariant: ['tabular-nums'],
    },
    totalsYear: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 15,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },

    // Quiet-move banner — accent-soft fill, terracotta ring + eyebrow, with a trailing arrow. The
    // fill (t.calmSoft) carries the theme; the ring is a faint accent hairline. We keep it as a soft
    // terracotta rgba (the web's accent/30) so the ring stays whisper-thin in both modes rather than
    // jumping to a solid accent line — the accent hue is close enough across light/dark that a single
    // low-alpha literal reads correctly on either calmSoft ground.
    quietBanner: {
      backgroundColor: t.calmSoft,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: 'rgba(224, 99, 58, 0.3)',
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    quietEyebrow: {
      color: t.calmStrong,
      fontSize: 11.5,
      fontWeight: '700',
      letterSpacing: 1.2,
    },
    quietBody: {
      color: t.ink,
      fontSize: 13,
      lineHeight: 18,
      fontVariant: ['tabular-nums'],
    },

    list: {
      backgroundColor: t.surface,
      borderRadius: 20,
      ...elevation.card,
    },
    row: {
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.hairline,
    },

    rowName: { color: t.ink, fontSize: 14.5, fontWeight: '600' },
    rowMeta: {
      color: t.muted,
      fontSize: 11.5,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    rowCost: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 15,
      fontVariant: ['tabular-nums'],
    },
    rowNext: {
      color: t.muted,
      fontSize: 10.5,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },

    // The Pause/Resume control — a compact inset pill matching the web h-8 px-3 rounded-full
    // bg-[var(--inset)]; never the full-width kit GhostButton.
    pausePill: {
      backgroundColor: t.inset,
      borderRadius: radius.pill,
      paddingVertical: 7,
      paddingHorizontal: 12,
    },
    pausePillLabel: { color: t.ink, fontSize: 12, fontWeight: '600' },

    empty: {
      backgroundColor: t.surface,
      borderRadius: 20,
      padding: 20,
      ...elevation.card,
    },

    // Add-a-subscription sheet — mirrors the Pots "Open a pot" sheet tokens.
    sheetKicker: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 13,
      lineHeight: 18,
    },
    sheetTitle: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 22,
      lineHeight: 28,
      letterSpacing: -0.3,
      marginTop: 2,
    },

    fieldLabel: { color: t.muted, fontSize: 13, fontWeight: '700', marginTop: gap.lg },
    nameChip: {
      borderRadius: radius.pill,
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderWidth: 1.5,
      borderColor: t.hairline,
      backgroundColor: t.surface,
    },
    nameChipOn: { borderColor: t.calm, backgroundColor: t.calmSoft },
    nameChipLabel: { color: t.secondary, fontSize: 13.5, fontWeight: '600' },
    nameChipLabelOn: { color: t.calmStrong },

    amountTile: {
      flex: 1,
      backgroundColor: t.inset,
      borderRadius: radius.lg,
      paddingVertical: gap.md,
      paddingHorizontal: gap.md,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    amountTileActive: { borderColor: t.calm, backgroundColor: t.calmSoft },
    amountTileLabel: {
      color: t.muted,
      fontSize: 10.5,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    amountTileValue: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 26,
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'],
      marginTop: 4,
    },
    amountTileValueActive: { color: t.calmStrong },
  });
}
