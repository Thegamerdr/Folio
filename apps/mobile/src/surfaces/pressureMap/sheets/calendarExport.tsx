// CalendarExportSheet — "Your money dates, in your calendar."
//
// Faithful RN port of the web SheetCalendarExport (src/components/folio/sheets/SheetCalendarExport.tsx).
// One-way: Folio builds a standard .ics calendar file from the derived events (paydays, bills,
// renewals, deadlines, things to check) and hands it to the OS share sheet so the user can open it
// in — or subscribe it into — their own calendar app. Folio reads nothing back.
//
// The web prototype offered a download + an illustrative webcal:// subscribe URL (a hosted feed that
// only ships with the real sync engine). On the phone there is no "download" and no hosted feed, so
// the honest, working path is a native share of the .ics file: write it to a temp file with
// expo-file-system, then Sharing.shareAsync it. The copy is truthful about exactly that — a calendar
// file you can open or share, not a live two-way link.
//
// Presentation + a single local file/share side effect. It never talks to the engine: the container
// passes the derived events (or a prebuilt ics string); this sheet builds the ics via the engine's
// buildIcs and shares it. Counts read through the passed events; money never formatted here.
//
// @rn-sheet  CalendarExportSheet
// @copy      FROZEN — one-way, "a calendar file you can open in your calendar app."
// @deps      expo-file-system (installed) · expo-sharing (installed)
// @tokens    paper.surface · paper.inset · paper.hairline · paper.positive · paper.repair · gap

import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { buildIcs } from '../../../local/calendarIcs';
import type { DerivedCalendarEvent } from '../../../local/calendarEvents';
import {
  Body,
  GhostButton,
  Headline,
  PrimaryAction,
  gap,
  radius,
  serif,
  useTheme,
  type Palette,
} from '../kit';
import { Sheet } from '../Sheet';

// The legend rows — what lands in the feed, with the calm dot colours from the web. Each dot's
// colour follows the active palette, so the legend stays right in dark mode too.
const INCLUDED: readonly { id: string; label: string; tone: 'in' | 'out' | 'deadline' | 'review' }[] =
  [
    { id: 'in', label: 'Paydays', tone: 'in' },
    { id: 'out', label: 'Bills & renewals', tone: 'out' },
    { id: 'deadline', label: 'Deadlines', tone: 'deadline' },
    { id: 'review', label: 'Things to check', tone: 'review' },
  ] as const;

function dotColor(t: Palette, tone: 'in' | 'out' | 'deadline' | 'review'): string {
  if (tone === 'in') return t.positive;
  if (tone === 'out') return t.repair;
  if (tone === 'deadline') return t.caution;
  return t.calm;
}

export type CalendarExportSheetProps = Readonly<{
  // Whether the sheet is on screen. The shared Sheet primitive owns the rise/scrim.
  visible: boolean;
  // The derived calendar events to fold into the .ics. The sheet builds the file from these via the
  // engine's buildIcs. If the container has already built the ics string it can pass it as `ics` to
  // skip the rebuild; otherwise this sheet derives it from `events`.
  events: readonly DerivedCalendarEvent[];
  // Optional prebuilt ics — when present it is shared verbatim and `events` is used only for the count.
  ics?: string | undefined;
  // Dismiss — "Done", or a scrim tap.
  onClose: () => void;
  // Honour the OS reduce-motion preference; forwarded to the shared Sheet.
  reduceMotion?: boolean | undefined;
}>;

export function CalendarExportSheet({
  visible,
  events,
  ics,
  onClose,
  reduceMotion,
}: CalendarExportSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Build once per event set (or use the prebuilt string). buildIcs takes integer minor money and
  // emits a standard VCALENDAR — no formatting drift, no engine call here beyond the pure builder.
  const icsText = useMemo(() => ics ?? buildIcs(events), [ics, events]);

  const handleShare = async () => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setStatus('Sharing a file is not available on this device.');
        setBusy(false);
        return;
      }
      const dir = FileSystem.documentDirectory;
      if (dir === null) {
        setStatus('Could not prepare the calendar file on this device.');
        setBusy(false);
        return;
      }
      const uri = `${dir}folio-calendar.ics`;
      await FileSystem.writeAsStringAsync(uri, icsText, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(uri, {
        mimeType: 'text/calendar',
        dialogTitle: 'Your money dates',
        UTI: 'com.apple.ical.ics',
      });
      setStatus(null);
    } catch {
      setStatus('Could not share the calendar file.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet onClose={onClose} reduceMotion={reduceMotion} visible={visible}>
      <View style={s.body}>
        <Text style={s.eyebrow}>Subscribe</Text>
        <Headline accent="calendar." lead="Your money dates, in your " style={s.headline} />
        <Body style={s.lead}>
          One-way — your money moves into your calendar app. Folio doesn&apos;t read anything back.
        </Body>

        <View style={s.card}>
          <Text style={s.cardLabel}>What&apos;s included</Text>
          <View style={s.legend}>
            {INCLUDED.map((row) => (
              <View key={row.id} style={s.legendRow}>
                <View style={[s.dot, { backgroundColor: dotColor(t, row.tone) }]} />
                <Text style={s.legendText}>{row.label}</Text>
              </View>
            ))}
          </View>
          <Text style={s.count}>
            {`${events.length} ${events.length === 1 ? 'date' : 'dates'} in the next 35 days`}
          </Text>
        </View>

        {status !== null ? <Body style={s.status}>{status}</Body> : null}

        <View style={s.action}>
          <PrimaryAction
            accessibilityHint="Builds a calendar file and opens the share sheet"
            disabled={busy}
            label={busy ? 'Preparing…' : 'Share calendar file'}
            onPress={handleShare}
          />
        </View>
        <Text style={s.footnote}>
          A calendar file you can open in your calendar app, or share to another device. The live
          subscribe link ships later.
        </Text>

        <View style={s.done}>
          <GhostButton accessibilityHint="Close this sheet" label="Done" onPress={onClose} />
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
    lead: {
      color: t.muted,
      fontSize: 14,
      lineHeight: 21,
      marginTop: gap.xs,
    },

    card: {
      backgroundColor: t.inset,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
      paddingHorizontal: gap.lg,
      paddingVertical: gap.md,
      marginTop: gap.xs,
      gap: gap.xs,
    },
    cardLabel: {
      fontSize: 10.5,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: t.muted,
    },
    legend: {
      gap: gap.xs,
      marginTop: gap.xxs,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: gap.sm,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    legendText: {
      fontSize: 14,
      color: t.ink,
    },
    count: {
      fontFamily: serif.displayItalic,
      fontSize: 12,
      color: t.muted,
      fontVariant: ['tabular-nums'],
      marginTop: gap.xxs,
    },

    status: {
      color: t.repairInk,
      fontSize: 13,
      marginTop: gap.xs,
    },

    action: {
      marginTop: gap.md,
    },
    footnote: {
      fontFamily: serif.displayItalic,
      fontSize: 11.5,
      color: t.muted,
      lineHeight: 17,
      marginTop: gap.xs,
      textAlign: 'center',
    },
    done: {
      marginTop: gap.sm,
    },
  });
}
