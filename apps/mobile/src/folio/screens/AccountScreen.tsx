// AccountScreen — the faithful 1:1 React Native port of the web account surface
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenAccount.tsx).
//
// @rn-screen    AccountScreen
// @rn-stack     MainTabs > More > Account
// @purpose      A calm read of who you are to Folio — current tier (Free / Full / trial; the
//               Free/Full/Live restructure, MONEY_MODEL.md §2b), connected money sources, your
//               footprint, and the quiet levers (sign in, restore purchase, manage plan, export,
//               wipe).
// @reads        fullUnlocked / trialCycleId / trialDaysLeft (via useLens()),
//               subs.length, pots.length, cycles.length, onboarding.monthlyIncome/payday,
//               melo.quietMode
// @writes       — none directly. "Wipe this device" routes to the gated Privacy reset (see
//               FIDELITY DECISIONS); export routes through the real export engine (via Privacy).
// @copy         FROZEN — ported verbatim from the web literals (no COPY_DECK entry exists yet for
//               this screen, so the web JSX strings are the frozen source, same convention
//               MeloScreen/MoreScreen use for their own inline literals).
// @tokens       canvas · surface · hairline · muted · calm (accent) · calmSoft · inset · ink ·
//               positive · repairInk — all from the kit, no new token.
// @motion       slide-in-r on mount · press 0.97 on every row/button.
//
// FIDELITY DECISIONS (each grounded in the SPEC + confirmed kit/store source):
//   • Lens tier: `@/folio/lib/lens`'s `useLens()` is a REAL engine (`fullUnlocked` derives from
//     the store's legacy plus/pro flag pair; `setLensFullUnlocked` is the mutator). Tier renders
//     as Full / trial / Free with matching hint copy and CTA ("See plans" / "Manage plan"), and
//     the trial days-left chip uses the real `trialDaysLeft` from `useLens()`. This diverges
//     deliberately from the web's Free/Plus/Pro — the RN paywall is pricing source of truth now.
//   • Quiet mode: `melo?.quietMode` is a REAL store field now (added alongside this round — see
//     MeloScreen.tsx / store.ts `MeloState`). The "Melo & quiet mode" row hint reads it live, exactly
//     like the web ("quiet mode on — Melo won't chime in" vs "how Melo speaks, and when").
//   • Bank connection / sign-in: the web's `toast(...)` calls (sonner) are replaced with
//     `Alert.alert`, the established RN convention across this codebase (SubscriptionsScreen /
//     MeloChatSheet / PrivacyScreen) — RN has no sonner equivalent.
//   • Export: the web built a client-side Blob + `<a download>` (browser-only API, does not exist in
//     RN). This port routes "Export your data" through the REAL export engine already wired on
//     Privacy (`runExport()` from '@/folio/lib/exportNative') via `nav.go('privacy')`, so tapping it
//     lands the user on the surface that performs the actual, working export rather than reimplementing
//     a second export entry point or faking a browser download that cannot exist on-device.
//   • Wipe this device: the web wipes directly behind a two-step sonner toast (arm -> confirm), which
//     is a BYPASS of this app's D3 tier-3 wipe policy (exportedAck -> typedConfirm -> finalConfirm,
//     the same "no fake undo after a confirmed wipe" rule PrivacyScreen enforces, and the same reason
//     MoreScreen's own "Start fresh" row was changed to ROUTE to Privacy rather than wipe from the
//     hub). This port does not add a second, weaker wipe path — "Wipe this device" routes to the
//     Privacy screen's gated reset instead of calling resetAll()/resetToEmpty() directly.
//   • Three-tier-at-a-glance grid + "Sources" tappable rows + "Your footprint" stats are ported
//     1:1 — they read only real store data (subs/pots/cycles/onboarding) and navigate honestly
//     (intake for statements, the onboarding sheet for payday/income, a plain "coming with the mobile
//     app" note for bank connection since there is no bank-link engine anywhere in this codebase).
//   • Accent word "plan": web `<em class="not-italic text-accent">plan</em>`. RN has no inline `<em>`,
//     so the headline is three Text runs and the accent run is a nested UPRIGHT terracotta span (the
//     StartScreen / MeloScreen / MoreScreen pattern — same Fraunces face, colour-only override).
//   • slide-in-r: translateX 28->0 + fade over 360ms ease-out-expo, gated to final state under
//     reduce-motion (MoreScreen / MeloScreen precedent).
//   • STATES: the SPEC-equivalent for this screen is populated-only (offline = populated; no async
//     dependency). All five branches are rendered for completeness, mirroring MoreScreen/MeloScreen.
//
// HONEST CLAIMS: this screen asserts no privacy/security property beyond what Privacy/export actually
// do. No banned product vocabulary appears in any visible string. Every row is a >=44px tap target.

import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccessibilityInfo } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAuth, useUser } from '@clerk/clerk-expo';

import { Surface, Hairline, gap, radius, serif, useTheme } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { copy } from '@/folio/copy/copy';
import { addAccount, useAppStore, type AccountKind } from '@/folio/store';
import { useLens } from '@/folio/lib/lens';
import { hasStatementSourceData } from '@/folio/lib/accountSources';
import { selectMonthlyIncome } from '@/folio/lib/income';
import { isClerkConfigured } from '@/folio/lib/clerkAuth';
import { SignInSheet } from '@/folio/sheets/SignInSheet';
import type { Nav } from '@/folio/types';

// The render states this screen can occupy. Populated-only per the SPEC convention (offline is
// identical to populated — local-first, no network dependency); loading/empty/error are n/a but are
// rendered for completeness so every branch is exercised (mirrors MoreScreen / MeloScreen).
export type AccountScreenState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type AccountScreenProps = {
  nav: Nav;
  state?: AccountScreenState;
};

// Shared ease-out-expo — the web's cubic-bezier(.16, 1, .3, 1).
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// slide-in-r geometry (from the SPEC @motion convention): the whole screen enters from +28px on X.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;

// Local reduce-motion read, mirroring MoreScreen / MeloScreen exactly.
function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduce(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}

// Honest balance-source caption (ENGINES.md §6) — matches TodayStabilityScreen/TodayScreen's own
// map so the same balance reads the same everywhere.
const BALANCE_SOURCE_LABEL: Record<string, string> = {
  'user-entered': 'you set this',
  statement: 'from your last statement',
  'pdf-derived': 'from a statement you added',
  'ocr-derived': 'from a photo you added',
  corrected: 'you corrected this',
  sample: 'sample data',
};

// Cadence display labels for the detected income source.
const CADENCE_LABEL: Record<string, string> = {
  monthly: 'monthly',
  weekly: 'weekly',
  fortnightly: 'fortnightly',
  'four-weekly': 'every 4 weeks',
  'last-working-day': 'last working day of the month',
};

const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  bank: 'Current',
  savings: 'Savings',
  cash: 'Cash',
  'credit-card': 'Credit card',
};

// The three doors at a glance — Free/Full/Live (MONEY_MODEL.md §2b). Prices are the paywall's
// numbers, owner-confirmed 2026-07-11.
const TIERS: readonly {
  key: 'free' | 'full' | 'live';
  name: string;
  price: string;
  priceSuffix: string;
  hint: string;
}[] = [
  { key: 'free', name: 'Free', price: '£0', priceSuffix: '', hint: 'Six lenses · safety layer' },
  {
    key: 'full',
    name: 'Melo Full',
    price: '£29.99',
    priceSuffix: 'one-time',
    hint: 'Every lens · yours for good',
  },
  {
    key: 'live',
    name: 'Melo Live',
    price: '£2.99',
    priceSuffix: '/mo',
    hint: 'Unlimited AI reads · sync',
  },
];

export function AccountScreen({ nav, state = 'populated' }: AccountScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  const subsCount = useAppStore((s) => s.subs.length);
  const potsCount = useAppStore((s) => s.pots.length);
  const cyclesCount = useAppStore((s) => s.cycles.length);
  const transactionsCount = useAppStore((s) => s.transactions.length);
  const statementImportsCount = useAppStore((s) => s.statementImports?.length ?? 0);
  const onboarding = useAppStore((s) => s.onboarding);
  const currentBalance = useAppStore((s) => s.currentBalance);
  // Keep the external-store selector referentially stable. Filtering inside the selector creates a
  // new array on every snapshot read, which React correctly treats as an endless update loop.
  const allAccounts = useAppStore((s) => s.accounts);
  const accounts = useMemo(
    () => (allAccounts ?? []).filter((account) => !account.closed),
    [allAccounts],
  );
  const incomeSources = useAppStore((s) => s.incomeSources);
  const monthlyIncome = useAppStore((s) => selectMonthlyIncome(s));
  const quietMode = useAppStore((s) => s.melo?.quietMode ?? false);

  // The detected income's label + cadence — from the first declared source when the user has one
  // (the honest, named figure), falling back to the generic "Income" / "monthly" shape for the
  // legacy onboarding-lump or history-derived-median cases where there's no named source to show.
  const primaryIncomeSource = incomeSources?.[0];
  const incomeLabel = primaryIncomeSource?.label || 'Income';
  const incomeCadenceLabel = primaryIncomeSource
    ? CADENCE_LABEL[primaryIncomeSource.cadence]
    : 'monthly';

  const balanceSourceLabel =
    !onboarding.done &&
    currentBalance.amount === 0 &&
    transactionsCount === 0 &&
    statementImportsCount === 0
      ? 'not set yet'
      : (BALANCE_SOURCE_LABEL[currentBalance.source] ?? 'sample data');

  // Sign-in is entirely optional (see clerkAuth.ts). Evaluated once per render, not via a hook, so
  // this branch stays safe whether or not a ClerkProvider ancestor exists — Clerk's own hooks only
  // ever run inside ClerkSignInRow, which only mounts when this is true (and therefore only when
  // the root layout actually wrapped the tree in ClerkProvider).
  const clerkConfigured = isClerkConfigured();
  const [signInVisible, setSignInVisible] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountKind, setNewAccountKind] = useState<AccountKind>('bank');
  const [newAccountBalance, setNewAccountBalance] = useState('');

  const saveAccount = () => {
    const name = newAccountName.trim();
    if (!name) return;
    const parsed = Number(newAccountBalance.replace(/[^0-9.]/g, ''));
    addAccount({
      name,
      kind: newAccountKind,
      balanceMinor: Number.isFinite(parsed) ? parsed : 0,
    });
    setNewAccountName('');
    setNewAccountBalance('');
    setNewAccountKind('bank');
    setAddingAccount(false);
  };

  // Tier — the real lens engine, Free/Full/Live vocabulary. (Live ownership lives in the billing
  // entitlement record, not the lens store — this card reads lens state only, so a Live-only
  // subscriber shows Free here until the paywall's fuller read is lifted; acceptable while Live
  // cannot be purchased at all.)
  const { fullUnlocked, trialCycleId, trialDaysLeft } = useLens();
  const tier: 'full' | 'trial' | 'free' = fullUnlocked ? 'full' : trialCycleId ? 'trial' : 'free';
  const tierLabel =
    tier === 'full' ? 'Melo Full' : tier === 'trial' ? 'All lenses · trial' : 'Free';
  const tierHint =
    tier === 'full'
      ? 'Every lens, one payment — nothing renews.'
      : tier === 'trial'
        ? 'Trying every Full lens for one cycle.'
        : 'Six lenses and the safety layer, always yours.';

  // slide-in-r — drives the whole screen.
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    enter.value = withTiming(1, { duration: SLIDE_MS, easing: EASE_OUT_EXPO });
  }, [enter, reduceMotion]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateX: (1 - enter.value) * SLIDE_FROM_X }],
  }));

  // Sources — honest rows. Statements are reachable (real intake flow); bank connection is a plain
  // "coming with the mobile app" note (no bank-link engine anywhere in this codebase); payday/income
  // opens the real onboarding sheet.
  const sources = useMemo(
    () => [
      {
        label: 'Statements & receipts',
        hint: 'PDF · image · paste · CSV',
        state: hasStatementSourceData(statementImportsCount, transactionsCount)
          ? ('manual' as const)
          : ('empty' as const),
        action: () => nav.go('intake'),
      },
      {
        label: 'Bank connection',
        hint: 'not available yet',
        state: 'empty' as const,
        action: () =>
          Alert.alert(
            'Bank connection is not available yet',
            'Statements, photos and manual entries work now.',
            [{ text: 'OK', style: 'cancel' }],
            { cancelable: true },
          ),
      },
      {
        label: 'Payday & income',
        hint:
          monthlyIncome > 0
            ? `${incomeLabel} · £${Math.round(monthlyIncome).toLocaleString()} ${incomeCadenceLabel}`
            : 'not set yet — tap to add',
        state: monthlyIncome > 0 ? ('manual' as const) : ('empty' as const),
        action: () => nav.openSheet('onboarding'),
      },
    ],
    [statementImportsCount, transactionsCount, monthlyIncome, incomeLabel, incomeCadenceLabel, nav],
  );

  // Export — routes to Privacy, which owns the real export engine (runExport). Avoids a second,
  // weaker export entry point (see FIDELITY DECISIONS).
  const handleExport = () => nav.go('privacy');

  // Wipe — routes to Privacy's gated D3 reset instead of wiping directly from here (see FIDELITY
  // DECISIONS; mirrors MoreScreen's own "Start fresh" -> Privacy routing).
  const handleWipe = () => nav.go('privacy');

  // empty / error — the calm EmptyState doorway (n/a in practice; rendered for completeness).
  if (state === 'empty' || state === 'error') {
    const headline = state === 'error' ? copy.err.generic : 'Your plan, plainly.';
    const body = state === 'error' ? undefined : 'Who you are to Melo — back in a moment.';
    return (
      <EmptyState
        mood="calm"
        headline={headline}
        body={body}
        cta={{ label: 'Back', onPress: () => nav.back() }}
      />
    );
  }

  // loading — Melo curious + a line, never a spinner (STATES.md convention).
  if (state === 'loading') {
    return (
      <View
        style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.huge }]}
      >
        <MeloLine mood="curious" text="One moment — pulling up your account." />
      </View>
    );
  }

  // populated / offline — the real account read. offline = populated (local-first).
  return (
    <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.xxl },
        ]}
      >
        {/* Header — back glyph · "Account" eyebrow · spacer. */}
        <View style={styles.header}>
          <Pressable
            accessibilityHint="Goes back."
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={16}
            onPress={() => nav.back()}
            style={({ pressed: isPressed }) => [isPressed ? styles.pressed : undefined]}
          >
            <Text style={[styles.backGlyph, { color: t.muted }]}>←</Text>
          </Pressable>
          <Text style={[styles.eyebrow, { color: t.muted }]}>Account</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Title block. */}
        <View style={styles.titleBlock}>
          <Text style={[styles.kicker, { color: t.muted }]}>You + Melo</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {'Your '}
            <Text style={[styles.headlineAccent, { color: t.calm }]}>money</Text>
            {', plainly.'}
          </Text>
        </View>

        {/* Balance — the real, honest current-balance read (ENGINES.md §6): every balance shows where
            it came from, so this screen is never blank after a statement import. */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.ink }]}>Your balance</Text>
          <Surface style={[styles.card, styles.balanceCard, { borderColor: t.hairline }]}>
            <Text style={[styles.balanceValue, { color: t.ink }]}>
              £{Math.round(currentBalance.amount).toLocaleString('en-GB')}
            </Text>
            <Text style={[styles.balanceHint, { color: t.muted }]}>{balanceSourceLabel}</Text>
          </Surface>
        </View>

        {/* Real account model — bank, savings, cash and credit-card balances already exist in the
            store and statement import can target them. Surface the model here instead of reducing
            "Account" to billing and sign-in. */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: t.ink }]}>Accounts</Text>
            <Text style={[styles.sectionHint, { color: t.muted }]}>
              {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
            </Text>
          </View>
          <Surface style={[styles.card, { borderColor: t.hairline }]}>
            {accounts.map((account, index) => (
              <View key={account.id}>
                {index > 0 ? <Hairline /> : null}
                <View
                  accessibilityLabel={`${account.name}, ${ACCOUNT_KIND_LABEL[account.kind]}, ${account.isLiability ? 'owed' : 'balance'} £${Math.abs(account.balanceMinor).toFixed(2)}`}
                  style={styles.accountRow}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, { color: t.ink }]}>{account.name}</Text>
                    <Text style={[styles.rowHint, { color: t.muted }]}>
                      {ACCOUNT_KIND_LABEL[account.kind]}
                    </Text>
                  </View>
                  <View style={styles.accountAmountWrap}>
                    <Text
                      style={[
                        styles.accountAmount,
                        { color: account.isLiability ? t.repairInk : t.ink },
                      ]}
                    >
                      £
                      {Math.abs(account.balanceMinor).toLocaleString('en-GB', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </Text>
                    <Text style={[styles.accountAmountHint, { color: t.muted }]}>
                      {account.isLiability ? 'owed' : 'balance'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
            {accounts.length > 0 ? <Hairline /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: addingAccount }}
              onPress={() => setAddingAccount((open) => !open)}
              style={({ pressed: isPressed }) => [
                styles.addAccountToggle,
                isPressed ? styles.rowPressed : undefined,
              ]}
            >
              <Text style={[styles.addAccountToggleLabel, { color: t.calm }]}>
                + Add an account
              </Text>
            </Pressable>
          </Surface>

          {addingAccount ? (
            <Surface style={[styles.addAccountCard, { borderColor: t.hairline }]}>
              <Text style={[styles.addAccountTitle, { color: t.ink }]}>Name this account</Text>
              <TextInput
                accessibilityLabel="Account name"
                autoCapitalize="words"
                onChangeText={setNewAccountName}
                placeholder="e.g. Monzo current"
                placeholderTextColor={t.muted}
                style={[styles.addAccountInput, { backgroundColor: t.inset, color: t.ink }]}
                value={newAccountName}
              />
              <View style={styles.accountKindRow}>
                {(Object.keys(ACCOUNT_KIND_LABEL) as AccountKind[]).map((kind) => {
                  const selected = kind === newAccountKind;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={kind}
                      onPress={() => setNewAccountKind(kind)}
                      style={({ pressed: isPressed }) => [
                        styles.accountKindChip,
                        { backgroundColor: selected ? t.ink : t.inset },
                        isPressed ? styles.pressed : undefined,
                      ]}
                    >
                      <Text
                        style={[styles.accountKindLabel, { color: selected ? t.canvas : t.muted }]}
                      >
                        {ACCOUNT_KIND_LABEL[kind]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={[styles.addAccountBalanceRow, { backgroundColor: t.inset }]}>
                <Text style={[styles.addAccountCurrency, { color: t.ink }]}>£</Text>
                <TextInput
                  accessibilityLabel={
                    newAccountKind === 'credit-card' ? 'Amount owed' : 'Opening balance'
                  }
                  keyboardType="decimal-pad"
                  onChangeText={setNewAccountBalance}
                  placeholder="0.00"
                  placeholderTextColor={t.muted}
                  style={[styles.addAccountBalanceInput, { color: t.ink }]}
                  value={newAccountBalance}
                />
                <Text style={[styles.addAccountBalanceHint, { color: t.muted }]}>
                  {newAccountKind === 'credit-card' ? 'owed' : 'opening balance'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: newAccountName.trim().length === 0 }}
                disabled={newAccountName.trim().length === 0}
                onPress={saveAccount}
                style={({ pressed: isPressed }) => [
                  styles.addAccountSave,
                  {
                    backgroundColor: t.calm,
                    opacity: newAccountName.trim().length === 0 ? 0.45 : 1,
                  },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.addAccountSaveLabel, { color: t.inverse }]}>Add account</Text>
              </Pressable>
            </Surface>
          ) : null}
        </View>

        {/* Sources. */}
        <View style={styles.section}>
          <View style={[styles.sectionHeaderRow, styles.sourcesHeaderRow]}>
            <Text style={[styles.sectionTitle, { color: t.ink }]}>Where your money comes from</Text>
            <Text style={[styles.sectionHint, { color: t.muted }]}>set by you · imported</Text>
          </View>
          <Surface style={[styles.card, { borderColor: t.hairline }]}>
            {sources.map((s, index) => (
              <View key={s.label}>
                {index > 0 ? <Hairline /> : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={s.action}
                  style={({ pressed: isPressed }) => [
                    styles.row,
                    isPressed ? styles.rowPressed : undefined,
                  ]}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, { color: t.ink }]}>{s.label}</Text>
                    <Text style={[styles.rowHint, { color: t.muted }]}>{s.hint}</Text>
                  </View>
                  <View style={[styles.rowStateChip, { backgroundColor: t.inset }]}>
                    <Text style={[styles.rowStateLabel, { color: t.muted }]}>
                      {s.state === 'manual' ? 'added by you' : 'not yet'}
                    </Text>
                  </View>
                  <Text style={[styles.chevron, { color: t.muted }]}>→</Text>
                </Pressable>
              </View>
            ))}
          </Surface>
        </View>

        {/* Your footprint. */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.ink }]}>Your footprint</Text>
          <View style={styles.statsGrid}>
            <Stat n={transactionsCount} label="transactions" />
            {/* Honest label — imports can be pdf/photo/paste/csv, not only "statements" in the
                narrow sense (task: coherence-fix stopgap ahead of the full accounts model). */}
            <Stat n={statementImportsCount} label="statements" />
            <Stat n={subsCount} label="subs" />
            <Stat n={potsCount} label="pots" />
            <Stat n={cyclesCount} label="cycles" />
          </View>
        </View>

        {/* Plan and billing follow the user's actual money, accounts, sources, and footprint. Account
            is an operational money surface first; it should not open as a three-card sales page. */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.ink }]}>Your Melo plan</Text>
          <Surface style={[styles.tierCard, styles.tierCardInSection, { borderColor: t.hairline }]}>
            <View style={styles.tierTopRow}>
              <Text style={[styles.tierEyebrow, { color: t.muted }]}>Tier</Text>
              <View style={[styles.tierPill, { backgroundColor: t.inset }]}>
                <Text style={[styles.tierPillLabel, { color: t.muted }]}>{tierLabel}</Text>
              </View>
            </View>
            <Text style={[styles.tierHint, { color: t.ink }]}>{tierHint}</Text>
            {tier === 'trial' && trialDaysLeft != null ? (
              <Text style={[styles.tierTrialChip, { color: t.muted }]}>
                <Text style={{ color: t.calm }}>{trialDaysLeft}</Text>
                {trialDaysLeft === 1
                  ? " day left · we'll ask when it ends"
                  : " days left · we'll ask when it ends"}
              </Text>
            ) : null}
            <View style={styles.tierActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => nav.go('paywall')}
                style={({ pressed: isPressed }) => [
                  styles.tierCta,
                  { backgroundColor: t.calm },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.tierCtaLabel, { color: t.inverse }]}>
                  {tier === 'free' ? 'See plans' : 'Manage plan'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => nav.go('paywall')}
                style={({ pressed: isPressed }) => [
                  styles.tierRestore,
                  { borderColor: t.hairline },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.tierRestoreLabel, { color: t.muted }]}>Restore</Text>
              </Pressable>
            </View>
          </Surface>

          <View style={styles.tiersGrid}>
            {TIERS.map((p) => {
              const isCurrent =
                p.key === 'full' ? tier === 'full' || tier === 'trial' : p.key === tier;
              const priceAria =
                p.key === 'full'
                  ? `${p.price} one-time`
                  : p.key === 'live'
                    ? `${p.price} per month`
                    : p.price;
              return (
                <Pressable
                  accessibilityLabel={`${p.name} — ${priceAria}. Tap for details.`}
                  accessibilityRole="button"
                  key={p.key}
                  onPress={() => nav.go('paywall')}
                  style={({ pressed: isPressed }) => [
                    styles.tierGridCard,
                    {
                      backgroundColor: isCurrent ? t.calmSoft : t.surface,
                      borderColor: t.hairline,
                    },
                    isPressed ? styles.pressed : undefined,
                  ]}
                >
                  <Text style={[styles.tierGridName, { color: t.ink }]}>{p.name}</Text>
                  <Text style={[styles.tierGridPrice, { color: t.ink }]}>
                    {p.price}
                    {p.priceSuffix ? (
                      <Text style={[styles.tierGridHint, { color: t.muted }]}>
                        {' '}
                        {p.priceSuffix}
                      </Text>
                    ) : null}
                  </Text>
                  <Text style={[styles.tierGridHint, { color: t.muted }]}>{p.hint}</Text>
                  {isCurrent ? (
                    <Text style={[styles.tierGridCurrent, { color: t.calm }]}>Current</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Levers. */}
        <Surface style={[styles.card, styles.leversCard, { borderColor: t.hairline }]}>
          <AccountRow
            label="Melo & quiet mode"
            hint={quietMode ? "quiet mode on — Melo won't chime in" : 'how Melo speaks, and when'}
            onPress={() => nav.go('melo')}
          />
          <Hairline />
          <AccountRow
            label="Payday & income"
            hint={
              monthlyIncome > 0
                ? `${incomeLabel} · £${Math.round(monthlyIncome).toLocaleString()} ${incomeCadenceLabel}`
                : 'not set yet'
            }
            onPress={() => nav.openSheet('onboarding')}
          />
          <Hairline />
          <AccountRow
            label="Data & privacy"
            hint="what's saved, what stays local"
            onPress={() => nav.go('privacy')}
          />
          <Hairline />
          <AccountRow
            label="Export your data"
            hint="a complete copy of everything on this device"
            onPress={handleExport}
          />
          <Hairline />
          {clerkConfigured ? (
            <ClerkSignInRow onPressSignIn={() => setSignInVisible(true)} />
          ) : (
            <AccountRow label="Sign in" hint="save across devices — coming soon" muted />
          )}
        </Surface>

        <Surface style={[styles.card, styles.wipeCard, { borderColor: t.hairline }]}>
          <AccountRow
            label="Wipe this device"
            hint="subs, pots, cycles, prefs — gone. can't undo"
            onPress={handleWipe}
            tone="negative"
          />
        </Surface>

        <View style={styles.closing}>
          <MeloLine text="Nothing here is guessed. You'll only see what you added or what Melo read from a statement." />
        </View>

        <Text style={[styles.footer, { color: t.muted }]}>{copy.global.app.name} · Android</Text>
      </ScrollView>
      {clerkConfigured ? (
        <SignInSheet visible={signInVisible} onClose={() => setSignInVisible(false)} />
      ) : null}
    </Animated.View>
  );
}

// Rendered ONLY when isClerkConfigured() is true (see AccountScreen body above), so a real
// ClerkProvider ancestor is guaranteed here and these hooks never run unprovided. Shows the
// signed-in email + sign-out once a session exists; otherwise the tappable "Sign in" row.
function ClerkSignInRow({ onPressSignIn }: { onPressSignIn: () => void }) {
  const { isSignedIn, user } = useUser();
  const { signOut } = useAuth();

  if (isSignedIn) {
    const email = user?.primaryEmailAddress?.emailAddress ?? 'Signed in';
    return (
      <AccountRow
        label="Sign out"
        hint={email}
        onPress={() =>
          Alert.alert('Sign out?', "You'll still keep everything on this device.", [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
          ])
        }
      />
    );
  }

  return <AccountRow label="Sign in" hint="save across devices" onPress={onPressSignIn} />;
}

function Stat({ n, label }: { n: number; label: string }) {
  const t = useTheme();
  return (
    <Surface style={[styles.statCard, { borderColor: t.hairline }]}>
      <Text style={[styles.statNumber, { color: t.ink }]}>{n}</Text>
      <Text style={[styles.statLabel, { color: t.muted }]}>{label}</Text>
    </Surface>
  );
}

function AccountRow({
  label,
  hint,
  onPress,
  muted,
  tone,
}: {
  label: string;
  hint: string;
  onPress?: () => void;
  muted?: boolean;
  tone?: 'negative';
}) {
  const t = useTheme();
  const labelColor = tone === 'negative' ? t.repairInk : t.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!muted }}
      disabled={!!muted}
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        styles.row,
        muted ? styles.rowMuted : undefined,
        isPressed && !muted ? styles.rowPressed : undefined,
      ]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: labelColor }]}>{label}</Text>
        <Text style={[styles.rowHint, { color: t.muted }]}>{hint}</Text>
      </View>
      {!muted ? <Text style={[styles.chevron, { color: t.muted }]}>→</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  content: {
    paddingHorizontal: gap.xl,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backGlyph: {
    fontSize: 20,
    lineHeight: 24,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  headerSpacer: {
    width: 20,
  },
  titleBlock: {
    marginTop: gap.xl,
  },
  kicker: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
  },
  headline: {
    fontFamily: serif.display,
    fontSize: 26,
    letterSpacing: -0.2,
    lineHeight: 30,
    marginTop: gap.xs,
  },
  headlineAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  tierCard: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.xl,
    padding: gap.lg,
  },
  tierCardInSection: {
    marginTop: gap.md,
  },
  tierTopRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tierEyebrow: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  tierPill: {
    borderRadius: radius.sm,
    paddingHorizontal: gap.sm,
    paddingVertical: 2,
  },
  tierPillLabel: {
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  tierHint: {
    fontFamily: serif.display,
    fontSize: 20,
    lineHeight: 24,
    marginTop: gap.sm,
  },
  tierTrialChip: {
    fontFamily: serif.displayItalic,
    fontSize: 11.5,
    fontStyle: 'italic',
    marginTop: gap.xs + gap.xxs,
  },
  tierActions: {
    columnGap: gap.sm,
    flexDirection: 'row',
    marginTop: gap.md,
  },
  tierCta: {
    alignItems: 'center',
    borderRadius: radius.lg,
    flex: 1,
    paddingVertical: gap.md,
  },
  tierCtaLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  tierRestore: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    paddingHorizontal: gap.lg,
  },
  tierRestoreLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  tiersGrid: {
    columnGap: gap.sm,
    flexDirection: 'row',
    marginTop: gap.md,
  },
  tierGridCard: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    padding: gap.sm + gap.xxs,
  },
  tierGridName: {
    fontFamily: serif.display,
    fontSize: 14,
    lineHeight: 17,
  },
  tierGridPrice: {
    fontFamily: serif.display,
    fontSize: 18,
    lineHeight: 20,
    marginTop: gap.xs,
  },
  tierGridHint: {
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: gap.xs + gap.xxs,
  },
  tierGridCurrent: {
    fontSize: 9,
    letterSpacing: 1.4,
    marginTop: gap.xs + gap.xxs,
    textTransform: 'uppercase',
  },
  section: {
    marginTop: gap.xl,
  },
  sectionHeaderRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sourcesHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: gap.xxs,
  },
  sectionTitle: {
    fontFamily: serif.displayItalic,
    fontSize: 15,
  },
  sectionHint: {
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.md,
    overflow: 'hidden',
  },
  leversCard: {
    marginTop: gap.xl,
  },
  balanceCard: {
    alignItems: 'flex-start',
    padding: gap.lg,
  },
  balanceValue: {
    fontFamily: serif.display,
    fontSize: 28,
    fontVariant: ['tabular-nums'],
  },
  balanceHint: {
    fontFamily: serif.displayItalic,
    fontSize: 11.5,
    marginTop: gap.xs,
  },
  accountRow: {
    alignItems: 'center',
    columnGap: gap.md,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  accountAmountWrap: {
    alignItems: 'flex-end',
  },
  accountAmount: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  accountAmountHint: {
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  addAccountToggle: {
    alignItems: 'center',
    minHeight: 50,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  addAccountToggleLabel: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  addAccountCard: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.md,
    padding: gap.lg,
  },
  addAccountTitle: {
    fontFamily: serif.display,
    fontSize: 18,
  },
  addAccountInput: {
    borderRadius: radius.md,
    fontSize: 15,
    marginTop: gap.md,
    minHeight: 50,
    paddingHorizontal: gap.md,
  },
  accountKindRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: gap.sm,
    marginTop: gap.md,
  },
  accountKindChip: {
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: gap.md,
  },
  accountKindLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  addAccountBalanceRow: {
    alignItems: 'center',
    borderRadius: radius.md,
    flexDirection: 'row',
    marginTop: gap.md,
    minHeight: 50,
    paddingHorizontal: gap.md,
  },
  addAccountCurrency: {
    fontSize: 15,
  },
  addAccountBalanceInput: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: gap.xs,
  },
  addAccountBalanceHint: {
    fontSize: 10,
    textTransform: 'uppercase',
  },
  addAccountSave: {
    alignItems: 'center',
    borderRadius: radius.lg,
    justifyContent: 'center',
    marginTop: gap.md,
    minHeight: 50,
  },
  addAccountSaveLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  wipeCard: {
    marginTop: gap.md,
  },
  row: {
    alignItems: 'center',
    columnGap: gap.md,
    flexDirection: 'row',
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md + gap.xxs,
  },
  rowMuted: {
    opacity: 0.55,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  rowHint: {
    fontFamily: serif.displayItalic,
    fontSize: 11,
    marginTop: 2,
  },
  rowStateChip: {
    borderRadius: radius.sm,
    paddingHorizontal: gap.xs + gap.xxs,
    paddingVertical: 2,
  },
  rowStateLabel: {
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  chevron: {
    fontSize: 15,
  },
  statsGrid: {
    columnGap: gap.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: gap.md,
    rowGap: gap.sm,
  },
  statCard: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    width: '31%',
    paddingVertical: gap.md,
  },
  statNumber: {
    fontFamily: serif.display,
    fontSize: 22,
    lineHeight: 24,
  },
  statLabel: {
    fontSize: 10.5,
    letterSpacing: 1.4,
    marginTop: gap.xs + gap.xxs,
    textTransform: 'uppercase',
  },
  closing: {
    marginTop: gap.xl,
  },
  footer: {
    fontFamily: serif.displayItalic,
    fontSize: 10.5,
    marginBottom: gap.xxl,
    marginTop: gap.xl,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
});
