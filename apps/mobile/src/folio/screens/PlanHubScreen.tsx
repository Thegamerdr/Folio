import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  MeloCompanionPerch,
  useMeloCompanionScrollHandlers,
} from '@/folio/companion/MeloCompanionHost';
import { deriveCalendarEvents } from '@/folio/lib/calendarEvents';
import { useAppStore } from '@/folio/store';
import type { Nav } from '@/folio/types';
import {
  Button,
  Card,
  Figure,
  ListGroup,
  Row,
  Screen,
  Section,
} from '@/folio/ui/ProductPrimitives';
import { gap } from '@/folio/theme';

/** Faithful native root for Lovable's Personal Plan tab. Detailed "what's coming" remains the
 * `plans` route; this hub owns the tab and gathers every path-shaping job without deleting it. */
export function PlanHubScreen({ nav }: { nav: Nav }) {
  const insets = useSafeAreaInsets();
  const companionScroll = useMeloCompanionScrollHandlers();
  const subs = useAppStore((state) => state.subs);
  const subPaused = useAppStore((state) => state.subPaused);
  const subOverrides = useAppStore((state) => state.subOverrides);
  const onboarding = useAppStore((state) => state.onboarding);
  const manualEvents = useAppStore((state) => state.calendarEvents);
  const pots = useAppStore((state) => state.pots);
  const debts = useAppStore((state) => state.debts ?? []);
  const includeSampleBills = useAppStore((state) => state.currentBalance.source === 'sample');
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => setNow(new Date()), []);

  const ahead = useMemo(() => {
    if (!now) return { count: 0, total: 0 };
    const outgoing = deriveCalendarEvents({
      subs,
      subPaused,
      subOverrides,
      onboarding,
      manualEvents,
      pots,
      now,
      includeSampleBills,
    }).filter(
      (event) => event.kind === 'out' && typeof event.amount === 'number' && event.amount < 0,
    );
    return {
      count: outgoing.length,
      total: outgoing.reduce((sum, event) => sum + Math.abs(event.amount ?? 0), 0),
    };
  }, [includeSampleBills, manualEvents, now, onboarding, pots, subOverrides, subPaused, subs]);

  const activeSubs = subs.filter((sub) => !subPaused[sub.name]);
  const potsSaved = pots.reduce((sum, pot) => sum + pot.saved, 0);

  return (
    <Screen>
      <ScrollView
        {...companionScroll}
        contentContainerStyle={{
          paddingBottom: insets.bottom + gap.huge,
          paddingTop: insets.top + gap.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <MeloCompanionPerch companionSize={60} id="plan/header" priority={90}>
          <View style={styles.anchor} />
        </MeloCompanionPerch>

        <Section eyebrow="Plan" title="Before payday">
          <Card style={styles.heroCard}>
            <Figure
              label={`${ahead.count} thing${ahead.count === 1 ? '' : 's'} still to leave`}
              supporting="in the next 35 days"
              value={`£${ahead.total.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`}
            />
            <View style={styles.heroActions}>
              <View style={styles.actionCell}>
                <Button label="See the list" onPress={() => nav.go('plans')} />
              </View>
              <View style={styles.actionCell}>
                <Button
                  label="Open calendar"
                  onPress={() => nav.go('calendar')}
                  variant="secondary"
                />
              </View>
            </View>
          </Card>
        </Section>

        <Section eyebrow="What's coming" title="Dates and commitments">
          <ListGroup label="Dates and commitments">
            <Row
              description="every outgoing before payday"
              icon="plan"
              onPress={() => nav.go('plans')}
              title="What's coming"
            />
            <Row
              description="the dates that matter"
              icon="today"
              onPress={() => nav.go('calendar')}
              title="Calendar"
            />
            <Row
              description={`${activeSubs.length} active`}
              icon="review"
              onPress={() => nav.go('subs')}
              title="Subscriptions"
            />
            <Row
              description={debts.length ? `${debts.length} tracked` : 'nothing tracked yet'}
              icon="money"
              onPress={() => nav.go('add-debt')}
              title="Debts"
            />
          </ListGroup>
        </Section>

        <Section eyebrow="Set aside" title="Pots and goals">
          <ListGroup label="Pots and goals">
            <Row
              description={pots.length ? `${pots.length} pots` : 'no pots yet'}
              icon="money"
              onPress={() => nav.go('pots')}
              title="Pots"
              value={`£${potsSaved.toFixed(0)}`}
            />
            <Row
              description="wrap up the month, calmly"
              icon="success"
              onPress={() => nav.go('ritual')}
              title="Payday review"
            />
          </ListGroup>
        </Section>

        <Section eyebrow="Adjust path" title="Try a change first">
          <ListGroup label="Adjust path">
            <Row
              description="preview before you decide"
              icon="plan"
              onPress={() => nav.go('whatif')}
              title="What if I spend"
            />
            <Row
              description="something has to move"
              icon="restore"
              onPress={() => nav.go('recovery')}
              title="Recovery"
            />
            <Row
              description="the shape of your months"
              icon="today"
              onPress={() => nav.go('insights')}
              title="Insights"
            />
          </ListGroup>
        </Section>

        <Section eyebrow="Add" title="Put something in the plan">
          <ListGroup label="Add to the plan">
            <Row
              description="something that leaves every month"
              icon="money"
              onPress={() => nav.go('add-bill')}
              title="Add a bill"
            />
            <Row
              description="balance, rate, payoff"
              icon="money"
              onPress={() => nav.go('add-debt')}
              title="Add a debt"
            />
            <Row
              description="a one-off in or out"
              icon="today"
              onPress={() => nav.openSheet('add-event')}
              title="Add a date"
            />
            <Row
              description="still worth it? three choices"
              icon="review"
              onPress={() => nav.go('subs')}
              title="Sub check-in"
            />
            <Row
              description="between your own accounts"
              icon="money"
              onPress={() => nav.openMelo({ prefill: 'Log a transfer between my accounts.' })}
              title="Log a transfer"
            />
            <Row
              description="link the money in to the earlier spend"
              icon="restore"
              onPress={() => nav.openMelo({ prefill: 'Pair a refund with the earlier spend.' })}
              title="Pair a refund"
            />
          </ListGroup>
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionCell: { flex: 1 },
  anchor: { height: 1, width: 1 },
  heroActions: { flexDirection: 'row', gap: gap.sm, marginTop: gap.lg },
  heroCard: { marginTop: 0 },
});
