// BulkStatementLanding — the shared bulk-landing surface for a multi-candidate read (task: BULK
// ADD-AS-HISTORY). Rendered by PdfSuccessScreen / ImageSuccessScreen / PasteSuccessScreen in place
// of their ordinary single-item preview whenever the reader/parse produced MORE THAN ONE candidate
// (a "statement"), per `isBulkStatement` (lib/bulkLanding.ts). Single-candidate reads are UNCHANGED
// — each screen's existing per-row `enqueueReviewItems` -> Review path still handles those.
//
// FLOW (owner spec, task: BULK ADD-AS-HISTORY; account step per ACCOUNTS_MODEL.md §3 step 1/5):
//   0. WHICH ACCOUNT — confirm-gated, shown before anything else. Detects a best-effort name/kind
//      from the candidates (`detectAccountName`, lib/detectAccountName.ts — honestly `null`/'bank'
//      today, since the reader carries no institution/header text yet; see that module's doc) and
//      offers: pick an existing `Account`, or name a new one with a bank/credit-card toggle,
//      defaulting to the detection. "Continue" resolves the accountId (creating the new account via
//      `addAccount` only on confirm, never speculatively) before the landing card below can render.
//      A blank new-account name falls through to `DEFAULT_ACCOUNT_ID` ('Main') rather than creating
//      an unnamed account — the no-choice-made path still lands in Main, per the owner spec.
//   1. BULK LANDING — a calm summary: 'Found {N} transactions · {from}–{to} · £{in} in / £{out}
//      out', a short preview list with money-in vs money-out unmistakably distinguished (the same
//      positiveInk/repairInk convention TodayScreen's "Coming in" / "Going out" uses — reused here,
//      never re-invented). PRIMARY CTA 'Add all as history' calls `addStatementAsHistory` with the
//      resolved accountId from step 0 and routes to Today (via the offer sequencer below). SECONDARY
//      'Review one by one' falls back to the screen's existing per-row enqueue-then-Review path —
//      nobody who wants line-by-line control loses it (that path does not carry the account choice
//      through — a P3 concern, see ACCOUNTS_MODEL.md).
//   2. POST-IMPORT OFFERS — after the add lands, `nextBulkLandingOffer` (lib/bulkLanding.ts) walks
//      the two named offers ONE AT A TIME, each with its own calm confirm card: closing balance
//      first ('Your balance looks like £X as of {date} — use it?' -> "Use it" calls
//      `setAccountBalance(offer.accountId, ...)`, the SAME account step 0 resolved and
//      `addStatementAsHistory` tagged the batch's transactions with — never the legacy global
//      `setCurrentBalance`, so a second account's import can never clobber a different account's
//      balance), then an unmatched income signal (routes to the existing self-deriving
//      IncomeCaughtSheet — it reads the live post-add ledger itself, so no candidate payload needs
//      threading through). Both are SKIPPABLE ("Not now") and NEITHER auto-applies —
//      review-before-truth extends past the add itself, matching the single-item Review card's own
//      confirm-before-truth contract.
//
// @tokens surface · hairline · calm (accent) · calmSoft · inset · muted · ink · inverse ·
//         positiveInk · repairInk — all from '@/folio/theme'. No new token, no new colour.
// @motion none of its own — mounts inside the success screens' existing slide-in-r frame.

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { gap, radius, serif, typeScale, useTheme } from '@/folio/theme';
import { copy } from '@/folio/copy/copy';
import { MeloLine } from '@/folio/melo/MeloLine';
import {
  bulkSummaryLine,
  closingBalanceOfferLine,
  nextBulkLandingOffer,
  type BulkLandingOffer,
} from '@/folio/lib/bulkLanding';
import { buildStatementSummary } from '@/folio/lib/statementSummary';
import { reconcileStatement, statementTotalsFrom } from '@/folio/lib/reconcileStatement';
import { detectAccountName } from '@/folio/lib/detectAccountName';
import { isAccountSelectable } from '@/folio/lib/accountPolicy';
import type { CandidateMoneyItem } from '@/folio/lib/importSheet';
import {
  addAccount,
  addStatementAsHistory,
  DEFAULT_ACCOUNT_ID,
  setAccountBalance,
  useAppStore,
  type Account,
  type AccountKind,
  type AddStatementAsHistoryResult,
  type ReaderClosingBalance,
} from '@/folio/store';
import type { Nav } from '@/folio/types';

export type BulkStatementLandingProps = {
  nav: Nav;
  /** The full candidate batch this statement read produced — rendered as the preview list AND, on
   *  "Add all as history", handed to `addStatementAsHistory` verbatim (this component makes the
   *  ONE money-path write; nothing lands before that tap). */
  candidates: readonly CandidateMoneyItem[];
  /** Passed straight through to `addStatementAsHistory` when the reader supplied a closing balance
   *  (see that function's doc) — omit when it didn't. Never fabricated by this component. Carries the
   *  optional reconciliation figures (opening balance + stated totals) too, verbatim. */
  closingBalance?: ReaderClosingBalance;
  /** Fires once "Add all as history" has actually landed the batch — the caller clears whatever
   *  staging slot it used (e.g. `clearReaderCandidates`), since that slot differs per reader path.
   *  Fired exactly once, before the post-import offers (if any) are shown. */
  onAdded: () => void;
  /** Fires when the user chooses "Review one by one", carrying the account they
   *  just confirmed so accepted rows cannot silently fall back to Main. */
  onReviewOneByOne: (accountId: string) => void;
};

// Format a signed GBP magnitude the way the rest of the success screens do: whole pounds grouped,
// pence only when the magnitude isn't whole, leading +/- glyph (matches formatSignedAmount in
// PdfSuccessScreen/ImageSuccessScreen — restated here rather than importing a screen-local helper).
function formatSignedAmount(amount: number): string {
  const magnitude = Math.abs(amount);
  const grouped = magnitude.toLocaleString('en-GB', {
    minimumFractionDigits: Number.isInteger(magnitude) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const sign = amount >= 0 ? '+' : '−';
  return `${sign}£${grouped}`;
}

// ACCOUNTS_MODEL.md §3 step 1/5 — sentinel value for "create a new account" in the picker below,
// distinct from any real `Account.id` (which are always `acct-...`).
const NEW_ACCOUNT_OPTION = '__new__';

export function BulkStatementLanding({
  nav,
  candidates,
  closingBalance,
  onAdded,
  onReviewOneByOne,
}: BulkStatementLandingProps) {
  const t = useTheme();

  // The bulk summary + offers — `null` until "Add all as history" is tapped (the ONE money-path
  // write on this component; nothing lands from a render alone).
  const [summary, setSummary] = useState<AddStatementAsHistoryResult | null>(null);
  // Which offers have already been resolved (confirmed OR skipped) this landing — drives
  // `nextBulkLandingOffer` to walk the sequence exactly once each, never re-showing one.
  const [shownOffers, setShownOffers] = useState<ReadonlySet<BulkLandingOffer>>(new Set());

  // ACCOUNTS_MODEL.md §3 step 1/5 — "Which account is this?" step, shown BEFORE the existing
  // summary/CTA card, confirm-gated (owner spec). `existingAccounts` reads live so a freshly-created
  // account from a PRIOR statement in the same session already appears in the picker.
  const existingAccounts = useAppStore((s) => (s.accounts ?? []).filter(isAccountSelectable));
  const detection = useMemo(() => detectAccountName(candidates), [candidates]);
  const [accountConfirmed, setAccountConfirmed] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string>(NEW_ACCOUNT_OPTION);
  const [newAccountName, setNewAccountName] = useState(detection.name ?? '');
  const [newAccountKind, setNewAccountKind] = useState<AccountKind>(detection.kind);
  // The resolved accountId this landing will pass to `addStatementAsHistory` — created lazily on
  // confirm (a new account is only ever created once the user actually commits to this step, never
  // speculatively on every render/keystroke).
  const [resolvedAccountId, setResolvedAccountId] = useState<string | null>(null);

  const currentOffer = summary !== null ? nextBulkLandingOffer(summary, shownOffers) : null;

  function resolveOffer(offer: BulkLandingOffer) {
    if (summary === null) return;
    const next = new Set(shownOffers);
    if (offer !== null) next.add(offer);
    setShownOffers(next);
    // Once the walk is exhausted, route onward — mirrors ReviewScreen.onAdd's own
    // "nothing left to offer -> go home" fallthrough.
    if (nextBulkLandingOffer(summary, next) === null) {
      nav.go('today');
    }
  }

  // Confirm the account step: either use the selected existing account, or create a new one from the
  // name/kind fields (defaulting to the detected name/kind when the user didn't change them). A blank
  // new-account name falls back to Main (DEFAULT_ACCOUNT_ID) rather than creating an unnamed account —
  // the default path (no account chosen) must still land in Main per the owner spec.
  function handleConfirmAccount() {
    if (selectedOption !== NEW_ACCOUNT_OPTION) {
      setResolvedAccountId(selectedOption);
      setAccountConfirmed(true);
      return;
    }
    const trimmedName = newAccountName.trim();
    if (trimmedName.length === 0) {
      const defaultAccount = existingAccounts.find((account) => account.id === DEFAULT_ACCOUNT_ID);
      const fallback =
        defaultAccount ?? existingAccounts[0] ?? addAccount({ name: 'Main', kind: 'bank' });
      setResolvedAccountId(fallback.id);
      setAccountConfirmed(true);
      return;
    }
    const account: Account = addAccount({ name: trimmedName, kind: newAccountKind });
    setResolvedAccountId(account.id);
    setAccountConfirmed(true);
  }

  function handleAddAll() {
    const accountId = resolvedAccountId ?? DEFAULT_ACCOUNT_ID;
    const result = addStatementAsHistory(candidates, closingBalance, accountId);
    setSummary(result);
    onAdded();
    // If neither offer exists, route straight to Today (or to the existing bill/drift/annual
    // caught-sheet chain, which `addStatementAsHistory` computes for parity but does not surface —
    // see that function's doc; only income + closing-balance are threaded through per the owner
    // spec's two named offers).
    if (nextBulkLandingOffer(result, new Set()) === null) {
      nav.go('today');
    }
  }

  // ACCOUNTS_MODEL.md §3 step 1/5 — the account-picker step, shown before anything else on a fresh
  // landing (never re-shown once confirmed, even if the component re-renders for other reasons).
  if (!accountConfirmed) {
    return (
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
        <Text style={[styles.offerHead, { color: t.ink }]}>Which account is this?</Text>
        {detection.name !== null ? (
          <Text style={[styles.accountHint, { color: t.muted }]}>
            {`Looks like ${detection.name}`}
          </Text>
        ) : null}

        {existingAccounts.length > 0 ? (
          <View style={styles.accountOptionList}>
            {existingAccounts.map((account) => {
              const selected = selectedOption === account.id;
              return (
                <Pressable
                  key={account.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={account.name}
                  onPress={() => setSelectedOption(account.id)}
                  style={({ pressed }) => [
                    styles.accountOption,
                    { backgroundColor: selected ? t.calmSoft : t.inset },
                    pressed ? styles.pressed : undefined,
                  ]}
                >
                  <Text style={[styles.accountOptionLabel, { color: t.ink }]}>{account.name}</Text>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: selectedOption === NEW_ACCOUNT_OPTION }}
              accessibilityLabel="A new account"
              onPress={() => setSelectedOption(NEW_ACCOUNT_OPTION)}
              style={({ pressed }) => [
                styles.accountOption,
                {
                  backgroundColor: selectedOption === NEW_ACCOUNT_OPTION ? t.calmSoft : t.inset,
                },
                pressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.accountOptionLabel, { color: t.ink }]}>+ New account</Text>
            </Pressable>
          </View>
        ) : null}

        {selectedOption === NEW_ACCOUNT_OPTION ? (
          <>
            <TextInput
              value={newAccountName}
              onChangeText={setNewAccountName}
              placeholder="Name this account"
              placeholderTextColor={t.muted}
              style={[
                styles.accountNameInput,
                { backgroundColor: t.inset, borderColor: t.hairline, color: t.ink },
              ]}
              accessibilityLabel="Account name"
            />
            <View style={styles.kindToggleRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: newAccountKind === 'bank' }}
                accessibilityLabel="Bank account"
                onPress={() => setNewAccountKind('bank')}
                style={({ pressed }) => [
                  styles.kindToggle,
                  { backgroundColor: newAccountKind === 'bank' ? t.calmSoft : t.inset },
                  pressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.kindToggleLabel, { color: t.ink }]}>Bank</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: newAccountKind === 'credit-card' }}
                accessibilityLabel="Credit card"
                onPress={() => setNewAccountKind('credit-card')}
                style={({ pressed }) => [
                  styles.kindToggle,
                  { backgroundColor: newAccountKind === 'credit-card' ? t.calmSoft : t.inset },
                  pressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.kindToggleLabel, { color: t.ink }]}>Credit card</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        <View style={styles.offerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirm account"
            onPress={handleConfirmAccount}
            style={({ pressed }) => [
              styles.offerPrimary,
              { backgroundColor: t.calm },
              pressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={[styles.offerPrimaryLabel, { color: t.accentInk }]}>Continue</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Post-import offer sequencer — replaces the landing card once the add has happened AND at
  // least one offer remains. Each offer is its own calm confirm, "Not now" always skips it.
  const closingBalanceOffer =
    currentOffer === 'closing-balance' ? (summary?.closingBalanceOffer ?? null) : null;
  if (closingBalanceOffer !== null) {
    const offer = closingBalanceOffer;
    return (
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
        <Text style={[styles.offerHead, { color: t.ink }]}>{closingBalanceOfferLine(offer)}</Text>
        {summary?.reconciliation?.status === 'mismatch' ? (
          <Text style={[styles.reconcileWarn, { color: t.repairInk }]}>
            {summary.reconciliation.message}
          </Text>
        ) : null}
        <View style={styles.offerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use this balance"
            onPress={() => {
              // ACCOUNTS_MODEL.md §3 step 4 — sets THIS offer's own account (`offer.accountId`,
              // stamped by `addStatementAsHistory` to match whichever account the batch's
              // transactions were tagged with), never the legacy global `currentBalance` scalar. A
              // second account's import can never clobber a different account's balance this way.
              // Falls back to DEFAULT_ACCOUNT_ID for a hand-built fixture offer predating this field
              // (see StatementClosingBalanceOffer's own back-compat doc).
              setAccountBalance(
                offer.accountId ?? DEFAULT_ACCOUNT_ID,
                offer.amountPence / 100,
                offer.asOfISO,
                // Provenance for the synced legacy scalar: this figure came off the statement,
                // so the balance-source caption must say so, not "corrected" or "user-entered".
                { source: 'statement', confidence: 'statement-derived' },
              );
              resolveOffer('closing-balance');
            }}
            style={({ pressed }) => [
              styles.offerPrimary,
              { backgroundColor: t.calm },
              pressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={[styles.offerPrimaryLabel, { color: t.accentInk }]}>Use it</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not now"
            onPress={() => resolveOffer('closing-balance')}
            style={({ pressed }) => [
              styles.offerSecondary,
              { borderColor: t.hairline },
              pressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={[styles.offerSecondaryLabel, { color: t.muted }]}>Not now</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const incomeOffer = currentOffer === 'income' ? (summary?.incomeSignal ?? null) : null;
  if (incomeOffer !== null) {
    const signal = incomeOffer;
    return (
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
        <Text style={[styles.offerHead, { color: t.ink }]}>
          {`Looks like ${signal.merchant} pays you — set as your pay?`}
        </Text>
        <View style={styles.offerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Check this income"
            onPress={() => {
              resolveOffer('income');
              nav.openSheet('income-caught');
            }}
            style={({ pressed }) => [
              styles.offerPrimary,
              { backgroundColor: t.calm },
              pressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={[styles.offerPrimaryLabel, { color: t.accentInk }]}>Check it</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not now"
            onPress={() => resolveOffer('income')}
            style={({ pressed }) => [
              styles.offerSecondary,
              { borderColor: t.hairline },
              pressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={[styles.offerSecondaryLabel, { color: t.muted }]}>Not now</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // The pre-add preview summary — the exact same pure math `addStatementAsHistory` runs
  // internally (`buildStatementSummary`), computed here just for the headline before any write
  // happens, so the pre-add and post-add headlines read byte-identical.
  const previewSummary: AddStatementAsHistoryResult = buildStatementSummary(candidates);

  // Reconciliation self-check for the PRE-add preview — proves (or honestly flags) that the extracted
  // rows add up to the statement's own balance/totals BEFORE the user commits (review-before-truth).
  // Same pure math `addStatementAsHistory` runs internally, so pre-add and post-add agree. Silent when
  // 'unverified' (the statement didn't print enough to check) — no noise, no false reassurance.
  const previewReconciliation = reconcileStatement(candidates, statementTotalsFrom(closingBalance));

  // The bulk landing card itself — summary line + preview list + the two CTAs. Hidden once
  // `summary` is set and there's nothing left to offer (nav.go('today') has already fired by then).
  return (
    <>
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
        <Text style={[styles.summary, { color: t.ink }]}>{bulkSummaryLine(previewSummary)}</Text>
        {previewReconciliation.status === 'ok' ? (
          <Text style={[styles.reconcileOk, { color: t.positiveInk }]}>
            ✓ {copy.add.statement.reconciled}
          </Text>
        ) : previewReconciliation.status === 'mismatch' ? (
          <Text style={[styles.reconcileWarn, { color: t.repairInk }]}>
            {previewReconciliation.message}
          </Text>
        ) : null}
        <View style={styles.list}>
          {candidates.slice(0, 6).map((row) => {
            const isIn = row.amount >= 0;
            return (
              <View key={row.id} style={styles.row}>
                <View style={[styles.dot, { backgroundColor: isIn ? t.positive : t.calm }]} />
                <Text numberOfLines={1} style={[styles.merchant, { color: t.ink }]}>
                  {row.merchant}
                </Text>
                <Text style={[styles.amount, { color: isIn ? t.positiveInk : t.repairInk }]}>
                  {formatSignedAmount(row.amount)}
                </Text>
              </View>
            );
          })}
          {candidates.length > 6 ? (
            <Text style={[styles.more, { color: t.muted }]}>
              {`+ ${candidates.length - 6} more`}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.meloBlock}>
        <MeloLine mood="calm" text="One tap adds it all. You can still check each one instead." />
      </View>

      <View style={styles.spacer} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add all as history"
        onPress={handleAddAll}
        style={({ pressed }) => [
          styles.primary,
          { backgroundColor: t.calm },
          pressed ? styles.pressed : undefined,
        ]}
      >
        <Text style={[styles.primaryLabel, { color: t.accentInk }]}>Add all as history</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Review one by one"
        onPress={() => onReviewOneByOne(resolvedAccountId ?? DEFAULT_ACCOUNT_ID)}
        style={({ pressed }) => [styles.secondary, pressed ? styles.pressed : undefined]}
      >
        <Text style={[styles.secondaryLabel, { color: t.muted }]}>Review one by one</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.xl,
    padding: gap.lg + gap.xs,
  },
  summary: {
    fontFamily: serif.display,
    fontSize: typeScale.title,
    lineHeight: 22,
  },
  reconcileOk: {
    fontSize: typeScale.bodySmall,
    lineHeight: 18,
    marginTop: gap.xs,
  },
  reconcileWarn: {
    fontSize: typeScale.bodySmall,
    lineHeight: 18,
    marginTop: gap.xs,
  },
  list: {
    marginTop: gap.lg,
    rowGap: gap.sm,
  },
  row: {
    alignItems: 'center',
    columnGap: gap.md,
    flexDirection: 'row',
  },
  dot: {
    borderRadius: radius.pill,
    height: 6,
    width: 6,
  },
  merchant: {
    flex: 1,
    fontSize: typeScale.bodySmall,
  },
  amount: {
    fontFamily: serif.display,
    fontSize: typeScale.bodySmall,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },
  more: {
    fontSize: typeScale.micro,
    marginTop: gap.xxs,
  },
  meloBlock: {
    marginTop: gap.lg + gap.xs,
  },
  spacer: {
    flex: 1,
  },
  primary: {
    alignItems: 'center',
    borderRadius: radius.xl,
    height: 58,
    justifyContent: 'center',
    marginTop: gap.lg,
  },
  primaryLabel: {
    fontSize: typeScale.body,
    fontWeight: '500',
  },
  secondary: {
    alignItems: 'center',
    borderRadius: radius.xl,
    height: 46,
    justifyContent: 'center',
    marginTop: gap.sm,
  },
  secondaryLabel: {
    fontSize: typeScale.bodySmall,
  },
  // Offer confirm card — head line + two-button row (primary confirm / quiet skip).
  offerHead: {
    fontFamily: serif.display,
    fontSize: typeScale.body,
    lineHeight: 21,
  },
  offerRow: {
    columnGap: gap.md,
    flexDirection: 'row',
    marginTop: gap.lg,
  },
  offerPrimary: {
    alignItems: 'center',
    borderRadius: radius.md,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  offerPrimaryLabel: {
    fontSize: typeScale.bodySmall,
    fontWeight: '600',
  },
  offerSecondary: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  offerSecondaryLabel: {
    fontSize: typeScale.bodySmall,
  },
  // Account-picker step (ACCOUNTS_MODEL.md §3 step 1/5) — detected-name hint + option list + new-
  // account name/kind fields, reusing the offer card's head/row/button styles above.
  accountHint: {
    fontSize: typeScale.caption,
    fontStyle: 'italic',
    marginTop: gap.xs,
  },
  accountOptionList: {
    marginTop: gap.md,
    rowGap: gap.sm,
  },
  accountOption: {
    borderRadius: radius.md,
    paddingHorizontal: gap.md,
    paddingVertical: gap.sm + gap.xxs,
  },
  accountOptionLabel: {
    fontSize: typeScale.bodySmall,
    fontWeight: '500',
  },
  accountNameInput: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: typeScale.bodySmall,
    height: 44,
    marginTop: gap.md,
    paddingHorizontal: gap.md,
  },
  kindToggleRow: {
    columnGap: gap.sm,
    flexDirection: 'row',
    marginTop: gap.sm,
  },
  kindToggle: {
    alignItems: 'center',
    borderRadius: radius.md,
    flex: 1,
    paddingVertical: gap.sm,
  },
  kindToggleLabel: {
    fontSize: typeScale.caption,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
});
