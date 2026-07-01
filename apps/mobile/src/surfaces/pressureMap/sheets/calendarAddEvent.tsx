// CalendarAddEventSheet — "One thing on the day."
//
// Faithful RN port of the web SheetAddEvent (src/components/folio/sheets/SheetAddEvent.tsx). A calm
// form to add ONE manual money event to the calendar — the explanation layer for the Route. Manual
// entries sit alongside the derived paydays, bills, sub renewals, and deadlines the read engine
// surfaces. The user names the thing, picks a day, picks a kind, and optionally adds an amount, a
// note, and a repeat.
//
// Presentation ONLY. It never talks to the engine. On submit it calls onAdd(input) with an
// AddUserCalendarEventInput; the container performs the write through
// addCalendarEventThroughCanonicalRepository and closes the sheet. Money is captured as INTEGER MINOR
// units (pence) via the kit MoneyPad and formatMinorAmount — no floats, no formatting drift.
//
// @rn-sheet  CalendarAddEventSheet
// @copy      FROZEN — "One thing on the day." / "Quietly added to your calendar."
// @tokens    paper.surface · paper.inset · paper.sunken · paper.hairline · paper.calm · gap · radius
// @motion    sheet-rise (shared Sheet primitive)

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { AddUserCalendarEventInput, UserCalendarEventKind } from '../../../local/localLedger';
import {
  Body,
  GhostButton,
  Headline,
  MoneyPad,
  PrimaryAction,
  gap,
  poundsLabel,
  radius,
  serif,
  useTheme,
  type Palette,
} from '../kit';
import { Sheet } from '../Sheet';

// The four kinds the user can author, with the web's FROZEN labels + hints. ('manual' is the
// derived source; the user picks one of these meaning-kinds — review/deadline carry no amount.)
const KINDS: readonly { id: UserCalendarEventKind; label: string; hint: string }[] = [
  { id: 'in', label: 'In', hint: 'money lands' },
  { id: 'out', label: 'Out', hint: 'money leaves' },
  { id: 'review', label: 'Review', hint: 'something to check' },
  { id: 'deadline', label: 'Deadline', hint: 'a date that matters' },
] as const;

const RECURRING_OPTIONS: readonly { id: 'once' | 'monthly' | 'yearly'; label: string }[] = [
  { id: 'once', label: 'Just once' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
] as const;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

// A YYYY-MM-DD with all three parts present and in range. The web used a native <input type="date">;
// RN has no equivalent without a heavy picker dep, so this is a calm, validated text field that
// accepts the same ISO shape the engine stores.
function isValidIso(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

export type CalendarAddEventSheetProps = Readonly<{
  // Whether the sheet is on screen. The shared Sheet primitive owns the rise/scrim.
  visible: boolean;
  // Add this manual event. The container performs the write through
  // addCalendarEventThroughCanonicalRepository, then closes the sheet. The input carries INTEGER
  // MINOR units; the container never re-derives money from text.
  onAdd: (input: AddUserCalendarEventInput) => void;
  // Dismiss without adding — "Cancel", or a scrim tap.
  onClose: () => void;
  // Honour the OS reduce-motion preference; forwarded to the shared Sheet. Source it the same way
  // the container sources it for every other sheet.
  reduceMotion?: boolean | undefined;
}>;

export function CalendarAddEventSheet({
  visible,
  onAdd,
  onClose,
  reduceMotion,
}: CalendarAddEventSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const [dateIso, setDateIso] = useState(todayIso());
  const [kind, setKind] = useState<UserCalendarEventKind>('out');
  const [title, setTitle] = useState('');
  // Whole-pounds digit string driven by the kit MoneyPad (e.g. "1200" => £1,200). Empty = no amount.
  const [pounds, setPounds] = useState('');
  const [note, setNote] = useState('');
  const [recurring, setRecurring] = useState<'once' | 'monthly' | 'yearly'>('once');

  const showAmount = kind === 'in' || kind === 'out';
  const canAdd = title.trim().length > 0 && isValidIso(dateIso);

  const handleAdd = () => {
    if (!canAdd) return;
    const digits = pounds.replace(/[^0-9]/g, '');
    const hasAmount = showAmount && digits.length > 0;
    // INTEGER minor units. Out leaves the wallet (negative), In lands (positive). Review/Deadline
    // carry no amount.
    const magnitudeMinor = hasAmount ? Number(digits) * 100 : undefined;
    const amountMinor =
      magnitudeMinor === undefined ? undefined : kind === 'out' ? -magnitudeMinor : magnitudeMinor;

    const input: AddUserCalendarEventInput = {
      dateIso,
      kind,
      title: title.trim(),
      ...(amountMinor !== undefined ? { amountMinor } : {}),
      ...(note.trim().length > 0 ? { note: note.trim() } : {}),
      ...(recurring !== 'once' ? { recurring } : {}),
    };
    onAdd(input);
  };

  const activeKindHint = KINDS.find((k) => k.id === kind)?.hint ?? '';

  return (
    <Sheet onClose={onClose} reduceMotion={reduceMotion} visible={visible}>
      <View style={s.body}>
        <Text style={s.eyebrow}>Add to calendar</Text>
        <Headline accent="day." lead="One thing on the " style={s.headline} />
        <Text style={s.kicker}>Quietly added to your calendar.</Text>

        {/* Kind — four equal chips. */}
        <View style={s.field}>
          <Text style={s.label}>Kind</Text>
          <View style={s.kindRow}>
            {KINDS.map((k) => {
              const selected = kind === k.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={k.id}
                  onPress={() => setKind(k.id)}
                  style={[s.kindChip, selected ? s.kindChipSelected : undefined]}
                >
                  <Text style={[s.kindLabel, selected ? s.kindLabelSelected : undefined]}>
                    {k.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.hint}>{activeKindHint}</Text>
        </View>

        {/* Date — validated ISO text field (RN has no native date input). */}
        <View style={s.field}>
          <Text style={s.label}>Date</Text>
          <TextInput
            accessibilityLabel="Date, year dash month dash day"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            onChangeText={setDateIso}
            placeholder="2026-06-30"
            placeholderTextColor={t.muted}
            style={[s.input, s.inputMono, !isValidIso(dateIso) ? s.inputInvalid : undefined]}
            value={dateIso}
          />
        </View>

        {/* What is it. */}
        <View style={s.field}>
          <Text style={s.label}>What is it</Text>
          <TextInput
            accessibilityLabel="What is it"
            onChangeText={setTitle}
            placeholder="e.g. Birthday gift"
            placeholderTextColor={t.muted}
            style={s.input}
            value={title}
          />
        </View>

        {/* Amount — only for In/Out, captured through the kit MoneyPad (whole pounds, no system kbd). */}
        {showAmount ? (
          <View style={s.field}>
            <Text style={s.label}>Amount (optional)</Text>
            <View style={s.amountWell}>
              <Text accessibilityLabel={`Amount ${poundsLabel(pounds)}`} style={s.amountValue}>
                {poundsLabel(pounds)}
              </Text>
            </View>
            <MoneyPad onChange={setPounds} value={pounds} />
          </View>
        ) : null}

        {/* Note. */}
        <View style={s.field}>
          <Text style={s.label}>Note (optional)</Text>
          <TextInput
            accessibilityLabel="Note"
            onChangeText={setNote}
            placeholder="A small reminder"
            placeholderTextColor={t.muted}
            style={s.input}
            value={note}
          />
        </View>

        {/* Repeat. */}
        <View style={s.field}>
          <Text style={s.label}>Repeat</Text>
          <View style={s.repeatRow}>
            {RECURRING_OPTIONS.map((option) => {
              const selected = recurring === option.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={option.id}
                  onPress={() => setRecurring(option.id)}
                  style={[s.repeatChip, selected ? s.repeatChipSelected : undefined]}
                >
                  <Text style={[s.repeatLabel, selected ? s.repeatLabelSelected : undefined]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {!canAdd ? <Body style={s.helper}>Give it a name and a date to add it.</Body> : null}

        <View style={s.action}>
          <PrimaryAction
            accessibilityHint="Adds this event to your calendar"
            disabled={!canAdd}
            label="Add to calendar"
            onPress={handleAdd}
          />
        </View>
        <View style={s.cancel}>
          <GhostButton
            accessibilityHint="Dismiss without adding"
            label="Cancel"
            onPress={onClose}
          />
        </View>
      </View>
    </Sheet>
  );
}

// Colour-bearing styles, resolved against the active palette `t` via makeStyles(t).
function makeStyles(t: Palette) {
  return StyleSheet.create({
    body: {
      gap: gap.md,
    },
    eyebrow: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: t.muted,
    },
    headline: {
      fontSize: 26,
      lineHeight: 31,
      marginTop: gap.xxs,
    },
    kicker: {
      fontFamily: serif.displayItalic,
      fontSize: 13,
      color: t.muted,
      marginTop: gap.xxs,
    },

    field: {
      marginTop: gap.sm,
      gap: gap.xs,
    },
    label: {
      fontSize: 10.5,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: t.muted,
    },
    hint: {
      fontFamily: serif.displayItalic,
      fontSize: 11.5,
      color: t.muted,
    },

    input: {
      height: 46,
      paddingHorizontal: gap.md,
      borderRadius: radius.md,
      backgroundColor: t.inset,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
      fontSize: 15,
      color: t.ink,
    },
    inputMono: {
      fontVariant: ['tabular-nums'],
    },
    inputInvalid: {
      borderColor: t.hairlineStrong,
    },

    kindRow: {
      flexDirection: 'row',
      gap: gap.xs,
    },
    kindChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: radius.md,
      alignItems: 'center',
      backgroundColor: t.inset,
    },
    kindChipSelected: {
      backgroundColor: t.calmSoft,
    },
    kindLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: t.muted,
    },
    kindLabelSelected: {
      color: t.calmStrong,
    },

    amountWell: {
      backgroundColor: t.sunken,
      borderRadius: radius.lg,
      paddingVertical: gap.sm,
      alignItems: 'center',
      marginBottom: gap.xs,
    },
    amountValue: {
      fontSize: 30,
      fontWeight: '700',
      letterSpacing: -1,
      color: t.ink,
      fontVariant: ['tabular-nums'],
    },

    repeatRow: {
      flexDirection: 'row',
      gap: gap.xs,
    },
    repeatChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: radius.pill,
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: t.hairline,
      backgroundColor: t.surface,
    },
    repeatChipSelected: {
      borderColor: t.calm,
      backgroundColor: t.calmSoft,
    },
    repeatLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: t.secondary,
    },
    repeatLabelSelected: {
      color: t.calmStrong,
    },

    helper: {
      color: t.muted,
      fontSize: 13,
      marginTop: gap.xs,
    },
    action: {
      marginTop: gap.md,
    },
    cancel: {
      marginTop: gap.xs,
    },
  });
}
