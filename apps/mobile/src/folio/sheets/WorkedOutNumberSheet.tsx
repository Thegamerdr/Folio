import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { calculateBusinessRunway } from '@folio/business-workspace';

import { gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import { buildTrustedSafeRangeFromAppState } from '@/folio/lib/trustedSafeRange';
import {
  buildBusinessRunwayBreakdown,
  buildSafeRangeBreakdown,
  type WorkedNumberBreakdown,
} from '@/folio/lib/workedOutNumber';
import { currentFinancialDate, useAppStore } from '@/folio/store';
import { useBusinessOperations } from '@/folio/screens/business/useBusinessOperations';
import type { Nav, SheetPayload } from '@/folio/types';

export function WorkedOutNumberSheet({
  visible,
  onClose,
  nav,
  subject,
}: {
  visible: boolean;
  onClose: () => void;
  nav: Nav;
  subject: NonNullable<SheetPayload['workedNumber']>;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const appState = useAppStore((state) => state);
  const business = useBusinessOperations();
  const [openedAt] = useState(() => new Date());
  const breakdown = useMemo<WorkedNumberBreakdown>(() => {
    if (subject === 'business-runway') {
      const accounts = appState.accounts ?? [];
      const openAccounts = accounts.filter(
        (account) => account.closed !== true && account.kind !== 'credit-card',
      );
      const runway = calculateBusinessRunway(
        business,
        accounts.map((account) => ({
          balanceMinor: Math.round(account.balanceMinor * 100),
          isLiability: account.kind === 'credit-card',
          ...(account.closed === undefined ? {} : { closed: account.closed }),
        })),
        openedAt,
      );
      return buildBusinessRunwayBreakdown(runway, currentFinancialDate(openedAt), {
        accounts: openAccounts.length,
        invoices: business.invoices.length,
        obligations: business.obligations.length,
      });
    }
    return buildSafeRangeBreakdown(buildTrustedSafeRangeFromAppState(appState, { now: openedAt }));
  }, [appState, business, openedAt, subject]);

  const navigate = (route: Parameters<Nav['go']>[0]) => {
    onClose();
    nav.go(route);
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={s.body}>
        <Text style={s.eyebrow}>{breakdown.eyebrow}</Text>
        <Text accessibilityRole="header" style={s.title}>
          {breakdown.title}
        </Text>
        <Text style={s.answer}>{breakdown.answer}</Text>
        <Text style={s.answerDetail}>{breakdown.answerDetail}</Text>

        <Section label="The arithmetic" styles={s}>
          <View style={s.equationCard}>
            <Text accessibilityLabel={`Calculation: ${breakdown.equation}`} style={s.equation}>
              {breakdown.equation}
            </Text>
          </View>
          {breakdown.inputs.map((input) => (
            <View key={`${input.label}-${input.value}`} style={s.line}>
              <View style={s.lineCopy}>
                <Text style={s.lineLabel}>{input.label}</Text>
                {input.detail ? <Text style={s.lineDetail}>{input.detail}</Text> : null}
              </View>
              <Text
                style={[
                  s.lineValue,
                  input.tone === 'caution'
                    ? { color: t.repairInk }
                    : input.tone === 'positive'
                      ? { color: t.positiveInk }
                      : undefined,
                ]}
              >
                {input.value}
              </Text>
            </View>
          ))}
        </Section>

        <Section label="Window" styles={s}>
          <Text style={s.bodyText}>{breakdown.window}</Text>
        </Section>

        <Section label="Assumptions" styles={s}>
          {breakdown.assumptions.map((item) => (
            <Bullet key={item} text={item} styles={s} />
          ))}
        </Section>

        <Section label="Sources and freshness" styles={s}>
          {breakdown.sources.map((item) => (
            <Bullet key={item} text={item} styles={s} />
          ))}
          <Text style={s.freshness}>{breakdown.freshness}</Text>
        </Section>

        <Section label="What this does not know" styles={s}>
          {breakdown.limits.map((item) => (
            <Bullet key={item} text={item} styles={s} caution />
          ))}
        </Section>

        <Section label="Correct the source" styles={s}>
          {breakdown.corrections.map((correction) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${correction.label}. ${correction.detail}`}
              key={correction.route}
              onPress={() => navigate(correction.route)}
              style={({ pressed }) => [
                s.correction,
                { borderColor: t.hairline, opacity: pressed ? 0.62 : 1 },
              ]}
            >
              <View style={s.correctionCopy}>
                <Text style={s.correctionLabel}>{correction.label}</Text>
                <Text style={s.correctionDetail}>{correction.detail}</Text>
              </View>
              <Text accessibilityElementsHidden style={s.arrow}>
                →
              </Text>
            </Pressable>
          ))}
        </Section>
      </View>
    </Sheet>
  );
}

function Section({
  label,
  children,
  styles,
}: {
  label: string;
  children: React.ReactNode;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionLabel}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function Bullet({
  text,
  styles,
  caution = false,
}: {
  text: string;
  styles: ReturnType<typeof makeStyles>;
  caution?: boolean;
}) {
  return <Text style={[styles.bullet, caution ? styles.caution : undefined]}>· {text}</Text>;
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    body: { paddingHorizontal: gap.xs, paddingBottom: gap.xl },
    eyebrow: { color: t.muted, fontFamily: serif.displayItalic, fontSize: 13 },
    title: { color: t.ink, fontFamily: serif.display, fontSize: 28, marginTop: 2 },
    answer: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 42,
      fontVariant: ['tabular-nums'],
      marginTop: gap.md,
    },
    answerDetail: { color: t.muted, fontSize: 13, lineHeight: 19, marginTop: 2 },
    section: { gap: gap.xs, marginTop: gap.xl },
    sectionLabel: {
      color: t.muted,
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1.35,
      marginBottom: 2,
      textTransform: 'uppercase',
    },
    equationCard: { backgroundColor: t.inset, borderRadius: radius.md, padding: gap.md },
    equation: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 17,
      fontVariant: ['tabular-nums'],
      lineHeight: 23,
    },
    line: {
      alignItems: 'flex-start',
      borderBottomColor: t.hairline,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: gap.md,
      justifyContent: 'space-between',
      minHeight: 48,
      paddingVertical: gap.sm,
    },
    lineCopy: { flex: 1, minWidth: 0 },
    lineLabel: { color: t.ink, fontSize: 13, lineHeight: 18 },
    lineDetail: { color: t.muted, fontSize: 11, lineHeight: 16, marginTop: 1 },
    lineValue: {
      color: t.ink,
      fontSize: 13,
      fontVariant: ['tabular-nums'],
      fontWeight: '600',
      maxWidth: '40%',
      textAlign: 'right',
    },
    bodyText: { color: t.ink, fontSize: 13, lineHeight: 19 },
    bullet: { color: t.ink, fontSize: 12.5, lineHeight: 19 },
    caution: { color: t.repairInk },
    freshness: { color: t.muted, fontSize: 11.5, lineHeight: 17, marginTop: gap.xs },
    correction: {
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: gap.md,
      minHeight: 56,
      paddingVertical: gap.sm,
    },
    correctionCopy: { flex: 1, minWidth: 0 },
    correctionLabel: { color: t.ink, fontSize: 13.5, fontWeight: '600' },
    correctionDetail: { color: t.muted, fontSize: 11.5, lineHeight: 16, marginTop: 2 },
    arrow: { color: t.calmStrong, fontSize: 18 },
  });
}
