// Pots — set aside small, calmly, on purpose (Quiet Paper Luxury).
//
// The RN port of the Folio WEB ScreenPots (src/components/folio/screens/ScreenPots.tsx). It is a
// faithful reproduction of that screen, rebuilt from RN primitives composing the pressure-map kit —
// the web is the source of truth, not a reinterpretation. Same italic "Set aside" kicker over the
// "Small, calmly, on purpose." headline (the accent word is "calmly"), the same across-pots totals
// card with a count-up figure and a progress bar, the same per-pot cards with a progress bar, pace
// line and +£5 / +£10 / +£20 quick-add pills, the same single accent "Open a pot" primary action,
// and the same reallocation bottom sheet (From → To + amount + live tight-point impact + "Move £n").
//
// Presentation only — this screen never touches the engine. It takes the pots view-model and the
// on* handler callbacks as PROPS; the container wires them to the canonical engine. Money is in
// minor units throughout and always rendered through the kit's formatMinorAmount, so there is no
// formatting drift with the rest of the app. User text (the new-pot goal/weekly amount) is converted
// to pence before any handler is called.
//
// Web → RN deltas, all deliberate and faithful to intent:
//   • Drag-to-reallocate isn't a native gesture here; the "⋮⋮" handle on each pot opens a compact
//     "move from this pot" picker (choose the destination), which then opens the same reallocation
//     sheet the web drag-drop opens. The flow and the sheet are identical; only the trigger differs.
//   • The web slider becomes a calm −/+ stepper because @react-native-community/slider is not a
//     dependency of this app (checked). The step (£5), the max clamp (the from-pot balance) and the
//     live readout all match the web range input exactly.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMinorAmount, type CreatePotInput } from '../../local/localLedger';
import type { LocalPotRow, LocalPotsModel } from '../../local/localPotsAdapter';
import {
  Body,
  elevation,
  gap,
  GhostButton,
  Headline,
  MoneyPad,
  poundsLabel,
  PrimaryAction,
  radius,
  serif,
  useTheme,
  type Palette,
} from './kit';
import { MeloLine, ScreenHeader } from './secondaryKit';
import { Sheet } from './Sheet';
import { useCountUp } from './useCountUp';

// Quick-add increments, in whole pounds — the web's +£5 / +£10 / +£20 pills. Converted to pence at
// the call site so the handler only ever sees minor units.
const QUICK_ADD_POUNDS = [5, 10, 20] as const;

// The reallocation step, in pence — the web slider steps in £5.
const MOVE_STEP_MINOR = 500;

// The short display name — the web splits a "Name · subtitle" label on the middle dot and keeps the
// first part for the compact sheet heading.
function shortName(name: string): string {
  return name.split(' · ')[0] ?? name;
}

// The across-pots total counts up via the shared useCountUp (./useCountUp) — the kit's
// easeOutCubic count-up over 700ms, honouring reduced motion (snaps straight to the value).
const TOTALS_COUNT_UP_MS = 700;

type ReallocationTarget = Readonly<{ fromId: string; toId: string }>;

export function PotsScreen({
  model,
  tightPointMinor,
  onBack,
  onCreatePot,
  onAddToPot,
  onReallocateBetweenPots,
  reduceMotion,
}: PotsScreenProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const rows = model.rows;

  // The reallocation flow has three states: closed, picking a destination for a chosen source pot,
  // and the open reallocation sheet for a confirmed from → to pair.
  const [picking, setPicking] = useState<string | null>(null);
  const [transfer, setTransfer] = useState<ReallocationTarget | null>(null);
  const [creating, setCreating] = useState(false);

  const sumDisplay = useCountUp(model.sumSavedMinor, TOTALS_COUNT_UP_MS, reduceMotion === true);
  const totalGoalMinor = rows.reduce((sum, row) => sum + row.goalMinor, 0);
  const totalPct = totalGoalMinor > 0 ? Math.min(1, model.sumSavedMinor / totalGoalMinor) : 0;

  return (
    <>
      <ScreenHeader label="Pots" onBack={onBack} />

      <View style={layout.head}>
        <Text style={s.kicker}>Set aside</Text>
        <Headline lead="Small, " accent="calmly" tail=", on purpose." />
        <Text style={s.subhead}>Move one pot onto another to reallocate.</Text>
      </View>

      {/* Across-pots totals — the figure counts up; the bar fills to the share of the combined goal. */}
      <View style={s.totals}>
        <Text style={s.totalsLabel}>Across pots</Text>
        <View style={layout.totalsRow}>
          <Text style={s.totalsValue}>{formatMinorAmount(Math.round(sumDisplay))}</Text>
          <Text style={s.totalsGoal}>of {formatMinorAmount(totalGoalMinor)}</Text>
        </View>
        <View style={s.totalsTrack}>
          <View style={[s.totalsFill, { width: `${Math.round(totalPct * 100)}%` }]} />
        </View>
      </View>

      {/* Per-pot cards. */}
      <View style={layout.list}>
        {rows.map((row) => (
          <PotCard
            key={row.id}
            row={row}
            onAdd={(amountMinor) => onAddToPot(row.id, amountMinor)}
            onMove={() => setPicking(row.id)}
          />
        ))}
      </View>

      <PrimaryAction
        label="Open a pot"
        accessibilityHint="Starts a new pot with a goal and a weekly amount."
        onPress={() => setCreating(true)}
      />

      <MeloLine tone="soft" text="Pots are money you set aside on purpose — they sit beside the path, they don't change it." />

      {/* Pick a destination for the pot being moved from. */}
      <DestinationPickerSheet
        rows={rows}
        fromId={picking}
        onClose={() => setPicking(null)}
        onPick={(toId) => {
          const fromId = picking;
          setPicking(null);
          if (fromId && fromId !== toId) setTransfer({ fromId, toId });
        }}
      />

      {/* The reallocation sheet — From → To + amount stepper + live tight-point impact + Move £n. */}
      <ReallocationSheet
        rows={rows}
        transfer={transfer}
        tightPointMinor={tightPointMinor}
        onClose={() => setTransfer(null)}
        onMove={(fromId, toId, amountMinor) => {
          onReallocateBetweenPots(fromId, toId, amountMinor);
          setTransfer(null);
        }}
      />

      {/* Open a pot. */}
      <CreatePotSheet
        visible={creating}
        onClose={() => setCreating(false)}
        onCreate={(input) => {
          onCreatePot(input);
          setCreating(false);
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Per-pot card
// ---------------------------------------------------------------------------

function PotCard({
  row,
  onAdd,
  onMove,
}: {
  row: LocalPotRow;
  onAdd: (amountMinor: number) => void;
  onMove: () => void;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  // Weeks-left at the current pace — the web's Math.ceil(remaining / perWeek), "goal met" at 0.
  const remainingMinor = Math.max(0, row.goalMinor - row.savedMinor);
  const weeksLeft = row.perWeekMinor > 0 ? Math.ceil(remainingMinor / row.perWeekMinor) : 0;
  const paceLabel = weeksLeft > 0 ? `about ${weeksLeft} weeks` : 'goal met';

  return (
    <View style={s.card}>
      <View style={layout.cardTop}>
        <View style={layout.cardName}>
          <Pressable
            accessibilityLabel={`Move money from ${row.name}`}
            accessibilityHint="Choose another pot to move money into."
            hitSlop={10}
            onPress={onMove}
            style={({ pressed }) => [layout.handle, pressed ? layout.handlePressed : undefined]}
          >
            <Text style={s.handleGlyph}>⋮⋮</Text>
          </Pressable>
          <Text style={s.cardTitle} numberOfLines={1}>
            {row.name}
          </Text>
        </View>
        <Text style={s.cardAmount}>
          {row.saved} <Text style={s.cardAmountGoal}>/ {row.goal}</Text>
        </Text>
      </View>

      <View style={s.cardTrack}>
        <View
          style={[
            layout.cardFill,
            { width: `${Math.round(row.progress * 100)}%` },
            row.accent ? s.cardFillAccent : s.cardFillInk,
          ]}
        />
      </View>

      <View style={layout.cardMeta}>
        <Text style={s.cardMetaText}>{row.perWeek}/wk at this pace</Text>
        <Text style={s.cardMetaText}>{paceLabel}</Text>
      </View>

      <View style={layout.pills}>
        {QUICK_ADD_POUNDS.map((pounds) => (
          <Pressable
            key={pounds}
            accessibilityRole="button"
            accessibilityLabel={`Add £${pounds} to ${row.name}`}
            onPress={() => onAdd(pounds * 100)}
            style={({ pressed }) => [s.pill, pressed ? layout.pillPressed : undefined]}
          >
            <Text style={s.pillLabel}>+£{pounds}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Destination picker — replaces the web drag-drop target choice
// ---------------------------------------------------------------------------

function DestinationPickerSheet({
  rows,
  fromId,
  onClose,
  onPick,
}: {
  rows: readonly LocalPotRow[];
  fromId: string | null;
  onClose: () => void;
  onPick: (toId: string) => void;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const from = rows.find((r) => r.id === fromId);
  const others = rows.filter((r) => r.id !== fromId);

  return (
    <Sheet visible={fromId !== null} onClose={onClose}>
      <Text style={s.sheetKicker}>Move from</Text>
      <Text style={s.sheetTitle}>{from ? shortName(from.name) : ''}</Text>
      <Body style={layout.pickerHint}>Choose where it goes.</Body>

      <View style={s.pickerList}>
        {others.map((row, index) => (
          <Pressable
            key={row.id}
            accessibilityRole="button"
            accessibilityLabel={`Move into ${row.name}`}
            onPress={() => onPick(row.id)}
            style={({ pressed }) => [
              s.pickerRow,
              index === 0 ? layout.pickerRowFirst : undefined,
              pressed ? s.pickerRowPressed : undefined,
            ]}
          >
            <Text style={s.pickerName} numberOfLines={1}>
              {row.name}
            </Text>
            <Text style={s.pickerAmount}>{row.saved}</Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Reallocation sheet — From → To + amount + live tight-point impact + Move £n
// ---------------------------------------------------------------------------

function ReallocationSheet({
  rows,
  transfer,
  tightPointMinor,
  onClose,
  onMove,
}: {
  rows: readonly LocalPotRow[];
  transfer: ReallocationTarget | null;
  tightPointMinor: number | undefined;
  onClose: () => void;
  onMove: (fromId: string, toId: string, amountMinor: number) => void;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const fromPot = transfer ? rows.find((r) => r.id === transfer.fromId) : undefined;
  const toPot = transfer ? rows.find((r) => r.id === transfer.toId) : undefined;
  const maxMoveMinor = fromPot ? fromPot.savedMinor : 0;

  // The chosen amount, in pence. Primed to min(£20, from-pot balance) when the sheet opens, then
  // stepped by £5 between 0 and the from-pot balance — exactly the web slider's bounds and step.
  const [amountMinor, setAmountMinor] = useState(0);
  // The last from→to pair we primed for, tracked in a ref so priming runs exactly once per opened
  // pair (and re-runs if the same pair is reopened, since the ref is cleared on close).
  const primedKeyRef = useRef<string | null>(null);

  // Prime the amount once per opened pair, after render (an effect, not during render — setting state
  // in the render body is a React anti-pattern). Keyed on the active pair's key + the from-pot
  // balance, so a newly initiated transfer resets the amount to its default; closing the sheet clears
  // the primed key so reopening the same pair primes again. Behaviour is identical to before.
  const transferKey = transfer ? keyFor(transfer) : null;
  useEffect(() => {
    if (transferKey === null) {
      primedKeyRef.current = null;
      return;
    }
    if (primedKeyRef.current !== transferKey) {
      primedKeyRef.current = transferKey;
      setAmountMinor(Math.min(2000, maxMoveMinor));
    }
  }, [transferKey, maxMoveMinor]);

  const clampedMinor = Math.max(0, Math.min(amountMinor, maxMoveMinor));

  // Moving money between pots doesn't move your tight point — pots sit outside the forecast, so the
  // committed move leaves it exactly where it was. We show the tight point unchanged rather than a
  // predicted shift that would never actually happen.
  const canStepDown = clampedMinor >= MOVE_STEP_MINOR;
  const canStepUp = clampedMinor + MOVE_STEP_MINOR <= maxMoveMinor;
  const canMove = clampedMinor > 0;

  return (
    <Sheet visible={transfer !== null} onClose={onClose}>
      {fromPot && toPot ? (
        <>
          <Text style={s.sheetKicker}>Reallocate</Text>
          <Text style={s.sheetTitle}>
            {shortName(fromPot.name)} → {shortName(toPot.name)}
          </Text>

          {/* Amount well — the big terracotta figure + a calm −/+ stepper (the web's slider). */}
          <View style={s.amountWell}>
            <View style={layout.amountWellHead}>
              <Text style={s.amountWellLabel}>Amount</Text>
              <Text style={s.amountWellMax}>max {formatMinorAmount(maxMoveMinor)}</Text>
            </View>
            <Text style={s.amountValue}>{formatMinorAmount(clampedMinor)}</Text>
            <View style={layout.stepper}>
              <StepButton
                label="−£5"
                disabled={!canStepDown}
                onPress={() => setAmountMinor(clampedMinor - MOVE_STEP_MINOR)}
              />
              <StepButton
                label="+£5"
                disabled={!canStepUp}
                onPress={() => setAmountMinor(clampedMinor + MOVE_STEP_MINOR)}
              />
            </View>
          </View>

          {/* Impact row — the tight point on the left (unchanged: pots sit outside the forecast), the
              destination on the right (with the +£n it gains). */}
          <View style={s.impact}>
            <View>
              <Text style={s.impactLabel}>Tight point</Text>
              <Text style={s.impactValue}>
                {tightPointMinor !== undefined ? formatMinorAmount(tightPointMinor) : '—'}
              </Text>
            </View>
            <View style={layout.impactRight}>
              <Text style={s.impactLabel}>{shortName(toPot.name)}</Text>
              <Text style={s.impactValue}>
                {toPot.saved}
                <Text style={s.impactDeltaUp}>
                  {' '}
                  +{formatMinorAmount(clampedMinor).replace('-', '')}
                </Text>
              </Text>
            </View>
          </View>

          <View style={layout.sheetActions}>
            <GhostButton flex label="Cancel" onPress={onClose} />
            <View style={layout.flex}>
              <PrimaryAction
                label={`Move ${formatMinorAmount(clampedMinor)}`}
                disabled={!canMove}
                accessibilityHint={`Moves ${formatMinorAmount(clampedMinor)} from ${shortName(
                  fromPot.name,
                )} into ${shortName(toPot.name)}.`}
                onPress={() => onMove(fromPot.id, toPot.id, clampedMinor)}
              />
            </View>
          </View>
        </>
      ) : null}
    </Sheet>
  );
}

function keyFor(transfer: ReallocationTarget): string {
  return `${transfer.fromId}->${transfer.toId}`;
}

function StepButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        s.step,
        disabled ? s.stepDisabled : undefined,
        pressed && !disabled ? layout.stepPressed : undefined,
      ]}
    >
      <Text style={[s.stepLabel, disabled ? s.stepLabelDisabled : undefined]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Open a pot
// ---------------------------------------------------------------------------

function CreatePotSheet({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (input: CreatePotInput) => void;
}) {
  const [name, setName] = useState('');
  const [field, setField] = useState<'goal' | 'perWeek'>('goal');
  // Both held as whole-pound digit strings, converted to pence on save.
  const [goal, setGoal] = useState('');
  const [perWeek, setPerWeek] = useState('');
  const [primed, setPrimed] = useState(false);
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  // Reset the form each time the sheet opens.
  if (visible && !primed) {
    setPrimed(true);
    setName('');
    setGoal('');
    setPerWeek('');
    setField('goal');
  }
  if (!visible && primed) {
    setPrimed(false);
  }

  const padValue = field === 'goal' ? goal : perWeek;
  const setPadValue = (next: string) => (field === 'goal' ? setGoal(next) : setPerWeek(next));

  const goalMinor = poundsToMinor(goal);
  const canCreate = name.trim().length > 0;

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={s.sheetKicker}>Open a pot</Text>
      <Text style={s.sheetTitle}>What are you setting aside for?</Text>

      <Text style={s.fieldLabel}>Name</Text>
      <View style={layout.nameRow}>
        {QUICK_NAMES.map((preset) => {
          const selected = name === preset;
          return (
            <Pressable
              key={preset}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setName(preset)}
              style={({ pressed }) => [
                s.nameChip,
                selected ? s.nameChipOn : undefined,
                pressed ? layout.pillPressed : undefined,
              ]}
            >
              <Text style={[s.nameChipLabel, selected ? s.nameChipLabelOn : undefined]}>
                {preset}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Goal / weekly — two tappable amount tiles; the active one is filled by the pad below. */}
      <View style={layout.amountTiles}>
        <AmountTile
          label="Goal"
          value={poundsLabel(goal)}
          active={field === 'goal'}
          onPress={() => setField('goal')}
        />
        <AmountTile
          label="Each week"
          value={poundsLabel(perWeek)}
          active={field === 'perWeek'}
          onPress={() => setField('perWeek')}
        />
      </View>

      <MoneyPad value={padValue} onChange={setPadValue} />

      <View style={layout.sheetActions}>
        <GhostButton flex label="Cancel" onPress={onClose} />
        <View style={layout.flex}>
          <PrimaryAction
            label="Open it"
            disabled={!canCreate}
            accessibilityHint="Creates the pot."
            onPress={() =>
              onCreate({
                name: name.trim(),
                goalMinor,
                perWeekMinor: poundsToMinor(perWeek),
              })
            }
          />
        </View>
      </View>
    </Sheet>
  );
}

const QUICK_NAMES = ['Buffer', 'Holiday', 'Car', 'Christmas', 'Rainy day'] as const;

function AmountTile({
  label,
  value,
  active,
  onPress,
}: {
  label: string;
  value: string;
  active: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        s.amountTile,
        active ? s.amountTileActive : undefined,
        pressed ? layout.pillPressed : undefined,
      ]}
    >
      <Text style={s.amountTileLabel}>{label}</Text>
      <Text style={[s.amountTileValue, active ? s.amountTileValueActive : undefined]}>
        {value}
      </Text>
    </Pressable>
  );
}

// Whole-pound digit string → pence. Strips any non-digits, defaults to 0.
function poundsToMinor(wholePounds: string): number {
  const digits = wholePounds.replace(/[^0-9]/g, '');
  const value = digits.length === 0 ? 0 : Number(digits);
  return value * 100;
}

// ---------------------------------------------------------------------------
// Prop contract
// ---------------------------------------------------------------------------

export type PotsScreenProps = {
  // The pots view-model from buildLocalPotsModel.
  model: LocalPotsModel;
  // The current tight point (pence) for the live reallocation preview. The container reads it from
  // the same engine that builds the path; when it isn't available the sheet shows a quiet em dash.
  tightPointMinor?: number | undefined;
  onBack: () => void;
  onCreatePot: (input: CreatePotInput) => void;
  onAddToPot: (potId: string, amountMinor: number) => void;
  onReallocateBetweenPots: (fromPotId: string, toPotId: string, amountMinor: number) => void;
  // The user's reduced-motion preference. When true, the across-pots count-up snaps straight to its
  // value instead of animating. Threaded from the container's useReducedMotionPreference, mirroring
  // the sibling Subscriptions/Today screens.
  reduceMotion?: boolean | undefined;
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

// Colour-free styles — shared across light and dark (per the DARK-MODE PATTERN in kit.tsx).
const layout = StyleSheet.create({
  flex: { flex: 1 },

  head: { gap: gap.xs, paddingTop: gap.xs },

  totalsRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },

  // Per-pot cards.
  list: { gap: gap.sm },
  cardTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  cardName: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  handle: { paddingVertical: 2, paddingRight: 2 },
  handlePressed: { opacity: 0.5 },
  cardFill: { height: '100%', borderRadius: radius.pill },

  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: gap.sm,
  },

  pills: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  pillPressed: { opacity: 0.6 },

  sheetActions: { flexDirection: 'row', gap: gap.sm, marginTop: gap.lg },

  // Destination picker.
  pickerHint: { fontSize: 14, marginTop: gap.xs },
  pickerRowFirst: { borderTopWidth: 0 },

  amountWellHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', gap: gap.sm, marginTop: gap.sm },
  stepPressed: { opacity: 0.6 },

  impactRight: { alignItems: 'flex-end' },

  nameRow: { flexDirection: 'row', flexWrap: 'wrap', gap: gap.xs, marginTop: gap.sm },
  amountTiles: { flexDirection: 'row', gap: gap.sm, marginTop: gap.lg },
});

// Colour-bearing styles, resolved against the active palette `t`.
function makeStyles(t: Palette) {
  return StyleSheet.create({
    // Italic "Set aside" kicker — web font-display italic, 13px, muted ink.
    kicker: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 13,
      lineHeight: 18,
    },
    subhead: { color: t.muted, fontSize: 11.5, lineHeight: 16, marginTop: 2 },

    // Across-pots totals card — a raised paper surface; the figure is serif tabular, the bar fills ink.
    totals: {
      backgroundColor: t.surface,
      borderRadius: radius.xl,
      padding: gap.lg,
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
      fontSize: 40,
      lineHeight: 42,
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'],
    },
    totalsGoal: {
      color: t.muted,
      fontFamily: serif.medium,
      fontSize: 14,
      fontVariant: ['tabular-nums'],
    },
    totalsTrack: {
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: t.inset,
      overflow: 'hidden',
      marginTop: gap.md,
    },
    totalsFill: { height: '100%', borderRadius: radius.pill, backgroundColor: t.ink },

    card: {
      backgroundColor: t.surface,
      borderRadius: radius.xl,
      paddingHorizontal: gap.lg,
      paddingVertical: gap.md,
      ...elevation.card,
    },
    handleGlyph: { color: t.muted, fontSize: 12, letterSpacing: -1 },
    cardTitle: { color: t.ink, fontSize: 14.5, fontWeight: '600', flexShrink: 1 },
    cardAmount: {
      color: t.ink,
      fontFamily: serif.medium,
      fontSize: 15,
      fontVariant: ['tabular-nums'],
    },
    cardAmountGoal: { color: t.muted, fontSize: 12 },

    cardTrack: {
      height: 5,
      borderRadius: radius.pill,
      backgroundColor: t.inset,
      overflow: 'hidden',
      marginTop: gap.md,
    },
    cardFillAccent: { backgroundColor: t.calm },
    cardFillInk: { backgroundColor: t.secondary },

    cardMetaText: { color: t.muted, fontSize: 11.5, fontVariant: ['tabular-nums'] },

    pill: {
      height: 28,
      paddingHorizontal: 10,
      borderRadius: radius.pill,
      backgroundColor: t.inset,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillLabel: { color: t.ink, fontSize: 11.5, fontVariant: ['tabular-nums'] },

    // Sheet shared bits.
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

    // Destination picker.
    pickerList: {
      backgroundColor: t.inset,
      borderRadius: radius.lg,
      marginTop: gap.md,
      overflow: 'hidden',
    },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      paddingHorizontal: gap.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.hairline,
    },
    pickerRowPressed: { backgroundColor: t.sunken },
    pickerName: { color: t.ink, fontSize: 15, fontWeight: '600', flex: 1, minWidth: 0 },
    pickerAmount: {
      color: t.muted,
      fontFamily: serif.medium,
      fontSize: 14,
      fontVariant: ['tabular-nums'],
    },

    // Reallocation amount well — sunken inset, big terracotta figure, calm stepper.
    amountWell: {
      backgroundColor: t.inset,
      borderRadius: radius.xl,
      padding: gap.lg,
      marginTop: gap.lg,
    },
    amountWellLabel: {
      color: t.muted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    amountWellMax: { color: t.muted, fontSize: 10.5, fontVariant: ['tabular-nums'] },
    amountValue: {
      color: t.calm,
      fontFamily: serif.display,
      fontSize: 44,
      lineHeight: 50,
      letterSpacing: -1,
      fontVariant: ['tabular-nums'],
      marginTop: 2,
    },
    step: {
      flex: 1,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: t.surface,
      borderWidth: 1.5,
      borderColor: t.hairlineStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepDisabled: { borderColor: t.hairline, backgroundColor: t.sunken },
    stepLabel: {
      color: t.ink,
      fontSize: 16,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    stepLabelDisabled: { color: t.muted },

    // Impact row — tight point + destination, with signed deltas.
    impact: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      backgroundColor: t.surface,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairlineStrong,
      paddingVertical: 14,
      paddingHorizontal: gap.lg,
      marginTop: gap.md,
    },
    impactLabel: {
      color: t.muted,
      fontSize: 10.5,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    impactValue: {
      color: t.ink,
      fontFamily: serif.medium,
      fontSize: 16,
      fontVariant: ['tabular-nums'],
      marginTop: 3,
    },
    impactDeltaUp: { color: t.positiveInk, fontSize: 12 },

    // Open-a-pot form.
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
