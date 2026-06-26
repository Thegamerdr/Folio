// Today — the signature money path.
//
// Answers the real questions at a glance: can I make it (the verdict), why (the
// path and its lowest point), what still needs checking (waiting rows), and lets the
// user tap any point for a human explanation. The route is the screen's hero object.

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { LocalTodayModel } from '../../local/localTodayAdapter';
import type { LocalRoutePoint, LocalRouteSummary } from '../../local/localLedger';
import { MoneyPath, PointExplanation, routeHasMeaningfulPath } from './MoneyPath';
import { MeloPresence } from './melo';
import {
  Body,
  Eyebrow,
  HeroMoney,
  Muted,
  PressureScreen,
  QuietLink,
  Verdict,
  gap,
  money,
  paper,
  type VerdictTone,
} from './kit';

function verdict(route: LocalRouteSummary): { line: string; tone: VerdictTone } {
  const low = route.tightestBalanceMinor;
  if (low < 0) return { line: 'Not quite — it runs short before payday.', tone: 'repair' };
  if (low < 10000) return { line: 'Yes — but it stays tight.', tone: 'warm' };
  return { line: 'Yes — your money lasts to payday.', tone: 'calm' };
}

// When the lowest point lands on today, its raw label is "Today" — which would echo the
// route header. Name what causes the dip instead, so the caption reads as one clear thought.
function tightestDayPhrase(point: LocalRoutePoint | undefined): string | undefined {
  if (point === undefined) return undefined;
  if (point.label !== 'Today') return point.label;
  if (point.deltaMinor < 0 || point.pointKind === 'commitment' || point.pointKind === 'shortfall') {
    return 'after bills';
  }
  return undefined;
}

// A calm, specific caption from real data only: it frames the hero as the lowest point, names
// the moment it lands (a real day, or what causes the dip), and ends on the payday it holds to.
function heroCaption(route: LocalRouteSummary, point: LocalRoutePoint | undefined): string {
  const when = tightestDayPhrase(point);
  const lowest = `lowest point ${money(route.tightestBalanceMinor)}`;
  const parts = when ? [lowest, when, route.nextPaydayLabel] : [lowest, route.nextPaydayLabel];
  return parts.join(' · ');
}

export function TodayScreen({
  onOpenSources,
  onOpenWhatIf,
  privateExampleMode,
  route,
  today,
}: {
  onOpenMelo: () => void;
  onOpenSources: () => void;
  onOpenWhatIf: () => void;
  privateExampleMode: boolean;
  route: LocalRouteSummary;
  today: LocalTodayModel;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const real = routeHasMeaningfulPath(route);
  const v = verdict(route);
  const tightestPoint = route.points.find((p) => p.date === route.tightestDay);

  return (
    <PressureScreen style={styles.screen}>
      <View accessibilityLabel={today.accessibilitySummary} style={styles.hero}>
        {privateExampleMode ? (
          <View style={styles.examplePill}>
            <Text style={styles.examplePillText}>Example picture</Text>
          </View>
        ) : null}
        <Eyebrow tone={!real ? undefined : v.tone === 'repair' ? 'warm' : undefined}>
          Will your money last to payday?
        </Eyebrow>

        {real ? (
          <>
            <Verdict tone={v.tone}>{v.line}</Verdict>
            <Text style={styles.heroEyebrow}>Its lowest point</Text>
            <HeroMoney
              accessibilityLabel={`Your lowest point before ${route.nextPaydayLabel} is ${money(
                route.tightestBalanceMinor,
              )}${tightestDayPhrase(tightestPoint) ? `, ${tightestDayPhrase(tightestPoint)}` : ''}.`}
              tone={v.tone}
            >
              {money(route.tightestBalanceMinor)}
            </HeroMoney>
            <Muted style={styles.heroCaption}>{heroCaption(route, tightestPoint)}</Muted>
            {route.pendingReviewCount > 0 ? (
              <Text style={styles.stillChecking}>
                {route.pendingReviewCount} still to check — only rows you add change this.
              </Text>
            ) : null}
          </>
        ) : (
          <>
            <Verdict tone="calm">Here's where you stand.</Verdict>
            <HeroMoney
              accessibilityLabel={`${money(route.availableNowMinor)}, money you can see now.`}
            >
              {money(route.availableNowMinor)}
            </HeroMoney>
            <Muted style={styles.heroCaption}>money you can see now</Muted>
            <Body style={styles.startBody}>
              Add when money comes in and what has to leave, and your path to payday draws itself.
            </Body>
          </>
        )}
      </View>

      <MoneyPath onSelectPoint={setSelected} route={route} selectedIndex={selected} />

      {real ? (
        <MeloPresence
          line={
            tightestDayPhrase(tightestPoint)
              ? `The tightest point is ${tightestDayPhrase(tightestPoint)!.toLowerCase()}.`
              : undefined
          }
          state="melo_path_explaining"
          style={styles.melo}
        />
      ) : (
        <MeloPresence state="melo_idle" style={styles.melo} />
      )}

      <View style={styles.quietRow}>
        <QuietLink
          accessibilityHint="See what a spend would do to your path."
          label="What if I spend something?"
          onPress={onOpenWhatIf}
        />
        <QuietLink
          accessibilityHint="See what this picture is built from."
          label="What's behind this picture?"
          onPress={onOpenSources}
        />
      </View>

      <PointExplanation
        onClose={() => setSelected(null)}
        point={selected === null ? null : (route.points[selected] ?? null)}
      />
    </PressureScreen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: gap.lg },
  melo: { marginTop: gap.xs },
  hero: { gap: gap.sm, paddingTop: gap.sm },
  examplePill: {
    alignSelf: 'flex-start',
    backgroundColor: paper.warmSoft,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
    marginBottom: 2,
  },
  examplePillText: { color: paper.warmInk, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  heroEyebrow: {
    color: paper.muted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: gap.xs,
    marginBottom: -2,
  },
  heroCaption: { marginTop: 2 },
  stillChecking: { color: paper.warmInk, fontSize: 14, fontWeight: '600', marginTop: gap.xs },
  startBody: { color: paper.secondary, marginTop: gap.xs },
  quietRow: { gap: 0 },
});
