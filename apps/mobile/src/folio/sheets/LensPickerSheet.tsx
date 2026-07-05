// @rn-sheet     LensPickerSheet
// @purpose      First-class lens switcher. Ten lenses, one tap. Locked Plus / Pro lenses show a
//               small badge and route to Paywall instead of switching; a first-time free user gets
//               the one-cycle trial inline instead.
// @reads        moneyMode, lens.plusUnlocked, lens.proUnlocked, lens.trialCycleId (via useLens())
// @writes       setMoneyMode (via the store), startLensTrial (via useLens().startTrial)
// @copy         FROZEN — calm labels only, ported verbatim from the web ONE_LINE deck.
// @tokens       --surface --hairline --accent --accent-soft --muted-ink (mapped to t.surface /
//               t.hairline / t.calm / t.calmSoft / t.muted)
//
// Faithful 1:1 RN port of the web design source
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetLensPicker.tsx).
// The web shows a toast on trial-start; RN has no toast primitive wired to this sheet, so a small
// inline confirmation line is shown instead of fabricating a toast system.

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { gap, radius, Sheet, serif, useTheme, type Palette } from '@/folio/theme';
import { setMoneyMode } from '@/folio/store';
import { MODE_LABEL, type MoneyMode } from '@/folio/lib/modes';
import { FREE_LENSES, PLUS_LENSES, PRO_LENSES, useLens } from '@/folio/lib/lens';
import type { Nav } from '@/folio/types';

export type LensPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  nav: Nav;
};

const ORDER: MoneyMode[] = [
  'survival',
  'stability',
  'growth',
  'reset',
  'optimizer',
  'planning',
  'lowVis',
  'irregular',
  'debt',
  'household',
];

const ONE_LINE: Record<MoneyMode, string> = {
  survival: 'Make it to payday.',
  stability: 'Bills covered — hold the line.',
  growth: 'Push the buffer, keep momentum.',
  debt: 'Chip away without slipping.',
  irregular: 'Even out the peaks and dips.',
  household: 'Share the shape, not the stress.',
  planning: 'Line it up without breaking today.',
  optimizer: 'Trim the quiet leaks.',
  reset: 'Soft landing, then rebuild.',
  lowVis: 'Not enough to say yet.',
};

export function LensPickerSheet({ visible, onClose, nav }: LensPickerSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const active = useLens().active;
  const {
    canAccess,
    tierFor,
    trialCycleId,
    trialDaysLeft,
    plusUnlocked,
    proUnlocked,
    canOfferTrial,
    startTrial,
  } = useLens();
  const [justStartedTrial, setJustStartedTrial] = useState(false);

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={s.body}>
        <View style={s.headRow}>
          <Text style={s.headline}>
            Pick a <Text style={s.accentWord}>lens</Text>.
          </Text>
          <Text style={s.tierCounts}>
            {FREE_LENSES.length} free · {PLUS_LENSES.length} plus · {PRO_LENSES.length} pro
          </Text>
        </View>
        <Text style={s.subline}>
          Reshapes Today's verdict and Melo's voice. Switch back any time.
        </Text>

        <ScrollView style={s.list} contentContainerStyle={s.listContent}>
          {ORDER.map((m, idx) => {
            const isActive = m === active;
            const tier = tierFor(m);
            const locked = !canAccess(m);
            const onTrial =
              trialCycleId !== null &&
              ((tier === 'plus' && !plusUnlocked) || (tier === 'pro' && !proUnlocked));
            const badgeLabel =
              tier === 'free'
                ? 'Free'
                : locked
                  ? tier === 'pro'
                    ? 'Pro'
                    : 'Plus'
                  : onTrial
                    ? tier === 'pro'
                      ? 'Pro · trial'
                      : 'Plus · trial'
                    : tier === 'pro'
                      ? 'Pro'
                      : 'Plus';
            const badgeActive = tier !== 'free' && !locked;

            return (
              <Pressable
                key={m}
                accessibilityRole="button"
                accessibilityLabel={
                  locked
                    ? `${MODE_LABEL[m]} — ${tier === 'pro' ? 'Pro' : 'Plus'} lens, ${
                        canOfferTrial ? 'tap to start free trial' : 'tap to see plans'
                      }`
                    : `Switch to ${MODE_LABEL[m]}`
                }
                onPress={() => {
                  if (locked) {
                    if (canOfferTrial) {
                      startTrial();
                      setMoneyMode(m);
                      setJustStartedTrial(true);
                      onClose();
                      return;
                    }
                    onClose();
                    nav.go('paywall');
                    return;
                  }
                  setMoneyMode(m);
                  onClose();
                }}
                style={[
                  s.row,
                  idx !== 0
                    ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.hairline }
                    : null,
                  isActive ? { backgroundColor: t.calmSoft } : null,
                ]}
              >
                <View style={s.rowBody}>
                  <View style={s.rowTitleRow}>
                    <Text style={s.rowTitle}>{MODE_LABEL[m]}</Text>
                    <View
                      style={[s.badge, { backgroundColor: badgeActive ? t.calmSoft : t.inset }]}
                    >
                      <Text style={[s.badgeText, { color: badgeActive ? t.calm : t.muted }]}>
                        {badgeLabel}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.rowLine} numberOfLines={1}>
                    &ldquo;{ONE_LINE[m]}&rdquo;
                  </Text>
                </View>
                {isActive ? <View style={s.activeDot} /> : <Text style={s.chevron}>→</Text>}
              </Pressable>
            );
          })}
        </ScrollView>

        {justStartedTrial ? (
          <View style={[s.footer, { backgroundColor: t.calmSoft }]}>
            <Text style={s.footerTitle}>Trial started · one cycle</Text>
            <Text style={s.footerBody}>
              Every paid lens (Plus + Pro) unlocked until your next payday. Auto-locks then.
            </Text>
          </View>
        ) : null}

        {trialCycleId && !plusUnlocked && !proUnlocked ? (
          <View style={[s.footer, { backgroundColor: t.calmSoft }]}>
            <View style={s.footerRow}>
              <View style={s.footerTextCol}>
                <Text style={s.footerTitle}>
                  Trial active{' '}
                  <Text style={s.footerTitleMuted}>
                    ·{' '}
                    {trialDaysLeft === 0
                      ? 'last day'
                      : trialDaysLeft === 1
                        ? '1 day left'
                        : `${trialDaysLeft} days left`}
                  </Text>
                </Text>
                <Text style={s.footerBody}>Every paid lens unlocked until your next payday.</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onClose();
                  nav.go('paywall');
                }}
                style={[s.footerCta, { backgroundColor: t.surface, borderColor: t.hairline }]}
              >
                <Text style={s.footerCtaLabel}>See plans</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {canOfferTrial && !justStartedTrial ? (
          <View style={[s.footer, { backgroundColor: t.inset }]}>
            <View style={s.footerRow}>
              <View style={s.footerTextCol}>
                <Text style={s.footerTitle}>Try every lens · one cycle</Text>
                <Text style={s.footerBody}>
                  No card. Auto-locks at payday. Never a silent renewal.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  startTrial();
                  setJustStartedTrial(true);
                }}
                style={[s.footerCta, { backgroundColor: t.calm }]}
              >
                <Text style={[s.footerCtaLabel, { color: t.inverse }]}>Start trial</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    body: { paddingHorizontal: gap.xs, paddingBottom: gap.md },
    headRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    headline: {
      fontFamily: serif.display,
      fontSize: 22,
      lineHeight: 26,
      color: t.ink,
      flexShrink: 1,
    },
    accentWord: { color: t.calm },
    tierCounts: { fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase', color: t.muted },
    subline: { marginTop: 4, fontSize: 12, color: t.muted },
    list: {
      marginTop: gap.md,
      maxHeight: 380,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
      backgroundColor: t.surface,
    },
    listContent: { paddingVertical: 0 },
    row: {
      paddingHorizontal: gap.lg,
      paddingVertical: gap.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: gap.sm,
    },
    rowBody: { flex: 1, minWidth: 0 },
    rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: gap.xs },
    rowTitle: { fontSize: 14.5, fontWeight: '500', color: t.ink },
    badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
    badgeText: { fontSize: 9, letterSpacing: 0.6, textTransform: 'uppercase' },
    rowLine: { marginTop: 2, fontSize: 12, fontStyle: 'italic', color: t.muted },
    activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.calm },
    chevron: { fontSize: 16, color: t.muted },
    footer: {
      marginTop: gap.md,
      borderRadius: radius.md,
      paddingHorizontal: gap.lg,
      paddingVertical: gap.md,
    },
    footerRow: { flexDirection: 'row', alignItems: 'center', gap: gap.sm },
    footerTextCol: { flex: 1 },
    footerTitle: { fontSize: 12.5, fontWeight: '500', color: t.ink },
    footerTitleMuted: {
      fontSize: 12.5,
      fontWeight: '400',
      color: t.muted,
      fontVariant: ['tabular-nums'],
    },
    footerBody: { marginTop: 2, fontSize: 11, color: t.muted },
    footerCta: {
      height: 32,
      paddingHorizontal: gap.md,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
    },
    footerCtaLabel: { fontSize: 11.5, color: t.ink },
  });
}
