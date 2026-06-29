// CalendarConnectSheet — "Your money dates in your phone's calendar."
//
// RN port of the web SheetCalendarConnect (src/components/folio/sheets/SheetCalendarConnect.tsx).
//
// On the WEB, "connect" meant a one-way Google Calendar push, and it was design-only: the button
// just toasted "Connecting moves to your phone" because the real OAuth + sync engine ships in RN.
//
// HONEST RN BEHAVIOUR (important): a true device-calendar WRITE needs `expo-calendar`, which is NOT a
// dependency of this app. Per the build rule we do NOT silently add a heavy native dep, and we do NOT
// ship a button that claims to connect when nothing connects. So this sheet:
//   1. Explains plainly what a connection would add (and what stays out) — the web's trust framing.
//   2. Wires the part that DOES work today with installed deps: hand the same one-way .ics feed to
//      the OS via expo-sharing, which lets the user drop the dates into the phone's own calendar
//      (Google/Apple/Outlook) through the system. That is a real, working, truthful action.
//   3. States clearly that a live two-way Google link is not built yet.
//
// To turn the primary button into a genuine in-app "Add to my phone's calendar" write (no share
// sheet), the wire/owner must add `expo-calendar` and request the calendar permission — see the
// @needs-dep note. Until then this is the honest, working surface.
//
// Presentation + a single local file/share side effect. It never talks to the engine: the container
// passes the derived events; this sheet builds the .ics via the engine's buildIcs and shares it.
//
// @rn-sheet  CalendarConnectSheet
// @copy      FROZEN-adapted — keeps the web's one-way trust copy; the device-calendar nuance is new
//            and truthful (the web claim "Connect Google" would lie on device without the dep).
// @needs-dep expo-calendar (NOT installed) for a real in-app device-calendar write. Without it the
//            working path is the OS share of the .ics feed below.
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

const WOULD_ADD: readonly { id: string; label: string; tone: 'in' | 'out' | 'deadline' | 'manual' }[] =
  [
    { id: 'in', label: 'Paydays', tone: 'in' },
    { id: 'out', label: 'Bills & renewals', tone: 'out' },
    { id: 'deadline', label: 'Deadlines', tone: 'deadline' },
    { id: 'manual', label: 'Things you added', tone: 'manual' },
  ] as const;

function dotColor(t: Palette, tone: 'in' | 'out' | 'deadline' | 'manual'): string {
  if (tone === 'in') return t.positive;
  if (tone === 'out') return t.repair;
  if (tone === 'deadline') return t.caution;
  return t.calm;
}

export type CalendarConnectSheetProps = Readonly<{
  // Whether the sheet is on screen. The shared Sheet primitive owns the rise/scrim.
  visible: boolean;
  // The derived calendar events to fold into the one-way feed handed to the phone's calendar via the
  // OS. The sheet builds the .ics from these through the engine's buildIcs.
  events: readonly DerivedCalendarEvent[];
  // Optional prebuilt ics — shared verbatim when present; `events` then only feeds the count.
  ics?: string | undefined;
  // Dismiss — "Not now", or a scrim tap.
  onClose: () => void;
  // Honour the OS reduce-motion preference; forwarded to the shared Sheet.
  reduceMotion?: boolean | undefined;
}>;

export function CalendarConnectSheet({
  visible,
  events,
  ics,
  onClose,
  reduceMotion,
}: CalendarConnectSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const icsText = useMemo(() => ics ?? buildIcs(events), [ics, events]);

  // The working, truthful action: hand the one-way feed to the OS so the user adds the dates to the
  // phone's own calendar (Google/Apple/Outlook). NOT a two-way Google link — that ships later.
  const handleAddToPhone = async () => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setStatus('Adding to your calendar is not available on this device.');
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
        dialogTitle: 'Add your money dates',
        UTI: 'com.apple.ical.ics',
      });
      setStatus(null);
    } catch {
      setStatus('Could not add the dates to your calendar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet onClose={onClose} reduceMotion={reduceMotion} visible={visible}>
      <View style={s.body}>
        <Text style={s.eyebrow}>Connect</Text>
        <Headline accent="calendar." lead="Your money dates in your phone&apos;s " style={s.headline} />
        <Body style={s.lead}>
          One-way — Folio adds the dates that move your money. Folio doesn&apos;t read anything back
          from your calendar.
        </Body>

        <View style={s.card}>
          <Text style={s.cardLabel}>What we&apos;d add</Text>
          <View style={s.legend}>
            {WOULD_ADD.map((row) => (
              <View key={row.id} style={s.legendRow}>
                <View style={[s.dot, { backgroundColor: dotColor(t, row.tone) }]} />
                <Text style={s.legendText}>{row.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[s.card, s.cardOut]}>
          <Text style={s.cardLabel}>What stays out</Text>
          <View style={s.outList}>
            <Text style={s.outText}>Your spend, the amount on each date, and your spare figure.</Text>
            <Text style={s.outText}>Anything from your calendar — Folio never reads it.</Text>
          </View>
        </View>

        {status !== null ? <Body style={s.status}>{status}</Body> : null}

        <View style={s.action}>
          <PrimaryAction
            accessibilityHint="Hands the dates to your phone's calendar through the share sheet"
            disabled={busy}
            label={busy ? 'Preparing…' : 'Add to my calendar'}
            onPress={handleAddToPhone}
          />
        </View>
        <Text style={s.footnote}>
          This hands the dates to your phone&apos;s calendar. A live two-way Google link ships later.
        </Text>

        <View style={s.notNow}>
          <GhostButton accessibilityHint="Close this sheet" label="Not now" onPress={onClose} />
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
    cardOut: {
      backgroundColor: t.sunken,
      borderColor: 'transparent',
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
    outList: {
      gap: gap.xs,
      marginTop: gap.xxs,
    },
    outText: {
      fontSize: 13,
      lineHeight: 19,
      color: t.muted,
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
    notNow: {
      marginTop: gap.sm,
    },
  });
}
