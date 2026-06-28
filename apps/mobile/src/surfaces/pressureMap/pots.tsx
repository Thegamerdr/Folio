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

import { useEffect, useRef, useState } from 'react';
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
  paper,
  poundsLabel,
  PrimaryAction,
  radius,
  serif,
} from './kit';
import { MeloLine, ScreenHeader } from './secondaryKit';
import { Sheet } from './Sheet';

// Quick-add increments, in whole pounds — the web's +£5 / +£10 / +£20 pills. Converted to pence at
// the call site so the handler only ever sees minor units.
const QUICK_ADD_POUNDS = [5, 10, 20] as const;

// The reallocation step, in pence — the web slider steps in £5.
const MOVE_STEP_MINOR = 500;

// How much a £1 move shifts the tight point, mirroring the web's rough 0.6 preview factor. The web
// only previews a shift when moving in or out of the Buffer pot; we keep the same shape but, since
// the RN model has no fixed "buffer" id, treat the pot whose name reads as a buffer/safety/spare pot
// as the buffer. Preview only — the engine owns the real number.
const TIGHT_POINT_PREVIEW_FACTOR = 0.6;

function isBufferPot(row: LocalPotRow | undefined): boolean {
  if (!row) return false;
  return /buffer|safety|spare|cushion|emergency/i.test(row.name);
}

// The short display name — the web splits a "Name · subtitle" label on the middle dot and keeps the
// first part for the compact sheet heading.
function shortName(name: string): string {
  return name.split(' · ')[0] ?? name;
}

// Count-up tween — the kit's useCountUp pattern (primitives.useCountUp), ported to RN. RN supports
// requestAnimationFrame, so the same cubic ease-out from the web runs here unchanged. Returns the
// tweened value; the screen rounds it for display.
function useCountUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

type ReallocationTarget = Readonly<{ fromId: string; toId: string }>;

export function PotsScreen({
  model,
  tightPointMinor,
  onBack,
  onCreatePot,
  onAddToPot,
  onReallocateBetweenPots,
}: PotsScreenProps) {
  const rows = model.rows;

  // The reallocation flow has three states: closed, picking a destination for a chosen source pot,
  // and the open reallocation sheet for a confirmed from → to pair.
  const [picking, setPicking] = useState<string | null>(null);
  const [transfer, setTransfer] = useState<ReallocationTarget | null>(null);
  const [creating, setCreating] = useState(false);

  const sumDisplay = useCountUp(model.sumSavedMinor, 700);
  const totalGoalMinor = rows.reduce((sum, row) => sum + row.goalMinor, 0);
  const totalPct = totalGoalMinor > 0 ? Math.min(1, model.sumSavedMinor / totalGoalMinor) : 0;

  return (
    <>
      <ScreenHeader label="Pots" onBack={onBack} />

      <View style={styles.head}>
        <Text style={styles.kicker}>Set aside</Text>
        <Headline lead="Small, " accent="calmly" tail=", on purpose." />
        <Text style={styles.subhead}>Move one pot onto another to reallocate.</Text>
      </View>

      {/* Across-pots totals — the figure counts up; the bar fills to the share of the combined goal. */}
      <View style={styles.totals}>
        <Text style={styles.totalsLabel}>Across pots</Text>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsValue}>{formatMinorAmount(Math.round(sumDisplay))}</Text>
          <Text style={styles.totalsGoal}>of {formatMinorAmount(totalGoalMinor)}</Text>
        </View>
        <View style={styles.totalsTrack}>
          <View style={[styles.totalsFill, { width: `${Math.round(totalPct * 100)}%` }]} />
        </View>
      </View>

      {/* Per-pot cards. */}
      <View style={styles.list}>
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

      <MeloLine tone="soft" text="Pots quietly lower your spare on the path — that's the point." />

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
  // Weeks-left at the current pace — the web's Math.ceil(remaining / perWeek), "goal met" at 0.
  const remainingMinor = Math.max(0, row.goalMinor - row.savedMinor);
  const weeksLeft = row.perWeekMinor > 0 ? Math.ceil(remainingMinor / row.perWeekMinor) : 0;
  const paceLabel = weeksLeft > 0 ? `about ${weeksLeft} weeks` : 'goal met';

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardName}>
          <Pressable
            accessibilityLabel={`Move money from ${row.name}`}
            accessibilityHint="Choose another pot to move money into."
            hitSlop={10}
            onPress={onMove}
            style={({ pressed }) => [styles.handle, pressed ? styles.handlePressed : undefined]}
          >
            <Text style={styles.handleGlyph}>⋮⋮</Text>
          </Pressable>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {row.name}
          </Text>
        </View>
        <Text style={styles.cardAmount}>
          {row.saved} <Text style={styles.cardAmountGoal}>/ {row.goal}</Text>
        </Text>
      </View>

      <View style={styles.cardTrack}>
        <View
          style={[
            styles.cardFill,
            { width: `${Math.round(row.progress * 100)}%` },
            row.accent ? styles.cardFillAccent : styles.cardFillInk,
          ]}
        />
      </View>

      <View style={styles.cardMeta}>
        <Text style={styles.cardMetaText}>{row.perWeek}/wk at this pace</Text>
        <Text style={styles.cardMetaText}>{paceLabel}</Text>
      </View>

      <View style={styles.pills}>
        {QUICK_ADD_POUNDS.map((pounds) => (
          <Pressable
            key={pounds}
            accessibilityRole="button"
            accessibilityLabel={`Add £${pounds} to ${row.name}`}
            onPress={() => onAdd(pounds * 100)}
            style={({ pressed }) => [styles.pill, pressed ? styles.pillPressed : undefined]}
          >
            <Text style={styles.pillLabel}>+£{pounds}</Text>
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
  const from = rows.find((r) => r.id === fromId);
  const others = rows.filter((r) => r.id !== fromId);

  return (
    <Sheet visible={fromId !== null} onClose={onClose}>
      <Text style={styles.sheetKicker}>Move from</Text>
      <Text style={styles.sheetTitle}>{from ? shortName(from.name) : ''}</Text>
      <Body style={styles.pickerHint}>Choose where it goes.</Body>

      <View style={styles.pickerList}>
        {others.map((row, index) => (
          <Pressable
            key={row.id}
            accessibilityRole="button"
            accessibilityLabel={`Move into ${row.name}`}
            onPress={() => onPick(row.id)}
            style={({ pressed }) => [
              styles.pickerRow,
              index === 0 ? styles.pickerRowFirst : undefined,
              pressed ? styles.pickerRowPressed : undefined,
            ]}
          >
            <Text style={styles.pickerName} numberOfLines={1}>
              {row.name}
            </Text>
            <Text style={styles.pickerAmount}>{row.saved}</Text>
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
  const fromPot = transfer ? rows.find((r) => r.id === transfer.fromId) : undefined;
  const toPot = transfer ? rows.find((r) => r.id === transfer.toId) : undefined;
  const maxMoveMinor = fromPot ? fromPot.savedMinor : 0;

  // The chosen amount, in pence. Primed to min(£20, from-pot balance) when the sheet opens, then
  // stepped by £5 between 0 and the from-pot balance — exactly the web slider's bounds and step.
  const [amountMinor, setAmountMinor] = useState(0);
  const [primedKey, setPrimedKey] = useState<string | null>(null);

  // Prime the amount once per opened pair, in render (no effect) — mirrors the sibling sheets in this
  // surface and avoids an extra render frame.
  if (transfer && primedKey !== keyFor(transfer)) {
    setPrimedKey(keyFor(transfer));
    setAmountMinor(Math.min(2000, maxMoveMinor));
  }
  if (!transfer && primedKey !== null) {
    setPrimedKey(null);
  }

  const clampedMinor = Math.max(0, Math.min(amountMinor, maxMoveMinor));

  // Live tight-point impact — moving OUT of the buffer lowers the tight point; moving INTO the buffer
  // raises it. Same rough 0.6 preview the web shows. Only previewed when one side is the buffer pot.
  const tightDeltaMinor =
    fromPot && toPot
      ? isBufferPot(toPot)
        ? Math.round(clampedMinor * TIGHT_POINT_PREVIEW_FACTOR)
        : isBufferPot(fromPot)
          ? -Math.round(clampedMinor * TIGHT_POINT_PREVIEW_FACTOR)
          : 0
      : 0;

  const canStepDown = clampedMinor >= MOVE_STEP_MINOR;
  const canStepUp = clampedMinor + MOVE_STEP_MINOR <= maxMoveMinor;
  const canMove = clampedMinor > 0;

  return (
    <Sheet visible={transfer !== null} onClose={onClose}>
      {fromPot && toPot ? (
        <>
          <Text style={styles.sheetKicker}>Reallocate</Text>
          <Text style={styles.sheetTitle}>
            {shortName(fromPot.name)} → {shortName(toPot.name)}
          </Text>

          {/* Amount well — the big terracotta figure + a calm −/+ stepper (the web's slider). */}
          <View style={styles.amountWell}>
            <View style={styles.amountWellHead}>
              <Text style={styles.amountWellLabel}>Amount</Text>
              <Text style={styles.amountWellMax}>max {formatMinorAmount(maxMoveMinor)}</Text>
            </View>
            <Text style={styles.amountValue}>{formatMinorAmount(clampedMinor)}</Text>
            <View style={styles.stepper}>
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

          {/* Impact row — the tight point on the left (with its live shift), the destination on the
              right (with the +£n it gains). */}
          <View style={styles.impact}>
            <View>
              <Text style={styles.impactLabel}>Tight point</Text>
              <Text style={styles.impactValue}>
                {tightPointMinor !== undefined ? formatMinorAmount(tightPointMinor) : '—'}
                {tightDeltaMinor !== 0 ? (
                  <Text
                    style={[
                      styles.impactDelta,
                      tightDeltaMinor > 0 ? styles.impactDeltaUp : styles.impactDeltaDown,
                    ]}
                  >
                    {' '}
                    {tightDeltaMinor > 0 ? '+' : '−'}
                    {formatMinorAmount(Math.abs(tightDeltaMinor)).replace('-', '')}
                  </Text>
                ) : null}
              </Text>
            </View>
            <View style={styles.impactRight}>
              <Text style={styles.impactLabel}>{shortName(toPot.name)}</Text>
              <Text style={styles.impactValue}>
                {toPot.saved}
                <Text style={styles.impactDeltaUp}>
                  {' '}
                  +{formatMinorAmount(clampedMinor).replace('-', '')}
                </Text>
              </Text>
            </View>
          </View>

          <View style={styles.sheetActions}>
            <GhostButton flex label="Cancel" onPress={onClose} />
            <View style={styles.flex}>
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.step,
        disabled ? styles.stepDisabled : undefined,
        pressed && !disabled ? styles.stepPressed : undefined,
      ]}
    >
      <Text style={[styles.stepLabel, disabled ? styles.stepLabelDisabled : undefined]}>
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
      <Text style={styles.sheetKicker}>Open a pot</Text>
      <Text style={styles.sheetTitle}>What are you setting aside for?</Text>

      <Text style={styles.fieldLabel}>Name</Text>
      <View style={styles.nameRow}>
        {QUICK_NAMES.map((preset) => {
          const selected = name === preset;
          return (
            <Pressable
              key={preset}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setName(preset)}
              style={({ pressed }) => [
                styles.nameChip,
                selected ? styles.nameChipOn : undefined,
                pressed ? styles.pillPressed : undefined,
              ]}
            >
              <Text style={[styles.nameChipLabel, selected ? styles.nameChipLabelOn : undefined]}>
                {preset}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Goal / weekly — two tappable amount tiles; the active one is filled by the pad below. */}
      <View style={styles.amountTiles}>
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

      <View style={styles.sheetActions}>
        <GhostButton flex label="Cancel" onPress={onClose} />
        <View style={styles.flex}>
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.amountTile,
        active ? styles.amountTileActive : undefined,
        pressed ? styles.pillPressed : undefined,
      ]}
    >
      <Text style={styles.amountTileLabel}>{label}</Text>
      <Text style={[styles.amountTileValue, active ? styles.amountTileValueActive : undefined]}>
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
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: { flex: 1 },

  head: { gap: gap.xs, paddingTop: gap.xs },
  // Italic "Set aside" kicker — web font-display italic, 13px, muted ink.
  kicker: {
    color: paper.muted,
    fontFamily: serif.displayItalic,
    fontSize: 13,
    lineHeight: 18,
  },
  subhead: { color: paper.muted, fontSize: 11.5, lineHeight: 16, marginTop: 2 },

  // Across-pots totals card — a raised paper surface; the figure is serif tabular, the bar fills ink.
  totals: {
    backgroundColor: paper.surface,
    borderRadius: radius.xl,
    padding: gap.lg,
    ...elevation.card,
  },
  totalsLabel: {
    color: paper.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  totalsRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  totalsValue: {
    color: paper.ink,
    fontFamily: serif.display,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  totalsGoal: {
    color: paper.muted,
    fontFamily: serif.medium,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  totalsTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: paper.inset,
    overflow: 'hidden',
    marginTop: gap.md,
  },
  totalsFill: { height: '100%', borderRadius: radius.pill, backgroundColor: paper.ink },

  // Per-pot cards.
  list: { gap: gap.sm },
  card: {
    backgroundColor: paper.surface,
    borderRadius: radius.xl,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
    ...elevation.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  cardName: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  handle: { paddingVertical: 2, paddingRight: 2 },
  handlePressed: { opacity: 0.5 },
  handleGlyph: { color: paper.muted, fontSize: 12, letterSpacing: -1 },
  cardTitle: { color: paper.ink, fontSize: 14.5, fontWeight: '600', flexShrink: 1 },
  cardAmount: {
    color: paper.ink,
    fontFamily: serif.medium,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  cardAmountGoal: { color: paper.muted, fontSize: 12 },

  cardTrack: {
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: paper.inset,
    overflow: 'hidden',
    marginTop: gap.md,
  },
  cardFill: { height: '100%', borderRadius: radius.pill },
  cardFillAccent: { backgroundColor: paper.calm },
  cardFillInk: { backgroundColor: paper.secondary },

  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: gap.sm,
  },
  cardMetaText: { color: paper.muted, fontSize: 11.5, fontVariant: ['tabular-nums'] },

  pills: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  pill: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: paper.inset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillPressed: { opacity: 0.6 },
  pillLabel: { color: paper.ink, fontSize: 11.5, fontVariant: ['tabular-nums'] },

  // Sheet shared bits.
  sheetKicker: {
    color: paper.muted,
    fontFamily: serif.displayItalic,
    fontSize: 13,
    lineHeight: 18,
  },
  sheetTitle: {
    color: paper.ink,
    fontFamily: serif.display,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  sheetActions: { flexDirection: 'row', gap: gap.sm, marginTop: gap.lg },

  // Destination picker.
  pickerHint: { fontSize: 14, marginTop: gap.xs },
  pickerList: {
    backgroundColor: paper.inset,
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
    borderTopColor: paper.hairline,
  },
  pickerRowFirst: { borderTopWidth: 0 },
  pickerRowPressed: { backgroundColor: paper.sunken },
  pickerName: { color: paper.ink, fontSize: 15, fontWeight: '600', flex: 1, minWidth: 0 },
  pickerAmount: {
    color: paper.muted,
    fontFamily: serif.medium,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },

  // Reallocation amount well — sunken inset, big terracotta figure, calm stepper.
  amountWell: {
    backgroundColor: paper.inset,
    borderRadius: radius.xl,
    padding: gap.lg,
    marginTop: gap.lg,
  },
  amountWellHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  amountWellLabel: {
    color: paper.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  amountWellMax: { color: paper.muted, fontSize: 10.5, fontVariant: ['tabular-nums'] },
  amountValue: {
    color: paper.calm,
    fontFamily: serif.display,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  stepper: { flexDirection: 'row', gap: gap.sm, marginTop: gap.sm },
  step: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: paper.surface,
    borderWidth: 1.5,
    borderColor: paper.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPressed: { opacity: 0.6 },
  stepDisabled: { borderColor: paper.hairline, backgroundColor: paper.sunken },
  stepLabel: {
    color: paper.ink,
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  stepLabelDisabled: { color: paper.muted },

  // Impact row — tight point + destination, with signed deltas.
  impact: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: paper.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.hairlineStrong,
    paddingVertical: 14,
    paddingHorizontal: gap.lg,
    marginTop: gap.md,
  },
  impactRight: { alignItems: 'flex-end' },
  impactLabel: {
    color: paper.muted,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  impactValue: {
    color: paper.ink,
    fontFamily: serif.medium,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    marginTop: 3,
  },
  impactDelta: { fontSize: 12, fontFamily: serif.regular },
  impactDeltaUp: { color: paper.positiveInk, fontSize: 12 },
  impactDeltaDown: { color: paper.repairInk, fontSize: 12 },

  // Open-a-pot form.
  fieldLabel: { color: paper.muted, fontSize: 13, fontWeight: '700', marginTop: gap.lg },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', gap: gap.xs, marginTop: gap.sm },
  nameChip: {
    borderRadius: radius.pill,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: paper.hairline,
    backgroundColor: paper.surface,
  },
  nameChipOn: { borderColor: paper.calm, backgroundColor: paper.calmSoft },
  nameChipLabel: { color: paper.secondary, fontSize: 13.5, fontWeight: '600' },
  nameChipLabelOn: { color: paper.calmStrong },

  amountTiles: { flexDirection: 'row', gap: gap.sm, marginTop: gap.lg },
  amountTile: {
    flex: 1,
    backgroundColor: paper.inset,
    borderRadius: radius.lg,
    paddingVertical: gap.md,
    paddingHorizontal: gap.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  amountTileActive: { borderColor: paper.calm, backgroundColor: paper.calmSoft },
  amountTileLabel: {
    color: paper.muted,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  amountTileValue: {
    color: paper.ink,
    fontFamily: serif.display,
    fontSize: 26,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  amountTileValueActive: { color: paper.calmStrong },
});
