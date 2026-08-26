/**
 * Canonical Money Sources registry, ported from pinned ScreenConnections.
 *
 * Source availability and surface existence are intentionally separate: the
 * registry remains navigable when Open Banking is disabled, and disabled
 * providers explain their state without making a request or pretending that a
 * connection exists.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isClerkConfigured } from '@/folio/lib/clerkAuth';
import { isOpenBankingEnabled } from '@/folio/lib/openBankingConfig';
import { BankConnectionSheet, type BankSourceSummary } from '@/folio/sheets/BankConnectionSheet';
import { SignInSheet } from '@/folio/sheets/SignInSheet';
import { gap, radius, serif, useTheme } from '@/folio/theme';
import { ScreenHeader } from '@/folio/ui/ScreenHeader';
import { showStatusDialog } from '@/folio/ui/statusDialogs';
import type { Nav } from '@/folio/types';

type ProviderRow = Readonly<{
  id: 'manual' | 'open-banking' | 'apple-wallet' | 'google-wallet';
  label: string;
  meta: string;
  value: string;
  onPress: () => void;
}>;

export function ConnectionsScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const clerkConfigured = isClerkConfigured();
  const openBankingEnabled = isOpenBankingEnabled();
  const [bankConnectionVisible, setBankConnectionVisible] = useState(false);
  const [signInVisible, setSignInVisible] = useState(false);
  const [bankSummary, setBankSummary] = useState<BankSourceSummary | null>(null);

  const openBanking = () => {
    if (!openBankingEnabled) {
      showStatusDialog('dialog.account-bank-unavailable');
      return;
    }
    if (!clerkConfigured) {
      showStatusDialog('dialog.account-bank-unconfigured');
      return;
    }
    setBankConnectionVisible(true);
  };

  const available: ProviderRow[] = [
    {
      id: 'manual',
      label: 'Files and manual evidence',
      meta: 'PDF, photo, CSV, paste or numbers you type',
      value: 'available',
      onPress: () => nav.go('intake'),
    },
  ];
  if (bankSummary?.active) {
    available.push({
      id: 'open-banking',
      label: 'Open Banking',
      meta: 'read-only UK current-account feed',
      value: 'connected',
      onPress: openBanking,
    });
  }

  const unavailable: ProviderRow[] = [
    ...(bankSummary?.active
      ? []
      : [
          {
            id: 'open-banking' as const,
            label: 'Open Banking',
            meta: 'read-only UK current-account feed',
            value: openBankingEnabled ? 'setup required' : 'not available',
            onPress: openBanking,
          },
        ]),
    {
      id: 'apple-wallet',
      label: 'Apple Wallet',
      meta: 'eligible Apple Pay purchase evidence',
      value: 'not available',
      onPress: () => showStatusDialog('dialog.account-bank-unavailable'),
    },
    {
      id: 'google-wallet',
      label: 'Google Wallet',
      meta: 'eligible Google Pay purchase evidence',
      value: 'not available',
      onPress: () => showStatusDialog('dialog.account-bank-unavailable'),
    },
  ];

  return (
    <View style={[styles.root, { backgroundColor: t.canvas }]}>
      <ScrollView
        accessibilityLabel="Money sources"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.sm, paddingBottom: insets.bottom + gap.xxl },
        ]}
      >
        <ScreenHeader onBack={nav.back} eyebrow="Data & security · Sources" spacerWidth={44} />

        <View style={styles.lead}>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {'Choose what Melo can '}
            <Text style={[styles.accent, { color: t.calm }]}>read</Text>
            {'.'}
          </Text>
          <Text style={[styles.narrative, { color: t.muted }]}>
            This page manages sources you already use — what each one shares, when it last
            refreshed, and how to stop it.
          </Text>
        </View>

        <SourceSection eyebrow="In use" title="What Melo can read today" rows={available} />
        <Pressable
          accessibilityRole="button"
          onPress={() => nav.go('intake')}
          style={({ pressed }) => [styles.intakeLink, pressed ? styles.pressed : undefined]}
        >
          <Text style={[styles.intakeLinkText, { color: t.calm }]}>Let Melo understand my money</Text>
        </Pressable>

        <View style={styles.section}>
          <Text style={[styles.eyebrow, { color: t.muted }]}>Provider connections</Text>
          <Text style={[styles.sectionTitle, { color: t.ink }]}>Not connected in this build</Text>
          <View style={[styles.note, { borderColor: t.hairline, backgroundColor: t.inset }]}>
            <Text style={[styles.noteLabel, { color: t.ink }]}>Why they are off</Text>
            <Text style={[styles.noteBody, { color: t.muted }]}>
              A connection can only be switched on once the app can show the provider, what it
              reads, when it last refreshed, when consent expires and how to revoke it.
            </Text>
          </View>
          <SourceList rows={unavailable} />
        </View>

        <Text style={[styles.footer, { color: t.muted }]}>
          When a provider is available, this page is where you reconnect, refresh consent, see what
          it can read and stop it. No hidden connection states.
        </Text>
      </ScrollView>

      {clerkConfigured && openBankingEnabled ? (
        <BankConnectionSheet
          visible={bankConnectionVisible}
          onClose={() => setBankConnectionVisible(false)}
          onRequestSignIn={() => setSignInVisible(true)}
          onReview={() => nav.go('review')}
          onStatusChange={setBankSummary}
        />
      ) : null}
      {clerkConfigured ? (
        <SignInSheet visible={signInVisible} onClose={() => setSignInVisible(false)} />
      ) : null}
    </View>
  );
}

function SourceSection({
  eyebrow,
  title,
  rows,
}: {
  eyebrow: string;
  title: string;
  rows: readonly ProviderRow[];
}) {
  const t = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.eyebrow, { color: t.muted }]}>{eyebrow}</Text>
      <Text style={[styles.sectionTitle, { color: t.ink }]}>{title}</Text>
      <SourceList rows={rows} />
    </View>
  );
}

function SourceList({ rows }: { rows: readonly ProviderRow[] }) {
  const t = useTheme();
  return (
    <View style={[styles.list, { backgroundColor: t.surface, borderColor: t.hairline }]}>
      {rows.map((row, index) => (
        <View key={row.id}>
          {index > 0 ? <View style={[styles.divider, { backgroundColor: t.hairline }]} /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${row.label}. ${row.meta}. ${row.value}`}
            onPress={row.onPress}
            style={({ pressed }) => [styles.row, pressed ? styles.pressed : undefined]}
          >
            <View style={styles.rowCopy}>
              <Text style={[styles.rowLabel, { color: t.ink }]}>{row.label}</Text>
              <Text style={[styles.rowMeta, { color: t.muted }]}>{row.meta}</Text>
            </View>
            <Text style={[styles.rowValue, { color: row.value === 'connected' ? t.calm : t.muted }]}>
              {row.value}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gap.xl },
  lead: { marginTop: gap.lg },
  headline: { fontFamily: serif.display, fontSize: 30, lineHeight: 35 },
  accent: { fontFamily: serif.display, fontStyle: 'normal' },
  narrative: { fontSize: 13.5, lineHeight: 20, marginTop: gap.md },
  section: { marginTop: gap.xxl },
  eyebrow: { fontSize: 10.5, letterSpacing: 1.45, textTransform: 'uppercase' },
  sectionTitle: { fontFamily: serif.display, fontSize: 20, lineHeight: 25, marginTop: gap.xs },
  list: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.md,
    overflow: 'hidden',
  },
  row: { alignItems: 'center', flexDirection: 'row', minHeight: 68, padding: gap.lg },
  rowCopy: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 14, fontWeight: '500' },
  rowMeta: { fontSize: 11.5, lineHeight: 16, marginTop: gap.xxs },
  rowValue: { fontSize: 10, letterSpacing: 0.45, marginLeft: gap.md, textTransform: 'uppercase' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: gap.lg },
  intakeLink: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 },
  intakeLinkText: { fontSize: 12.5, textDecorationLine: 'underline' },
  note: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.md,
    padding: gap.lg,
  },
  noteLabel: { fontSize: 12.5, fontWeight: '600' },
  noteBody: { fontSize: 11.5, lineHeight: 17, marginTop: gap.xs },
  footer: { fontSize: 11.5, lineHeight: 17, marginTop: gap.xl },
  pressed: { opacity: 0.65, transform: [{ scale: 0.99 }] },
});
