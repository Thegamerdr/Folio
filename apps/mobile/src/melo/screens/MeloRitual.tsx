// The Payday Ritual (MELO_BLUEPRINT.md §2 P3, §5.2 screen 11) — the signature moment. Five
// beats, big taps, two minutes: celebrate → protect the bills → set savings aside → reveal the
// cycle's Safe Zone → one smart move. Every beat is skippable without comment: it must stay a
// gift, not a chore. Payday is the one day people feel good about money — this owns it.

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatPounds } from '@folio/melo-engine';
import {
  Body,
  Display,
  GhostButton,
  HeroMoney,
  Muted,
  PrimaryAction,
  Surface,
  useTheme,
} from '@/surfaces/pressureMap/kit';
import { useCountUp } from '@/surfaces/pressureMap/useCountUp';

import { MeloMascot } from '../mascot/MeloMascot';
import { WeatherSky } from '../components/WeatherSky';
import type { MeloColorway } from '../theme/weather';

type Beat = 1 | 2 | 3 | 4 | 5;

export interface RitualBillRow {
  readonly name: string;
  readonly amountPence: number;
}

type Props = {
  colorway: MeloColorway;
  wardrobe?: string | null;
  bills: readonly RitualBillRow[];
  savingsPence: number;
  safeZonePence: number;
  perDayPence: number;
  daysToPayday: number;
  paydayLabel: string;
  smartMove: { title: string; body: string } | null;
  onDone: () => void;
  onSkip: () => void;
};

export function MeloRitual({
  colorway,
  wardrobe = null,
  bills,
  savingsPence,
  safeZonePence,
  perDayPence,
  daysToPayday,
  paydayLabel,
  smartMove,
  onDone,
  onSkip,
}: Props) {
  const t = useTheme();
  const [beat, setBeat] = useState<Beat>(1);
  const billsTotal = bills.reduce((sum, b) => sum + b.amountPence, 0);

  return (
    <View style={[s.root, { backgroundColor: t.canvas }]}>
      {beat === 1 ? (
        <View style={s.center}>
          <View style={s.sky}>
            <WeatherSky weather="sunny" height={170} />
          </View>
          <MeloMascot emotion="joy" colorway={colorway} wardrobe={wardrobe} size={112} glow={0.9} />
          <Display style={s.title}>Payday.</Display>
          <Body style={s.sub}>
            Before it starts disappearing — two minutes to make the month safe?
          </Body>
          <View style={s.cta}>
            <PrimaryAction label="Let’s do it" onPress={() => setBeat(2)} />
            <GhostButton label="skip today" onPress={onSkip} />
          </View>
        </View>
      ) : null}

      {beat === 2 ? (
        <ScrollView contentContainerStyle={s.step}>
          <Muted style={s.tag}>THE RITUAL — 1 OF 4</Muted>
          <Display>First: protect the important things.</Display>
          <Surface style={s.list} tone="sunken">
            {bills.map((b) => (
              <View key={b.name} style={s.listRow}>
                <Text style={[s.listName, { color: t.secondary }]}>{b.name}</Text>
                <Text style={[s.listAmount, { color: t.ink }]}>{formatPounds(b.amountPence)}</Text>
              </View>
            ))}
            <View style={[s.listTotal, { borderTopColor: t.hairline }]}>
              <Text style={[s.listName, { color: t.ink, fontWeight: '600' }]}>Shielded</Text>
              <Text style={[s.listAmount, { color: t.calmStrong, fontWeight: '700' }]}>
                {formatPounds(billsTotal)}
              </Text>
            </View>
          </Surface>
          <View style={s.cta}>
            <PrimaryAction
              label={`Protect ${formatPounds(billsTotal)}`}
              onPress={() => setBeat(3)}
            />
          </View>
        </ScrollView>
      ) : null}

      {beat === 3 ? (
        <View style={s.step}>
          <Muted style={s.tag}>THE RITUAL — 2 OF 4</Muted>
          <Display>Set a little aside?</Display>
          <Body style={s.sub}>
            {formatPounds(savingsPence)} to savings — one storm smaller, every month.
          </Body>
          <View style={s.mascotSide}>
            <MeloMascot
              emotion="calm"
              colorway={colorway}
              wardrobe={wardrobe}
              size={84}
              glow={0.85}
            />
          </View>
          <View style={s.cta}>
            <PrimaryAction
              label={`Set aside ${formatPounds(savingsPence)}`}
              onPress={() => setBeat(4)}
            />
            <GhostButton label="not this month" onPress={() => setBeat(4)} />
          </View>
        </View>
      ) : null}

      {beat === 4 ? (
        <View style={s.step}>
          <Muted style={s.tag}>THE RITUAL — 3 OF 4</Muted>
          {/* Never declare a negative month "made safe" — the honest variant leads with the
              shield and the plan instead (audit). */}
          <Display>{safeZonePence > 0 ? 'Your month, made safe.' : 'The honest month.'}</Display>
          <RevealNumber safeZonePence={safeZonePence} />
          <Muted style={s.revealSub}>
            {safeZonePence > 0
              ? `${formatPounds(perDayPence)}/day for ${daysToPayday} days · until ${paydayLabel}`
              : `tight to ${paydayLabel} — bills first, then we steer`}
          </Muted>
          <View style={s.cta}>
            <PrimaryAction label="One last thing" onPress={() => setBeat(5)} />
          </View>
        </View>
      ) : null}

      {beat === 5 ? (
        <View style={s.step}>
          <Muted style={s.tag}>THE RITUAL — 4 OF 4</Muted>
          <Display>One smart move.</Display>
          {smartMove ? (
            <Surface style={s.list}>
              <Text style={[s.moveTitle, { color: t.ink }]}>{smartMove.title}</Text>
              <Body style={s.moveBody}>{smartMove.body}</Body>
            </Surface>
          ) : (
            <Body style={s.sub}>
              Nothing needs fixing this cycle. That’s the good kind of boring.
            </Body>
          )}
          <View style={s.mascotSide}>
            <MeloMascot
              emotion="joy"
              colorway={colorway}
              wardrobe={wardrobe}
              size={84}
              glow={0.9}
            />
          </View>
          <View style={s.cta}>
            <PrimaryAction label="Done — show me the month" onPress={onDone} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function RevealNumber({ safeZonePence }: { safeZonePence: number }) {
  const animated = useCountUp(Math.max(safeZonePence, 0), 900);
  const display = safeZonePence <= 0 ? safeZonePence : Math.round(animated);
  return (
    <View style={s.revealNumber}>
      <HeroMoney accessibilityLabel={`Safe Zone ${formatPounds(safeZonePence)}`}>
        {formatPounds(display)}
      </HeroMoney>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  sky: { position: 'absolute', top: 0, left: 0, right: 0 },
  title: { marginTop: 14 },
  sub: { textAlign: 'center', marginTop: 8, lineHeight: 21, maxWidth: 300 },
  step: { flexGrow: 1, paddingHorizontal: 26, paddingTop: 30 },
  tag: { fontSize: 11.5, letterSpacing: 0.8, marginBottom: 10 },
  list: { marginTop: 18, gap: 10 },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listName: { fontSize: 14.5 },
  listAmount: { fontSize: 14.5, fontVariant: ['tabular-nums'], fontWeight: '600' },
  listTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  mascotSide: { marginTop: 'auto', marginBottom: 10, alignSelf: 'flex-start' },
  cta: { marginTop: 'auto', marginBottom: 18, gap: 8, alignSelf: 'stretch' },
  revealNumber: { marginTop: 18 },
  revealSub: { marginTop: 6 },
  moveTitle: { fontSize: 15, fontWeight: '600' },
  moveBody: { marginTop: 4, lineHeight: 20 },
});
