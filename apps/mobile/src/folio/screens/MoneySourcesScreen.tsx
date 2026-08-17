import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useUser } from '@clerk/clerk-expo';
import type { OpenBankingRuntimeConnection } from '@folio/open-banking';

import { gap, radius, serif, Surface, useTheme } from '@/folio/theme';
import { BankConnectionSheet } from '@/folio/sheets/BankConnectionSheet';
import { isClerkConfigured } from '@/folio/lib/clerkAuth';
import { fetchOpenBankingConnections } from '@/folio/lib/openBankingNative';
import {
  bankSourceHealth,
  importSourceSummary,
  type BankSourceState,
} from '@/folio/lib/accountSources';
import { displayCurrency, isLaunchCurrency } from '@/folio/lib/launchCurrency';
import { useAppStore, type Account, type IncomeSource } from '@/folio/store';
import type { Nav } from '@/folio/types';

type Props = Readonly<{ nav: Nav }>;

const ACCOUNT_KIND: Readonly<Record<Account['kind'], string>> = {
  bank: 'Current account',
  savings: 'Savings',
  cash: 'Cash',
  'credit-card': 'Credit card',
};

const CADENCE: Readonly<Record<IncomeSource['cadence'], string>> = {
  monthly: 'monthly',
  weekly: 'weekly',
  fortnightly: 'every 2 weeks',
  'four-weekly': 'every 4 weeks',
  'last-working-day': 'last working day',
};

export function MoneySourcesScreen({ nav }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const accounts = useAppStore((state) => state.accounts ?? []);
  const imports = useAppStore((state) => state.statementImports ?? []);
  const evidence = useAppStore((state) => state.evidenceDocuments ?? []);
  const income = useAppStore((state) => state.incomeSources ?? []);
  const workspace = useAppStore(
    (state) => state.workspaces.find((item) => item.id === state.activeWorkspaceId)!,
  );
  const imported = useMemo(
    () => importSourceSummary(imports, evidence.length),
    [evidence.length, imports],
  );

  return (
    <View style={[styles.root, { backgroundColor: t.canvas }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + gap.xxl,
          paddingHorizontal: gap.lg,
          paddingTop: insets.top + gap.lg,
        }}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityHint="Returns to Account."
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={16}
            onPress={nav.back}
            style={({ pressed }) => (pressed ? styles.pressed : undefined)}
          >
            <Text style={[styles.back, { color: t.muted }]}>←</Text>
          </Pressable>
          <Text style={[styles.eyebrow, { color: t.muted }]}>Money Sources</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
          Every number starts somewhere.
        </Text>
        <Text style={[styles.intro, { color: t.muted }]}>
          See what you entered, what came from a file and what a connected service can check.
          Nothing joins your money picture before you accept it.
        </Text>

        <SectionTitle title="Your accounts" detail={`${accounts.length} recorded`} />
        <Surface style={[styles.card, { borderColor: t.hairline }]}>
          {accounts.length === 0 ? (
            <EmptyLine text="No accounts recorded yet." />
          ) : (
            accounts.map((account, index) => (
              <SourceRow
                key={account.id}
                divided={index > 0}
                title={account.name}
                detail={`${ACCOUNT_KIND[account.kind]} · ${accountState(account)}`}
                value={formatAccountBalance(account)}
                tone={account.closed || account.excludedFromTotals ? 'muted' : 'normal'}
              />
            ))
          )}
          <ActionRow label="Manage accounts" onPress={() => nav.go('account')} />
        </Surface>

        <SectionTitle title="Files and records" detail={`${imported.rowCount} rows accepted`} />
        <Surface style={[styles.card, { borderColor: t.hairline }]}>
          <SourceRow
            title="Statements & receipts"
            detail={
              imported.importCount === 0
                ? 'PDF · photo · paste · CSV'
                : `${imported.importCount} ${imported.importCount === 1 ? 'import' : 'imports'} · last added ${formatWhen(imported.latestAt)}`
            }
            value={imported.importCount === 0 ? 'not yet' : 'local'}
          />
          <SourceRow
            divided
            title="Saved source evidence"
            detail="Encrypted originals retained in this workspace"
            value={`${imported.retainedEvidenceCount} saved`}
          />
          <ActionRow label="Add records" onPress={() => nav.go('intake')} />
        </Surface>

        <SectionTitle title="Income rhythm" detail={`${income.length} recorded`} />
        <Surface style={[styles.card, { borderColor: t.hairline }]}>
          {income.length === 0 ? (
            <EmptyLine text="No income source recorded yet." />
          ) : (
            income.map((source, index) => (
              <SourceRow
                key={source.id}
                divided={index > 0}
                title={source.label}
                detail={`${CADENCE[source.cadence]} · ${source.source === 'inferred' ? 'suggested from records' : 'added by you'}`}
                value={`£${source.amount.toLocaleString('en-GB')}`}
              />
            ))
          )}
          <ActionRow label="Edit income sources" onPress={() => nav.go('account')} />
        </Surface>

        <SectionTitle title="Connected services" detail="optional" />
        {isClerkConfigured() ? (
          <ConnectedBankSources nav={nav} />
        ) : (
          <Surface style={[styles.card, { borderColor: t.hairline }]}>
            <SourceRow
              title="Bank connection"
              detail="This build has no account service configured. Manual entry and file import still work."
              value="unavailable"
              tone="muted"
            />
          </Surface>
        )}

        <Surface style={[styles.truthCard, { backgroundColor: t.inset, borderColor: t.hairline }]}>
          <Text style={[styles.truthTitle, { color: t.ink }]}>How Melo uses sources</Text>
          <Text style={[styles.truthBody, { color: t.muted }]}>
            Files and bank checks create Review items first. Manual corrections remain visible in
            history, and an older provider update cannot silently overwrite a newer correction.
            Sources stay isolated to {workspace.name}.
          </Text>
        </Surface>
      </ScrollView>
    </View>
  );
}

function ConnectedBankSources({ nav }: Props) {
  const t = useTheme();
  const { isSignedIn } = useUser();
  const { getToken } = useAuth();
  const workspaceId = useAppStore((state) => state.activeWorkspaceId);
  const [connections, setConnections] = useState<readonly OpenBankingRuntimeConnection[]>([]);
  const [providerConfigured, setProviderConfigured] = useState<boolean | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isSignedIn) {
      setState('ready');
      setConnections([]);
      setProviderConfigured(null);
      return;
    }
    let active = true;
    setState('loading');
    setError(null);
    void getToken()
      .then((token) => {
        if (!token) throw new Error('Sign in again to check bank sources.');
        return fetchOpenBankingConnections(token, workspaceId);
      })
      .then((result) => {
        if (!active) return;
        setProviderConfigured(result.providerConfigured);
        setConnections(result.connections);
        setState('ready');
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : 'Bank sources could not be checked.');
        setState('error');
      });
    return () => {
      active = false;
    };
  }, [getToken, isSignedIn, refreshKey, workspaceId]);

  const liveConnections = connections.filter((item) => item.status !== 'disconnected');

  return (
    <>
      <Surface style={[styles.card, { borderColor: t.hairline }]}>
        {!isSignedIn ? (
          <SourceRow
            title="Bank connection"
            detail="Sign in only if you want optional read-only bank checks. Local sources keep working without it."
            value="sign in first"
            tone="muted"
          />
        ) : state === 'loading' ? (
          <SourceRow
            title="Bank connection"
            detail="Checking the current source state…"
            value="checking"
          />
        ) : state === 'error' ? (
          <SourceRow
            title="Bank connection"
            detail={error ?? 'Could not check this source.'}
            value="unavailable"
            tone="muted"
          />
        ) : providerConfigured === false ? (
          <SourceRow
            title="Bank connection"
            detail="The protected adapter is present, but approved provider credentials are not configured."
            value="setup pending"
            tone="muted"
          />
        ) : liveConnections.length === 0 ? (
          <SourceRow
            title="Bank connection"
            detail="Optional and read-only · account details and transactions only"
            value="not connected"
          />
        ) : (
          liveConnections.map((connection, index) => (
            <BankConnectionRow connection={connection} divided={index > 0} key={connection.id} />
          ))
        )}
        <ActionRow
          label={liveConnections.length > 0 ? 'Manage bank connection' : 'About bank connection'}
          onPress={() => setSheetVisible(true)}
        />
      </Surface>
      <BankConnectionSheet
        visible={sheetVisible}
        onClose={() => {
          setSheetVisible(false);
          setRefreshKey((current) => current + 1);
        }}
        onRequestSignIn={() => nav.go('account')}
        onReview={() => nav.go('review')}
      />
    </>
  );
}

function BankConnectionRow({
  connection,
  divided,
}: Readonly<{ connection: OpenBankingRuntimeConnection; divided: boolean }>) {
  const health = bankSourceHealth(connection, new Date().toISOString());
  const detail = [
    health.summary,
    `scope: ${connection.scopes.join(' + ')}`,
    connection.lastSuccessfulRefreshAt
      ? `last check ${formatWhen(connection.lastSuccessfulRefreshAt)}`
      : null,
    connection.expiresAt ? `permission ends ${formatDate(connection.expiresAt)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <SourceRow
      divided={divided}
      title={connection.providerLabel}
      detail={detail}
      value={sourceStateLabel(health.state)}
      tone={health.needsAction ? 'muted' : 'normal'}
    />
  );
}

function SectionTitle({ title, detail }: Readonly<{ title: string; detail: string }>) {
  const t = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: t.ink }]}>{title}</Text>
      <Text style={[styles.sectionDetail, { color: t.muted }]}>{detail}</Text>
    </View>
  );
}

function SourceRow({
  title,
  detail,
  value,
  divided = false,
  tone = 'normal',
}: Readonly<{
  title: string;
  detail: string;
  value: string;
  divided?: boolean;
  tone?: 'normal' | 'muted';
}>) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.sourceRow,
        divided ? { borderTopColor: t.hairline, borderTopWidth: StyleSheet.hairlineWidth } : null,
      ]}
    >
      <View style={styles.sourceText}>
        <Text style={[styles.sourceTitle, { color: tone === 'muted' ? t.muted : t.ink }]}>
          {title}
        </Text>
        <Text style={[styles.sourceDetail, { color: t.muted }]}>{detail}</Text>
      </View>
      <Text style={[styles.sourceValue, { color: t.muted }]}>{value}</Text>
    </View>
  );
}

function ActionRow({ label, onPress }: Readonly<{ label: string; onPress: () => void }>) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        { borderTopColor: t.hairline },
        pressed ? styles.pressed : undefined,
      ]}
    >
      <Text style={[styles.actionLabel, { color: t.calmStrong }]}>{label}</Text>
      <Text style={[styles.actionArrow, { color: t.muted }]}>→</Text>
    </Pressable>
  );
}

function EmptyLine({ text }: Readonly<{ text: string }>) {
  const t = useTheme();
  return <Text style={[styles.emptyLine, { color: t.muted }]}>{text}</Text>;
}

function accountState(account: Account): string {
  if (account.closed) return 'closed · history kept';
  if (account.excludedFromTotals) return 'excluded from current totals';
  if (account.hidden) return 'hidden · still in totals';
  return `balance checked ${formatWhen(account.balanceAsOfISO)}`;
}

function formatAccountBalance(account: Account): string {
  const amount = Math.abs(account.balanceMinor).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const currency = isLaunchCurrency(account.currency)
    ? '£'
    : `${displayCurrency(account.currency)} `;
  return `${account.isLiability ? 'owes ' : ''}${currency}${amount}`;
}

function sourceStateLabel(state: BankSourceState): string {
  if (state === 'active') return 'connected';
  if (state === 'pending') return 'waiting';
  if (state === 'stale') return 'check now';
  if (state === 'reauth') return 'renew';
  if (state === 'error') return 'needs attention';
  return 'disconnected';
}

function formatWhen(value: string | null): string {
  if (value === null) return 'never';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return 'unknown';
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return 'at an unknown date';
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerSpacer: { width: 24 },
  back: { fontSize: 22, lineHeight: 28 },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  headline: { fontFamily: serif.display, fontSize: 34, lineHeight: 39, marginTop: gap.xl },
  intro: { fontFamily: serif.displayItalic, fontSize: 14, lineHeight: 21, marginTop: gap.sm },
  sectionHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: gap.sm,
    marginTop: gap.xl,
  },
  sectionTitle: { fontFamily: serif.display, fontSize: 18, lineHeight: 23 },
  sectionDetail: { fontSize: 11.5 },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  sourceRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: gap.md,
    minHeight: 66,
    paddingHorizontal: gap.md,
    paddingVertical: gap.md,
  },
  sourceText: { flex: 1 },
  sourceTitle: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  sourceDetail: { fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  sourceValue: { fontSize: 11.5, lineHeight: 18, maxWidth: 96, textAlign: 'right' },
  actionRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 50,
    paddingHorizontal: gap.md,
  },
  actionLabel: { fontSize: 13, fontWeight: '600' },
  actionArrow: { fontSize: 17 },
  emptyLine: { fontSize: 12.5, lineHeight: 18, padding: gap.md },
  truthCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.xl,
    padding: gap.md,
  },
  truthTitle: { fontFamily: serif.display, fontSize: 16, lineHeight: 21 },
  truthBody: { fontSize: 11.5, lineHeight: 17, marginTop: gap.xs },
  pressed: { opacity: 0.62 },
});
