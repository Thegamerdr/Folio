// AddEventSheet — the faithful 1:1 React Native port of the web manual calendar-event sheet
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetAddEvent.tsx).
//
// @rn-sheet     AddEventSheet
// @purpose      Add a one-off money event to the calendar (the explanation layer for the Route).
//               Manual entries sit alongside derived paydays, bills, sub renewals, and deadlines.
// @reads        — (no store reads; local form state only)
// @writes       calendarEvents (via addCalendarEvent)
// @copy         FROZEN (verbatim from the web source; these literals are not yet in COPY_DECK —
//               '@/folio/copy/copy' carries only currency.symbol for this sheet)
// @tokens       --paper (→ surface, the sheet body) · --accent (→ calm) · --accent-soft (→ calmSoft,
//               selected kind chip) · --inset (→ inset, unselected chip + field wells) ·
//               --hairline (→ hairline, field borders) · --muted-ink (→ muted) · --ink (→ ink)
// @motion       sheet-rise + scrim-in (inherited from Sheet) · press 0.97 on every tappable
//               (×, kind chips, both CTAs, the date steppers); collapses to final state under
//               reduce-motion (MOTION.md: reduced motion is the resolved layout, never a slower tween)
//
// Faithful 1:1 RN port. The web source renders ONE branch — the populated form — and that is the only
// visual state here (STATES.md lists no empty/loading/error/offline row for this sheet; canAdd merely
// disables the primary CTA at opacity 0.4, with NO inline validation message, NO error copy, NO
// toast). The single conditional sub-branch is the Amount field, present only when kind ∈ {in, out}.
// Per MELO_MOODS.md this sheet renders NO Melo ("No mood = no Melo") — no mascot, no count-up, no
// route-draw, no verdict stamp; only sheet-rise / scrim-in / press.
//
// Design-system discipline: every colour/font/spacing/radius token comes from '@/folio/theme' (which
// re-exports the pressure-map kit). Nothing new is defined — no colour, font, spacing, or dependency.
// The web '×' close glyph is drawn inline with react-native-svg (the codebase ships no icon font).
//
// Date/time input uses the native picker already shipped by the mobile package. Calendar reminders
// are explicit and optional; choosing one requests OS permission only after the event is saved.
//
// This sheet OWNS its Sheet host (visible / onClose), mounted as a sibling in the shell — mirroring
// the EditItemSheet + LogSpendSheet + OnboardingSheet pattern — so it never nests in a generic host.

import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Svg, { Path } from 'react-native-svg';

import { gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import { addCalendarEvent, type CalendarEvent } from '@/folio/store';
import { copy } from '@/folio/copy/copy';
import { reminderFireDate } from '@/folio/lib/calendarReminders';
import { forceRescheduleNow } from '@/folio/lib/notifyScheduler';
import { loadRemindersSettings, saveRemindersSettings } from '@/folio/lib/notifySettings';
import { requestPermission } from '@/folio/lib/notifications';
import type { SheetPayload } from '@/folio/types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type AddEventSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Deep-link prefill (web `intent?.addEventKind` / `intent?.addEventTitle`) — e.g. a lens CTA like
   *  "Add a bill" opening this sheet pre-filled with kind="out"/title="Rent". Absent/undefined = the
   *  cold defaults (kind='out', empty title), exactly as before this prop existed. */
  intent?: SheetPayload | undefined;
};

type Kind = CalendarEvent['kind'];

// The kind chips + their hints — the web `KINDS` list, verbatim.
const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: 'in', label: 'In', hint: 'money lands' },
  { id: 'out', label: 'Out', hint: 'money leaves' },
  { id: 'review', label: 'Review', hint: 'something to check' },
  { id: 'deadline', label: 'Deadline', hint: 'a date that matters' },
];

type ReminderChoice = 'off' | 'on-day' | 'day-before' | 'week-before';

const REMINDER_CHOICES: ReadonlyArray<{
  id: ReminderChoice;
  label: string;
  offsetMinutes?: number;
}> = [
  { id: 'off', label: 'Off' },
  { id: 'on-day', label: 'On day', offsetMinutes: 0 },
  { id: 'day-before', label: 'Day before', offsetMinutes: 24 * 60 },
  { id: 'week-before', label: 'Week before', offsetMinutes: 7 * 24 * 60 },
];

// Local-date YYYY-MM-DD (zero-padded), the web `todayIso()` helper reimplemented for RN. RN has no
// SSR, so the new Date() default is stable (no hydration mismatch — see STATES.md).
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function localIsoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
    value.getDate(),
  ).padStart(2, '0')}`;
}

function dateValue(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function timeValue(time: string | null): Date {
  const [hour = 9, minute = 0] = (time ?? '09:00').split(':').map(Number);
  const value = new Date();
  value.setHours(hour, minute, 0, 0);
  return value;
}

function localTime(value: Date): string {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

// Friendly long-form label for the chosen ISO date — display only; the stored value stays ISO.
function isoLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Reduced-motion hook (AccessibilityInfo-backed, mirrors the EditItemSheet hook)
// ---------------------------------------------------------------------------

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduce(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

// ---------------------------------------------------------------------------
// AddEventSheet
// ---------------------------------------------------------------------------

export function AddEventSheet({ visible, onClose, intent }: AddEventSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const reduceMotion = useReduceMotion();

  return (
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      <AddEventForm styles={s} palette={t} onClose={onClose} intent={intent} />
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// The form — the only render branch.
// ---------------------------------------------------------------------------

function AddEventForm({
  styles: s,
  palette: t,
  onClose,
  intent,
}: {
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  onClose: () => void;
  intent?: SheetPayload | undefined;
}) {
  const [date, setDate] = useState(todayIso());
  const [kind, setKind] = useState<Kind>(intent?.addEventKind ?? 'out');
  const [title, setTitle] = useState(intent?.addEventTitle ?? '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [time, setTime] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [reminderChoice, setReminderChoice] = useState<ReminderChoice>('off');

  const reminderOffsetMinutes = REMINDER_CHOICES.find(
    (choice) => choice.id === reminderChoice,
  )?.offsetMinutes;
  const reminderDate =
    reminderOffsetMinutes === undefined
      ? null
      : reminderFireDate({
          id: 'draft',
          date,
          ...(time !== null ? { time } : {}),
          kind,
          title: title.trim() || 'Draft',
          reminderOffsetMinutes,
        });
  const reminderIsFuture = reminderDate === null || reminderDate.getTime() > Date.now();
  const canAdd = title.trim().length > 0 && date.length === 10 && reminderIsFuture;
  const showAmount = kind === 'in' || kind === 'out';

  function handleAdd() {
    if (!canAdd) return;
    const amt = showAmount && amount ? parseFloat(amount) : undefined;
    // Web sign logic, verbatim: out => -abs, in => +abs, undefined when not in/out, empty, or NaN.
    const signedAmount =
      typeof amt === 'number' && !isNaN(amt)
        ? kind === 'out'
          ? -Math.abs(amt)
          : Math.abs(amt)
        : undefined;
    const trimmedNote = note.trim();
    // exactOptionalPropertyTypes: omit optional fields rather than passing explicit undefined
    // (mirrors the store / calendarEvents conditional-spread idiom). Same output as the web source.
    addCalendarEvent({
      date,
      ...(time !== null ? { time } : {}),
      kind,
      title: title.trim(),
      ...(trimmedNote ? { note: trimmedNote } : {}),
      ...(signedAmount !== undefined ? { amount: signedAmount } : {}),
      ...(reminderOffsetMinutes !== undefined ? { reminderOffsetMinutes } : {}),
    });
    onClose();
    if (reminderOffsetMinutes !== undefined) {
      // Creating a reminder is the opt-in action. The event remains valid if OS permission is
      // denied; More then explains that system settings are blocking its notification.
      void (async () => {
        const settings = await loadRemindersSettings();
        await saveRemindersSettings({ ...settings, remindersEnabled: true });
        await requestPermission();
        forceRescheduleNow();
      })();
    }
  }

  const hint = KINDS.find((k) => k.id === kind)?.hint;

  return (
    <View>
      {/* Header — eyebrow + close glyph. */}
      <View style={s.headerRow}>
        <Text style={s.eyebrow}>Add to calendar</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
          onPress={onClose}
          style={({ pressed }) => [pressed ? s.pressed : undefined]}
        >
          <CloseGlyph color={t.muted} />
        </Pressable>
      </View>

      {/* Headline — accent word "day." upright in terracotta. */}
      <Text accessibilityRole="header" style={s.headline}>
        One thing on the <Text style={s.headlineAccent}>day.</Text>
      </Text>
      <Text style={s.subhead}>Quietly added to your calendar.</Text>

      <View style={s.fields}>
        {/* Kind — 4-up equal-width grid. */}
        <View>
          <Text style={s.fieldLabel}>Kind</Text>
          <View style={s.kindGrid}>
            {KINDS.map((k) => {
              const on = kind === k.id;
              return (
                <Pressable
                  key={k.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setKind(k.id)}
                  style={({ pressed }) => [
                    s.kindChip,
                    { backgroundColor: on ? t.calmSoft : t.inset },
                    pressed ? s.pressed : undefined,
                  ]}
                >
                  <Text style={[s.kindChipLabel, { color: on ? t.ink : t.muted }]}>{k.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.hint}>{hint}</Text>
        </View>

        {/* Native date picker; the persisted value remains local YYYY-MM-DD. */}
        <View>
          <Text style={s.fieldLabel}>Date</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Date, ${isoLabel(date)}. Tap to change.`}
            onPress={() => setDatePickerOpen(true)}
            style={({ pressed }) => [s.dateWell, pressed ? s.pressed : undefined]}
          >
            <Text accessibilityLabel={isoLabel(date)} style={s.dateValue}>
              {isoLabel(date)}
            </Text>
          </Pressable>
          {datePickerOpen ? (
            <View style={s.pickerWrap}>
              <DateTimePicker
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                mode="date"
                onChange={(_event: DateTimePickerEvent, selected?: Date) => {
                  if (Platform.OS === 'android') setDatePickerOpen(false);
                  if (selected !== undefined) setDate(localIsoDate(selected));
                }}
                value={dateValue(date)}
              />
              {Platform.OS === 'ios' ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setDatePickerOpen(false)}
                  style={({ pressed }) => [s.pickerDone, pressed ? s.pressed : undefined]}
                >
                  <Text style={s.pickerDoneLabel}>Done</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        <View>
          <Text style={s.fieldLabel}>Time (optional)</Text>
          <View style={s.timeRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${time ?? 'All day'}. Tap to choose a time.`}
              onPress={() => setTimePickerOpen(true)}
              style={({ pressed }) => [s.timeWell, pressed ? s.pressed : undefined]}
            >
              <Text style={s.dateValue}>{time ?? 'All day'}</Text>
            </Pressable>
            {time !== null ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear event time"
                onPress={() => setTime(null)}
                style={({ pressed }) => [s.clearTime, pressed ? s.pressed : undefined]}
              >
                <Text style={s.clearTimeLabel}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
          {timePickerOpen ? (
            <View style={s.pickerWrap}>
              <DateTimePicker
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                mode="time"
                onChange={(_event: DateTimePickerEvent, selected?: Date) => {
                  if (Platform.OS === 'android') setTimePickerOpen(false);
                  if (selected !== undefined) setTime(localTime(selected));
                }}
                value={timeValue(time)}
              />
              {Platform.OS === 'ios' ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setTimePickerOpen(false)}
                  style={({ pressed }) => [s.pickerDone, pressed ? s.pressed : undefined]}
                >
                  <Text style={s.pickerDoneLabel}>Done</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* What is it. */}
        <View>
          <Text style={s.fieldLabel}>What is it</Text>
          <TextInput
            accessibilityLabel="What is it"
            onChangeText={setTitle}
            placeholder="e.g. Birthday gift"
            placeholderTextColor={t.muted}
            style={s.input}
            value={title}
          />
        </View>

        {/* Amount — only when kind ∈ {in, out}. Value is kept (not cleared) when hidden, and
            ignored on add because handleAdd gates the parse on showAmount. */}
        {showAmount ? (
          <View>
            <Text style={s.fieldLabel}>Amount (optional)</Text>
            <View style={s.amountRow}>
              <Text style={s.currency}>{copy.global.currency.symbol}</Text>
              <TextInput
                accessibilityLabel="Amount (optional)"
                keyboardType="decimal-pad"
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={t.muted}
                style={s.amountInput}
                value={amount}
              />
            </View>
          </View>
        ) : null}

        {/* Note (optional). */}
        <View>
          <Text style={s.fieldLabel}>Note (optional)</Text>
          <TextInput
            accessibilityLabel="Note (optional)"
            onChangeText={setNote}
            placeholder="A small reminder"
            placeholderTextColor={t.muted}
            style={s.input}
            value={note}
          />
        </View>

        <View>
          <Text style={s.fieldLabel}>Reminder</Text>
          <View style={s.kindGrid}>
            {REMINDER_CHOICES.map((choice) => {
              const on = reminderChoice === choice.id;
              return (
                <Pressable
                  key={choice.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setReminderChoice(choice.id)}
                  style={({ pressed }) => [
                    s.kindChip,
                    { backgroundColor: on ? t.calmSoft : t.inset },
                    pressed ? s.pressed : undefined,
                  ]}
                >
                  <Text
                    numberOfLines={2}
                    style={[s.reminderChipLabel, { color: on ? t.ink : t.muted }]}
                  >
                    {choice.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[s.hint, !reminderIsFuture ? { color: t.repair } : undefined]}>
            {!reminderIsFuture
              ? 'That reminder time has passed. Choose a later date or time.'
              : reminderChoice === 'off'
                ? 'Off until you choose one.'
                : `Scheduled locally${time === null ? ' at 09:00' : ''}. Details stay private on your lock screen.`}
          </Text>
        </View>
      </View>

      {/* Primary — Add to calendar. Disabled (opacity 0.4, non-interactive) until canAdd. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add to calendar"
        accessibilityState={{ disabled: !canAdd }}
        disabled={!canAdd}
        onPress={handleAdd}
        style={({ pressed }) => [
          s.primary,
          { backgroundColor: t.calm, opacity: canAdd ? 1 : 0.4 },
          canAdd && pressed ? s.pressed : undefined,
        ]}
      >
        <Text style={[s.primaryLabel, { color: t.accentInk }]}>Add to calendar</Text>
      </Pressable>

      {/* Secondary — Cancel. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel"
        onPress={onClose}
        style={({ pressed }) => [s.cancel, pressed ? s.pressed : undefined]}
      >
        <Text style={[s.cancelLabel, { color: t.muted }]}>Cancel</Text>
      </Pressable>
    </View>
  );
}

// Close glyph — the web '×', drawn inline. 18×18 user space.
function CloseGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path d="M4 4 L14 14 M14 4 L4 14" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Styles — colour-bearing, resolved against the active palette.
// ---------------------------------------------------------------------------

function makeStyles(t: Palette) {
  return StyleSheet.create({
    // Header row — eyebrow + close, space-between.
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    // 11px uppercase tracked eyebrow.
    eyebrow: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    // Display headline — Fraunces 26, leading-tight, mt-2.
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 26,
      letterSpacing: -0.3,
      lineHeight: 30,
      marginTop: gap.sm,
    },
    // Accent word — upright (NOT italic), terracotta.
    headlineAccent: {
      color: t.calmStrong,
      fontFamily: serif.display,
    },
    // Italic subhead, 12.5px muted, mt-1.
    subhead: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 12.5,
      marginTop: gap.xs,
    },
    // The field stack — web mt-5 + space-y-4 (16px between fields).
    fields: {
      gap: gap.lg,
      marginTop: gap.xl - gap.xs, // 20
    },
    // 10.5px uppercase tracked field label.
    fieldLabel: {
      color: t.muted,
      fontSize: 10.5,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    // Kind grid — 4 equal-width chips, gap-1.5, mt-2.
    kindGrid: {
      columnGap: gap.xs + gap.xxs, // 6
      flexDirection: 'row',
      marginTop: gap.sm,
    },
    // py-2 rounded-xl chip, flex:1.
    kindChip: {
      alignItems: 'center',
      borderRadius: radius.md,
      flex: 1,
      paddingVertical: gap.sm,
    },
    kindChipLabel: {
      fontSize: 12,
      fontWeight: '500',
    },
    // Italic 10.5px hint under the grid, mt-1.5.
    hint: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 10.5,
      marginTop: gap.xs + gap.xxs, // 6
    },
    // Date well — a 44px-tall inset row holding the steppers + the chosen date.
    dateWell: {
      alignItems: 'center',
      backgroundColor: t.inset,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      height: 44,
      marginTop: gap.sm,
      paddingHorizontal: gap.xs,
    },
    // ≥44px square tap target for each day step.
    dateStep: {
      alignItems: 'center',
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    dateStepLabel: {
      color: t.muted,
      fontSize: 20,
      lineHeight: 22,
    },
    // The chosen date, centred between the steppers — tabular so it doesn't jitter on step.
    dateValue: {
      color: t.ink,
      flex: 1,
      fontSize: 13.5,
      fontVariant: ['tabular-nums'],
      textAlign: 'center',
    },
    timeRow: {
      alignItems: 'center',
      columnGap: gap.sm,
      flexDirection: 'row',
      marginTop: gap.sm,
    },
    timeWell: {
      alignItems: 'center',
      backgroundColor: t.inset,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flex: 1,
      height: 44,
      justifyContent: 'center',
      paddingHorizontal: gap.md,
    },
    clearTime: {
      alignItems: 'center',
      height: 44,
      justifyContent: 'center',
      minWidth: 52,
    },
    clearTimeLabel: {
      color: t.muted,
      fontSize: 12,
    },
    pickerWrap: {
      marginTop: gap.sm,
    },
    pickerDone: {
      alignItems: 'center',
      alignSelf: 'flex-end',
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: gap.md,
    },
    pickerDoneLabel: {
      color: t.calmStrong,
      fontSize: 13,
      fontWeight: '600',
    },
    reminderChipLabel: {
      fontSize: 11,
      fontWeight: '500',
      lineHeight: 14,
      textAlign: 'center',
    },
    // Text field — 44px tall inset well, px-3, 13.5px, mt-2.
    input: {
      backgroundColor: t.inset,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      color: t.ink,
      fontSize: 13.5,
      height: 44,
      marginTop: gap.sm,
      paddingHorizontal: gap.md,
      paddingVertical: 0,
    },
    // Amount row — £ prefix + flex input, gap-2, mt-2.
    amountRow: {
      alignItems: 'center',
      columnGap: gap.sm,
      flexDirection: 'row',
      marginTop: gap.sm,
    },
    // 14px tabular currency glyph.
    currency: {
      color: t.muted,
      fontSize: 14,
      fontVariant: ['tabular-nums'],
    },
    // Amount field — same well, flex:1, tabular.
    amountInput: {
      backgroundColor: t.inset,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      color: t.ink,
      flex: 1,
      fontSize: 13.5,
      fontVariant: ['tabular-nums'],
      height: 44,
      paddingHorizontal: gap.md,
      paddingVertical: 0,
    },
    // Primary — full width, h-54, 2xl radius (kit xl = 24), terracotta, mt-6.
    primary: {
      alignItems: 'center',
      borderRadius: radius.xl,
      height: 54,
      justifyContent: 'center',
      marginTop: gap.xl,
    },
    primaryLabel: {
      fontSize: 15,
      fontWeight: '500',
    },
    // Cancel — full width, h-44, 2xl radius, ghost, mt-2.
    cancel: {
      alignItems: 'center',
      borderRadius: radius.xl,
      height: 44,
      justifyContent: 'center',
      marginTop: gap.sm,
    },
    cancelLabel: {
      fontSize: 13.5,
    },
    // The kit press feel (web `press` util — scale 0.97 / lowered opacity).
    pressed: {
      opacity: 0.6,
      transform: [{ scale: 0.97 }],
    },
  });
}
