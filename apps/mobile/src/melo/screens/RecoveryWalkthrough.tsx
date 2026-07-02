// Recovery Mode (MELO_BLUEPRINT.md §2 P4, §5.2 screen 12): see it plainly → adjust the plan →
// one move today → the check-in. One decision per screen. Progress counts FORWARD ("Day N on
// the path"), never "days since failure". Nothing here is sold, upsold, or badged — ever.

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatPounds } from '@folio/melo-engine';
import {
  Body,
  Display,
  GhostButton,
  Muted,
  PrimaryAction,
  Surface,
  useTheme,
} from '@/surfaces/pressureMap/kit';

import { MeloMascot } from '../mascot/MeloMascot';
import type { MeloColorway } from '../theme/weather';

type StepId = 1 | 2 | 3 | 'checkin';

type Props = {
  colorway: MeloColorway;
  wardrobe?: string | null;
  /** The CURRENT Safe Zone, signed — negative means genuinely over the line. */
  szPence: number;
  /** How this was entered: only 'overspent' may say "it went over" (audit: never claim an
   *  overspend to a user in Danger who hasn't overspent). */
  entered: 'overspent' | 'danger';
  /** The user's REAL shielded bill names — never a fabricated list. */
  billNames: readonly string[];
  perDayPence: number;
  daysToPayday: number;
  paydayLabel: string;
  dayOnPath: number;
  /** The derived "one move today" (recoveryMovePence) — never a hardcoded number. */
  movePence: number;
  /** Already on the path (day 2+): open at today's move, never replay the confrontation. */
  startAtMove?: boolean;
  onCommit: () => void;
  onExit: () => void;
};

export function RecoveryWalkthrough({
  colorway,
  wardrobe = null,
  szPence,
  entered,
  billNames,
  perDayPence,
  daysToPayday,
  paydayLabel,
  dayOnPath,
  movePence,
  startAtMove,
  onCommit,
  onExit,
}: Props) {
  const t = useTheme();
  const [step, setStep] = useState<StepId>(startAtMove ? 3 : 1);

  return (
    <View style={[s.root, { backgroundColor: t.canvas }]}>
      {step !== 'checkin' ? (
        <Muted style={s.tag}>THE WAY BACK — STEP {step} OF 3</Muted>
      ) : (
        <Muted style={s.tag}>THE WAY BACK</Muted>
      )}

      {step === 1 ? (
        <View style={s.body}>
          {entered === 'overspent' ? (
            <Display>
              It went over — {formatPounds(Math.abs(Math.min(szPence, 0)))} past the line.
            </Display>
          ) : (
            <Display>Close to the line — {formatPounds(Math.max(szPence, 0))} left.</Display>
          )}
          <Body style={s.sub}>
            {entered === 'overspent'
              ? 'No lecture. Here’s the way back: three steps, the first one takes a minute.'
              : 'Caught early. Three steps keep it from going over — the first takes a minute.'}
          </Body>
          <View style={s.mascot}>
            <MeloMascot
              emotion="hope"
              colorway={colorway}
              wardrobe={wardrobe}
              size={84}
              glow={0.5}
            />
          </View>
          <View style={s.cta}>
            <PrimaryAction label="Show me" onPress={() => setStep(2)} />
            <GhostButton label="not today" onPress={onExit} />
          </View>
        </View>
      ) : null}

      {step === 2 ? (
        <View style={s.body}>
          <Display>The plan, adjusted.</Display>
          <Body style={s.sub}>
            Bills stay protected. Spending resets to {formatPounds(perDayPence)}/day for the{' '}
            {daysToPayday} days to {paydayLabel}.
          </Body>
          {billNames.length > 0 ? (
            <Surface style={s.list} tone="sunken">
              {billNames.map((name) => (
                <View key={name} style={s.listRow}>
                  <Text style={[s.listName, { color: t.ink }]}>{name}</Text>
                  <Text style={[s.listOk, { color: t.positiveInk }]}>shielded ✓</Text>
                </View>
              ))}
            </Surface>
          ) : null}
          <View style={s.cta}>
            <PrimaryAction label="That works" onPress={() => setStep(3)} />
          </View>
        </View>
      ) : null}

      {step === 3 ? (
        <View style={s.body}>
          <Display>One move today.</Display>
          <Body style={s.sub}>
            Shift {formatPounds(movePence)} to bills. That’s the whole ask — nothing else today.
          </Body>
          <View style={s.mascot}>
            <MeloMascot
              emotion="hope"
              colorway={colorway}
              wardrobe={wardrobe}
              size={84}
              glow={0.5}
            />
          </View>
          <View style={s.cta}>
            <PrimaryAction label="Done — that’s today" onPress={() => setStep('checkin')} />
          </View>
        </View>
      ) : null}

      {step === 'checkin' ? (
        <View style={[s.body, s.checkin]}>
          <MeloMascot
            emotion="hope"
            colorway={colorway}
            wardrobe={wardrobe}
            size={96}
            glow={0.55}
          />
          <Display style={s.day}>Day {dayOnPath}</Display>
          <Muted>on the path</Muted>
          <Body style={s.sub}>See you tomorrow. I’ll bring the numbers.</Body>
          <View style={s.cta}>
            <PrimaryAction label="Back home" onPress={onCommit} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  tag: { paddingHorizontal: 26, paddingTop: 26, fontSize: 11.5, letterSpacing: 0.8 },
  body: { flex: 1, paddingHorizontal: 26, paddingTop: 14 },
  checkin: { alignItems: 'center', justifyContent: 'center', paddingTop: 0 },
  sub: { marginTop: 10, lineHeight: 21 },
  mascot: { marginTop: 'auto', marginBottom: 12, alignSelf: 'flex-start' },
  list: { marginTop: 18, gap: 10 },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listName: { fontSize: 14.5 },
  listOk: { fontSize: 13, fontWeight: '600' },
  day: { marginTop: 12 },
  cta: { marginTop: 'auto', marginBottom: 18, gap: 8 },
});
