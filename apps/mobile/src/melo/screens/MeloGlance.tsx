// The Glance Stack (MELO_BLUEPRINT.md §6.1) — Melo's home. Sky → mascot + one line → the Safe
// Zone number → runway → ONE action card → the afford-check → tiny-wins ticker. The ⚙ chip
// cycles the six demo states; everything on screen reacts through the real engine
// (resolveState + COPY), so this screen is Gate 1 of MELO_PHASE2_PLAN.md: the glance, native.

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  COPY,
  checkAfford,
  formatPounds,
  resolveState,
  type AffordResult,
} from '@folio/melo-engine';
import {
  Body,
  Eyebrow,
  GhostButton,
  HeroMoney,
  Muted,
  PrimaryAction,
  Surface,
  Verdict,
  money,
  useTheme,
  type VerdictTone,
} from '@/surfaces/pressureMap/kit';

import { MeloMascot } from '../mascot/MeloMascot';
import { RunwayStrip } from '../components/RunwayStrip';
import { WeatherSky } from '../components/WeatherSky';
import { breatheFor, glowFor, WEATHER_VISUALS } from '../theme/weather';
import { DEMOS, DEMO_ORDER, DEMO_TODAY, demoBreakdown, type DemoKey } from '../state/demoStates';

const SKY_HEIGHT = 200;

type Ask = { amountPence: number; result: AffordResult | null; fog: boolean; shelved: boolean };

export function MeloGlance() {
  const t = useTheme();
  const [demoKey, setDemoKey] = useState<DemoKey>('calm');
  const [devOpen, setDevOpen] = useState(false);
  const [showMath, setShowMath] = useState(false);
  const [askText, setAskText] = useState('');
  const [ask, setAsk] = useState<Ask | null>(null);
  const [checks, setChecks] = useState(3);
  const [recoveryDone, setRecoveryDone] = useState(false);

  const demo = DEMOS[demoKey];
  const { view } = useMemo(
    () => resolveState(demo.prev, demo.inputs, DEMO_TODAY),
    [demo.prev, demo.inputs],
  );
  const visual = WEATHER_VISUALS[view.weather];
  const breathe = breatheFor(view);
  const line1 = COPY[view.copyKey](demo.ctx);
  const isFog = view.data === 'fog';

  const switchDemo = (key: DemoKey) => {
    setDemoKey(key);
    setDevOpen(false);
    setShowMath(false);
    setAsk(null);
    setAskText('');
    setRecoveryDone(false);
  };

  const runAsk = () => {
    const pounds = Number.parseInt(askText.replace(/[^0-9]/g, ''), 10);
    if (!Number.isFinite(pounds) || pounds <= 0) return;
    const amountPence = pounds * 100;
    if (isFog) {
      setAsk({ amountPence, result: null, fog: true, shelved: false });
      return;
    }
    setAsk({
      amountPence,
      result: checkAfford(demo.szPence, amountPence),
      fog: false,
      shelved: false,
    });
    setChecks((n) => n + 1);
  };

  const handleAction = () => {
    if (demoKey === 'storm') {
      switchDemo('recovery');
      return;
    }
    if (demoKey === 'recovery') setRecoveryDone(true);
  };

  const breakdown = demoBreakdown(demo.szPence);

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ambient sky + weather chip */}
        <View style={{ height: SKY_HEIGHT }}>
          <WeatherSky weather={view.weather} height={SKY_HEIGHT} />
          <View style={[s.chip, { backgroundColor: t.inset, borderColor: t.hairline }]}>
            <View style={[s.chipDot, { backgroundColor: visual.dot }]} />
            <Text style={[s.chipWord, { color: t.secondary }]}>{demo.chipWord}</Text>
          </View>
        </View>

        {/* mascot + its one line */}
        <View style={s.mascotRow}>
          <MeloMascot
            emotion={view.mascot.family}
            size={104}
            glow={glowFor(view)}
            breathe={breathe.enabled}
            breatheDurationMs={breathe.durationMs}
          />
          <View style={s.say}>
            <Body style={s.sayLine}>{line1}</Body>
            <Muted style={s.saySub}>{demo.l2}</Muted>
          </View>
        </View>

        {/* the number */}
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Shows how the Safe Zone was calculated"
          onPress={() => setShowMath((v) => !v)}
          style={s.numberBlock}
        >
          <HeroMoney accessibilityLabel={`Safe Zone ${formatPounds(demo.szPence)}`}>
            {formatPounds(demo.szPence)}
          </HeroMoney>
          <View style={s.subRow}>
            <Muted>{demo.sub}</Muted>
            {isFog ? (
              <View style={[s.staleBadge, { backgroundColor: '#E7E3EC' }]}>
                <Text style={s.staleText}>as of Tue</Text>
              </View>
            ) : null}
          </View>
          <Muted style={s.hint}>tap for the math</Muted>
        </Pressable>

        {/* show the math */}
        {showMath ? (
          <Surface style={s.card} tone="sunken">
            <Muted style={s.mathIntro}>
              Every pound accounted for. Tap anything that looks wrong — I’d rather be corrected
              than confidently wrong.
            </Muted>
            <MathRow label="Balance" value={money(breakdown.balance)} />
            <MathRow label="Shielded bills" value={`−${money(breakdown.bills)}`} />
            <MathRow label="Essentials to payday" value={`−${money(breakdown.essentials)}`} />
            <MathRow label="Savings, as planned" value={`−${money(breakdown.savings)}`} />
            <MathRow label="Buffer — early warning" value={`−${money(breakdown.buffer)}`} />
            <MathRow label="Safe Zone" value={formatPounds(demo.szPence)} total />
            <View style={s.mathButtons}>
              <GhostButton flex label="Looks right" onPress={() => setShowMath(false)} />
              <GhostButton flex label="Something’s off" onPress={() => setShowMath(false)} />
            </View>
          </Surface>
        ) : null}

        {/* runway */}
        <View style={s.runway}>
          <RunwayStrip
            daysToPayday={demo.daysToPayday}
            bills={demo.bills}
            dangerDay={demo.dangerDay}
            paydayLabel={demo.ctx.paydayLabel}
          />
        </View>

        {/* the ONE action card */}
        <Surface style={s.card}>
          <Eyebrow tone="muted">
            {recoveryDone && demoKey === 'recovery' ? 'Done' : demo.action.title}
          </Eyebrow>
          <Body style={s.actionBody}>
            {recoveryDone && demoKey === 'recovery'
              ? 'That’s the whole ask. See you tomorrow — I’ll bring the numbers.'
              : demo.action.body}
          </Body>
          {recoveryDone && demoKey === 'recovery' ? null : (
            <View style={s.actionCta}>
              <PrimaryAction label={demo.action.cta} tone="ink" onPress={handleAction} />
            </View>
          )}
        </Surface>

        {/* can I afford…? */}
        <View style={s.askRow}>
          <TextInput
            value={askText}
            onChangeText={setAskText}
            onSubmitEditing={runAsk}
            keyboardType="number-pad"
            returnKeyType="done"
            placeholder="Can I afford… £"
            placeholderTextColor={t.muted}
            style={[
              s.askInput,
              { backgroundColor: t.inset, borderColor: t.hairlineStrong, color: t.ink },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            onPress={runAsk}
            style={[s.askButton, { backgroundColor: t.calmStrong }]}
          >
            <Text style={[s.askButtonLabel, { color: t.inverse }]}>Ask</Text>
          </Pressable>
        </View>

        {ask ? (
          <AskVerdict
            ask={ask}
            demoKey={demoKey}
            onShelf={() => setAsk({ ...ask, shelved: true })}
          />
        ) : null}

        {/* tiny wins ticker */}
        <Muted style={s.ticker}>
          {ask?.shelved ? `✦ ${COPY.shelf()}` : `✦ ${checks} checks-before-buying this week`}
        </Muted>
      </ScrollView>

      {/* dev state chip */}
      <View style={s.devWrap}>
        {devOpen ? (
          <View style={[s.devMenu, { backgroundColor: t.surface, borderColor: t.hairline }]}>
            {DEMO_ORDER.map((key) => (
              <Pressable
                key={key}
                onPress={() => switchDemo(key)}
                style={[s.devItem, key === demoKey ? { backgroundColor: t.calmSoft } : null]}
              >
                <Text style={[s.devItemLabel, { color: key === demoKey ? t.ink : t.secondary }]}>
                  {DEMOS[key].label}
                </Text>
              </Pressable>
            ))}
            <View style={[s.devDivider, { backgroundColor: t.hairline }]} />
            <Text style={[s.devDebug, { color: t.muted }]}>
              {view.ladder} · {view.weather} · {view.copyKey} · sell{' '}
              {view.monetizationAllowed ? 'on' : 'off'}
            </Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Prototype states"
          onPress={() => setDevOpen((v) => !v)}
          style={[s.devToggle, { backgroundColor: t.inset, borderColor: t.hairline }]}
        >
          <Text style={[s.devToggleLabel, { color: t.muted }]}>⚙ state</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AskVerdict({
  ask,
  demoKey,
  onShelf,
}: {
  ask: Ask;
  demoKey: DemoKey;
  onShelf: () => void;
}) {
  const demo = DEMOS[demoKey];
  if (ask.fog) {
    return (
      <Surface style={s.card} tone="sunken">
        <Verdict>Can’t call it</Verdict>
        <Body style={s.verdictLine}>{COPY.affordFog(demo.ctx)}</Body>
      </Surface>
    );
  }
  if (!ask.result) return null;

  const left = formatPounds(ask.result.leftAfterPence);
  const word =
    ask.result.verdict === 'safe' ? 'Safe' : ask.result.verdict === 'tight' ? 'Tight' : 'Not now';
  const tone: VerdictTone | undefined =
    ask.result.verdict === 'safe'
      ? 'positive'
      : ask.result.verdict === 'tight'
        ? 'warm'
        : undefined;
  const line =
    ask.result.verdict === 'safe'
      ? COPY.affordSafe({ ...demo.ctx, safeZone: left })
      : ask.result.verdict === 'tight'
        ? COPY.affordTight({ ...demo.ctx, safeZone: left })
        : COPY.affordNotNow(demo.ctx);

  return (
    <Surface style={s.card} tone="sunken">
      <Verdict tone={tone}>{word}</Verdict>
      <Body style={s.verdictLine}>{ask.shelved ? COPY.shelf() : line}</Body>
      {ask.result.shelfEligible && !ask.shelved ? (
        <View style={s.shelfRow}>
          <GhostButton label="Put it on the Shelf (24h)" onPress={onShelf} />
        </View>
      ) : null}
    </Surface>
  );
}

function MathRow({ label, value, total }: { label: string; value: string; total?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={[
        s.mathRow,
        total
          ? null
          : { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.hairline },
      ]}
    >
      <Text
        style={[s.mathLabel, { color: total ? t.ink : t.secondary }, total ? s.mathTotal : null]}
      >
        {label}
      </Text>
      <Text
        style={[s.mathValue, { color: total ? t.calmStrong : t.ink }, total ? s.mathTotal : null]}
      >
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 110 },
  chip: {
    position: 'absolute',
    top: 16,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipWord: { fontSize: 12.5, fontWeight: '600' },
  mascotRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
    paddingHorizontal: 24,
    marginTop: -64,
  },
  say: { flex: 1, paddingBottom: 12 },
  sayLine: { fontWeight: '600' },
  saySub: { marginTop: 3 },
  numberBlock: { paddingHorizontal: 26, paddingTop: 12 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  staleBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  staleText: { fontSize: 10.5, fontWeight: '600', color: '#7A7286', letterSpacing: 0.2 },
  hint: { fontSize: 11, marginTop: 4 },
  card: { marginHorizontal: 26, marginTop: 16 },
  mathIntro: { marginBottom: 10, lineHeight: 18 },
  mathRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  mathLabel: { fontSize: 14 },
  mathValue: { fontSize: 14, fontVariant: ['tabular-nums'], fontWeight: '600' },
  mathTotal: { fontSize: 16, fontWeight: '700' },
  mathButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  runway: { paddingHorizontal: 26, paddingTop: 18 },
  actionBody: { marginTop: 4, lineHeight: 20 },
  actionCta: { marginTop: 12 },
  askRow: { flexDirection: 'row', gap: 8, marginHorizontal: 26, marginTop: 16 },
  askInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  askButton: {
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  askButtonLabel: { fontSize: 14.5, fontWeight: '600' },
  verdictLine: { marginTop: 5, lineHeight: 20 },
  shelfRow: { marginTop: 10, alignSelf: 'flex-start' },
  ticker: { marginHorizontal: 26, marginTop: 16, fontSize: 12.5 },
  devWrap: { position: 'absolute', right: 14, bottom: 14, alignItems: 'flex-end', gap: 8 },
  devMenu: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    minWidth: 132,
  },
  devItem: { borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10 },
  devItemLabel: { fontSize: 13, textAlign: 'right', fontWeight: '500' },
  devDivider: { height: StyleSheet.hairlineWidth, marginVertical: 5, marginHorizontal: 4 },
  devDebug: { fontSize: 10, textAlign: 'right', paddingHorizontal: 10, paddingBottom: 4 },
  devToggle: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  devToggleLabel: { fontSize: 11.5, fontWeight: '600', letterSpacing: 0.3 },
});
